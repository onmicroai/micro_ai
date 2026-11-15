"""
Knowledge base views - the sources attached to an app (files, web pages,
websites, pasted text), their extracted chunks, and a retrieval test query.

File uploads still go through MicroAppFileUpload in media_views.
"""
import logging as log

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.microapps.knowledge import sources as source_service
from apps.microapps.knowledge.ingest import start_ingestion
from apps.microapps.knowledge.loaders import TextLoader, WebPageLoader, WebsiteLoader
from apps.microapps.knowledge.url_safety import UnsafeURLError, validate_public_url
from apps.microapps.models import DocumentChunk, FileSource
from apps.microapps.rag_service import retrieve_chunks
from apps.utils.custom_permissions import IsAppAdminOrOwnerFromUrl
from apps.utils.throttles import KnowledgeSearchThrottle
from .mixins import MicroAppMixin

MAX_TEXT_CHARS = 200_000
MAX_QUERY_CHARS = 2_000
CHUNK_PAGE_SIZE = 50
MAX_CHUNK_PAGE_SIZE = 200


class WebSourceSerializer(serializers.Serializer):
    url = serializers.CharField(max_length=2048)
    mode = serializers.ChoiceField(choices=["page", "site"], default="page")


class TextSourceSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    text = serializers.CharField(max_length=MAX_TEXT_CHARS, trim_whitespace=False)

    def validate_text(self, value):
        if not value.strip():
            raise serializers.ValidationError("Enter some text.")
        return value


class TextSourceUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False)
    text = serializers.CharField(max_length=MAX_TEXT_CHARS, trim_whitespace=False, required=False)

    def validate_text(self, value):
        if not value.strip():
            raise serializers.ValidationError("Enter some text.")
        return value


class SearchSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=MAX_QUERY_CHARS)
    source_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)


def _serialize_chunk(chunk):
    source = chunk.file_source
    data = {
        "id": chunk.id,
        "source_id": source.id,
        "source_name": source.file_name,
        "source_type": source.source_type,
        "chunk_index": chunk.chunk_index,
        "source_chunk_count": source.chunk_count or 0,
        "content": chunk.content,
        "metadata": chunk.metadata or {},
    }
    similarity = getattr(chunk, "similarity", None)
    if similarity is not None:
        data["similarity"] = round(similarity, 4)
    return data


class KnowledgeBaseView(APIView, MicroAppMixin):
    """Base for knowledge base endpoints: app admins and owners only."""
    permission_classes = [IsAuthenticated, IsAppAdminOrOwnerFromUrl]

    def get_app_or_404(self, pk):
        microapp = self.get_microapp(pk)
        if not microapp:
            return None, Response({"error": "Microapp not found"}, status=status.HTTP_404_NOT_FOUND)
        return microapp, None

    def get_source_or_404(self, microapp, source_id):
        source = source_service.get_app_source(microapp, source_id)
        if not source:
            return None, Response({"error": "Source not found for this app"}, status=status.HTTP_404_NOT_FOUND)
        return source, None

    def selected_source_ids(self, microapp, requested):
        """The app's source ids, narrowed to the requested ones when given."""
        ids = list(source_service.app_sources(microapp).values_list("id", flat=True))
        if requested:
            wanted = set(requested)
            ids = [source_id for source_id in ids if source_id in wanted]
        return ids


class KnowledgeSourceList(KnowledgeBaseView):
    @extend_schema(summary="List the knowledge base sources of a microapp")
    def get(self, request, pk=None):
        microapp, error = self.get_app_or_404(pk)
        if error:
            return error
        return Response({
            "data": [source_service.serialize_source(s) for s in source_service.app_sources(microapp)]
        })


class KnowledgeWebSourceCreate(KnowledgeBaseView):
    @extend_schema(request=WebSourceSerializer, summary="Add a web page or website to the knowledge base")
    def post(self, request, pk=None):
        microapp, error = self.get_app_or_404(pk)
        if error:
            return error

        serializer = WebSourceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            url = validate_public_url(serializer.validated_data["url"])
        except UnsafeURLError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        is_site = serializer.validated_data["mode"] == "site"
        source = source_service.create_source(
            microapp,
            source_type=FileSource.WEBSITE if is_site else FileSource.WEBPAGE,
            name=url,  # replaced by the page title once it has been read
            url=url,
        )
        start_ingestion(source.id, WebsiteLoader(url) if is_site else WebPageLoader(url))
        return Response({"data": source_service.serialize_source(source)}, status=status.HTTP_201_CREATED)


class KnowledgeTextSourceCreate(KnowledgeBaseView):
    @extend_schema(request=TextSourceSerializer, summary="Add pasted text to the knowledge base")
    def post(self, request, pk=None):
        microapp, error = self.get_app_or_404(pk)
        if error:
            return error

        serializer = TextSourceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        text = serializer.validated_data["text"]
        source = source_service.create_source(
            microapp,
            source_type=FileSource.TEXT,
            name=serializer.validated_data["title"].strip(),
            raw_text=text,
        )
        start_ingestion(source.id, TextLoader(text))
        return Response({"data": source_service.serialize_source(source)}, status=status.HTTP_201_CREATED)


class KnowledgeSourceDetail(KnowledgeBaseView):
    @extend_schema(summary="Get one knowledge base source, including the text of a pasted-text source")
    def get(self, request, pk=None, source_id=None):
        microapp, error = self.get_app_or_404(pk)
        if error:
            return error
        source, error = self.get_source_or_404(microapp, source_id)
        if error:
            return error

        data = source_service.serialize_source(source)
        if source.source_type == FileSource.TEXT:
            data["text"] = source.raw_text or ""
        return Response({"data": data})

    @extend_schema(request=TextSourceUpdateSerializer, summary="Edit the title or text of a pasted-text source")
    def patch(self, request, pk=None, source_id=None):
        microapp, error = self.get_app_or_404(pk)
        if error:
            return error
        source, error = self.get_source_or_404(microapp, source_id)
        if error:
            return error
        if source.source_type != FileSource.TEXT:
            return Response({"error": "Only pasted text can be edited."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TextSourceUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        title = serializer.validated_data.get("title")
        text = serializer.validated_data.get("text")
        text_changed = text is not None and text != (source.raw_text or "")

        # Another app may share this source; give this app its own copy first.
        source = source_service.writable_source(microapp, source)
        if title is not None and title.strip():
            source.file_name = title.strip()
        if text_changed:
            source.raw_text = text
            source_service.mark_pending(source)
            start_ingestion(source.id, TextLoader(text))
        else:
            source.save()

        return Response({"data": source_service.serialize_source(source)})

    @extend_schema(summary="Remove a source from the knowledge base")
    def delete(self, request, pk=None, source_id=None):
        microapp, error = self.get_app_or_404(pk)
        if error:
            return error
        source, error = self.get_source_or_404(microapp, source_id)
        if error:
            return error

        deleted_chunks = source_service.remove_source_from_app(microapp, source)
        return Response({"deleted_chunks": deleted_chunks})


class KnowledgeSourceRefresh(KnowledgeBaseView):
    @extend_schema(request=None, summary="Fetch a web page or website again and replace its content")
    def post(self, request, pk=None, source_id=None):
        microapp, error = self.get_app_or_404(pk)
        if error:
            return error
        source, error = self.get_source_or_404(microapp, source_id)
        if error:
            return error
        if source.source_type not in FileSource.WEB_TYPES or not source.url:
            return Response({"error": "Only web pages and websites can be refreshed."},
                            status=status.HTTP_400_BAD_REQUEST)
        in_progress = source.status in (FileSource.PENDING, FileSource.PROCESSING)
        if in_progress and not source_service.is_stale(source):
            return Response({"error": "This source is already being processed."},
                            status=status.HTTP_409_CONFLICT)

        # Another app may share this source; give this app its own copy first.
        source = source_service.writable_source(microapp, source)
        source_service.mark_pending(source)
        loader = WebsiteLoader(source.url) if source.source_type == FileSource.WEBSITE else WebPageLoader(source.url)
        start_ingestion(source.id, loader)
        return Response({"data": source_service.serialize_source(source)})


class KnowledgeChunkList(KnowledgeBaseView):
    @extend_schema(summary="List the text chunks extracted from an app's knowledge base sources")
    def get(self, request, pk=None):
        microapp, error = self.get_app_or_404(pk)
        if error:
            return error

        try:
            requested = [int(v) for v in request.query_params.get("source_ids", "").split(",") if v.strip()]
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = int(request.query_params.get("page_size", CHUNK_PAGE_SIZE))
        except ValueError:
            return Response({"error": "Invalid query parameters"}, status=status.HTTP_400_BAD_REQUEST)
        page_size = max(1, min(page_size, MAX_CHUNK_PAGE_SIZE))

        source_ids = self.selected_source_ids(microapp, requested)
        chunks = (
            DocumentChunk.objects
            .filter(file_source_id__in=source_ids)
            .select_related("file_source")
            .defer("embedding")
            .order_by("file_source_id", "chunk_index", "id")
        )
        count = chunks.count()
        start = (page - 1) * page_size
        results = list(chunks[start:start + page_size])

        return Response({
            "count": count,
            "page": page,
            "page_size": page_size,
            "has_more": start + len(results) < count,
            "results": [_serialize_chunk(chunk) for chunk in results],
        })


class KnowledgeSearch(KnowledgeBaseView):
    throttle_classes = [KnowledgeSearchThrottle]

    @extend_schema(request=SearchSerializer, summary="Show the chunks an app run would retrieve for a query")
    def post(self, request, pk=None):
        microapp, error = self.get_app_or_404(pk)
        if error:
            return error

        serializer = SearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        source_ids = self.selected_source_ids(microapp, serializer.validated_data.get("source_ids"))
        chunks = retrieve_chunks(
            microapp_id=microapp.id,
            source_ids=source_ids,
            query=serializer.validated_data["query"],
        )
        log.info(f"RAG: test query on microapp={microapp.id} returned {len(chunks)} chunks")
        return Response({"results": [_serialize_chunk(chunk) for chunk in chunks]})
