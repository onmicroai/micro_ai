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

## Custom login theme

`themes/onmicro/login/` extends Keycloak 26's default `keycloak.v2` theme,
overriding only the page background (a gradient from the app's primary
brand color to white — see `resources/css/onmicro.css`) so login, register,
verify-email, reset-password, etc. all inherit the rest of the stock theme
unchanged. Set via `realm-export.json`'s `loginTheme`, applied the normal
config-as-code way (`import-realm.sh`).

`resources/js/light-mode.js` pins the pages to PatternFly's light palette by
stripping the `pf-v5-theme-dark` class the parent theme sets from
`prefers-color-scheme`. Without it, visitors whose OS is in dark mode get
light-grey text on the white panels this theme paints. The file's own header
explains why this is JS rather than more CSS — read it before touching it.

Keycloak only serves files that live under the theme directory, so the images
in `resources/img/` are copies rather than references:

- `favicon.ico` — copied from `frontend/public/img/favicons/favicon.ico`, so
  the auth pages carry the app's icon instead of the stock Keycloak one. The
  parent template links `${url.resourcesPath}/img/favicon.ico` and quietly
  falls back to Keycloak's own file when the theme has none, so a drift here
  shows up as the wrong icon, not an error. Re-copy it whenever the frontend's
  favicon is rebranded.
- `onmicro-logo.svg` — the white wordmark, same bytes as
  `frontend/src/img/logo.svg`. It has to be the white variant; the colour logo
  in `frontend/public/` disappears against the blue panel. Note that the
  `src/img/` original is not imported anywhere in the frontend, so this copy
  is in practice the only live one.
- `auth-img.png` — the brand-panel illustration, owned by this theme alone.

Themes are only scanned at Keycloak boot, same as the federation provider
JAR — after adding or editing a theme file, the container needs a full
recreate (`docker compose up -d --force-recreate keycloak`), not just a
restart, for the change to take effect.

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
