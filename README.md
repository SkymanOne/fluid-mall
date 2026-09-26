# Fluid Mall

One cart for every store, with a shop that builds itself around what you want.

The buyer says what they want to buy or build. An agent searches several merchants, then composes a shopping interface for that request on the fly and fills it with real items. The buyer shapes it by prompting ("show me only linen", "compare delivery times", "dark theme"). Everything lands in one cart. At checkout, agents split the cart per merchant and handle payment, shipping and tracking.

Built for the [Grok Bot Commerce London Hackathon](https://gb-ecommerce-hackathon-09-2026.teamdeel.workers.dev/hackathon) (26 September 2026, Storefront Experience track).

## Features

- **Ask once.** A centred "What are you shopping for?" takes an outfit ("look cool at a tech event") or one item ("black jeans under £80").
- **Groups.** Every request becomes a group: an outfit (top, bottom, shoes, with other options per slot) or a set (a grid or list of one kind of item). Groups live in a hideable side panel.
- **One bag per group.** Add to bag on every item, or a whole outfit at once. Each bag checks out on its own, split per shop. Checkout is simulated.
- **Talk to the page.** Change the items ("sneakers for shoes", "only black") or the page ("show each category as a carousel", "add a buy button to each item", "dark mode", "only tops"). Page requests are Jev edits on the existing tree and never reload the items.
- **Storefronts.** How a group looks (grid, carousel or list, buy buttons, details, theme, spacing) is a storefront, saved as a JSON template without its products. Use it for new searches and the products found load straight into it, or use it on the open group.
- **Buying details.** Price in GBP, sizes, stock, UK delivery cost and time, and returns for every piece, read live from the shop. Unknown stays unknown.
- **Phone.** Installable PWA. Camera capture and outfit previews come next.

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
just compose-dev      # run the compose function locally on :8000
just compose-deploy   # push secrets from .env and deploy the function
```

For local work set `VITE_COMPOSE_URL=http://localhost:8000` in `apps/web/.env.development.local`. `/preview` renders the app without sign in, in dev only.

### Phone

Fluid is a PWA. Open the web app on the phone and add it to the Home Screen. `public/manifest.webmanifest` and `public/sw.js` make it installable.
