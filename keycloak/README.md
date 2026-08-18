# Keycloak

Identity provider for OnMicro.AI, per `docs/keycloak-migration.md`. One Keycloak
per instance, single realm, its own database inside the instance's existing
Postgres (`db:5432/keycloak`, same pattern as `litellm` — see `postgres/init.sql`).

## Realm config-as-code

`realm-export.json` is the source of truth for the realm — clients, token
lifespans, protocol mappers, identity providers. It is applied with
`import-realm.sh`, not with Keycloak's built-in `--import-realm` startup flag,
because that flag only bootstraps a realm that doesn't exist yet; it will not
push an edit into an already-running instance.

**To apply a change:** edit `realm-export.json`, then run:

```bash
KEYCLOAK_CONTAINER=keycloak \
DOMAIN=https://dev.onmicro.ai \
KEYCLOAK_REALM=onmicro \
KEYCLOAK_ADMIN=admin \
KEYCLOAK_ADMIN_PASSWORD=<from .env> \
./keycloak/import-realm.sh
```

CI runs this automatically after every deploy (see the GitHub Actions
workflows), so drift between the committed JSON and the running realm is not
possible by construction.

## Local admin access

The admin console lives at `<DOMAIN>/auth/admin/` (note the `/auth` prefix —
`KC_HTTP_RELATIVE_PATH=/auth` is set specifically so Keycloak's admin console
doesn't collide with the nginx regex that already routes bare `/admin/` to
Django). Log in with `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` from `.env`.

## First-time setup on an existing (already-initialized) server

`postgres/init.sql` only runs on a fresh Postgres data directory — it will
not retroactively create the `keycloak` database on a dev/prod server whose
Postgres volume already has data (this is the same situation `litellm`'s
database was in). On those servers, create it once by hand:

```bash
docker exec -it db psql -U "$DATABASE_USER" -c "CREATE DATABASE keycloak;"
```

## What's not here yet

- The REST federation User Storage Provider JAR (`user-storage-provider/`) —
  added in a later PR, once the Django-side federation endpoints exist.
- Google and university IdP brokers — realm config added in later PRs.
