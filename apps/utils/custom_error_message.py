from rest_framework import status

class ErrorMessages:
    MICROAPP_NOT_EXIST = {"error": "microapp not exist", "status": status.HTTP_400_BAD_REQUEST}
    USER_NOT_EXIST = {"error": "user not exist", "status": status.HTTP_400_BAD_REQUEST}
    COLLECTION_NOT_EXIST = {"error": "collection not exist", "status": status.HTTP_400_BAD_REQUEST}
    OPERATION_NOT_ALLOWED = {"error": "operation not allowed", "status": status.HTTP_403_FORBIDDEN}
    FIELD_MISSING = {"error": "invalid payload fields missing", "status": status.HTTP_400_BAD_REQUEST}
    SERVER_ERROR =  {"error": "an unexpected error occurred", "status": status.HTTP_500_INTERNAL_SERVER_ERROR},
    RUN_USAGE_LIMIT_EXCEED = {"error": "usage limit exceed", "status": status.HTTP_400_BAD_REQUEST}
    MICROAPP_USAGE_LIMIT_EXCEED = {"error": "cannot create more than 3 microapp on free plan, upgrade your plan to get access to unlimited microapps", "status": status.HTTP_400_BAD_REQUEST}
    INVALID_PAYLOAD = {"error": "invalid payload", "status": status.HTTP_400_BAD_REQUEST}
    UNSUPPORTED_AI_MODEL = "unsupported AI model"
    EMAIL_ALREADY_EXIST = 'email already exist'
    VALIDATION_ERROR = "An error occurred during validation"
    PROMPT_REQUIRED = {"error": "Prompt field required for this phase", "status": status.HTTP_400_BAD_REQUEST}
    COLLECTION_VIEW_FORBIDDEN = {"error": "You do not have permission to view this collection", "status": status.HTTP_403_FORBIDDEN } 
    
    @staticmethod
    def validation_error(errors):
        return {"error": errors, "status": status.HTTP_400_BAD_REQUEST}