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
    python3 -c "import secrets, string; chars = string.ascii_letters + string.digits; print(''.join(secrets.choice(chars) for _ in range($1)))"
}

# Replace a key in .env only if its current value matches a known insecure placeholder.
# Uses Python to avoid sed portability issues (macOS vs Linux) and special-char escaping.
set_if_placeholder() {
    local key=$1
    local new_value=$2
    python3 - "$key" "$new_value" <<'PYEOF'
import sys, re

key, new_value = sys.argv[1], sys.argv[2]
PLACEHOLDERS = [
    'your_secret_key', 'change_me', 'changeme',
    'change_me_to_secure_key_in_prod', 'django-insecure-',
    'your_access_key', 'your_bucket_name', 'your_region',
    'sk_live_***', 'sk_test_***', 'pk_live_***', 'pk_test_***',
    '***', "'your_secret_key'",
]

with open('.env', 'r') as f:
    lines = f.readlines()

new_lines = []
replaced = False
for line in lines:
    m = re.match(rf'^{re.escape(key)}\s*=\s*(.*)', line.rstrip())
    if m:
        current = m.group(1).strip("'\"")
        if not current or any(p.lower() in current.lower() for p in PLACEHOLDERS):
            new_lines.append(f'{key}={new_value}\n')
            replaced = True
            continue
    new_lines.append(line)

if replaced:
    with open('.env', 'w') as f:
        f.writelines(new_lines)
    print(f'  Generated {key}')
PYEOF
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
        python3 - "DOMAIN" "https://$domain" <<'PYEOF'
import sys, re
key, new_value = sys.argv[1], sys.argv[2]
with open('.env', 'r') as f:
    lines = f.readlines()
new_lines = [f'{key}={new_value}\n' if re.match(rf'^{re.escape(key)}\s*=', line) else line for line in lines]
with open('.env', 'w') as f:
    f.writelines(new_lines)
print(f'  Set {key}={new_value}')
PYEOF
    fi

    # Flip PRODUCTION and DEBUG
    python3 - <<'PYEOF'
import re
with open('.env', 'r') as f:
    content = f.read()
content = re.sub(r'^PRODUCTION\s*=.*', 'PRODUCTION=True', content, flags=re.MULTILINE)
content = re.sub(r'^DEBUG\s*=.*', 'DEBUG=False', content, flags=re.MULTILINE)
with open('.env', 'w') as f:
    f.write(content)
print('  Set PRODUCTION=True, DEBUG=False')
PYEOF
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
