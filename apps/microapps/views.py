import datetime
import json
from django.forms import model_to_dict
from django.shortcuts import render
from django.http import Http404, JsonResponse
from django.shortcuts import render
from rest_framework.response import Response
from apps.microapps.serializer import MicroAppSerializer, MicroappUserSerializer, AssetsSerializer, AssetsMicroappSerializer, RunSerializer
from rest_framework import status
from rest_framework.decorators import api_view
from apps.microapps.models import Microapps, MicroAppUserJoin, AssetsMaJoin, Assets, Run
from apps.global_microapps.models import GlobalMicroapps 
from apps.collection.models import CollectionMaJoin
from rest_framework.views import APIView
import uuid
from openai import OpenAI
import os
import environ
from pathlib import Path
from django.utils.translation import gettext_lazy
from django.db.models import Q
from datetime import timedelta


BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))



class MicroAppList(APIView):
   
   def add_microapp_user(self, uid, microapp):
    
        role = "admin"  # always admin
        ma_id = microapp.id  
        user_id = uid
        data = {'role': role, 'ma_id': ma_id, 'user_id': user_id}
        print("=>data" + str(data))
        serializer = MicroappUserSerializer(data=data) 
        if serializer.is_valid():
            return serializer.save()
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
   def add_assets(self, request, microapp):
       assets = request.data.get('assets')
       serializer = AssetsSerializer(data=assets)
       if serializer.is_valid():
           asset = serializer.save()
           return self.add_microapp_assets(microapp=microapp, asset=asset)
       
       return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
   
   def add_microapp_assets(self, microapp, asset):
       data = {'ma_id': microapp.id, 'asset_id': asset.id}
       serializer = AssetsMicroappSerializer(data=data)
       if serializer.is_valid():
           return serializer.save()
       
       return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)   

   def get(self, request, format=None):
        microapps = Microapps.objects.all()
        serializer = MicroAppSerializer(microapps, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
   
   def post(self, request, format=None):
        serializer = MicroAppSerializer(data=request.data)
        if serializer.is_valid():
            microapp = serializer.save()
            self.add_microapp_user(uid=request.user.id, microapp=microapp)
            # self.add_assets(request=request, microapp=microapp)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
   
   
class MicroAppDetails(APIView):

    def get_object(self, pk):
        try:
            return Microapps.objects.get(id=pk)
        except Microapps.DoesNotExist:
            raise Http404
        
    def get(self, request, pk, format=None):
        snippet = self.get_object(pk)
        serializer = MicroAppSerializer(snippet)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def put(self, request, pk, format=None):
        microapps = self.get_object(pk)
        serializer = MicroAppSerializer(microapps, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk, format=None):
        microapps = self.get_object(pk)
        microapps.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    

class CloneMicroApp(APIView):
    
    def post(self, request, pk):
        try:
            global_app = GlobalMicroapps.objects.get(id=pk)
            global_app_dict = model_to_dict(global_app)
            global_app_dict["global_ma_id"] = global_app_dict["id"]
            del global_app_dict["id"]
            print("=>globalapp " + str(global_app_dict))
            
            serializer = MicroAppSerializer(data=global_app_dict)
            if serializer.is_valid():
                microapp = serializer.save()
                micro_app_list = MicroAppList
                micro_app_list.add_microapp_user(self, uid=request.user.id, microapp=microapp)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except GlobalMicroapps.DoesNotExist:
            raise Http404
    
    
class UserMicroApps(APIView):

    def get_object(self,uid,aid):
        try:
            return MicroAppUserJoin.objects.get(user_id=uid, ma_id=aid)
        except MicroAppUserJoin.DoesNotExist:
            return None

    def get_objects(self, uid, aid):
        try:
            return MicroAppUserJoin.objects.filter(user_id=uid, ma_id=aid)
        except MicroAppUserJoin.DoesNotExist:
            return None
        
    def get(self, request, app_id, user_id=None):
        if user_id:
            user_role = self.get_objects(user_id, app_id)
            if user_role:
                serializer = MicroappUserSerializer(user_role, many=True)
                return Response(serializer.data, status=status.HTTP_200_OK) 
            
            return Response({"user not found"}, status=status.HTTP_400_BAD_REQUEST)
        
        usermicroapps = MicroAppUserJoin.objects.filter(ma_id = app_id)
        serializer = MicroappUserSerializer(usermicroapps, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def post(self, request, app_id, user_id, format=None):
        role = request.data.get("role")
        data = {'ma_id': app_id, 'user_id': user_id, 'role': role}

        if user_id:
            serializer = MicroappUserSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({"error": "user_id not found"}, status=status.HTTP_400_BAD_REQUEST)
    
    def put(self, request, app_id, user_id, format=None):
        role = request.data.get("role")
        current_user = request.user.id
        current_user_role = self.get_object(current_user, app_id)
        
        if current_user_role:
            current_user_role_dict = model_to_dict(current_user_role)

            if current_user_role_dict["role"] == "admin":
                userapp = self.get_object(user_id, app_id)
                user_app_role = model_to_dict(userapp)
                user_app_role["role"] = role
                serializer = MicroappUserSerializer(userapp, data=user_app_role)
                if serializer.is_valid():
                    serializer.save()
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({"error": "Operation not allowed"}, status=status.HTTP_403_FORBIDDEN)
        
        return Response({"error": "Operation not allowed"}, status=status.HTTP_403_FORBIDDEN)
        
    def delete(self, request, app_id, user_id, format=None):
        current_user = request.user.id
        current_user_role = self.get_object(current_user, app_id)

        if user_id:
        
            if current_user_role:
                current_user_role_dict = model_to_dict(current_user_role)

                if current_user_role_dict["role"] == "admin":
                    userapp = self.get_object(user_id, app_id)
                    if userapp:
                        userapp.delete()
                        return Response(status=status.HTTP_204_NO_CONTENT)
                    
                    return Response({"error": "microapp not found"}, status=status.HTTP_404_NOT_FOUND)
                
                return Response({"error": "Operation not allowed"}, status=status.HTTP_403_FORBIDDEN)
        
            return Response({"error": "Operation not allowed"}, status=status.HTTP_403_FORBIDDEN)

        return Response({"error": "user_id not found"}, status=status.HTTP_400_BAD_REQUEST)

    
class UserApps(APIView):

    def get(self, request):
        try: 
            current_user = request.user.id
            print("userId " + str(current_user))
            user_apps_ids = MicroAppUserJoin.objects.filter(user_id=current_user).values_list('ma_id', flat=True)
            print("user_apps_ids" + str(user_apps_ids))
            user_apps = Microapps.objects.filter(id__in=user_apps_ids)
            serializer = MicroAppSerializer(user_apps, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except Microapps.DoesNotExist:
            raise Http404


class RunList(APIView):
    
    def post(self, request, format=None):

        client = OpenAI(
        api_key= env("OPENAI_API_KEY", default="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")
        )

        data = json.loads(request.body)
        ma_id = data.get('ma_id')
        user_id = data.get('user_id')
        prompt = data.get('prompt')
        session_id = data.get("session_id")
        timestamp = datetime.datetime.now()

        print("prompt " + str(prompt))

        response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=prompt
        )

        completion_tokens = response.usage.completion_tokens
        prompt_tokens = response.usage.prompt_tokens
        total_token = response.usage.total_tokens

        cost = 0.5 * prompt_tokens / 1000000 + 1.5 * completion_tokens / 1000000
        cost = round(cost, 6)

        print("tokens " + str(completion_tokens) + str(prompt_tokens))
        print("cost " +str(cost))


        if(not session_id):
            session_id = uuid.uuid4()

        ai_response = response.choices[0].message.content

        print(ai_response)

        data = {"ma_id": ma_id, "user_id": user_id, "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"), "session_id": str(session_id), "satisfaction": 0, "prompt": prompt, "response": ai_response, "credits": 0, "cost": cost}

        print("response_data " + str(data))
        serializer = RunSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            print(serializer.data)
            return Response(data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def get(self, request, *args, **kwargs):

        user_id = request.GET.get("user_id")
        ma_id = request.GET.get("ma_id")
        session_id = request.GET.get("session_id")
        start_date = request.GET.get("start_date")
        end_date = request.GET.get("end_date")

        try:
            queryset = Run.objects.all()  
            q = Q()
            if user_id:
                q &= Q(user_id=user_id)
            if ma_id:
                q &= Q(ma_id=ma_id)
            if session_id:
                q &= Q(session_id=session_id)

            if start_date and end_date:
                q &= Q(timestamp__date__gte=start_date, timestamp__date__lte=end_date)
            elif start_date and not end_date:
                 q &= Q(timestamp__date__gte=start_date)
            elif not start_date and end_date:
                q &= Q(timestamp__date__lte=end_date)

            queryset = queryset.filter(q)

            serializer = RunSerializer(queryset, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except Exception as e:
            return Response({"error": e}, status=status.HTTP_400_BAD_REQUEST)



# @api_view(["GET"])
# def collection_microapps(request, collection_id):
#     try:
#         collection_apps_ids = CollectionMaJoin.objects.filter(collection_id=collection_id).values_list('ma_id',flat=True)
#         collection_apps = Microapps.objects.filter(id__in=collection_apps_ids)
#         serializer = MicroAppSerializer(collection_apps,many=True)
#         return Response(serializer.data, status=status.HTTP_200_OK)

#     except Microapps.DoesNotExist:
#         raise Http404
    

    




    