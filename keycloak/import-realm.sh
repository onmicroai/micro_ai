#!/usr/bin/env bash
# Idempotently apply keycloak/realm-export.json to a running Keycloak container.
#
# Keycloak's own `--import-realm` startup flag only bootstraps a realm that
# doesn't exist yet — it will not push edits into an already-running instance.
# This script is what makes the realm config-as-code guarantee real: run it
# after every deploy (not just first boot) so drift is impossible by
# construction, per docs/keycloak-migration.md section 1.
#
# A second, less obvious gotcha this script exists to work around: Keycloak's
# realm UPDATE endpoint (PUT /admin/realms/{realm}) does NOT cascade into
# nested collections like clients[].protocolMappers[] or components[] (e.g.
# the REST user federation provider) — that nested-object processing only
# happens on realm CREATE (POST /admin/realms). So a plain "update the whole
# realm JSON" only ever applies top-level realm settings; adding a protocol
# mapper to an existing client, or a new federation provider, via that path
# silently does nothing. This script therefore reconciles clients (with
# their protocol mappers) and components individually, by id, after the
# realm-level upsert.
#
# Requires: docker, envsubst (gettext), jq — all on the machine running this
# script (not inside the Keycloak container, which has neither).
#
# Usage: KEYCLOAK_CONTAINER=keycloak DOMAIN=https://dev.onmicro.ai \
#        KEYCLOAK_REALM=onmicro KEYCLOAK_ADMIN=admin \
#        KEYCLOAK_ADMIN_PASSWORD=... \
#        KEYCLOAK_FEDERATION_SHARED_SECRET=... ./keycloak/import-realm.sh
set -euo pipefail

KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-keycloak}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:?KEYCLOAK_REALM must be set}"
DOMAIN="${DOMAIN:?DOMAIN must be set}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:?KEYCLOAK_ADMIN must be set}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD must be set}"
KEYCLOAK_FEDERATION_SHARED_SECRET="${KEYCLOAK_FEDERATION_SHARED_SECRET:?KEYCLOAK_FEDERATION_SHARED_SECRET must be set}"

for bin in envsubst jq docker; do
  command -v "$bin" >/dev/null 2>&1 || {
    echo "ERROR: '$bin' is required on the machine running this script." >&2
    exit 1
  }
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

kc() {
  docker exec -i "${KEYCLOAK_CONTAINER}" /opt/keycloak/bin/kcadm.sh "$@"
}

# Render the realm template — same envsubst approach already used for nginx's
# NGINX_SERVER_NAME (nginx/docker-entrypoint.d/14-set-nginx-server-name.sh).
RENDERED="$(mktemp)"
trap 'rm -f "$RENDERED"' EXIT
DOMAIN="$DOMAIN" KEYCLOAK_REALM="$KEYCLOAK_REALM" \
  KEYCLOAK_FEDERATION_SHARED_SECRET="$KEYCLOAK_FEDERATION_SHARED_SECRET" \
  envsubst '${DOMAIN} ${KEYCLOAK_REALM} ${KEYCLOAK_FEDERATION_SHARED_SECRET}' \
  < "${SCRIPT_DIR}/realm-export.json" > "$RENDERED"
chmod 600 "$RENDERED"  # contains the federation shared secret in plaintext

echo "Authenticating kcadm against ${KEYCLOAK_CONTAINER}..."
kc config credentials \
  --server http://localhost:8080/auth \
  --realm master \
  --user "$KEYCLOAK_ADMIN" \
  --password "$KEYCLOAK_ADMIN_PASSWORD"

REALM_EXISTS=0
kc get "realms/${KEYCLOAK_REALM}" >/dev/null 2>&1 && REALM_EXISTS=1

if [ "$REALM_EXISTS" = "1" ]; then
  echo "Realm '${KEYCLOAK_REALM}' exists — applying top-level settings, then reconciling clients and components."
  jq 'del(.clients) | del(.components)' "$RENDERED" | kc update "realms/${KEYCLOAK_REALM}" -f -
else
  echo "Realm '${KEYCLOAK_REALM}' does not exist — creating (clients, protocol mappers, and components included)."
  kc create realms -f "$RENDERED"
  echo "Realm import complete."
  exit 0
fi

# Realm already existed, so nested clients/protocolMappers from the create
# path above were skipped — reconcile each client individually.
CLIENT_COUNT=$(jq '.clients | length' "$RENDERED")
i=0
while [ "$i" -lt "$CLIENT_COUNT" ]; do
  CLIENT_JSON=$(jq -c ".clients[$i]" "$RENDERED")
  CLIENT_ID=$(echo "$CLIENT_JSON" | jq -r '.clientId')
  CLIENT_BODY=$(echo "$CLIENT_JSON" | jq 'del(.protocolMappers)')
  MAPPERS_JSON=$(echo "$CLIENT_JSON" | jq -c '.protocolMappers // []')

  INTERNAL_ID=$(kc get clients -r "$KEYCLOAK_REALM" -q "clientId=${CLIENT_ID}" --fields id \
    | jq -r '.[0].id // empty')

  if [ -z "$INTERNAL_ID" ]; then
    echo "  client '${CLIENT_ID}' does not exist — creating."
    echo "$CLIENT_JSON" | kc create clients -r "$KEYCLOAK_REALM" -f -
    INTERNAL_ID=$(kc get clients -r "$KEYCLOAK_REALM" -q "clientId=${CLIENT_ID}" --fields id \
      | jq -r '.[0].id')
  else
    echo "  client '${CLIENT_ID}' exists (${INTERNAL_ID}) — updating."
    echo "$CLIENT_BODY" | kc update "clients/${INTERNAL_ID}" -r "$KEYCLOAK_REALM" -f -

    MAPPER_COUNT=$(echo "$MAPPERS_JSON" | jq 'length')
    j=0
    while [ "$j" -lt "$MAPPER_COUNT" ]; do
      MAPPER_JSON=$(echo "$MAPPERS_JSON" | jq -c ".[$j]")
      MAPPER_NAME=$(echo "$MAPPER_JSON" | jq -r '.name')

      EXISTING_MAPPER_ID=$(kc get "clients/${INTERNAL_ID}/protocol-mappers/models" -r "$KEYCLOAK_REALM" \
        | jq -r --arg name "$MAPPER_NAME" '.[] | select(.name == $name) | .id')

      if [ -z "$EXISTING_MAPPER_ID" ]; then
        echo "    protocol mapper '${MAPPER_NAME}' does not exist — creating."
        echo "$MAPPER_JSON" | kc create "clients/${INTERNAL_ID}/protocol-mappers/models" -r "$KEYCLOAK_REALM" -f -
      else
        echo "    protocol mapper '${MAPPER_NAME}' exists — updating."
        # Keycloak's PUT handler looks up the entity by the "id" field inside
        # the body itself, not just the URL path — omitting it NPEs server-side.
        echo "$MAPPER_JSON" | jq --arg id "$EXISTING_MAPPER_ID" '.id = $id' \
          | kc update "clients/${INTERNAL_ID}/protocol-mappers/models/${EXISTING_MAPPER_ID}" \
              -r "$KEYCLOAK_REALM" -f -
      fi
      j=$((j + 1))
    done
  fi
  i=$((i + 1))
done

# Reconcile components (e.g. the REST user federation provider) — same
# nested-collection gotcha as clients above; only realm CREATE processes
# these, not UPDATE.
PROVIDER_TYPES=$(jq -r '.components // {} | keys[]' "$RENDERED")
for PROVIDER_TYPE in $PROVIDER_TYPES; do
  COMPONENT_COUNT=$(jq --arg pt "$PROVIDER_TYPE" '.components[$pt] | length' "$RENDERED")
  k=0
  while [ "$k" -lt "$COMPONENT_COUNT" ]; do
    COMPONENT_JSON=$(jq -c --arg pt "$PROVIDER_TYPE" ".components[\$pt][$k]" "$RENDERED")
    COMPONENT_NAME=$(echo "$COMPONENT_JSON" | jq -r '.name')

    EXISTING_COMPONENT_ID=$(kc get components -r "$KEYCLOAK_REALM" \
        -q "name=${COMPONENT_NAME}" -q "type=${PROVIDER_TYPE}" \
      | jq -r '.[0].id // empty')

    if [ -z "$EXISTING_COMPONENT_ID" ]; then
      echo "  component '${COMPONENT_NAME}' (${PROVIDER_TYPE}) does not exist — creating."
      echo "$COMPONENT_JSON" | kc create components -r "$KEYCLOAK_REALM" -f -
    else
      echo "  component '${COMPONENT_NAME}' (${PROVIDER_TYPE}) exists (${EXISTING_COMPONENT_ID}) — updating."
      echo "$COMPONENT_JSON" | jq --arg id "$EXISTING_COMPONENT_ID" '.id = $id' \
        | kc update "components/${EXISTING_COMPONENT_ID}" -r "$KEYCLOAK_REALM" -f -
    fi
    k=$((k + 1))
  done
done

echo "Realm import complete."
