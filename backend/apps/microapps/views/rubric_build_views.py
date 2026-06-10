import os
import re
import tempfile
import logging as log
import json
from pathlib import Path
import environ
from apps.utils.usage_helper import get_user_ip
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.microapps.models import Microapp, MicroAppUserJoin, RubricBuild
from apps.microapps.document_parser import DocumentProcessor
from apps.microapps.dynamic_model_service import DynamicModelService
from apps.microapps.llm_interface import UnifiedLLMInterface
import concurrent.futures

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))

_FENCED_JSON_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _parse_rubric_from_ai_response(raw: str) -> list | None:
    """Parse a rubric JSON array from a model message (plain JSON or ```json fences)."""
    text = (raw or "").strip()
    if not text:
        return None

    candidates = [text]
    for match in _FENCED_JSON_RE.finditer(text):
        candidates.append(match.group(1).strip())

    bracket_start = text.find("[")
    if bracket_start != -1:
        candidates.append(text[bracket_start:])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

    if bracket_start != -1:
        try:
            parsed, _ = json.JSONDecoder().raw_decode(text[bracket_start:])
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

    return None


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

            if not app_hash_id:
                return Response(
                    {"error": "app_hash_id is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            microapp = Microapp.objects.filter(hash_id=app_hash_id, is_archived=False).first()
            if not microapp:
                return Response(
                    {"error": "Microapp not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            has_app_access = MicroAppUserJoin.objects.filter(
                ma_id=microapp,
                user_id=user,
                is_archived=False,
                role__in=[MicroAppUserJoin.OWNER, MicroAppUserJoin.ADMIN],
            ).exists()
            if not has_app_access:
                return Response(
                    {"error": "You don't have permission to build rubric for this app"},
                    status=status.HTTP_403_FORBIDDEN
                )

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

            model_name = env("DEFAULT_AI_MODEL")

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

            rubric = _parse_rubric_from_ai_response(ai_response)
            if rubric is None:
                log.error(
                    "Failed to parse rubric from AI response (first 500 chars): %s",
                    ai_response[:500],
                )
                return Response(
                    {"error": "Failed to parse rubric from AI response"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            rubric_str = json.dumps(rubric, ensure_ascii=False)
            credits_spent = response["data"]["credits"]

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