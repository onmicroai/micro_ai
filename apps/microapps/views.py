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
import logging as log


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
            serializer = MicroappUserSerializer(data=data) 
            if serializer.is_valid():
                return serializer.save()
            
            return Response({
                "error": serializer.errors,
                "status": status.HTTP_400_BAD_REQUEST
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
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
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
   
   def add_microapp_assets(self, microapp, asset):
       
       try:
            data = {'ma_id': microapp.id, 'asset_id': asset.id}
            serializer = AssetsMicroappSerializer(data=data)
            if serializer.is_valid():
                return serializer.save()
            
            return Response({"error": serializer.errors, "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)   
       
       except Exception as e:
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

   def get(self, request, format=None):
        try:
            microapps = Microapp.objects.all()
            serializer = MicroAppSerializer(microapps, many=True)
            return Response({"data": serializer.data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
        
        except Exception as e:
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
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk, format=None):
        try:
            microapps = self.get_object(pk)
            if microapps != None:
                microapps.delete()
                return Response({"status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
            
            return Response({"error": "microapp not exist", "status":status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
    
        except Exception as e:
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

class CloneMicroApp(APIView):

    def get_microapp(self, pk):
        try:
             global_app = Microapp.objects.get(id=pk)
             return global_app
        
        except Microapp.DoesNotExist:
            return None

    
    def post(self, request, pk):
        try:
            # global_app = GlobalMicroapps.objects.get(id=pk)
            global_app = self.get_microapp(pk)
            if global_app == None:
                return Response({"error": "microapp not exist", "status":status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)
            global_app_dict = model_to_dict(global_app)
            # global_app_dict["global_ma_id"] = global_app_dict["id"]
            del global_app_dict["id"]   
            
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
            return Response({"error": "an unexpected error occured", "status":status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get_objects(self, uid, aid):
        try:
            return MicroAppUserJoin.objects.filter(user_id=uid, ma_id=aid)
        
        except Exception as e:
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

    client = OpenAI(api_key= env("OPENAI_API_KEY", default="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"))

    def check_payload(self, data):
        try:
            required_fields = ["ma_id", "user_id", "no_submission", "ai_model", "scored_run", "skippable_phase"]

            for field in required_fields:
                if data.get(field) is None:
                    return False
                
            if data.get("scored_run") == True:
                if data.get("minimum_score") is None or data.get("rubric") is None:
                    return False
                
            return True
        
        except Exception as e:
            log.error(e)
    
    def get_ai_model_specific_config(self, api_param, model_name):

        if "gpt" in model_name:
            return self.default_gpt_phase(api_param)
        elif "gemini" in model_name:
            pass
        else:
            pass

    def default_gpt_phase(self, api_params):
        try:
            response =  self.client.chat.completions.create(**api_params)
            completion_tokens = response.usage.completion_tokens
            prompt_tokens = response.usage.prompt_tokens
            total_token = response.usage.total_tokens       
            ai_response = response.choices[0].message.content
            return{'completion_tokens':completion_tokens, 'prompt_tokens':prompt_tokens, 'total_tokens':total_token, 'ai_response':ai_response}
        
        except Exception as e:
            log.error(e)

    def skip_phase(self):
        try:
            return{'completion_tokens':0, 'prompt_tokens':0, 'total_tokens':0, 'ai_response':'Phase skipped'}
    
        except Exception as e:
            log.error(e)

    def no_submission_phase(self):
        try:
            return{'completion_tokens':0, 'prompt_tokens':0, 'total_tokens':0, 'ai_response':'Hard coded phase'}
        
        except Exception as e:
            log.error(e)

    def hard_coded_phase(self):
        try:
            return{'completion_tokens':0, 'prompt_tokens':0, 'total_tokens':0, 'ai_response':'Hard coded phase'}
        
        except Exception as e:
            log.error(e)

    def score_phase(self, api_params):

        response =  self.client.chat.completions.create(**api_params)
        completion_tokens = response.usage.completion_tokens
        prompt_tokens = response.usage.prompt_tokens
        total_token = response.usage.total_tokens       
        ai_response = response.choices[0].message.content
        return{'completion_tokens':completion_tokens, 'prompt_tokens':prompt_tokens, 'total_tokens':total_token, 'ai_response':ai_response}

    def post(self, request, format=None):

        try:
            data = request.data
            
            if not self.check_payload(data):
                return Response({"error": "Invalid payload fields missing", "status": status.HTTP_400_BAD_REQUEST}, status=status.HTTP_400_BAD_REQUEST)

            ma_id = data.get('ma_id')
            user_id = data.get('user_id')
            prompt = data.get('prompt')
            session_id = data.get("session_id")
            message_history = data.get("message_history")
            no_submission = data.get("no_submission")
            ai_model = data.get("ai_model", "gpt-3.5-turbo")
            temperature = data.get("temperature", 0)
            max_tokens = data.get("max_tokens")
            top_p = data.get("top_p", 1)
            frequency_penalty = data.get("frequency_penalty", 0)
            presence_penalty = data.get("presence_penalty", 0)
            scored_run = data.get("scored_run")
            minimum_score = data.get("minimum_score")
            rubric = data.get("rubric")
            skippable_phase = data.get("skippable_phase")
            timestamp = datetime.datetime.now()

            if message_history and len(message_history) > 0:
                message_history.extend(prompt)
                prompt = message_history
                
                

            api_params = {
                'model': ai_model,
                'messages': prompt,
                'temperature': temperature,
                'frequency_penalty': frequency_penalty,
                'presence_penalty': presence_penalty,
                'top_p': top_p
            }

            if max_tokens:
                api_params["max_tokens"] = max_tokens
            
            response = ""

            #hnadling skippable phase
            if skippable_phase:
                response = self.skip_phase()

            #handling hardcoded response
            elif no_submission and prompt is None:
                response = self.hard_coded_phase()
                prompt = []

            #handling no submission phase
            elif no_submission:
                response = self.no_submission_phase()

            #handle score phase
            # elif scored_run:
            #     instruction = """Please provide a score for the previous user message. Use the following rubric:
            #     """ + rubric + """
            #     Please output your response as JSON, using this format: { "[criteria 1]": "[score 1]", "[criteria 2]": "[score 2]", "total": "[total score]" }"""
            #     prompt.append({"role": "system", "content": instruction})
            #     api_params["messages"] = prompt
            #     self.get_ai_model_specific_config()
                

            #handling default phase
            else:
                response = self.get_ai_model_specific_config(api_params, ai_model)

          
            completion_tokens = response['completion_tokens']
            prompt_tokens = response['prompt_tokens']
            total_token = response['total_tokens']
            cost = round(0.5 * prompt_tokens/1000000 + 1.5 * completion_tokens/1000000, 6)        
            ai_response = response['ai_response']
            if(not session_id):
                session_id = uuid.uuid4()

            data = {"ma_id": ma_id, 
                    "user_id": user_id, 
                    "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"), 
                    "session_id": str(session_id), 
                    "satisfaction": 0, 
                    "prompt": prompt, 
                    "response": ai_response, 
                    "credits": 0, 
                    "cost": cost,
                    "no_submission": no_submission,
                    "ai_model": ai_model,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "top_p": top_p,
                    "frequency_penalty": frequency_penalty,
                    "presence_penalty": presence_penalty,
                    "input_tokens": prompt_tokens,
                    "output_tokens": completion_tokens,
                    "price_input_token_1M": round(0.5 * prompt_tokens/1000000, 6),
                    "price_output_token_1M": round(1.5 * completion_tokens/1000000, 6),
                    "scored_run": scored_run,
                    "run_score": 0,
                    "minimum_score": minimum_score,
                    "rubric": rubric,
                    "run_passed": True
                    }

            serializer = RunSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response({"data": data, "status": status.HTTP_200_OK}, status=status.HTTP_200_OK)
            
            return Response({
                "error": serializer.errors,
                "status": status.HTTP_400_BAD_REQUEST
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            log.error(e)
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
            return Response({"error": "an unexpected error occured", "status": status.HTTP_500_INTERNAL_SERVER_ERROR}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)    

