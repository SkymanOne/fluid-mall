# Fluid

Shopping mall in your hands. Say what you want to wear. Fluid searches UK shops and builds a shop around your request. Pieces from every shop go in one bag.

Live: [web app](https://fluid-web-azure.vercel.app) · [landing page](https://fluid-landing-nine.vercel.app). Built for the [Grok Bot Commerce London Hackathon](https://gb-ecommerce-hackathon-09-2026.teamdeel.workers.dev/hackathon) (26 September 2026, Storefront Experience track).

## Fluid UIs

Every page is a [json-render](https://json-render.dev) spec composed for one request. [Jev](https://json-render.dev/docs/jev) (TypeSafe) picks and arranges components from a fixed catalog (sections, grids, carousels, filters, sort, size guides, delivery and returns facts) and edits the page in place when you ask. It never writes code or copy. Code binds the real products into Jev's design, so one change reaches every item.

## Features

- **Say what you want to wear.** An outfit for an occasion ("I wanna look cool at a tech event") or one kind of item ("black jeans under £80"). Each request becomes its own group with its own bag.
- **Change the page by asking.** A carousel, a list, dark mode, only tops, group by colour, filters by size. Fluid rebuilds the page around the same pieces. Saved looks are reusable storefront templates.
- **One bag. Every shop.** At checkout Fluid splits the bag into an order per shop, each with its own delivery and returns. You confirm every total first. Checkout is simulated.
- **Stock information. All in one place.** Price in GBP, sizes and stock, UK delivery and returns, read from the shop. Unknown stays unknown.
- **See the outfit.** A shop the look photo of your picked pieces from the Grok image model, with a tag on each piece.
- **Keep it on your phone.** Runs in the browser and installs like an app.

## How a request runs

Each prompt is an intent made of up to four steps (details in `AGENTS.md`):

1. **Search items.** Grok, a generic agent, plans the searches and live search finds pieces in UK shops.
2. **Compose UI.** Jev designs the page from a component catalog with one sample card per category. Code loads every piece returned into that design.
3. **Refine UI.** Jev edits the existing page for requests like "carousel", "add a buy button" or "dark mode". Items stay.
4. **Update items.** Grok searches again for a follow-up like "sneakers for shoes" and only those items change.

## Stack

| Part | Tech |
| --- | --- |
| Landing | React Router, prerendered |
| Web app | React Router SPA, installable PWA, hosted on Vercel |
| UI | shadcn/ui (Radix, Nova preset) on Tailwind v4, Look Sheet tokens in `apps/web/app/app.css` |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Agent | `compose` Edge Function: Grok plans and searches, Jev composes and refines the UI |
| UI composition | Jev (TypeSafe API) with json-render `experimental_composeSpec`, like the json-render playground |
| Outfit images | Grok image model |
| Product sources | Shopify Storefront API, Tavily, seeded Supabase catalog |

## Structure

- `apps/landing` landing page with links to the web app and the App Store
- `apps/web` web app
- `apps/web/app/components/ui` shadcn components
- `apps/web/app/components/fluid` storefront screens that render the json-render spec
- `supabase` config, migrations, seed and Edge Functions
- `mockups` UI mocks (tldraw)

## Setup

Needs Node 22.22+, pnpm 12, [just](https://github.com/casey/just) and Docker for local Supabase.

```sh
just install
cp apps/landing/.env.example apps/landing/.env
just db     # local Supabase in Docker, writes apps/web/.env.development.local
just dev    # landing on :5174, web on :5173
```

Run `just` to list every recipe.

Sign up needs an invite code from `public.invite_codes`. Local seed adds `LOCAL-DEV`.

### Hosted Supabase

```sh
just db-link <project-ref>
just db-push
```

Then enable the `before_user_created` hook in Auth > Hooks, pointing at `public.hook_require_invite_code`. Put the project URL and publishable key in `apps/web/.env` (see `.env.example`).

Add invite codes with SQL:

```sql
insert into public.invite_codes (code, uses_left) values ('FRIENDS', 10);
```

### Server secrets

AI keys live in the root `.env` (gitignored) and in Edge Function secrets, never in app env files: `XAI_API_KEY`, `TYPESAFE_API_KEY`, `TAVILY_API_KEY`.

```sh
just compose-dev        # run the compose function locally on :8000
just outfit-image-dev   # run the outfit-image function locally on :8001
just compose-deploy     # push secrets from .env and deploy both functions
```

Pushes to `main` that change `supabase/functions` deploy the functions automatically (`.github/workflows/deploy-supabase.yml`). The repo needs the secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID`. Function secrets are set once with `just compose-deploy`.

For local work set `VITE_COMPOSE_URL=http://localhost:8000` and `VITE_OUTFIT_IMAGE_URL=http://localhost:8001` in `apps/web/.env.development.local`. `/preview` renders the app without sign in, in dev only.

### Phone

Fluid is a PWA. Open the web app on the phone and add it to the Home Screen. `public/manifest.webmanifest` and `public/sw.js` make it installable.
