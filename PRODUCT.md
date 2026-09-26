# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: fashion shoppers dressing for an occasion or a look ("I wanna look cool at tech event"). They know the outcome they want, not the exact items or which stores carry them. Their job is to go from that intent to buyable pieces across several shops in one session, without a tab per merchant. Sometimes that is a whole outfit, sometimes just one kind of thing ("black jeans under £80").

Fashion comes first. Other categories (anything a buyer wants to buy or build) come later.

Second audience for now: hackathon judges watching a 3 minute live demo on the web app.

## Product Purpose

Fluid turns a prompt into a personal storefront, called a group. An agent searches several merchants, composes an interface tailored to the request from pre-made components, and fills it with real items. The buyer reshapes it by prompting: categories, layout, which buying details show, theme and colours. Preferences persist between sessions. Each group has its own bag. At checkout, agents split a group's bag into per-merchant orders and handle payment, shipping and tracking.

Success: a buyer goes from a prompt to a confirmed multi-merchant order in one flow, with availability, size, price, shipping, delivery time and returns visible whenever they need them.

## Positioning

The storefront does not exist until the buyer asks for it. It is not a marketplace with a fixed layout and not a chat that returns links. The interface itself is composed per intent and per person, from approved components, across merchants, with one cart and agent-run fulfilment.

## Operating Context

- Built for the Grok Bot Commerce London Hackathon, 26 September 2026, Storefront Experience track. Judged on problem, experience, execution, AI agent integration, commerce depth, originality and impact.
- The live demo runs on the web app: prompt, generated storefront, refine by prompt, cart across merchants, confirm, simulated checkout.
- On the phone (installed PWA), buyers capture an item (photo, scan or screenshot), save it for later, then search for it or find something similar. They can also generate outfit previews from their own photos.

## Capabilities and Constraints

- **Product sources:** Shopify Storefront API, open web via Tavily search and extract, and a seeded catalog in Supabase. Every product is normalized to merchant, images, price and currency, variants and sizes, availability, shipping policy, delivery estimate, returns policy, source URL and fetch time.
- **Composed UI:** Jev (experimental, via json-render) picks and arranges components from a fixed component catalog using prepared candidates. The model never writes UI code.
- **One web app, installable:** a React Router SPA built with shadcn/ui. Phones install it as a PWA. There is no native app.
- **Buyer controlled themes:** buyers change themes and colours by prompt, so every component must work under themes the buyer picks.
- **Groups:** every prompt that is not a refinement starts a group. A look is a group for an outfit (slots like top, bottom, shoes). A set is a group for one kind of item (jeans, trainers) shown as a line-up. The buyer keeps several groups open, switches between them, and each group has its own bag and checkout.
- **Saved groups:** a composed group (layout, details shown, theme) is saved, not regenerated on every visit. Buyers name, reopen and reuse saved storefronts, including as the starting layout for a new prompt.
- **Shop in one place:** each piece shows what its shop page offers (photos, description, material and fit, rating, colours, sizes, stock, delivery options, returns), so shoppers rarely leave Fluid.
- **Page requests:** prompts about the page itself (a buy button on each item, photo size, grid or list, which details show, theme, spacing) change the storefront and never reload or change the pieces.
- **Clearing:** buyers can remove a group with its bag, clear a bag, and delete saved storefronts.
- **UK buyers, any market:** prices show in GBP. Merchants can be anywhere as long as they deliver to the UK. Every piece shows UK delivery cost and time. Pieces that do not deliver to the UK are left out.
- **Checkout is simulated.** No real money moves. The buyer confirms per-merchant totals, including shipping, before checkout runs.
- **Accounts:** email and password sign-in. Sign up requires an invite code.
- **Outfit previews:** Grok image model. User photos need explicit consent, live in private storage and can be deleted.
- **Terms:** "group" is the generated storefront for one shopping intent, with its own bag. "Look" and "set" are the two kinds of group. "Component catalog" is the set of UI parts Jev can use. "Product catalog" is merchant items. "Merchant" is any store a product comes from.

## Brand Commitments

- **Name:** Fluid. The repo name still says "fluid-mall".
- **Tagline:** "Shopping mall in your hands".
- **Writing:** plain, short English. No em dashes, no semicolons in prose, no AI-sounding filler.
- No logo, palette or typography exists yet.

## Evidence on Hand

- `mockups/UI-mock.tldraw`: low fidelity wireframe. A home screen with the "Fluid" wordmark, the tagline and a prompt field ("I wanna look cool at tech event"). A storefront screen with a cart icon and Top and Bottom outfit sections.
- Working invite-code sign up and sign in on web against a hosted Supabase project.
- No customers, testimonials, metrics, merchant partnerships or press exist. Do not fabricate any.

## Product Principles

1. **Intent before inventory.** Start from what the buyer wants to achieve, not from a store's catalogue.
2. **The buyer owns the interface.** Any layout, detail, category or theme is one prompt away and is remembered.
3. **Truth over polish.** Never show an invented price, stock level, size or policy. Unknown stays visibly unknown and links to the merchant.
4. **One cart, many shops.** Merchant boundaries show up where they matter to the buyer (shipping, delivery, returns, checkout) and disappear elsewhere.
5. **The buyer approves money.** Agents do the work. The buyer confirms every total.
