# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

OnMicro.AI is a no-code platform that lets educators build and deploy AI-powered "micro apps" — multi-phase, form-like apps where each phase can collect user input (text, audio, file uploads) and generate an AI response. The platform is multi-tenant, supports subscriptions/credits, and routes all LLM calls through a self-hosted LiteLLM proxy.

## Commands

### Docker (primary dev workflow)

All backend work runs inside Docker. Use `make` from the `backend/` directory:

```bash
make start          # docker compose up
make start-bg       # docker compose up -d
make stop           # docker compose down
make migrations     # python manage.py makemigrations (inside container)
make migrate        # python manage.py migrate (inside container)
make test           # python manage.py test (inside container)
make shell          # Django shell inside container
make ssh            # bash into running web container
make format         # run black + isort on backend code
make build          # rebuild Docker images
```

Access points when running:
- App: http://localhost
- Django API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/api/schema/swagger-ui/
- LiteLLM proxy: http://localhost:8008

### Frontend (inside the container or locally)

```bash
npm run dev         # Next.js dev server
npm run build       # production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
```

### Playwright E2E Tests

Tests live in `playwright/`. Config at `playwright/playwright.config.ts`. Requires a `.env` or `.env.local` file with `TEST_BASE_URL` and credentials.

```bash
npx playwright test                          # run all tests
npx playwright test tests/foo.spec.ts        # run a single file
```

### Commit Message Convention

```
<type>: #<issue-number> <description>
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Breaking changes use `!` suffix.

## Architecture

### Services (docker-compose.yml)

| Service | Role |
|---------|------|
| `db` | PostgreSQL 17 with pgvector extension |
| `web` | Django + Uvicorn (ASGI), port 8000 |
| `frontend` | Next.js 14, port 3000 (internal) |
| `om-litellm` | LiteLLM proxy, port 8008 — all LLM calls go through here |
| `nginx` | Reverse proxy on port 80 routing to frontend + backend |
| `theme-cron` | Runs `generate_app_themes` management command daily |

### Backend (`backend/`)

Django app using DRF + `dj-rest-auth` + `allauth` for auth (JWT via `simplejwt`, Google OAuth, MFA). ASGI server (Uvicorn) enables streaming SSE responses.

**App layout** (`backend/apps/`):

| App | Purpose |
|-----|---------|
| `microapps` | Core: app CRUD, run execution, analytics, rubric scoring, RAG, streaming |
| `api` | Shared DRF schema, permissions, helpers |
| `authentication` | Custom allauth views, JWT endpoints |
| `users` | User profile, avatar handling |
| `subscriptions` | Stripe integration, credits system, plan feature gating |
| `collection` | User-curated collections of micro apps |
| `dashboard` | Dashboard ordering/layout views |
| `lti` | LTI 1.3 integration for LMS embedding |
| `web` | Static web views (homepage, sitemap) |

**Key files in `microapps/`:**

- `models.py` — `Microapp` model stores the entire app definition as a JSON field (`app_json`). The schema for this field is documented in `docs/microapp-json-schema.md`.
- `llm_interface.py` — `UnifiedLLMInterface` wraps LiteLLM for all LLM calls. Model configs are fetched dynamically from the LiteLLM API (cached 5 min) via `dynamic_model_service.py`.
- `streaming.py` — `litellm_sse_generator()` is the async SSE generator used by run views to stream AI responses to the client.
- `rag_service.py` — Chunks and embeds attached files using `text-embedding-3-small` via LiteLLM; retrieves relevant chunks using pgvector cosine distance.
- `views/app_builder_views.py` — AI-assisted app generation endpoint; streams back generated `app_json`.
- `views/run_views.py` — App execution endpoints (authenticated and anonymous runs).
- `views/analytics_views.py` — Per-app usage stats, conversation logs, score analysis.

**Model access tiers** — controlled by LiteLLM `access_groups` in `litellm/config.yaml`: `free`, `pro`, `enterprise`, `legacy`. Legacy models are maintained for backwards compatibility but not offered to new apps.

### Frontend (`frontend/src/`)

Next.js 14 App Router. UI uses shadcn/ui components (Radix UI primitives + Tailwind), Zustand for client state, `react-hook-form` + Zod for forms.

**Route groups:**
- `(public)/` — unauthenticated pages: homepage, library, about, pricing, accounts
- `(authenticated)/(dashboard)/` — user dashboard
- `(authenticated)/app/(pages)/[id]/` — app runner (user-facing)
- `(authenticated)/app/(pages)/[id]/edit` — app builder/editor

**State stores** (`src/store/`):
- `conversationStore.ts` — conversation history for the current run
- `runtimeSurveyStore.ts` — tracks phase/element progression during a run
- `runtimeTryStore.ts` — manages "try again" state
- `userStore.ts` — user profile and subscription info

**Key component categories** (`src/components/`):
- `QuestionTypes/` — renderers for each element type (text input, file upload, audio, etc.)
- `modules/` — larger feature modules (app builder UI, analytics dashboard)
- `layout/` — shared layout components

### Microapp JSON Schema (`app_json`)

The `Microapp.app_json` field is the source of truth for app behavior. There are two versions:

- **V2 (current):** Flat `elements[]` array — new apps should always use V2.
- **V1 (legacy):** Nested `phases[]` — still supported for existing apps.

The full schema is in `docs/microapp-json-schema.md`. The backend is schema-agnostic; the frontend owns interpretation.

### LiteLLM Proxy

All LLM calls go through the LiteLLM proxy (`om-litellm`) rather than directly to providers. The proxy handles:
- Model routing and fallbacks (configured in `litellm/config.yaml`)
- Spend logging to the `litellm` Postgres database
- Access group enforcement per subscription tier

`DynamicModelService` fetches available models from the LiteLLM `/models` API and caches them for 5 minutes.

### Subscriptions & Credits

- Stripe powers subscriptions via `apps/subscriptions/`.
- `feature_gate_check()` in `subscriptions/feature_gating.py` enforces plan limits.
- A credits system (separate from Stripe) is implemented in `subscriptions/credits.py`.
- Model access is gated at the LiteLLM level via `access_groups` matching the user's subscription plan slug.
