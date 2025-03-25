from rest_framework.permissions import BasePermission

from apps.collection.models import CollectionUserJoin
from apps.microapps.models import MicroAppUserJoin

from rest_framework.permissions import BasePermission

class BaseMicroAppPermission(BasePermission):
    def get_app_id(self, request, view):
        # First try to get from request data
        data = request.data
        if data.get('app_id'):
            return data.get('app_id')
        elif data.get('ma_id'):
            return data.get('ma_id')
        
        # Then try to get from URL kwargs
        app_id = view.kwargs.get('app_id')
        if app_id:
            return app_id
            
        # If we have a hash_id, get the app_id from the microapp object
        hash_id = view.kwargs.get('hash_id')
        if hash_id:
            from apps.microapps.models import Microapp
            try:
                microapp = Microapp.objects.get(hash_id=hash_id)
                return microapp.id
            except Microapp.DoesNotExist:
                return None
                
        return None
    
class IsAdminOrOwner(BaseMicroAppPermission):
    def has_permission(self, request, view):
        app_id = self.get_app_id(request, view)
        user = request.user.id
        user_roles = MicroAppUserJoin.objects.filter(user_id=user, ma_id=app_id).values_list('role', flat=True)
        return 'admin' in user_roles or 'owner' in user_roles

class IsOwner(BaseMicroAppPermission):
    def has_permission(self, request, view):
        app_id = self.get_app_id(request, view)
        user = request.user.id
        user_roles = MicroAppUserJoin.objects.filter(user_id=user, ma_id=app_id).values_list('role', flat=True)
        return 'owner' in user_roles
    
class AdminRole(BasePermission):
    def has_permission(self, request, view):
        return "admin" in request.data["role"]

class BaseCollectionPermission(BasePermission):
    def get_collection_id(self, request, view):
        data = request.data
        if data.get('collection_id'):
            return data.get('collection_id')
        return view.kwargs.get('collection_id')
    
class IsCollectionAdmin(BaseCollectionPermission):
    def has_permission(self, request, view):
        collection_id = self.get_collection_id(request,view)
        user = request.user.id
        user_roles = CollectionUserJoin.objects.filter(user_id=user, collection_id=collection_id).values_list("role", flat=True)
        return 'admin' in user_roles