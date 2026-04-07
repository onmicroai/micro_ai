"""
Media processing views - File uploads, audio transcription, and text-to-speech.
"""
import base64
import os
import re
import tempfile
import threading
import logging as log
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema, extend_schema_view
import boto3
from botocore.config import Config
from django.conf import settings

from apps.utils.custom_error_message import ErrorMessages as error
from apps.utils.usage_helper import GuestUsage, get_user_ip
from apps.utils.global_variables import UsageVariables
from apps.microapps.dynamic_model_service import DynamicModelService
from apps.microapps.models import Microapp, DocumentChunk, FileSource, AppFileReference, Run, MicroAppUserJoin
from apps.microapps.document_parser import DocumentProcessor
from apps.microapps.rag_service import (
    TextChunker, generate_embeddings_batch
)
from apps.microapps.serializer import ImageUploadSerializer, FileUploadSerializer, PresignedUrlResponse
from ..llm_interface import UnifiedLLMInterface
from .mixins import handle_exception, MicroAppMixin, FileProcessingMixin, UsageTrackingMixin


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

    def _process_file_background(self, file_source_id, temp_path):
        """
        Background thread: extract text -> chunk -> embed -> update FileSource status.
        Cleans up the temp file on completion or error.
        Chank is neede because embedding large documents in one go can exceed token limits
        """
        from django.db import connection as db_connection
        try:
            if not FileSource.objects.filter(id=file_source_id).exists():
                log.info(f"RAG: file_source={file_source_id} was deleted before processing completed, skipping")
                return
            file_source = FileSource.objects.get(id=file_source_id)

            # Extract text
            file_source.status = FileSource.PROCESSING
            file_source.save(update_fields=['status', 'updated_at'])

            processor = DocumentProcessor()
            parsed_content = processor.extract_text(temp_path)
            if not parsed_content or parsed_content.startswith("Error:") or parsed_content == "Unsupported file format":
                raise ValueError(parsed_content or "No text could be extracted from file")

            # Strip NUL bytes - PostgreSQL rejects \x00 in text columns
            parsed_content = parsed_content.replace('\x00', '')

            word_count = self.count_words(parsed_content)

            # Skip if chunks already exist (re-upload of same file)
            if DocumentChunk.objects.filter(file_source=file_source).exists():
                log.info(f"RAG: chunks already exist for {file_source.file_name}, skipping embed")
                file_source.status = FileSource.READY
                file_source.word_count = word_count
                file_source.chunk_count = DocumentChunk.objects.filter(file_source=file_source).count()
                file_source.save(update_fields=['status', 'word_count', 'chunk_count', 'updated_at'])
                return

            # Chunk
            chunks = TextChunker().chunk_text(parsed_content)
            if not chunks:
                raise ValueError("File produced no text chunks after parsing")

            # Embed 
            embeddings = generate_embeddings_batch(chunks)

            # Check again - file may have been deleted during embedding API call
            if not FileSource.objects.filter(id=file_source_id).exists():
                log.info(f"RAG: file_source={file_source_id} was deleted during processing, discarding embeddings")
                return

            # Store
            DocumentChunk.objects.bulk_create([
                DocumentChunk(
                    file_source=file_source,
                    content=chunk_text,
                    embedding=emb,
                )
                for chunk_text, emb in zip(chunks, embeddings)
            ], batch_size=100)

            file_source.status = FileSource.READY
            file_source.word_count = word_count
            file_source.chunk_count = len(chunks)
            file_source.error = None
            file_source.save(update_fields=['status', 'word_count', 'chunk_count', 'error', 'updated_at'])
            log.info(f"RAG: {len(chunks)} chunks stored for {file_source.file_name} (source={file_source_id})")

        except Exception as e:
            log.error(f"Background processing failed for file_source={file_source_id}: {e}")
            try:
                FileSource.objects.filter(id=file_source_id).update(
                    status=FileSource.FAILED,
                    error=str(e),
                )
            except Exception:
                pass
        finally:
            db_connection.close()
            try:
                os.unlink(temp_path)
            except OSError:
                pass

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

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Write to temp file — path handed off to background thread for cleanup
            temp_file = tempfile.NamedTemporaryFile(
                delete=False, suffix=os.path.splitext(filename)[1]
            )
            for chunk in uploaded_file.chunks():
                temp_file.write(chunk)
            temp_file.flush()
            temp_file.close()
            temp_path = temp_file.name

            # Upsert FileSource: if this app already has a reference to a file with
            # this name, reset it; otherwise create a fresh FileSource + AppFileReference.
            existing_ref = AppFileReference.objects.filter(
                app=microapp,
                file_source__file_name=filename,
            ).select_related('file_source').first()

            if existing_ref:
                file_source = existing_ref.file_source
                DocumentChunk.objects.filter(file_source=file_source).delete()
                file_source.status = FileSource.PENDING
                file_source.error = None
                file_source.chunk_count = None
                file_source.word_count = None
                file_source.save()
            else:
                file_source = FileSource.objects.create(
                    file_name=filename,
                    status=FileSource.PENDING,
                    file_owner=microapp,
                )
                AppFileReference.objects.create(app=microapp, file_source=file_source)

            # Fire background thread - temp file cleanup is its responsibility
            thread = threading.Thread(
                target=self._process_file_background,
                args=(file_source.id, temp_path),
                daemon=True,
            )
            thread.start()

            return Response({
                'data': {
                    'original_filename': filename,
                    'status': FileSource.PENDING,
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            log.error(f"File upload error: {str(e)}")
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
            model_config = DynamicModelService.get_model_config("gpt-4o-mini")  # Using OpenAI config for Whisper
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
class TextToSpeech(APIView, UsageTrackingMixin):
    """Handle text-to-speech conversion."""
    permission_classes = [IsAuthenticated]

    def _charge_tts(self, run_id, text_length, consumer_id):
        """
        Calculate TTS cost, update the run record, and deduct owner credits.

        Returns (cost, credits) so the caller can include them in the response.
        """
        cost = round(text_length * UsageVariables.OPENAI_TTS_COST_PER_CHARACTER, 6)
        credits = max(int(cost * UsageVariables.CREDITS_MULTIPLIER), UsageVariables.MINIMUM_CREDITS)

        if not run_id:
            return cost, credits

        try:
            run = Run.objects.get(run_uuid=run_id)
        except Run.DoesNotExist:
            log.warning(f"TTS charge skipped — run not found: {run_id}")
            return cost, credits

        try:
            new_cost = round(float(run.cost or 0) + cost, 6)
            new_credits = (run.credits or 0) + credits
            Run.objects.filter(run_uuid=run_id).update(cost=new_cost, credits=new_credits)

            owner_join = MicroAppUserJoin.objects.get(ma_id=run.ma_id, role="owner")
            self.credits = credits
            self.update_user_credits(run.id, owner_join.user_id.id, consumer_id)

            # Return the new cumulative totals so the frontend store stays in sync
            return new_cost, new_credits
        except Exception as e:
            log.error(f"TTS credit deduction failed for run {run_id}: {e}")

        return cost, credits

    def post(self, request, format=None):
        """Convert text to speech and charge the app owner."""
        try:
            text = request.data.get('text')
            provider = request.data.get('provider', 'openai')
            voice = request.data.get('voice', 'alloy')
            instructions = request.data.get('instructions')
            run_id = request.data.get('run_id')

            if not text:
                return Response(
                    {'error': 'Text is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Initialize LLM interface with appropriate model config
            # TODO: Remove this once we support more TTS providers
            model_name = "non-openai-tts-not-setup-yet" if provider != 'openai' else 'gpt-4o-mini-tts'
            model_config = DynamicModelService.get_model_config(model_name)
            llm_interface = UnifiedLLMInterface(model_config)

            # Get audio data
            audio_data = llm_interface.text_to_speech(text, voice, instructions)

            # Return the audio data
            consumer_id = getattr(request.user, 'id', None)
            cost, credits = self._charge_tts(run_id, len(text), consumer_id)

            return Response({
                'audio_base64': base64.b64encode(audio_data).decode('utf-8'),
                'cost': cost,
                'credits': credits,
            })

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
class MicroAppFileDelete(APIView, MicroAppMixin):
    """Remove a file reference from an app. Deletes chunks only when no other app references the same FileSource."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk=None):
        if not pk:
            return Response({"error": "Microapp ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        microapp = self.get_microapp(pk)
        if not microapp:
            return Response({"error": "Microapp not found"}, status=status.HTTP_404_NOT_FOUND)

        filename = request.data.get("filename")
        if not filename:
            return Response({"error": "filename is required"}, status=status.HTTP_400_BAD_REQUEST)

        ref = AppFileReference.objects.filter(
            app=microapp,
            file_source__file_name=filename,
        ).select_related('file_source').first()

        if not ref:
            return Response({"error": "File not found for this app"}, status=status.HTTP_404_NOT_FOUND)

        file_source = ref.file_source
        ref.delete()

        # If no other app references this FileSource, delete it (cascades to DocumentChunk)
        remaining = AppFileReference.objects.filter(file_source=file_source).count()
        chunks_deleted = 0
        if remaining == 0:
            chunks_deleted = file_source.chunk_count or 0
            file_source.delete()
            log.info(f"Deleted FileSource + {chunks_deleted} chunks for {filename}")
        else:
            log.info(f"Removed reference for {filename} from app={microapp.id}, {remaining} app(s) still reference it")

        return Response({"deleted_chunks": chunks_deleted}, status=status.HTTP_200_OK)


class FileEmbeddingStatusView(APIView, MicroAppMixin):
    """GET /api/microapps/<pk>/file-status/ - returns embedding status for all files of a microapp."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk=None):
        if not pk:
            return Response({"error": "Microapp ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        microapp = self.get_microapp(pk)
        if not microapp:
            return Response({"error": "Microapp not found"}, status=status.HTTP_404_NOT_FOUND)

        sources = FileSource.objects.filter(app_references__app=microapp)
        return Response({
            s.file_name: {
                'status': s.status,
                'chunk_count': s.chunk_count,
                'word_count': s.word_count,
                'error': s.error,
            }
            for s in sources
        }, status=status.HTTP_200_OK)


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
