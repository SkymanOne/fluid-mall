---
version: 1
slug: "apps-web-app-routes-home-tsx"
primary_target: "apps/web/app/routes/home.tsx"
related_targets: ["apps/web/app/components/fluid"]
---

# Storefront

Scope: the web app, installable as a PWA. Home, groups (outfits and sets), refine and restyle by prompt, piece details, one bag per group, simulated per-shop checkout, saved storefronts. Built with shadcn/ui.

Mode: Operate.

Audience and job: UK shoppers, mass market. They describe what they want, an outfit or one kind of item, and buy across shops in one sitting. Judges watch it live.

Proof on screen: pieces from several shops, each with shop name, GBP price, size, UK delivery and returns. Add to bag on every item. One bag per group, split per shop at checkout.

Constraints: GBP only. Unknown data reads "unknown, check at <shop>". Sample pieces are labelled Sample. Checkout is simulated and says so. UI requests change the page, never the pieces.

Memorable moment: asking "show as a list with bigger photos" and watching the page change in place with the same pieces.

## Direction contract

THESIS: A shop that builds itself around one sentence, then reshapes itself when you talk to it. Refuses a chat window with product links and refuses a fixed marketplace grid.

OWN-WORLD: Warm off-white stock, near-black ink, one cobalt accent reserved for what is yours and for the main action. Sofia Sans for reading, Sofia Sans Condensed for headings, labels and buttons, Sofia Sans Extra Condensed only for the Fluid wordmark. Square-cornered buttons, pill filter chips, photos set straight on the stock.

STORY: The shopper lands on one centred question, types or taps an idea, watches a short live log while Fluid searches, gets an outfit or a set with prices, sizes, UK delivery and an Add to bag on every item, refines or restyles by typing, then checks out one bag per group.

FIRST VIEWPORT: Home at 1440: hideable left panel with groups and New search. Centre column: "What are you shopping for?" at about 72px, one line of help, a large pill input with Shop, four idea chips, and Your groups and Your bags buttons when they exist. Group view: header with panel toggle and Bag, group title, removable filter chips, collapsible search log, pieces, a floating ask bar, and an outfit total bar for outfits.

FORM: Look Sheet world simplified for the mass market after user feedback. Seed key a28d04b7.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
