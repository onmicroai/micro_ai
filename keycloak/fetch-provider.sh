#!/usr/bin/env bash
# Downloads the pinned "User migration using a REST client" provider JAR
# (https://github.com/daniel-frak/keycloak-user-migration) into
# keycloak/providers/, verifying its checksum. This directory is
# volume-mounted read-only into the Keycloak container
# (docker-compose*.yml: ./keycloak/providers:/opt/keycloak/providers:ro) —
# the base Keycloak image itself stays a pinned, unmodified upstream image
# (see keycloak/README.md), never rebuilt.
#
# Never a bare :latest — this pins one exact release + its exact bytes.
set -euo pipefail

VERSION="6.2.2"
JAR_NAME="keycloak-rest-provider-${VERSION}.jar"
URL="https://github.com/daniel-frak/keycloak-user-migration/releases/download/${VERSION}/${JAR_NAME}"
# Computed and pinned by hand against the published release asset — verify
# against a fresh download from the URL above if this version ever changes.
EXPECTED_SHA256="828b8eb559ae745d32efe82b0654c610ecce1340dfa10da3d0c1687e020ec028"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST_DIR="${SCRIPT_DIR}/providers"
DEST="${DEST_DIR}/${JAR_NAME}"

mkdir -p "$DEST_DIR"

if [ -f "$DEST" ]; then
  ACTUAL_SHA256="$(shasum -a 256 "$DEST" | cut -d' ' -f1)"
  if [ "$ACTUAL_SHA256" = "$EXPECTED_SHA256" ]; then
    echo "${JAR_NAME} already present and checksum matches — nothing to do."
    exit 0
  fi
  echo "Existing ${JAR_NAME} has an unexpected checksum — re-downloading."
fi

echo "Downloading ${JAR_NAME}..."
curl -sL -o "$DEST" "$URL"

ACTUAL_SHA256="$(shasum -a 256 "$DEST" | cut -d' ' -f1)"
if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
  echo "ERROR: checksum mismatch for ${JAR_NAME}." >&2
  echo "  expected: ${EXPECTED_SHA256}" >&2
  echo "  actual:   ${ACTUAL_SHA256}" >&2
  rm -f "$DEST"
  exit 1
fi

echo "Downloaded and verified ${JAR_NAME}."
