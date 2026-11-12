#!/bin/sh
# Prefer an untracked local override so litellm/config.yaml can stay as committed.
set -eu

if [ -f /litellm-config/config.override.yaml ]; then
  CONFIG=/litellm-config/config.override.yaml
else
  CONFIG=/litellm-config/config.yaml
fi

echo "LiteLLM config: ${CONFIG}"
exec /app/docker/prod_entrypoint.sh --config "$CONFIG" --host 0.0.0.0 --port 4000
