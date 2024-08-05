from rest_framework import status

class ErrorMessages:
    MICROAPP_NOT_EXIST = {"error": "microapp not exist", "status": status.HTTP_400_BAD_REQUEST}
    USER_NOT_EXIST = {"error": "user not exist", "status": status.HTTP_400_BAD_REQUEST}
    COLLECTION_NOT_EXIST = {"error": "collection not exist", "status": status.HTTP_400_BAD_REQUEST}
    OPERATION_NOT_ALLOWED = {"error": "operation not allowed", "status": status.HTTP_403_FORBIDDEN}
    FIELD_MISSING = {"error": "invalid payload fields missing", "status": status.HTTP_400_BAD_REQUEST}
    SERVER_ERROR =  {"error": "an unexpected error occurred", "status": status.HTTP_500_INTERNAL_SERVER_ERROR},
    UNSUPPORTED_AI_MODEL = "Unsupported AI model"
    EMAIL_ALREADY_EXIST = 'email already exist'
    
    @staticmethod
    def validation_error(errors):
        return {"error": errors, "status": status.HTTP_400_BAD_REQUEST}