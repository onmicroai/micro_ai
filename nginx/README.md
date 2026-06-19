## Production nginx domain configuration

Production nginx reads **`NGINX_SERVER_NAME`** (hostname only, e.g. `nuteachai.org`) for:

- `server_name`
- Let's Encrypt certificate paths: `/etc/letsencrypt/live/<NGINX_SERVER_NAME>/`

If `NGINX_SERVER_NAME` is unset, the nginx entrypoint derives it from **`DOMAIN`** (`https://nuteachai.org` → `nuteachai.org`).

Set both in `.env` when deploying a new site:

```env
DOMAIN="https://nuteachai.org"
NGINX_SERVER_NAME="nuteachai.org"
```

`DOMAIN` is also used by Django, Stripe redirects, and the frontend API URL. Keep them aligned on the same host unless you have a deliberate split (uncommon).

The checked-in template is `nginx.prod.conf.template`. At container start, the official `nginx:alpine` image runs `envsubst` and writes `/etc/nginx/conf.d/default.conf`.

After changing domain or `.env`, recreate nginx:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

---

## SSL Certificate Renewal with Certbot (Dockerized Setup)

To renew the Let's Encrypt SSL certificate for the site, follow these steps:

### 1. Run Certbot Renewal
This uses the `webroot` method and writes updated certificates directly into the Nginx-mounted volume:

```bash
docker run --rm \
  -v "/home/ubuntu/micro_ai/nginx/certbot/conf:/etc/letsencrypt" \
  -v "/home/ubuntu/micro_ai/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot renew --webroot -w /var/www/certbot --no-random-sleep-on-renew -v
```


### 2. Verify the New Certificate Expiration Date
After renewal, confirm the certificate was updated (replace with your `NGINX_SERVER_NAME`):

```bash
openssl x509 -noout -dates -in /home/ubuntu/micro_ai/nginx/certbot/conf/live/<NGINX_SERVER_NAME>/fullchain.pem
```

You should see an expiration date about 90 days from today.

### 3. Reload Nginx to Serve the Updated Certificate
```bash
docker exec nginx nginx -s reload
```
