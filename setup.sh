#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}OnMicro AI Setup${NC}"
echo "================================="

# ── .env ────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "Created ${GREEN}.env${NC} from .env.example"
else
    echo ".env already exists — skipping copy"
fi

# Helpers
gen_key() {
    openssl rand -base64 $(( $1 * 2 )) 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c "$1"
    echo
}

PLACEHOLDERS="your_secret_key change_me changeme change_me_to_secure_key_in_prod django-insecure- your_access_key your_bucket_name your_region sk_live sk_test pk_live pk_test ***"

_is_placeholder() {
    local val="${1,,}"
    val="${val//\'/}"
    val="${val//\"/}"
    [[ -z "$val" ]] && return 0
    for p in $PLACEHOLDERS; do
        [[ "$val" == *"$p"* ]] && return 0
    done
    return 1
}

# Replace a key in .env only if its current value matches a known insecure placeholder.
set_if_placeholder() {
    local key="$1"
    local new_value="$2"
    local tmpfile replaced=false
    tmpfile=$(mktemp)

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^${key}[[:space:]]*=(.*)$ ]]; then
            local current="${BASH_REMATCH[1]}"
            current="${current#\'}" current="${current%\'}"
            current="${current#\"}" current="${current%\"}"
            if _is_placeholder "$current"; then
                printf '%s=%s\n' "$key" "$new_value"
                replaced=true
                continue
            fi
        fi
        printf '%s\n' "$line"
    done < .env > "$tmpfile"

    mv "$tmpfile" .env
    [[ "$replaced" == "true" ]] && echo "  Generated $key" || true
}

_update_env_key() {
    local key="$1" new_value="$2" tmpfile
    tmpfile=$(mktemp)
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^${key}[[:space:]]*= ]]; then
            printf '%s=%s\n' "$key" "$new_value"
        else
            printf '%s\n' "$line"
        fi
    done < .env > "$tmpfile"
    mv "$tmpfile" .env
    echo "  Set ${key}=${new_value}"
}

# Auto-generate secrets
echo ""
echo -e "${BOLD}Generating secure keys...${NC}"
set_if_placeholder "SECRET_KEY"              "'$(gen_key 50)'"
set_if_placeholder "SIMPLE_JWT_SIGNING_KEY"  "'$(gen_key 50)'"
set_if_placeholder "LITELLM_SALT_KEY"        "$(gen_key 32)"
set_if_placeholder "LITELLM_MASTER_KEY"      "$(gen_key 32)"
set_if_placeholder "LITELLM_DB_PASSWORD"     "$(gen_key 24)"
set_if_placeholder "DATABASE_PASSWORD"       "$(gen_key 24)"

# Keep DATABASE_URL in sync with DATABASE_PASSWORD (they must match)
_sync_db_url() {
    local pass url new_url
    pass=$(grep -E '^DATABASE_PASSWORD[[:space:]]*=' .env | cut -d= -f2- | tr -d "'\"\r\n ")
    url=$(grep -E  '^DATABASE_URL[[:space:]]*='      .env | cut -d= -f2- | tr -d "'\"\r\n")
    new_url=$(echo "$url" | sed -E "s|://([^:]+):[^@]+@|://\1:${pass}@|")
    _update_env_key "DATABASE_URL" "'${new_url}'"
}
_sync_db_url

# AI API key
echo ""
echo -e "${BOLD}AI Provider${NC}"
echo "At least one AI API key is required."
echo "  1) OpenAI   (OPENAI_API_KEY)"
echo "  2) Anthropic (ANTHROPIC_API_KEY)"
echo "  3) Google   (GOOGLE_API_KEY)"
echo "  4) Skip (I'll add it manually)"
echo -n "Choose [1-4]: "
read choice

case $choice in
    1)
        echo -n "OpenAI API key: "
        read -s api_key; echo
        set_if_placeholder "OPENAI_API_KEY" "$api_key"
        ;;
    2)
        echo -n "Anthropic API key: "
        read -s api_key; echo
        set_if_placeholder "ANTHROPIC_API_KEY" "$api_key"
        ;;
    3)
        echo -n "Google API key: "
        read -s api_key; echo
        set_if_placeholder "GOOGLE_API_KEY" "$api_key"
        ;;
    *)
        echo -e "${YELLOW}Skipped — set at least one AI key in .env before starting.${NC}"
        ;;
esac

# Production domain
echo ""
echo -n "Is this a production deployment? [y/N]: "
read is_prod

if [[ "$is_prod" =~ ^[Yy]$ ]]; then
    echo -n "Domain (e.g. yourdomain.com): "
    read domain
    if [ -n "$domain" ]; then
        _update_env_key "DOMAIN" "https://$domain"
    fi
    _update_env_key "PRODUCTION" "True"
    _update_env_key "DEBUG" "False"
fi

# Done
echo ""
echo -e "${GREEN}Setup complete.${NC}"
echo "Start the application with: docker compose up -d"
echo ""
echo -e "${YELLOW}Optional services (edit .env to enable):${NC}"
echo "  • AWS S3 + CloudFront  — set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, CLOUDFRONT_DOMAIN"
echo "  • Email (SMTP/SES)     — set EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD"
echo "  • Stripe billing       — set STRIPE_TEST_SECRET_KEY (or LIVE for production)"
