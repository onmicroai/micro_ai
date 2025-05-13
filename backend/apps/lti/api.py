from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import LTIConfig
from apps.microapps.models import Microapp

@api_view(['GET'])
def get_lti_config(request, microapp_id):
    try:
        config = LTIConfig.objects.get(microapp_id=microapp_id)
        return Response({
            'issuer': config.issuer,
            'client_id': config.client_id,
            'deployment_id': config.deployment_ids[0] if config.deployment_ids else '',
            'key_set_url': config.key_set_url,
            'auth_token_url': config.auth_token_url,
            'auth_login_url': config.auth_login_url,
        })
    except LTIConfig.DoesNotExist:
        return Response({}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
def create_or_update_lti_config(request):
    try:
        microapp = Microapp.objects.get(id=request.data['microapp_id'])
        
        # Convert deployment_id to list format
        deployment_ids = [request.data['deployment_id']] if request.data.get('deployment_id') else []
        
        config, created = LTIConfig.objects.update_or_create(
            microapp=microapp,
            defaults={
                'issuer': request.data['issuer'],
                'client_id': request.data['client_id'],
                'deployment_ids': deployment_ids,
                'key_set_url': request.data['key_set_url'],
                'auth_token_url': request.data['auth_token_url'],
                'auth_login_url': request.data['auth_login_url'],
            }
        )
        
        return Response({
            'issuer': config.issuer,
            'client_id': config.client_id,
            'deployment_id': config.deployment_ids[0] if config.deployment_ids else '',
            'key_set_url': config.key_set_url,
            'auth_token_url': config.auth_token_url,
            'auth_login_url': config.auth_login_url,
        })
    except Microapp.DoesNotExist:
        return Response({'error': 'Microapp not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)