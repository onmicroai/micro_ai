import os
import tempfile
import logging as log
import json
from apps.utils.usage_helper import get_user_ip
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.microapps.models import Microapp, RubricBuild
from apps.microapps.document_parser import DocumentProcessor
from apps.microapps.dynamic_model_service import DynamicModelService
from apps.microapps.llm_interface import UnifiedLLMInterface
import concurrent.futures

class RubricBuildView(APIView):
    """Generate rubric and log usage for microapp rubric build."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            files = request.FILES.getlist('files')
            prompt = request.data.get('prompt', '')
            app_hash_id = request.data.get('app_hash_id')
            user_ip = get_user_ip(request)
            user = request.user

            if not prompt and not files:
                return Response({"error": "Either prompt or files must be provided"}, status=status.HTTP_400_BAD_REQUEST)

            parsed_texts = []
            file_names = []
            document_processor = DocumentProcessor()
            def process_file(file):
                with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.name)[1]) as tmp_file:
                    for chunk in file.chunks():
                        tmp_file.write(chunk)
                    tmp_file_path = tmp_file.name
                try:
                    text = document_processor.extract_text(tmp_file_path)
                    if text.startswith("Error:"):
                        return {"error": f"File {file.name}: {text}"}
                    return f"--- File: {file.name} ---\n{text}"
                finally:
                    os.unlink(tmp_file_path)

            parsed_texts = []
            errors = []
            with concurrent.futures.ThreadPoolExecutor() as executor:
                results = list(executor.map(process_file, files))
                for result in results:
                    if isinstance(result, dict) and "error" in result:
                        errors.append(result["error"])
                    else:
                        parsed_texts.append(result)

            if errors:
                return Response({"error": "; ".join(errors)}, status=status.HTTP_400_BAD_REQUEST)

            combined_context = "\n\n".join(parsed_texts)
            system_message = """You are an expert at creating scoring rubrics. 
Generate a detailed rubric based on the provided context and instructions.
If the uploaded files contain rubric criteria, merge them with the user instructions and avoid duplicates.
Return ONLY valid JSON in this exact format:
[
  {
    "criteria": "Category Name",
    "lines": [
      {"score": 5, "description": "Excellent performance..."},
      {"score": 4, "description": "Good performance..."},
      {"score": 3, "description": "Satisfactory performance..."},
      {"score": 2, "description": "Needs improvement..."},
      {"score": 1, "description": "Poor performance..."},
      {"score": 0, "description": "No evidence..."}
    ]
  }
]
Important:
- Create multiple categories if needed
- Each category should have clear score levels (0-5 or 0-10)
- Descriptions should be specific and actionable
- Return ONLY the JSON array, no additional text"""

            user_message = f"""Context from uploaded files:
{combined_context}

User instructions:
{prompt}

Generate a comprehensive rubric based on this information."""

            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]

            model_name = 'gpt-4o-mini'

            model_config = DynamicModelService.get_model_config(model_name)
            llm = UnifiedLLMInterface(model_config)
            api_params = llm.get_default_params({
                "messages": messages,
                "model": model_name,
                "temperature": 0.3,
                "max_tokens": 4000
            })
            response = llm.get_response(api_params)
            if not response.get("status"):
                return Response({"error": "Failed to generate rubric"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            ai_response = response["data"]["ai_response"].strip()

            try:
               rubric = json.loads(ai_response)
               rubric_str = json.dumps(rubric, ensure_ascii=False)
            except Exception:
               return Response({"error": "Failed to parse rubric from AI response"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            credits_spent = response["data"]["credits"]

            microapp = Microapp.objects.filter(hash_id=app_hash_id).first()

            files_data = []
            for i, file in enumerate(files):
                files_data.append({
                    "name": file.name,
                    "text": parsed_texts[i] if i < len(parsed_texts) else ""
                })
            RubricBuild.objects.create(
                microapp=microapp,
                user=user,
                rubric_prompt=prompt,
                files=files_data,
                rubric=rubric_str,
                credits_spent=credits_spent,
                model_used=model_name,
                app_hash_id=app_hash_id,
                user_ip=user_ip,
            )

            return Response({
                "rubric": rubric,
                "credits_spent": credits_spent,
                "model": model_name
            }, status=status.HTTP_200_OK)
        except Exception as e:
            log.error(f"Error in rubric build: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)