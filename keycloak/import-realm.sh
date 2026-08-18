#!/bin/sh
# Idempotently apply keycloak/realm-export.json to a running Keycloak container.
#
# Keycloak's own `--import-realm` startup flag only bootstraps a realm that
# doesn't exist yet — it will not push edits into an already-running instance.
# This script is what makes the realm config-as-code guarantee real: run it
# after every deploy (not just first boot) so drift is impossible by
# construction, per docs/keycloak-migration.md section 1.
#
# Usage: KEYCLOAK_CONTAINER=keycloak DOMAIN=https://dev.onmicro.ai \
#        KEYCLOAK_REALM=onmicro KEYCLOAK_ADMIN=admin \
#        KEYCLOAK_ADMIN_PASSWORD=... ./keycloak/import-realm.sh
set -eu

KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-keycloak}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:?KEYCLOAK_REALM must be set}"
DOMAIN="${DOMAIN:?DOMAIN must be set}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:?KEYCLOAK_ADMIN must be set}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD must be set}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KCADM="docker exec -i ${KEYCLOAK_CONTAINER} /opt/keycloak/bin/kcadm.sh"

# Render the realm template — same envsubst approach already used for nginx's
# NGINX_SERVER_NAME (nginx/docker-entrypoint.d/14-set-nginx-server-name.sh).
RENDERED="$(mktemp)"
trap 'rm -f "$RENDERED"' EXIT
DOMAIN="$DOMAIN" KEYCLOAK_REALM="$KEYCLOAK_REALM" \
  envsubst '${DOMAIN} ${KEYCLOAK_REALM}' \
  < "${SCRIPT_DIR}/realm-export.json" > "$RENDERED"

echo "Authenticating kcadm against ${KEYCLOAK_CONTAINER}..."
$KCADM config credentials \
  --server http://localhost:8080/auth \
  --realm master \
  --user "$KEYCLOAK_ADMIN" \
  --password "$KEYCLOAK_ADMIN_PASSWORD"

if $KCADM get "realms/${KEYCLOAK_REALM}" >/dev/null 2>&1; then
  echo "Realm '${KEYCLOAK_REALM}' exists — applying partial update."
  docker exec -i "${KEYCLOAK_CONTAINER}" \
    /opt/keycloak/bin/kcadm.sh update "realms/${KEYCLOAK_REALM}" -f - < "$RENDERED"
else
  echo "Realm '${KEYCLOAK_REALM}' does not exist — creating."
  docker exec -i "${KEYCLOAK_CONTAINER}" \
    /opt/keycloak/bin/kcadm.sh create realms -f - < "$RENDERED"
fi

echo "Realm import complete."
