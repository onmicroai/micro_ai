#!/bin/sh
set -eu

# NGINX_SERVER_NAME must match the Let's Encrypt cert directory name
# (e.g. nuteachai.org → /etc/letsencrypt/live/nuteachai.org/).
#
# If unset, derive hostname from DOMAIN (https://example.com → example.com).
if [ -z "${NGINX_SERVER_NAME:-}" ]; then
  if [ -z "${DOMAIN:-}" ]; then
    echo "ERROR: Set NGINX_SERVER_NAME or DOMAIN for nginx production config." >&2
    exit 1
  fi

  NGINX_SERVER_NAME="$(printf '%s' "$DOMAIN" | sed -e 's|^https\?://||' -e 's|/.*||' -e 's|:.*||')"
  export NGINX_SERVER_NAME
fi

echo "nginx server_name / TLS cert domain: ${NGINX_SERVER_NAME}"
