"""
Media processing views - File uploads, audio transcription, and text-to-speech.
"""
import os
import re
import tempfile
import logging as log
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.http import HttpResponse
import boto3
from botocore.config import Config
from django.conf import settings

from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.usage_helper import GuestUsage, get_user_ip
from apps.utils.global_variables import AIModelConstants
from apps.microapps.models import Microapp
from apps.microapps.document_parser import DocumentProcessor
from apps.microapps.serializer import ImageUploadSerializer, FileUploadSerializer, PresignedUrlResponse
from ..llm_interface import UnifiedLLMInterface
from .mixins import handle_exception, MicroAppMixin, FileProcessingMixin


class MicroAppImageUpload(APIView, MicroAppMixin):
    """Handle image uploads for microapps."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ImageUploadSerializer,
        responses={200: PresignedUrlResponse},
        summary="Upload image for microapp"
    )
    def post(self, request, pk=None):
        """Upload image for microapp."""
        # Validate microapp ID is provided
        if not pk:
            return Response(
                {"error": "Microapp ID is required", "status": status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if microapp exists
        microapp = self.get_microapp(pk)
        if not microapp:
            return Response(
                {"error": "Microapp not found", "status": status.HTTP_404_NOT_FOUND},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ImageUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        filename = serializer.validated_data['filename']
        content_type = serializer.validated_data['content_type']

        # Sanitize filename to remove any potentially problematic characters
        filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
        
        try:
            s3_client = boto3.client(
                's3',
                config=Config(signature_version='s3v4'),
                region_name=settings.AWS_S3_REGION_NAME,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )

            # Use the validated microapp ID in the file path
            file_key = f'microapps/{microapp.id}/images/{filename}'

            conditions = [
                {'bucket': settings.AWS_STORAGE_BUCKET_NAME},
                ['starts-with', '$key', f'microapps/{microapp.id}/images/'],
                {'Content-Type': content_type}
            ]

            response = s3_client.generate_presigned_post(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=file_key,
                Fields={
                    'Content-Type': content_type
                },
                Conditions=conditions,
                ExpiresIn=300
            )

            # Return the complete presigned POST response
            formatted_response = {
                'data': {
                    'url': response['url'],
                    'fields': {
                        **response['fields'],
                        'key': file_key,
                        'filename': filename
                    }
                }
            }

            return Response(formatted_response)
        except Exception as e:
            log.error(f"S3 presigned URL generation error: {str(e)}")
            return handle_exception(e)


class MicroAppFileUpload(APIView, MicroAppMixin, FileProcessingMixin):
    """Handle file uploads and processing for microapps."""
    permission_classes = [IsAuthenticated]

    def upload_to_s3(self, file_key, file_content, content_type):
        """Helper method to upload content to S3"""
        try:
            s3_client = boto3.client(
                's3',
                config=Config(signature_version='s3v4'),
                region_name=settings.AWS_S3_REGION_NAME,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )
            
            s3_client.put_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=file_key,
                Body=file_content,
                ContentType=content_type
            )
            return True
        except Exception as e:
            log.error(f"S3 upload error: {str(e)}")
            return False

    @extend_schema(
        request=FileUploadSerializer,
        responses={200: PresignedUrlResponse},
        summary="Upload file for microapp"
    )
    def post(self, request, pk=None):
        """Upload and process file for microapp."""
        if not pk:
            return Response({"error": "Microapp ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        microapp = self.get_microapp(pk)
        if not microapp:
            return Response({"error": "Microapp not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = FileUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        filename = self.sanitize_filename(serializer.validated_data['filename'])
        content_type = serializer.validated_data['content_type']
        
        # Define S3 keys for both files
        original_file_key = f'microapps/{microapp.id}/files/original/{filename}'
        base_name, ext = os.path.splitext(filename)
        text_file_key = f'microapps/{microapp.id}/files/text/{base_name}__{ext[1:]}.txt'

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create a temporary file and process it
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
                for chunk in uploaded_file.chunks():
                    temp_file.write(chunk)
                temp_file.flush()
                
                try:
                    # Extract text content
                    processor = DocumentProcessor()
                    parsed_content = processor.extract_text(temp_file.name)
                    
                    # Count words
                    word_count = self.count_words(parsed_content)

                    # Upload original file to S3
                    uploaded_file.seek(0)
                    original_upload_success = self.upload_to_s3(
                        original_file_key, 
                        uploaded_file.read(), 
                        content_type
                    )

                    # Upload extracted text to S3
                    text_upload_success = self.upload_to_s3(
                        text_file_key,
                        parsed_content.encode('utf-8'),
                        'text/plain'
                    )

                    if not (original_upload_success and text_upload_success):
                        return Response(
                            {"error": "Failed to upload files to S3"}, 
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )

                    # Only return a preview of the content
                    preview_length = 1000  # First 1000 characters
                    content_preview = parsed_content[:preview_length]
                    has_more = len(parsed_content) > preview_length

                    return Response({
                        'data': {
                            'original_file': original_file_key,
                            'text_file': text_file_key,
                            'content_preview': content_preview,
                            'has_more_content': has_more,
                            'word_count': word_count
                        }
                    }, status=status.HTTP_200_OK)

                finally:
                    # Clean up the temporary file
                    os.unlink(temp_file.name)

        except Exception as e:
            log.error(f"File processing error: {str(e)}")
            return handle_exception(e)


class AudioTranscription(APIView):
    """Handle audio transcription using Whisper."""
    permission_classes = [IsAuthenticated]

    def transcribe_audio_logic(self, audio_file, user_id=None, ip=None):
        """Shared transcription logic for both authenticated and anonymous users"""
        try:
            if not audio_file:
                return Response(
                    {"error": "No audio file provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Read the audio file content
            audio_content = audio_file.read()

            # Initialize the LLM interface with OpenAI configuration
            model_config = AIModelConstants.get_configs("gpt-4o-mini")  # Using OpenAI config for Whisper
            model = UnifiedLLMInterface(model_config)

            # Transcribe the audio
            result = model.transcribe_audio(audio_content)

            if not result["status"]:
                return Response(
                    {"error": result["message"]},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            return Response(result["data"], status=status.HTTP_200_OK)

        except Exception as e:
            log.error(f"Error in transcribe_audio_logic: {str(e)}")
            return handle_exception(e)

    @extend_schema(
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'audio': {
                        'type': 'string',
                        'format': 'binary',
                        'description': 'Audio file to transcribe'
                    }
                }
            }
        },
        responses={200: None},
        summary="Transcribe audio file using Whisper (authenticated)"
    )
    def post(self, request, format=None):
        """Transcribe audio file for authenticated users."""
        try:
            # For authenticated users, we can track usage by user ID
            audio_file = request.FILES.get('audio')
            return self.transcribe_audio_logic(
                audio_file=audio_file,
                user_id=request.user.id,
                ip=get_user_ip(request)
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    post=extend_schema(
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'audio': {
                        'type': 'string',
                        'format': 'binary',
                        'description': 'Audio file to transcribe'
                    }
                }
            }
        },
        responses={200: None},
        summary="Transcribe audio file using Whisper (anonymous)"
    )
)
class AnonymousAudioTranscription(AudioTranscription):
    """Handle anonymous audio transcription with rate limiting."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, format=None):
        """Transcribe audio file for anonymous users."""
        try:
            # For anonymous users, check IP-based rate limiting
            ip = get_user_ip(request)
            
            # Use the same guest usage check as AnonymousRunList
            if not GuestUsage.check_usage_limit(self, ip):
                return Response(
                    error.RUN_USAGE_LIMIT_EXCEED, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            audio_file = request.FILES.get('audio')
            return self.transcribe_audio_logic(
                audio_file=audio_file,
                user_id=None,  # No user ID for anonymous users
                ip=ip
            )
        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    post=extend_schema(
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'text': {'type': 'string', 'description': 'Text to convert to speech'},
                    'provider': {'type': 'string', 'description': 'TTS provider (e.g., openai, elevenlabs, hume)'},
                    'voice': {'type': 'string', 'description': 'Voice ID to use'},
                    'instructions': {'type': 'string', 'description': 'Optional voice instructions'}
                }
            }
        },
        responses={200: None},
        summary="Convert text to speech using specified provider"
    )
)
class TextToSpeech(APIView):
    """Handle text-to-speech conversion."""
    permission_classes = [IsAuthenticated]

    def post(self, request, format=None):
        """Convert text to speech for authenticated users."""
        try:
            text = request.data.get('text')
            provider = request.data.get('provider', 'openai')
            voice = request.data.get('voice', 'alloy')
            instructions = request.data.get('instructions')

            if not text:
                return Response(
                    {'error': 'Text is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Initialize LLM interface with appropriate model config
            # TODO: Remove this once we support more TTS providers
            model_name = "non-openai-tts-not-setup-yet" if provider != 'openai' else 'gpt-4o-mini-tts'
            model_config = AIModelConstants.get_configs(model_name)
            llm_interface = UnifiedLLMInterface(model_config)

            # Get audio data
            audio_data = llm_interface.text_to_speech(text, voice, instructions)

            # Return the audio data
            return HttpResponse(
                audio_data,
                content_type='audio/mpeg'
            )

        except Exception as e:
            log.error(f"Error in Text to Speech: {str(e)}")
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@extend_schema_view(
    post=extend_schema(
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'text': {'type': 'string', 'description': 'Text to convert to speech'},
                    'provider': {'type': 'string', 'description': 'TTS provider (e.g., openai, elevenlabs, hume)'},
                    'voice': {'type': 'string', 'description': 'Voice ID to use'},
                    'instructions': {'type': 'string', 'description': 'Optional voice instructions'}
                }
            }
        },
        responses={200: None},
        summary="Convert text to speech using specified provider (anonymous)"
    )
)
class AnonymousTextToSpeech(TextToSpeech):
    """Handle anonymous text-to-speech conversion with rate limiting."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, format=None):
        """Convert text to speech for anonymous users."""
        try:
            # For anonymous users, check IP-based rate limiting
            ip = get_user_ip(request)
            
            # Use the same guest usage check as AnonymousRunList
            if not GuestUsage.check_usage_limit(self, ip):
                return Response(
                    error.RUN_USAGE_LIMIT_EXCEED, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Call the parent class method
            return super().post(request, format)

        except Exception as e:
            return handle_exception(e)


@extend_schema_view(
    post=extend_schema(
        request=FileUploadSerializer,
        responses={200: dict},
        summary="Parse an uploaded file and return its plain-text content (max 20 000 chars)"
    )
)
class ParseFile(APIView, FileProcessingMixin):
    """Return raw text from an uploaded document without persisting it anywhere."""
    permission_classes = [IsAuthenticated]
    MAX_CHARS = 20_000

    def post(self, request, format=None):
        """Parse uploaded file and return text content."""
        # Validate basic fields using the existing serializer
        serializer = FileUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        filename = self.sanitize_filename(serializer.validated_data['filename'])

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Write the upload to a temp file so our DocumentProcessor can read it
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
                for chunk in uploaded_file.chunks():
                    temp_file.write(chunk)
                temp_file.flush()

                try:
                    processor = DocumentProcessor()
                    parsed_content = processor.extract_text(temp_file.name)

                    # Enforce 20 000-character cap
                    if len(parsed_content) > self.MAX_CHARS:
                        return Response(
                            {
                                "error": f"Parsed content exceeds {self.MAX_CHARS:,} character limit.",
                                "status": status.HTTP_400_BAD_REQUEST,
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    # Basic word count (re-using helper logic)
                    word_count = self.count_words(parsed_content)

                    return Response(
                        {
                            "data": {
                                "text": parsed_content,
                                "word_count": word_count,
                                "filename": filename,
                            }
                        },
                        status=status.HTTP_200_OK,
                    )

                finally:
                    # Always clean up the temp file
                    os.unlink(temp_file.name)

        except Exception as e:
            return handle_exception(e)
