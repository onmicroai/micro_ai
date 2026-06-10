## 🔒 SSL Certificate Renewal with Certbot (Dockerized Setup)

To renew the Let's Encrypt SSL certificate for the site, follow these steps:

### 1. Run Certbot Renewal
This uses the `webroot` method and writes updated certificates directly into the Nginx-mounted volume:

```bash
docker run --rm \
  -v "/docker/volumes/micro_ai/nginx/certbot/conf:/etc/letsencrypt" \
  -v "/docker/volumes/micro_ai/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot renew --webroot -w /var/www/certbot --no-random-sleep-on-renew -v
```


### 2. Verify the New Certificate Expiration Date
After renewal, confirm the certificate was updated:

```bash
openssl x509 -noout -dates -in /docker/volumes/micro_ai/nginx/certbot/conf/live/<sitename>/fullchain.pem
```

You should see an expiration date about 90 days from today.

### 3. Reload Nginx to Serve the Updated Certificate
```bash
docker exec nginx nginx -s reload
```

