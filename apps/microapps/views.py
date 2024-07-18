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
from apps.microapps.models import Microapp, MicroAppUserJoin, AssetsMaJoin, Asset, Run
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
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
import asyncio


BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, ".env"))


@extend_schema_view(
    get=extend_schema(
        responses={200: MicroAppSerializer(many=True)},
    ),
    post=extend_schema(
        request=MicroAppSerializer, 
        responses={200: MicroAppSerializer},
    )
)
class MicroAppList(APIView):
   
   def add_microapp_user(self, uid, microapp):
        try:
            role = "admin" 
            ma_id = microapp.id  
            user_id = uid
            data = {'role': role, 'ma_id': ma_id, 'user_id': user_id}
            print("=>data" + str(data))
            serializer = MicroappUserSerializer(data=data) 
            if serializer.is_valid():
                return serializer.save()
            
            return Response({
                "error": serializer.errors,
                "status": status.HTTP_400_BAD_REQUEST
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
   def add_assets(self, request, microapp):
       try:
            assets = request.data.get('assets')
            serializer = AssetsSerializer(data=assets)
            if serializer.is_valid():
                asset = serializer.save()
                return self.add_microapp_assets(microapp=microapp, asset=asset)
            
            return Response({"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
       
       except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
   
   def add_microapp_assets(self, microapp, asset):
       
       try:
            data = {'ma_id': microapp.id, 'asset_id': asset.id}
            serializer = AssetsMicroappSerializer(data=data)
            if serializer.is_valid():
                return serializer.save()
            
            return Response({"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)   
       
       except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

   def get(self, request, format=None):
        try:
            microapps = Microapp.objects.all()
            serializer = MicroAppSerializer(microapps, many=True)
            return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
   
   def post(self, request, format=None):
        try:
            serializer = MicroAppSerializer(data=request.data)
            if serializer.is_valid():
                microapp = serializer.save()
                self.add_microapp_user(uid=request.user.id, microapp=microapp)
                # self.add_assets(request=request, microapp=microapp)
                return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)

            return Response({
                "error": serializer.errors,
                "status": status.HTTP_400_BAD_REQUEST
            }, status=status.HTTP_400_BAD_REQUEST)

        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

   
@extend_schema_view(
    get=extend_schema(
        responses={200: MicroAppSerializer(many=True)},
    ),
    put=extend_schema(
        request=MicroAppSerializer, 
        responses={200: MicroAppSerializer},
    )
)
class MicroAppDetails(APIView):

    def get_object(self, pk):
        try:
            return Microapp.objects.get(id=pk)
        
        except Microapp.DoesNotExist:
            return None
        
    def get(self, request, pk, format=None):
        try:
            snippet = self.get_object(pk)
            if snippet != None:
                serializer = MicroAppSerializer(snippet)
                return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
            
            return Response({"error": "microapp not exist", "status":status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    
    def put(self, request, pk, format=None):
        try:
            microapps = self.get_object(pk)
            if microapps != None:
                serializer = MicroAppSerializer(microapps, data=request.data)
                if serializer.is_valid():
                    serializer.save()
                    return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
                
                return Response({
                    "error": serializer.errors,
                    "status": status.HTTP_400_BAD_REQUEST
                }, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({"error": "microapp not exist", "status":status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
    
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk, format=None):
        try:
            microapps = self.get_object(pk)
            if microapps != None:
                microapps.delete()
                return Response({"status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
            
            return Response({"error": "microapp not exist", "status":status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
    
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

class CloneMicroApp(APIView):
    
    def post(self, request, pk):
        try:
            # global_app = GlobalMicroapps.objects.get(id=pk)
            global_app = Microapp.objects.get(id=pk)
            global_app_dict = model_to_dict(global_app)
            # global_app_dict["global_ma_id"] = global_app_dict["id"]
            del global_app_dict["id"]   
            print("=>globalapp " + str(global_app_dict))
            
            serializer = MicroAppSerializer(data=global_app_dict)
            if serializer.is_valid():
                microapp = serializer.save()
                micro_app_list = MicroAppList
                micro_app_list.add_microapp_user(self, uid=request.user.id, microapp=microapp)
                return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
            
            return Response({
                "error": serializer.errors,
                "status": status.HTTP_400_BAD_REQUEST
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
@extend_schema_view(

    get=extend_schema(
        responses={200: MicroappUserSerializer(many=True)},
    ),
    post=extend_schema(
        request=MicroappUserSerializer, 
        responses={200: MicroappUserSerializer},
    ),
    put=extend_schema(
        request=MicroappUserSerializer, 
        responses={201: MicroappUserSerializer},
    ),
    delete=extend_schema(
        responses={200: MicroappUserSerializer(many=True)},
    )
)
class UserMicroApps(APIView):

    def get_object(self,uid,aid):
        try:
            return MicroAppUserJoin.objects.get(user_id=uid, ma_id=aid)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get_objects(self, uid, aid):
        try:
            return MicroAppUserJoin.objects.filter(user_id=uid, ma_id=aid)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    def get(self, request, app_id, user_id=None):
        try:
            if user_id:
                user_role = self.get_objects(user_id, app_id)
                
                if user_role:
                    serializer = MicroappUserSerializer(user_role, many=True)
                    return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
                
                return Response({
                "error": 'user not found',
                "status": status.HTTP_400_BAD_REQUEST
                 }, status=status.HTTP_400_BAD_REQUEST)

            
            usermicroapps = MicroAppUserJoin.objects.filter(ma_id = app_id)
            serializer = MicroappUserSerializer(usermicroapps, many=True)
            return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        
    def post(self, request, app_id, user_id, format=None):
        try:
            role = request.data.get("role")
            data = {'ma_id': app_id, 'user_id': user_id, 'role': role}

            if user_id:
                serializer = MicroappUserSerializer(data=data)
                if serializer.is_valid():
                    serializer.save()
                    return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
                
                return Response({"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({"error": "user_id not found", "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
       
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    
    def put(self, request, app_id, user_id, format=None):
        try:
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
                        return Response({"data": serializer.data, "error": status.HTTP_200_OK}, status=status.HTTP_200_OK)
                    
                    return Response({"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
                
                return Response({"error": "Operation not allowed", "status": status.HTTP_403_FORBIDDEN}, status=status.HTTP_403_FORBIDDEN)
            
            return Response({"error": "Operation not allowed", "status":status.HTTP_403_FORBIDDEN}, status=status.HTTP_403_FORBIDDEN)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    def delete(self, request, app_id, user_id, format=None):
        try:
            current_user = request.user.id
            current_user_role = self.get_object(current_user, app_id)

            if user_id:
            
                if current_user_role:
                    current_user_role_dict = model_to_dict(current_user_role)

                    if current_user_role_dict["role"] == "admin":
                        userapp = self.get_object(user_id, app_id)
                        if userapp:
                            userapp.delete()
                            return Response({"status": status.HTTP_200_OK},status=status.HTTP_200_OK)
                        
                        return Response({"error": "microapp not found", "status": status.HTTP_404_NOT_FOUND}, status=status.HTTP_404_NOT_FOUND)
                    
                    return Response({"error": "Operation not allowed", "status": status.HTTP_403_FORBIDDEN}, status=status.HTTP_403_FORBIDDEN)
            
                return Response({"error": "Operation not allowed", "status": status.HTTP_403_FORBIDDEN}, status=status.HTTP_403_FORBIDDEN)

            return Response({"error": "user_id not found", "status": status.HTTP_404_NOT_FOUND}, status=status.HTTP_404_NOT_FOUND)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema_view(
    get=extend_schema(
        responses={200: MicroAppSerializer(many=True)},
    ),
)
class UserApps(APIView):

    def get(self, request):
        try: 
            current_user = request.user.id
            user_apps_ids = MicroAppUserJoin.objects.filter(user_id=current_user).values_list('ma_id', flat=True)
            user_apps = Microapp.objects.filter(id__in=user_apps_ids)
            serializer = MicroAppSerializer(user_apps, many=True)
            return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema_view(
    get=extend_schema(
        responses={200: RunSerializer(many=True)},
        parameters=[
            OpenApiParameter(name='ma_id', description='Optional Micro App ID', required=False),
            OpenApiParameter(name='user_id', description='Optional User ID', required=False),
            OpenApiParameter(name='session_id', description='Optional Session ID', required=False),
            OpenApiParameter(name='start_date', description='Optional Start Date', required=False),
            OpenApiParameter(name='end_date', description='Optional End Date', required=False),
        ]
    ),
    post=extend_schema(
        request=RunSerializer, 
        responses={200: RunSerializer},
    )
)
class RunList(APIView):
    
    def post(self, request, format=None):

        try:
            client = OpenAI(
            api_key= env("OPENAI_API_KEY", default="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")
            )
            data = request.data
            print("jsondata " + str(data))
            ma_id = data.get('ma_id')
            user_id = data.get('user_id')
            prompt = data.get('prompt')
            session_id = data.get("session_id")
            timestamp = datetime.datetime.now()

            if(not ma_id or not user_id or not prompt):
                return Response({
                "error": "invalid payload",
                "status": status.HTTP_400_BAD_REQUEST
                }, status=status.HTTP_400_BAD_REQUEST)

            print("prompt " + str(prompt))

            response =  client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=prompt
            )

            completion_tokens = response.usage.completion_tokens
            prompt_tokens = response.usage.prompt_tokens
            total_token = response.usage.total_tokens

            cost = 0.5 * prompt_tokens / 1000000 + 1.5 * completion_tokens / 1000000
            cost = round(cost, 6)

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
                return Response({"data": data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
            
            return Response({
                "error": serializer.errors,
                "status": status.HTTP_400_BAD_REQUEST
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status": status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    
    def get(self, request, *args, **kwargs):
        try:     
            user_id = request.GET.get("user_id")
            ma_id = request.GET.get("ma_id")
            session_id = request.GET.get("session_id")
            start_date = request.GET.get("start_date")
            end_date = request.GET.get("end_date")
       
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
            return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        
        except Exception as e:
            print("=error " +str(e))
            return Response({"error": "an unexpected error occured", "status": status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)    

