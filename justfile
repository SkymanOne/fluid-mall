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

# Run iOS app in the simulator
ios:
    pnpm --filter mobile exec expo start --ios

# Build and install iOS app on a connected iPhone, pass device name or UDID to skip the picker
# Serves Metro on the Tailscale IP when Tailscale is up, for networks that block device to device traffic
ios-device *device:
    REACT_NATIVE_PACKAGER_HOSTNAME="$(tailscale status >/dev/null 2>&1 && tailscale ip -4)" pnpm --filter mobile exec expo run:ios --device {{device}}

# Same as ios-device but Release with the JS bundled in, works when the phone cannot reach Metro
ios-device-release *device:
    pnpm --filter mobile exec expo run:ios --configuration Release --device {{device}}

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
