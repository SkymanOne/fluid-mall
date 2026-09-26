default:
    @just --list

# Install dependencies
install:
    pnpm install

# Run landing page and web app
dev:
    pnpm --parallel --filter landing --filter web dev

# Run landing page on :5174
landing:
    pnpm --filter landing dev

# Run web app on :5173
web:
    pnpm --filter web dev

# Build landing page and web app
build:
    pnpm --filter landing --filter web build

# Typecheck every package
typecheck:
    pnpm -r typecheck

# Start local Supabase (needs Docker) and point web and mobile at it
db:
    pnpm supabase start
    just db-env

# Write local Supabase URL and key into the dev env files of web and mobile
db-env:
    #!/usr/bin/env bash
    set -euo pipefail
    eval "$(pnpm exec supabase status -o env)"
    printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$API_URL" "$PUBLISHABLE_KEY" > apps/web/.env.development.local
    printf 'EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=%s\n' "$API_URL" "$PUBLISHABLE_KEY" > apps/mobile/.env.development.local

# Stop local Supabase
db-stop:
    pnpm supabase stop

# Recreate local database from migrations and seed
db-reset:
    pnpm supabase db reset

# Link the hosted Supabase project
db-link ref:
    pnpm supabase link --project-ref {{ref}}

# Push migrations to the linked hosted project
db-push:
    pnpm supabase db push

# Run the compose Edge Function on :8000 without Docker. Set COMPOSE_DEV_SKIP_AUTH=1 to skip the JWT check
compose-dev:
    #!/usr/bin/env bash
    set -euo pipefail
    export SUPABASE_URL="$(grep '^VITE_SUPABASE_URL=' apps/web/.env | cut -d= -f2- | tr -d '"')"
    export SUPABASE_ANON_KEY="$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' apps/web/.env | cut -d= -f2- | tr -d '"')"
    DENO_NO_PACKAGE_JSON=1 deno run --no-lock --env-file=.env --allow-net --allow-env --allow-read supabase/functions/compose/index.ts --local

# Run the outfit-image Edge Function on :8001 without Docker. Set COMPOSE_DEV_SKIP_AUTH=1 to skip the JWT check
outfit-image-dev port="8001":
    #!/usr/bin/env bash
    set -euo pipefail
    export SUPABASE_URL="$(grep '^VITE_SUPABASE_URL=' apps/web/.env | cut -d= -f2- | tr -d '"')"
    export SUPABASE_ANON_KEY="$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' apps/web/.env | cut -d= -f2- | tr -d '"')"
    DENO_SERVE_ADDRESS=tcp:0.0.0.0:{{port}} DENO_NO_PACKAGE_JSON=1 deno run --no-lock --env-file=.env --allow-net --allow-env --allow-read supabase/functions/outfit-image/index.ts --local

# Push secrets from .env and deploy the compose and outfit-image Edge Functions to the linked project
compose-deploy:
    pnpm supabase secrets set --env-file .env
    pnpm supabase functions deploy compose
    pnpm supabase functions deploy outfit-image
