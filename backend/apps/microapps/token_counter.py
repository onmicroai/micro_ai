"""
Token counting utilities for models that don't provide usage data in streaming responses.
This module provides fallback token counting for Anthropic and Google models.
"""

import tiktoken
import logging
from typing import Dict, Any, List, Optional
import re

log = logging.getLogger(__name__)

class TokenCounter:
    """
    Token counter for models that don't provide usage data in streaming responses.
    Uses tiktoken for OpenAI-compatible tokenization as a fallback.
    """
    
    def __init__(self):
        # Initialize encodings for different model families
        self.encodings = {}
        self._init_encodings()
    
    def _init_encodings(self):
        """Initialize tiktoken encodings for different model families."""
        try:
            # Use cl100k_base for most modern models (GPT-4, Claude, etc.)
            self.encodings['cl100k_base'] = tiktoken.get_encoding("cl100k_base")
            # Use p50k_base for older models
            self.encodings['p50k_base'] = tiktoken.get_encoding("p50k_base")
            # Use r50k_base for GPT-3 models
            self.encodings['r50k_base'] = tiktoken.get_encoding("r50k_base")
        except Exception as e:
            log.error(f"Error initializing tiktoken encodings: {e}")
    
    def get_encoding_for_model(self, model_name: str) -> Optional[tiktoken.Encoding]:
        """
        Get the appropriate encoding for a model.
        
        Args:
            model_name: The model identifier
            
        Returns:
            tiktoken.Encoding or None if not found
        """
        # Default to cl100k_base for most modern models
        if any(name in model_name.lower() for name in ['gpt-4', 'gpt-5', 'claude', 'gemini']):
            return self.encodings.get('cl100k_base')
        elif 'gpt-3' in model_name.lower():
            return self.encodings.get('r50k_base')
        else:
            return self.encodings.get('cl100k_base')
    
    def count_tokens(self, text: str, model_name: str = None) -> int:
        """
        Count tokens in text using tiktoken.
        
        Args:
            text: The text to count tokens for
            model_name: Optional model name for encoding selection
            
        Returns:
            Number of tokens
        """
        if not text:
            return 0
            
        try:
            encoding = self.get_encoding_for_model(model_name or '')
            if not encoding:
                # Fallback to simple word count estimation
                return len(text.split())
            
            return len(encoding.encode(text))
        except Exception as e:
            log.error(f"Error counting tokens: {e}")
            # Fallback to word count estimation
            return len(text.split())
    
    def count_messages_tokens(self, messages: List[Dict[str, str]], model_name: str = None) -> int:
        """
        Count tokens in a list of messages (conversation format).
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            model_name: Optional model name for encoding selection
            
        Returns:
            Total number of tokens in all messages
        """
        if not messages:
            return 0
            
        try:
            encoding = self.get_encoding_for_model(model_name or '')
            if not encoding:
                # Fallback to simple word count
                total_words = 0
                for message in messages:
                    content = message.get('content', '')
                    total_words += len(content.split())
                return total_words
            
            total_tokens = 0
            for message in messages:
                # Count tokens for role + content
                role = message.get('role', '')
                content = message.get('content', '')
                
                # Add tokens for role and content
                role_tokens = len(encoding.encode(role))
                content_tokens = len(encoding.encode(content))
                
                # Add some overhead for message formatting (typically 4 tokens per message)
                total_tokens += role_tokens + content_tokens + 4
            
            return total_tokens
        except Exception as e:
            log.error(f"Error counting message tokens: {e}")
            # Fallback to word count
            total_words = 0
            for message in messages:
                content = message.get('content', '')
                total_words += len(content.split())
            return total_words
    
    def estimate_usage_for_streaming(self, 
                                   messages: List[Dict[str, str]], 
                                   full_content: str, 
                                   model_name: str) -> Dict[str, int]:
        """
        Estimate usage data for streaming responses when not provided by the model.
        
        Args:
            messages: Original conversation messages
            full_content: Complete response content from streaming
            model_name: Model identifier
            
        Returns:
            Dictionary with estimated usage data
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
            # Fallback to simple word count
            prompt_words = sum(len(msg.get('content', '').split()) for msg in messages)
            completion_words = len(full_content.split())
            
            return {
                'prompt_tokens': prompt_words,
                'completion_tokens': completion_words,
                'total_tokens': prompt_words + completion_words
            }

# Global instance
token_counter = TokenCounter()
