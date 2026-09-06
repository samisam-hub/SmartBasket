# Phase 3B — Meals to package-optimized baskets

Implemented in the existing app. New baskets use meal review → confirmation → aggregated ingredients → package matching. The old direct optimizer remains only for backward-compatible tests/legacy code; the app no longer calls it. Old saved baskets reopen normally.

## Architecture and rules

- 24 curated development meals, 23 canonical ingredient definitions. Meal nutrition is an explicitly labeled development estimate, computed from ingredient amounts; these are not verified branded-product nutrition records or medical advice.
- Raw/dry/as-sold ingredient quantities are explicit. Rice, pasta and lentils are dry; canned chickpeas/tuna require declared drained package weights. Eggs use edible mass. No automatic conversion from pieces to grams or ml to grams. Oil packages sold only in ml cannot satisfy a gram requirement without density evidence.
- Deterministic meal scoring covers calorie/protein fit, repeated meals, same-day repetition, ingredient reuse, simplicity, known budget cost and ingredient availability. Portions are 0.75–1.5 base servings per person. Three slots per day; lunch/dinner meals may share slots. Goal-specific protein targets reuse the existing rules. Budget remains the total for the selected planning period.
- Review shows all meals, slots, servings, calories, protein and ingredients; compatible replacements update totals. Explicit confirmation is required before SKU optimization. Reopening a saved basket includes its confirmed meal snapshot.
- Meal dietary declarations are checked against every ingredient. Known allergens are excluded. Oats are conservatively unavailable for gluten/wheat exclusions; no certified gluten-free oats substitution is assumed. Retail SKU matching preserves existing positive dietary evidence and strict allergen/free-from/trace checks. A missing declaration is not inferred safe.
- Ingredient aggregation happens once across the whole household/period. Protein ±10%; vegetables/fruit ±15%; staples ±10%; oil ±2%; precise lines fixed. Rules live in services/meals/config.ts. Shared fixed ingredients stay exact.
- Name aliases, category, preparation form, nutrition plausibility, dietary/allergen constraints and known package size/unit determine candidate sets. Conflicting duplicate product IDs are removed. Prepared foods and tofu cheese substitutes are not accepted as plain ingredients. Matching remains conservative and needs further curated SKU equivalences before broad coverage.
- Package search considers up to 16 candidates, single-SKU and two-SKU combinations. Pair search is bounded at 100 first-SKU packages; individual choices cap at 1,000. It compares minimum feasible counts and the next count, rather than always rounding upward. This is a bounded heuristic, not a global proof of optimality.
- Weights: quantity deviation 2; remaining quantity 3; price 0.3; package count 0.08; unavailable price 0.35; quality/completeness 0.05. Price is normalized by an ingredient budget allocation when available. Unknown prices never become zero-valued estimates.
- Underfill inside the ingredient range adjusts planned consumption. Surplus remains left for later; consumption is not raised just to empty a package. Both item and meal nutrition are recalculated from consumed ingredient amounts. Package cost uses full purchased counts. Missing ingredients contribute zero to basket nutrition, with explicit warnings; their original meal requirements remain visible.
- Basket results version 2 retain legacy fields and add ingredient keys, source meal-slot IDs, purchased/consumed/remaining quantities, adjustment percentages, requirements, confirmed plan, per-meal adjusted nutrition and separate mass/volume totals. The internal estimatedWastePercent metric means remaining mass share, not actual food waste. Saved result plan-fit scoring penalizes missing ingredients.

## Persistence

Migration: supabase/migrations/20260906194141_meal_based_baskets.sql, applied to the dedicated SmartBasket backend.

Owner-private meal_plans and meal_plan_items, indexed owner/date and plan/slot keys, timestamps, range checks, plan snapshots, and a composite basket-to-plan owner foreign key. New typed basket-item quantity fields enforce purchased = consumed + remaining and package-count consistency. No client update/delete permission. SECURITY INVOKER save RPC atomically writes meal plan, meal rows, basket and SKU rows. An owner/request lock and idempotency key prevent duplicate retries. The V1 save contract remains supported.

Save meal plan & basket persists locally first, then cloud; explicit retry survives offline/cloud errors. Empty SKU coverage can still save a confirmed nonempty meal plan. Review drafts are not auto-saved before confirmation/save. Corrupt local data is preserved and reported. No authentication, onboarding, preference schema or catalog rows changed.

Local PostgreSQL tests covered old and new saves, quantity columns, rollback on bad day/product, owner isolation, denied writes and retries. Hosted transaction verified nine meal rows, linked basket, idempotency and second-owner isolation; all temporary data was rolled back. Security advisors show expected owner-scoped anonymous-session notices and the pre-existing disabled leaked-password protection notice; no new unprotected table or privileged-function finding. See [Supabase anonymous-session policy guidance](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins).

## Requested live example

1 person, 3 days, 1,500 kcal/day, high protein, lactose-free, €100 period budget. Targets: 4,500 kcal and 281.25 g protein. Read-only run against all 750 current real catalog products via npm run meals:verify.

| Day | Selected meals | Daily kcal | Daily protein (g) |
|---|---|---:|---:|
| 1 | breakfast: Eggs with toast (1 servings); lunch: Salmon rice bowl (0.75 servings); dinner: Tofu vegetable stir-fry (0.75 servings) | 1451.2 | 90.79 |
| 2 | breakfast: Savory lentil breakfast bowl (1 servings); lunch: Lentil pasta bowl (1 servings); dinner: Tofu tomato pasta (1 servings) | 1511.4 | 88.9 |
| 3 | breakfast: Eggs with toast (1 servings); lunch: Salmon rice bowl (0.75 servings); dinner: Salmon with potatoes and spinach (1 servings) | 1550.35 | 99.09 |

These are the meal plan estimates before catalog matching. They are not nutrition that the resulting shopping basket can provide.

| Ingredient | Aggregated need | Acceptable range | Package matching |
|---|---:|---:|---|
| Wholemeal bread | 160 g | 144–176 g | No verified match |
| Broccoli | 382.5 g | 325.13–439.88 g | No verified match |
| Carrots | 75 g | 63.75–86.25 g | No verified match |
| Eggs (edible mass) | 300 g | 300–300 g | No verified match |
| Lentils (dry) | 140 g | 126–154 g | No verified match |
| Olive oil | 31.25 g | 30.63–31.88 g | No verified match |
| Pasta (dry) | 140 g | 126–154 g | No verified match |
| Potatoes | 280 g | 252–308 g | No verified match |
| Rice (dry) | 165 g | 148.5–181.5 g | No verified match |
| Salmon fillet (raw) | 375 g | 337.5–412.5 g | No verified match |
| Spinach | 250 g | 212.5–287.5 g | No verified match |
| Plain tofu | 330 g | 297–363 g | No verified match |
| Chopped tomatoes | 730 g | 620.5–839.5 g | No verified match |

**Live result: no verified SKU matches, 0 products, 0 packages, 0 purchased/consumed/remaining grams; estimated cost unavailable; basket-backed planned calories/protein and coverage 0.** No SKU/package/price combination can truthfully be reported for this example. The app displays an empty basket with specific missing-ingredient warnings and lets the user save the meal plan.

The catalog contains many processed foods and incomplete dietary/package declarations. Existing strict lactose-free evidence plus ingredient equivalence leaves no valid matches for this plan. Tofu rella initially matched a broad tofu alias but is a cheese substitute containing caseinate and peppers; it is now explicitly rejected. No safety constraints were weakened or products invented to make the demonstration succeed. This catalog gap prevents the requested live example from being a usable shopping basket.

## Complete-catalog regression example — test data only

Same preferences with an explicitly synthetic in-memory test SKU for each ingredient. These fixtures are never imported, offered in the app or presented as actual retailer prices. This isolates engine/package behavior from the live catalog gap.

| Fixture ingredient | Package | Count | Purchased (g) | Planned (g) | Left for later (g) | Fixture cost |
|---|---:|---:|---:|---:|---:|---:|
| wholemeal bread (test fixture) | 500 g | 1 | 500 | 160 | 340 | €2.00 |
| broccoli (test fixture) | 500 g | 1 | 500 | 360 | 140 | €2.00 |
| carrots (test fixture) | 500 g | 1 | 500 | 150 | 350 | €2.00 |
| eggs (test fixture) | 500 g | 1 | 500 | 300 | 200 | €2.00 |
| lentils (test fixture) | 500 g | 1 | 500 | 140 | 360 | €2.00 |
| olive oil (test fixture) | 250 g | 1 | 250 | 31.25 | 218.75 | €2.00 |
| pasta (test fixture) | 500 g | 1 | 500 | 140 | 360 | €2.00 |
| potatoes (test fixture) | 500 g | 1 | 500 | 280 | 220 | €2.00 |
| rice (test fixture) | 500 g | 1 | 500 | 161.25 | 338.75 | €2.00 |
| salmon fillet (test fixture) | 500 g | 1 | 500 | 262.5 | 237.5 | €2.00 |
| spinach (test fixture) | 500 g | 1 | 500 | 250 | 250 | €2.00 |
| tofu (test fixture) | 500 g | 1 | 500 | 480 | 20 | €2.00 |
| chopped tomatoes (test fixture) | 500 g | 2 | 1000 | 730 | 270 | €4.00 |

Each combination is chosen for ingredient equivalence and minimum feasible whole-package quantity, balancing allowed underfill, leftovers, fixture cost and package count. Detailed selection reasons are stored on each item.

Result: 13 products, 14 packages, €28.00 fixture cost, 4504.55 planned kcal (100.1% coverage), 280.09 g protein (99.59% coverage), 3305 g left for later. Leftover mass is 48.96% of purchased mass; zero remaining quantity is not a hard constraint.

## Verification and limits

- All 58 tests pass. Regression tests A–F pass: 620 g flexible protein prefers 600/650 g to 2×500 g; 300 g oats buy 500/consume 300/leave 200; accepted underfill recalculates nutrition; fixed 620 g requires two 600 g packs; shared broccoli aggregates; complete fixture catalog achieves high coverage.
- Additional tests cover meal filters/replacements, missing data, unknown prices, misleading tofu cheese, mixed SKU combinations, confirmation flow, local restart, cloud retry, PostgreSQL ownership and atomic saves.
- TypeScript and lint pass; Expo Doctor 18/18. Android Hermes export passes. Existing GitHub APK workflow is unchanged; no new APK workflow was requested/dispatched in this phase. Physical Android interactions have not been re-tested.
- Development meal nutrition still needs independent nutritional validation. No recipe instructions, cooking-yield conversion or inferred density. Alias lists are intentionally limited and may reject suitable products until evidence is curated. Product label differences do not overwrite the curated recipe estimates.
- Meal selection and per-ingredient package search are deterministic heuristics, not joint global optimization. Extreme targets/restrictions may produce poor coverage or repetition, reported as warnings. No retailer prices exist in the current catalog. Future catalog curation is needed before the live example can work.

Stopped at Phase 3B. No advanced Basket UX, checkout, payments, LLM recipes, ML, home inventory or future-week leftover reuse.
