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

def retrieve_relevant_chunks_multi_file(
    microapp_id: int,
    file_names: List[str],
    query: str,
    top_k_total: int = 10,
) -> dict:
    """
    Retrieve the top-K most relevant chunks globally across all files in a
    single DB query (one embedding call, one SQL round-trip).
    Queries via AppFileReference -> FileSource so cloned apps share the same chunks.
    Returns a dict keyed by file_name, preserving order by similarity score.
    """
    from apps.microapps.models import DocumentChunk

    if not file_names:
        return {}

    try:
        query_vec = generate_embedding(query)

        results = (
            DocumentChunk.objects
            .filter(
                file_source__app_references__app_id=microapp_id,
                file_source__file_name__in=file_names,
                embedding__isnull=False,
            )
            .select_related('file_source')
            .annotate(similarity=1 - CosineDistance("embedding", query_vec))
            .order_by("-similarity")
            [:top_k_total]
        )

        grouped: dict = {fname: [] for fname in file_names}
        for chunk in results:
            grouped[chunk.file_source.file_name].append((chunk.content, float(chunk.similarity)))

        # Fallback: if no embeddings exist at all, return first chunks per file
        if not any(grouped.values()):
            log.warning(f"RAG: no embeddings for microapp={microapp_id}, using fallback chunks")
            for fname in file_names:
                fallback = (
                    DocumentChunk.objects
                    .filter(
                        file_source__app_references__app_id=microapp_id,
                        file_source__file_name=fname,
                    )
                    .select_related('file_source')
                    .order_by("id")
                    [:max(1, top_k_total // len(file_names))]
                )
                grouped[fname] = [(chunk.content, 0.0) for chunk in fallback]

        return grouped

    except Exception as e:
        log.error(f"retrieve_relevant_chunks_multi_file error: {e}")
        return {fname: [] for fname in file_names}
