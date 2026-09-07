# MVP synthetic package pricing

Implemented 2026-09-07. No retailer scraping, retailer offers, checkout or APK workflow changes.

## Audit and cause

The hosted catalog contained 784 products, all with `price_estimate = NULL`: zero priced, 784 missing, **0% usable coverage**. The OFF normalizer intentionally sets `priceKind: unavailable`, `priceEstimate: null`, and currency EUR because OFF nutrition data does not supply reliable package prices. Earlier phases did not implement the optional synthetic estimator. The importer was therefore behaving as written; the missing piece was SmartBasket's own estimation layer.

After backfill: **410 priced, 374 unpriced, 52.30% catalog coverage**. All persisted synthetic prices are positive EUR estimates with source, confidence and version metadata. Running the same backfill again updates zero rows. Existing product facts and IDs are preserved; only price metadata and update timestamps change. The complete unpriced list is in [UNPRICED-PRODUCTS.csv](UNPRICED-PRODUCTS.csv).

## Estimator and configuration

`services/pricing/priceEstimator.ts` applies deterministic, package-aware rules from `pricingConfig.ts`. Every rate below is an **invented development assumption**, not a current, sampled, averaged or retailer-specific price. No brand tier is guessed.

| Reference | EUR/kg | EUR/L | EUR/piece |
|---|---:|---:|---:|
| Chicken / other meat | 12 | — | — |
| Salmon | 22 | — | — |
| Tuna | 12 | — | — |
| Other fish | 18 | — | — |
| Eggs | 6 | — | 0.32 |
| Tofu | 6 | — | — |
| Lentils / other legumes | 3 | — | — |
| Rice / other grains | 3 | — | — |
| Pasta | 2.50 | — | — |
| Potatoes | 1.50 | — | — |
| Bread | 4 | — | — |
| Olive oil | 11 | 10 | — |
| Oats | 2.40 | — | — |
| Other breakfast | 4 | — | — |
| Fruit / vegetables | 3 | — | — |
| Chopped/diced canned tomatoes | 2.50 | — | — |
| Dairy | 4 | 1.50 | — |
| Dairy alternatives | 5 | 2 | — |
| Almond milk | — | 2 | — |
| Snacks | 10 | — | — |
| Other beverages | — | 1.50 | — |

Price = declared package amount × matching unit rate, rounded to cents, with a €0.35 minimum package estimate. Packages exceeding 20 kg/L or 1,000 pieces and estimates exceeding €1,000 are excluded. The shared package normalizer handles metric/imperial units, multipacks and explicit counts. Conflicting quantities, serving-only text, unknown amounts and unsupported unit/type combinations remain unpriced. No mass/volume density or mass-per-egg conversion is used: eggs and oil have independent reference rates for each supported source unit. Egg masses below 150 g remain unresolved as possible serving metadata.

Specific product-type rules use medium confidence with declared package evidence; broader category rates or name-derived quantities use low confidence. No synthetic estimate is high confidence. Confidence describes the input specificity, **not verified market accuracy**. Quantities remain crowdsourced source declarations; prices cannot improve inaccurate package metadata.

## Persistence and imports

Applied migration: `20260907120000_synthetic_price_metadata.sql`. It adds `price_estimate_source`, `price_confidence`, and `price_estimate_version` with a constraint requiring complete positive EUR metadata for `synthetic_mvp`. `price_estimate`, `price_kind` and `currency` remain compatible with existing Product snapshots. A before-update trigger prevents missing or synthetic import prices from overwriting any existing price. Catalog write permissions and RLS remain unchanged; database tests verify normal app roles cannot write. This uses standard PostgreSQL columns and constraints described in the [Supabase table documentation](https://supabase.com/docs/guides/database/tables).

`npm run prices:prepare` reads the live catalog and writes an ignored snapshot, manifest and reviewable SQL to `.expo/pricing/`. It does not apply changes. The SQL fills only NULL prices; an administrator applies it after review. `npm run prices:verify` reads the hosted result and validates package totals, coverage and preservation of other product facts.

Both SQL catalog imports and the administrative API import use the same estimator. The OFF normalizer stays provider-only and continues returning unavailable pricing. The UI and basket do not manufacture prices at read time. Re-importing nutrition does not recalculate existing estimates; deliberate future repricing requires a separate reviewed operation. Future retailer quotes should have their own retailer, timestamp and availability model; they must not be inserted as synthetic estimates. The basket currently consumes a package-price interface independently of those future sources.

## Basket totals and budget semantics

Each contribution is `packageCount × priceEstimate`, rounded to cents. Buying one 500 g oats pack for 300 g planned consumption charges the full pack. Estimated totals sum selected package contributions. Within budget, slightly over (up to 10%) and over budget refer to selected packages. `price_incomplete` is used when selected items lack usable EUR prices; an empty basket has no total and retains `unknown`, while a disabled budget retains `disabled`. Legacy statuses remain readable in old snapshots.

Unmatched ingredients do not erase the cost of priced selected packages. A separate warning explicitly states that missing ingredient costs are excluded and the complete meal-plan cost remains unknown. Existing saved baskets retain their historical snapshots; regenerate to see newly imported estimates. UI language uses “Est.”, “Estimated total”, “Estimated … under/over budget”, and a synthetic-development attribution. Product details distinguish synthetic estimates from source nutrition data.

## Requested live example

One person, three days, 1500 kcal/day, €100 total budget, high-protein goal and lactose-free lifestyle preference without selected allergies. **13 products, 16 packages, 13/13 matched ingredients and 100% selected-item price coverage**. Estimated total **€38.76**; budget difference **−€61.24**, status **within_budget**. Recipe calorie coverage remains 99.52%. This is a synthetic development basket, not a purchasable retailer quote.

The following tables come from the hosted verification output.

## Current local preview

The user's existing two-person, three-day, 1500 kcal/day profile was also verified in the actual browser, without changing preferences. It displays **Estimated total €50.09**, **€19.91 under the €70 period budget**, 16 products and 19 packages. The tuna ingredient remains unresolved; its cost is explicitly excluded, so this is a selected-package budget comparison, not a complete meal-plan quotation.

## Validation and files

The 66-test suite was exercised; one new constraint fixture initially omitted the required nutrition basis, was corrected, and the database test passed on rerun. All remaining tests passed. The final 11 meal/pricing regression tests also passed after cent rounding. TypeScript and lint passed. The initial Expo Doctor attempt failed its remote schema check because the Expo API TLS connection dropped; final retry status is recorded below. Android export passed; no GitHub APK build was triggered and the existing workflow is unchanged. Local browser verification confirmed per-package estimates, item totals, estimated basket total, budget difference, synthetic attribution and the unmatched-cost warning. No physical-device APK test was performed.

Changed areas: new pricing configuration/service, price metadata migration and preservation trigger, preparation/verification scripts, import row handling and API import, Product/Basket types and snapshot status validation, meal basket cost/budget calculations and cent rounding, basket/detail wording, database/pricing tests, npm scripts and documentation. No retailer integration or checkout was added. CSV product data is derived from Open Food Facts under ODbL; existing catalog attribution remains applicable.

Expo Doctor retry: **18/18 checks passed**. A final Android export initially hit a sandbox permission denial executing the installed Hermes compiler; the rerun with the required execution permission **passed**, producing the Android Hermes bundle and assets.

| Product | Packages | Estimate/pack | Item total |
|---|---:|---:|---:|
| Brokkoli | 1 | €1.20 | €1.20 |
| Carrots | 1 | €3.00 | €3.00 |
| Diced tomatoes | 1 | €1.99 | €1.99 |
| Latta's Egg Ranch, Cage Free Chickens | 1 | €4.08 | €4.08 |
| Lentilles vertes | 1 | €1.50 | €1.50 |
| Olivenöl | 1 | €5.04 | €5.04 |
| Enriched, Spaghetti | 1 | €0.65 | €0.65 |
| Premium Sized Russet Potatoes | 1 | €6.80 | €6.80 |
| Brown Rice | 1 | €1.19 | €1.19 |
| Lachsfilet | 1 | €5.50 | €5.50 |
| Baby Spinach | 3 | €0.35 | €1.05 |
| Tofu | 2 | €2.38 | €4.76 |
| Vollkorntoast | 1 | €2.00 | €2.00 |

## Catalog examples

| Product | Declared package | Synthetic estimate |
|---|---|---:|
| Frische Hähnchenbrustfilet Teilstücke | 600g | €7.20 |
| Bio Basmati Reis | 500g | €1.50 |
| Brokkoli | 400 g | €1.20 |
| Latta's Egg Ranch, Cage Free Chickens | 24 oz | €4.08 |
| Olivenöl | 458 g | €5.04 |
| Almond Milk | 1 L | €2.00 |

## Complete demo catalog pricing and web images — 7 September 2026

All 784 catalog products now have persisted estimated EUR prices. The existing 410 prices were preserved; 374 missing prices use `synthetic-category-demo-2`, source `synthetic_mvp`, confidence `low`. These are invented category-level demo amounts, not surveyed retailer prices or verified package quotes. Unknown/conflicting package metadata stays unchanged, and the ingredient/package engine still needs a compatible usable quantity. Kroger 1% lowfat chocolate milk now shows Est. €1.99 with a quantity-unverified demo label.

`estimateCatalogPrice` first uses the existing quantity-based estimator, then assigns a deterministic category demo value. `withMissingPriceEstimate` applies this to future imports, while the backfill script only updates null prices. Cards and details explain the less reliable fallback. Re-running the script is idempotent; it preserves already assigned prices.

Live verification: 784 products, 784 prices, zero unpriced; all non-price fields and previous prices compared to the pre-update snapshot and preserved. The established one-person three-day basket remains €38.76, 13 product lines/16 packages, with no unmatched ingredients.

The preview's React Native Web image-load event omitted both native source dimensions and DOM target dimensions. ProductImage now uses Image.getSize when those fields are absent, validates the decoded dimensions, and respects unmounting and the existing resolution thresholds. Stable load/error callbacks prevent repeated loading effects. Cards fall back to the main display image if the thumbnail metadata is unsuitable. No images were generated or substituted with invented packaging.

687 catalog rows have a usable display-image URL; the other 97 retain placeholders. Browser verification confirmed loaded product images, including Kroger chocolate milk, alongside its persisted demo price. Unit tests cover missing-event lookup success/failure, native/web dimensions, tiny resources, price preservation and no invented package quantities.
