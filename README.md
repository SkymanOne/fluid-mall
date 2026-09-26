# Fluid Mall

One cart for every store, with a shop that builds itself around what you want.

The buyer says what they want to buy or build. An agent searches several merchants, then composes a shopping interface for that request on the fly and fills it with real items. The buyer shapes it by prompting ("show me only linen", "compare delivery times", "dark theme"). Everything lands in one cart. At checkout, agents split the cart per merchant and handle payment, shipping and tracking.

Built for the [Grok Bot Commerce London Hackathon](https://gb-ecommerce-hackathon-09-2026.teamdeel.workers.dev/hackathon) (26 September 2026, Storefront Experience track).

## Features

- **Prompt to shop.** Free text request ("summer wedding outfit under £300, size M") becomes a tailored UI with matching products.
- **Fluid UI.** [Jev](https://json-render.dev/docs/jev) composes pre-made components from our catalog into a [json-render](https://json-render.dev) spec. The buyer prompts to change layout, categories and how items are presented.
- **Many merchants.** Products come from Shopify stores (Storefront API), the open web (Tavily search and extract) and a seeded catalog in Supabase.
- **Buying details.** Availability, sizes and variants, price, shipping policy, delivery time and returns policy for every item. The buyer can ask for any of them and the UI shows them.
- **Personalisation.** Themes, colours, layout and shopping preferences are saved per user and reused next time.
- **One cart, agent checkout.** A single cart across merchants. Agents split it into per-merchant orders and fulfil them. Payment, shipping and tracking are simulated for the hackathon.
- **Camera (iOS).** Photo, scan or screenshot an item, save it for later, then search for it or find something similar.
- **Outfit previews.** Generate images of the buyer wearing the outfit they are shopping for, from their own photos (Grok image model).

## Stack

| Part | Tech |
| --- | --- |
| Landing | React Router, prerendered |
| Web app (demo lead) | React Router SPA, react-native-web, hosted on Vercel |
| iOS app | Expo, Expo Router |
| Shared UI | `packages/app`, React Native components used by web and iOS |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Agent | Grok text model with tool calls, in Edge Functions |
| UI composition | Jev with json-render |
| Outfit images | Grok image model |
| Product sources | Shopify Storefront API, Tavily, seeded Supabase catalog |

## Structure

- `apps/landing` landing page with links to the web app and the App Store
- `apps/web` web app
- `apps/mobile` iOS app
- `packages/app` screens, json-render catalog components and Supabase hooks shared by web and iOS
- `supabase` config, migrations, seed and Edge Functions
- `mockups` UI mocks (tldraw)

## Setup

Needs Node 22.22+, pnpm 12, [just](https://github.com/casey/just), Docker for local Supabase and Xcode for iOS.

```sh
just install
cp apps/landing/.env.example apps/landing/.env
just db     # local Supabase in Docker, writes .env.development.local for web and mobile
just dev    # landing on :5174, web on :5173
just ios    # iOS simulator
```

Run `just` to list every recipe.

Sign up needs an invite code from `public.invite_codes`. Local seed adds `LOCAL-DEV`.

### Hosted Supabase

```sh
just db-link <project-ref>
just db-push
```

Then enable the `before_user_created` hook in Auth > Hooks, pointing at `public.hook_require_invite_code`. Put the project URL and publishable key in `apps/web/.env` and `apps/mobile/.env` (see `.env.example`).

Add invite codes with SQL:

```sql
insert into public.invite_codes (code, uses_left) values ('FRIENDS', 10);
```

### Server secrets

AI and merchant keys live only in Edge Function secrets, never in app env files.

```sh
pnpm supabase secrets set XAI_API_KEY=... AI_GATEWAY_API_KEY=... TAVILY_API_KEY=...
```

Shopify store domains and Storefront tokens go in the same place.

### iOS on a device

```sh
just ios-device           # debug build, needs the phone to reach Metro on the Mac
just ios-device-release   # JS bundled in, works on networks that block device to device traffic
```
