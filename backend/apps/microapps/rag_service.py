"""
RAG service for sidebar files - chunking, embedding, and pgvector retrieval.
Uses native pgvector SQL operators (<=> cosine distance) for efficient DB-level search.
"""
import logging as log
from typing import List
import requests
from django.conf import settings
from pgvector.django import CosineDistance

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536


def _embed_via_litellm(texts: List[str]) -> List[List[float]]:
    url = f"{settings.LITELLM_BASE_URL}/v1/embeddings"
    headers = {"Authorization": f"Bearer {settings.LITELLM_API_KEY}"}
    payload = {"model": EMBEDDING_MODEL, "input": texts}

    response = requests.post(url, json=payload, headers=headers, timeout=120)
    response.raise_for_status()
    data = response.json()["data"]
    return [item["embedding"] for item in sorted(data, key=lambda x: x["index"])]


# Chunking
class TextChunker:
    """Splits extracted text into overlapping chunks suitable for embedding."""

    def __init__(self, chunk_chars: int = 4200, overlap_chars: int = 420):
        """
        Args:
            chunk_chars:   Target size of each chunk in characters (~700 words / ~1,400 tokens).
            overlap_chars: Characters of overlap between consecutive chunks (10%).
        """
        self.chunk_chars = chunk_chars
        self.overlap_chars = overlap_chars

    def chunk_text(self, text: str) -> List[str]:
        """Return a list of overlapping text chunks."""
        text = text.strip()
        if not text:
            return []

        chunks: List[str] = []
        start = 0

        while start < len(text):
            end = min(start + self.chunk_chars, len(text))

            # Prefer a sentence / paragraph boundary when possible
            if end < len(text):
                for boundary in ("\n\n", ".\n", ". ", "\n"):
                    pos = text.rfind(boundary, start + int(self.chunk_chars * 0.7), end)
                    if pos != -1:
                        end = pos + len(boundary)
                        break

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            if end >= len(text):
                break

            start = max(start + 1, end - self.overlap_chars)

        return chunks


# Embedding generation

def generate_embedding(text: str) -> List[float]:
    """Generate a single embedding vector via LiteLLM"""
    return _embed_via_litellm([text])[0]


def generate_embeddings_batch(texts: List[str], batch_size: int = 100) -> List[List[float]]:
    """Generate embeddings in batches to stay under the 300k token/request limit."""
    if not texts:
        return []
    results: List[List[float]] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        results.extend(_embed_via_litellm(batch))
    return results


# Similarity retrieval - pgvector SQL-level search

DEFAULT_TOP_K = 10


def retrieve_chunks(
    microapp_id: int,
    source_ids: List[int],
    query: str,
    top_k: int = DEFAULT_TOP_K,
) -> list:
    """
    Return the top-K chunks most relevant to the query across the given sources
    of an app, best first (one embedding call, one SQL round-trip).

    Each chunk has a `similarity` attribute and its `file_source` loaded. This
    is the single retrieval path: app runs and the knowledge base test query
    both use it, so the test shows exactly what a run would retrieve.
    Queries via AppFileReference -> FileSource so cloned apps share the same chunks.
    """
    from apps.microapps.models import DocumentChunk

    source_ids = list(source_ids or [])
    if not source_ids:
        return []

    try:
        query_vec = generate_embedding(query)

        results = list(
            DocumentChunk.objects
            .filter(
                file_source__app_references__app_id=microapp_id,
                file_source_id__in=source_ids,
                embedding__isnull=False,
            )
            .select_related('file_source')
            .annotate(similarity=1 - CosineDistance("embedding", query_vec))
            .order_by("-similarity")
            [:top_k]
        )
        for chunk in results:
            chunk.similarity = float(chunk.similarity)

        # Fallback: if no embeddings exist at all, return the first chunks of each source
        if not results:
            log.warning(f"RAG: no embeddings for microapp={microapp_id}, using fallback chunks")
            per_source = max(1, top_k // len(source_ids))
            for source_id in source_ids:
                fallback = (
                    DocumentChunk.objects
                    .filter(
                        file_source__app_references__app_id=microapp_id,
                        file_source_id=source_id,
                    )
                    .select_related('file_source')
                    .order_by("chunk_index", "id")
                    [:per_source]
                )
                for chunk in fallback:
                    chunk.similarity = 0.0
                    results.append(chunk)

        return results

    except Exception as e:
        log.error(f"retrieve_chunks error: {e}")
        return []
