"""
Token counting utilities for models that don't provide usage data in streaming responses.
This module provides fallback token counting for Anthropic and Google models.
"""

import tiktoken
import logging
from typing import Dict, Any, List, Optional
import re

log = logging.getLogger(__name__)


def _is_openai_model(model_name: str) -> bool:
    name = model_name.lower()
    return name.startswith("openai/") or any(k in name for k in ["gpt-", "o1", "o3"])


def _litellm_count_messages(model_name: str, messages: List[Dict]) -> Optional[int]:
    """Use LiteLLM's provider-aware token counter for a message list."""
    try:
        import litellm
        return litellm.token_counter(model=model_name, messages=messages)
    except Exception as e:
        log.debug(f"LiteLLM token_counter failed for {model_name}: {e}")
        return None


def _litellm_count_text(model_name: str, text: str) -> Optional[int]:
    """Use LiteLLM's provider-aware token counter for plain text."""
    try:
        import litellm
        return litellm.token_counter(model=model_name, text=text)
    except Exception as e:
        log.debug(f"LiteLLM token_counter failed for {model_name}: {e}")
        return None


class TokenCounter:
    """
    Token counter for models that don't provide usage data in streaming responses.
    Uses LiteLLM for provider-specific tokenization (Anthropic, Google) and
    tiktoken for OpenAI-compatible models.
    """

    def __init__(self):
        self.encodings = {}
        self._init_encodings()

    def _init_encodings(self):
        """Initialize tiktoken encodings for OpenAI model families."""
        for enc_name in ("cl100k_base", "o200k_base"):
            try:
                self.encodings[enc_name] = tiktoken.get_encoding(enc_name)
            except Exception as e:
                log.error(f"Error initializing tiktoken encoding {enc_name}: {e}")

    def _get_tiktoken_encoding(self, model_name: str) -> Optional[tiktoken.Encoding]:
        """Return the right tiktoken encoding for an OpenAI model."""
        name = model_name.lower()
        # gpt-4o, gpt-4o-mini, gpt-5, o1, o3 use the newer o200k_base vocabulary
        if any(k in name for k in ['gpt-4o', 'gpt-5', 'o1', 'o3']):
            return self.encodings.get('o200k_base')
        # gpt-4, gpt-3.5, and everything else defaults to cl100k_base
        return self.encodings.get('cl100k_base')

    def count_tokens(self, text: str, model_name: str = None) -> int:
        """
        Count tokens in text.

        Uses LiteLLM for non-OpenAI models (Claude, Gemini) so that
        provider-specific tokenizers are applied. Falls back to tiktoken
        for OpenAI models and as a last resort.
        """
        if not text:
            return 0

        mn = model_name or ''

        # For non-OpenAI models prefer LiteLLM's provider-aware counter
        if mn and not _is_openai_model(mn):
            result = _litellm_count_text(mn, text)
            if result is not None:
                return result

        # OpenAI path (or LiteLLM fallback)
        try:
            encoding = self._get_tiktoken_encoding(mn)
            if encoding:
                return len(encoding.encode(text))
        except Exception as e:
            log.error(f"Error counting tokens with tiktoken: {e}")

        return len(text.split())

    def count_messages_tokens(self, messages: List[Dict[str, str]], model_name: str = None) -> int:
        """
        Count tokens in a list of messages (conversation format).

        Uses LiteLLM for non-OpenAI models so that provider-specific
        tokenizers are applied. Falls back to tiktoken for OpenAI models.
        """
        if not messages:
            return 0

        mn = model_name or ''

        # For non-OpenAI models prefer LiteLLM's provider-aware counter
        if mn and not _is_openai_model(mn):
            result = _litellm_count_messages(mn, messages)
            if result is not None:
                return result

        # OpenAI path (or LiteLLM fallback) — tiktoken with per-message overhead
        try:
            encoding = self._get_tiktoken_encoding(mn)
            if not encoding:
                return sum(len(m.get('content', '').split()) for m in messages)

            total_tokens = 0
            for message in messages:
                role = message.get('role', '')
                content = message.get('content', '')

                if isinstance(content, list):
                    content_text = ''
                    for block in content:
                        if isinstance(block, dict) and block.get('type') == 'text':
                            content_text += block.get('text', '')
                        elif isinstance(block, str):
                            content_text += block
                    content = content_text

                total_tokens += len(encoding.encode(role)) + len(encoding.encode(content)) + 4

            return total_tokens
        except Exception as e:
            log.error(f"Error counting message tokens: {e}")

        # Last-resort word-count fallback
        total_words = 0
        for message in messages:
            content = message.get('content', '')
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get('type') == 'text':
                        total_words += len(block.get('text', '').split())
                    elif isinstance(block, str):
                        total_words += len(block.split())
            elif isinstance(content, str):
                total_words += len(content.split())
        return total_words

    def estimate_usage_for_streaming(self,
                                     messages: List[Dict[str, str]],
                                     full_content: str,
                                     model_name: str) -> Dict[str, int]:
        """
        Estimate usage data for streaming responses when not provided by the model.

        Returns a dict with prompt_tokens, completion_tokens, total_tokens.
        """
        try:
            # Count prompt tokens
            prompt_tokens = self.count_messages_tokens(messages, model_name)
            
            # Count completion tokens
            completion_tokens = self.count_tokens(full_content, model_name)
            
            total_tokens = prompt_tokens + completion_tokens
            
            return {
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'total_tokens': total_tokens
            }
        except Exception as e:
            log.error(f"Error estimating usage: {e}")
            # Debug logging for multimodal messages
            log.error(f"Messages structure: {[msg.get('content', '') for msg in messages]}")
            log.error(f"Message types: {[type(msg.get('content', '')) for msg in messages]}")
            
            # Fallback to simple word count with multimodal support
            prompt_words = 0
            for msg in messages:
                content = msg.get('content', '')
                if isinstance(content, list):
                    # Handle multimodal content (list of content blocks)
                    for block in content:
                        if isinstance(block, dict) and block.get('type') == 'text':
                            prompt_words += len(block.get('text', '').split())
                        elif isinstance(block, str):
                            prompt_words += len(block.split())
                elif isinstance(content, str):
                    prompt_words += len(content.split())
            
            completion_words = len(full_content.split())
            
            return {
                'prompt_tokens': prompt_words,
                'completion_tokens': completion_words,
                'total_tokens': prompt_words + completion_words
            }

# Global instance
token_counter = TokenCounter()
