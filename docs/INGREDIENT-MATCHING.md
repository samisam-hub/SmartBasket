# Phase 3C — ingredient → SKU matching

Verified 2026-09-07 against the dedicated hosted SmartBasket catalog. Meal selection architecture, recipe quantities and UI layout are preserved. No advanced Basket UX was added.

## Previous failures

The original 750-product catalog was audited before edits. For the lactose-free example, strict rejection of every unknown lifestyle flag reduced all 23 ingredient concepts to zero eligible candidates. Package eligibility was also applied before retaining ingredient candidates, disguising quantity problems as absent foods. The importer favored an early, image-rich sample and excluded the broad `other` category, missing plain oils.

| Ingredient | Additional original failure |
|---|---|
| Wholemeal bread | Sparse aliases and missing package metadata on matching records. |
| Broccoli | Mixed vegetables and prepared pasta; no suitable plain broccoli. |
| Carrots | Plain 1 kg carrots existed but unknown lactose metadata excluded them. |
| Chicken breast | Mostly processed meat; no verified plain raw breast candidate. |
| Eggs | Singular brand wording missed; count-only packs lacked mass; some 50 g records appeared to describe a serving. |
| Lentils | Rice/oats/lentil mixtures instead of plain dry lentils. |
| Olive oil | Plain oil absent; unrelated products mentioned oil in their names. |
| Pasta | Usable spaghetti/penne excluded by unknown lifestyle flags; some quantities absent. |
| Potatoes | Usable 10 lb russet pack excluded by unknown lifestyle flags; other products were prepared foods. |
| Rice | Usable 14 oz brown rice excluded by unknown lifestyle flags; some alternatives had cooked/inconsistent nutrition. |
| Salmon | Missing structured quantity/limited aliases; pollock (Seelachs) and crusted products are unsuitable substitutes. |
| Spinach | Plain 85 g baby spinach excluded by unknown lifestyle metadata. |
| Tofu | Plain 396 g tofu excluded by unknown lifestyle metadata; cheese substitutes unsuitable. |
| Chopped tomatoes | Plain canned products existed, but unknown lifestyle flags excluded them; flavored variants require exclusion. |
| Tuna | Water-specific identity coverage missing; available new records still lack explicit drained weight. |

## Model, matching and diagnostics

`data/ingredient-mappings.ts` centralizes 23 canonical keys, English/German aliases, allowed internal categories, required phrases and blocked preparation keywords. Legacy `chicken`, `bread`, `oil`, and `tomatoes` keys resolve to their new canonical forms when old snapshots aggregate. No synonym arrays live in UI components.

Stages are curated barcode → alias phrase → category plus all words of a keyword phrase in any order. Accent folding and German spelling normalization are supported. Arbitrary fuzzy similarity is not used. Every stage still checks category, food form, known dietary conflicts, selected allergens, and nutrition plausibility. Prepared dishes, breaded/cured poultry, cooked alternatives to dry staples, and contradictory duplicate IDs cannot win through a high score. Oils retain the existing broad `other` category with oil-specific keywords and curated IDs; a new UI category was not introduced.

Compatibility scoring gives 60/45/30 for those stages, 15 for category, 10 for a known eligible package, 2 per nutrition field, dietary confidence up to 10 with a 5-point penalty per unknown requirement, and 2 each for image and price availability. Hard exclusions happen before scoring. The existing package optimizer also considers compatibility with a centralized weight of 0.15 alongside package fit, price and leftovers.

`diagnoseMatches` returns candidates, rejection counts, stage, score, dietary uncertainty, package issue and optimization eligibility. Basket snapshots retain compact selected-product diagnostics and reasons. `npm run matching:verify` writes full read-only diagnostics to ignored `.expo/phase3c/after.json`.

## Package normalization

`services/catalog/package-size.ts` reads explicit quantity text, provider numeric quantity and finally unit-bearing product names. kg→g, L/cl→ml, oz/lb→g, decimal commas, multipacks and explicit counts/dozens are normalized. Serving/portion/per-100 labels are not package evidence. Metric declarations take precedence over equivalent imperial declarations; disagreement exceeding 3% or 2 g produces `conflicting`, not a guessed size.

Migration `20260907081513_ingredient_package_metadata.sql` was applied: count, status, source, explicit mass per unit and drained weight columns have constraints. Existing sizes were only marked known; original product facts were preserved, excluding migration-triggered `updatedAt` changes. Existing catalog read-only app permissions and RLS remain unchanged.

Good ingredient candidates remain visible when quantities are unknown. Package status describes source quantity evidence separately from optimizer eligibility. A count does not imply mass; no egg weight, oil density, fruit edible yield or canned drained fraction is invented. Explicitly declared package mass is accepted; count-only eggs need explicit per-unit mass. The retained 24 oz egg record is source-declared package mass, not a verified shell-loss measurement, which remains a source limitation.

## Dietary and allergen policy

Unknown vegetarian/vegan/lactose-free/gluten-free lifestyle flags reduce confidence and create warnings; they are never rewritten as true. Explicit conflicts and clear ingredient/category contradictions exclude products. Selected allergy conflicts, traces and ingredient-text conflicts remain hard exclusions. Missing selected-allergy evidence remains strict: the current policy requires ingredient/allergen evidence and relevant explicit free-from support. Lactose-free is not milk-allergy evidence. There is no separate medical/Coeliac requirement model; gluten-free currently represents a lifestyle preference, while selected wheat allergy uses strict evidence rules.

## Curated coverage and import

`data/curated-ingredient-products.ts` contains reviewed preferred barcodes and evidence for 16 concepts. These records do not bypass validation. Targeted scripts search ingredient categories, cache bounded responses, normalize through the existing OFF provider layer and retain up to three eligible candidates per ingredient, or one good identity candidate with unresolved quantity. Database writes use deduplicated barcode upserts. No prices, nutrition, images or packaging were fabricated.

34 real OFF products were added, bringing the catalog from 750 to **784**. Three of the additions deliberately retain unresolved quantity eligibility (tuna, chickpeas and banana). Existing useful tofu, pasta, potatoes, carrots and eggs were reused. Several targeted endpoints returned 503, including berries; failures are cached/reported instead of causing uncontrolled retries. The bounded importer uses supported v2 search because the tested v3.6 search endpoint returned 400; searches are separated by seven seconds. This follows the separation and request constraints in the [OFF API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/). No OFF calls occur during UI matching.

## Resolution and limitations

- Original lactose-free matching: 0/23 concepts; 0/15 reported core ingredients; example 0/13.
- New logic on the original catalog: 10/23 concepts with lactose-free preference.
- New logic plus targeted import: 17/23 concepts; **14/15 reported core ingredients (93.3%)**; example **13/13 (100%)**.
- Remaining: turkey (no verified plain raw match), tuna and chickpeas (drained weight unknown), berries (package evidence missing and targeted API failures), banana (unqualified/variable quantity), apple (no suitable plain packaged candidate).

The three-day, one-person, 1500 kcal/day example has nine meal slots, 13 real products and 16 packages. Planned meal consumption supplies **4478.55 kcal / 277.59 g protein**, 99.52% / 98.70% of the respective targets. These are the existing curated recipe nutrition estimates, not a new sum of purchased SKU nutrition. Both no-diet and lactose-free runs pass; the latter explicitly warns about unverified lifestyle metadata.

Prices and budget fit remain unknown. Purchased quantity is 10.82 kg, planned consumption 3.43 kg and leftovers 7.39 kg (68.28%), mainly from the 10 lb potato bag. This is a coverage improvement, not a claim of ideal package availability or local retailer stock. OFF remains crowdsourced; package mass and preparation suitability require label checking.

## Verification and changed areas

63 tests passed, including normalization, missing/conflicting quantities, counts, candidate retention, canonical/staged matching, safety, duplicate IDs, existing meal/persistence tests and PostgreSQL migration/RLS tests. TypeScript and lint passed; Expo Doctor passed 18/18; Android export passed. The final live audit confirmed 784 products, deterministic results when catalog order is reversed, and preservation of all original product facts. An initial sandbox network read failed; the authorized read-only network verification succeeded.

No APK build was requested for this phase and no GitHub build was triggered. The existing Android workflow is unchanged. Device interaction was not retested on a physical Android device.

Files changed: `data/meals.ts`, new ingredient mapping and curated mapping modules; catalog normalization, row mapping and new package helper; meal matching, safety, aggregation, planner key lookup, basket diagnostics, package optimizer and configuration; Product/Basket types; package metadata migration; targeted fetch/prepare/audit scripts; ingredient, meal and database tests; README and this report. The existing web preview dependency addition in package.json/lock is retained.

## Verified candidate examples and final basket

The following tables are generated from the final hosted audit. Quantities are rounded for readability; calculations retain source precision.

| Ingredient | OFF product / barcode | Package | Stage / score |
|---|---|---|---|
| chicken_breast | [Frische Hähnchenbrustfilet Teilstücke](https://world.openfoodfacts.org/product/4061458010627) / 4061458010627 | 600 g | curated / 105 |
| chicken_breast | [Hähnchen-Brustfilet Teilstück, frisch](https://world.openfoodfacts.org/product/4337256098779) / 4337256098779 | 600 g | curated / 103 |
| eggs | [Latta's Egg Ranch, Cage Free Chickens](https://world.openfoodfacts.org/product/0029653831007) / 0029653831007 | 680.39 g | curated / 105 |
| rice | [Basmati Rice](https://world.openfoodfacts.org/product/4056489845171) / 4056489845171 | 1000 g | curated / 105 |
| rice | [Aldi Jasmin Reis](https://world.openfoodfacts.org/product/4061458002684) / 4061458002684 | 1000 g | curated / 105 |
| rice | [Bio Basmati Reis](https://world.openfoodfacts.org/product/4056489095736) / 4056489095736 | 500 g | curated / 105 |
| rice | [Brown Rice](https://world.openfoodfacts.org/product/0017400100780) / 0017400100780 | 396.89 g | alias / 90 |
| broccoli | [Brokkoli](https://world.openfoodfacts.org/product/4250241204668) / 4250241204668 | 400 g | curated / 105 |
| broccoli | [Brokkoli](https://world.openfoodfacts.org/product/4337256109505) / 4337256109505 | 300 g | curated / 105 |
| broccoli | [Brokkoli](https://world.openfoodfacts.org/product/4061458248129) / 4061458248129 | 500 g | curated / 105 |
| olive_oil | [Olivenöl](https://world.openfoodfacts.org/product/4104420248823) / 4104420248823 | 458 g | curated / 105 |

| Basket ingredient | Product / barcode | Packages | Bought g | Planned g | Left g |
|---|---|---|---|---|---|
| broccoli | Brokkoli / 4250241204668 | 1 | 400 | 360 | 40 |
| carrots | Carrots / 0000000258258 | 1 | 1000 | 150 | 850 |
| chopped_tomatoes | Diced tomatoes / 0021130338283 | 1 | 794 | 730 | 64 |
| eggs | Latta's Egg Ranch, Cage Free Chickens / 0029653831007 | 1 | 680.39 | 300 | 380.39 |
| lentils | Lentilles vertes / 4056489032090 | 1 | 500 | 140 | 360 |
| olive_oil | Olivenöl / 4104420248823 | 1 | 458 | 31.25 | 426.75 |
| pasta | Enriched, Spaghetti / 0011110850041 | 1 | 260 | 140 | 120 |
| potatoes | Premium Sized Russet Potatoes / 0033383530505 | 1 | 4535.92 | 280 | 4255.92 |
| rice | Brown Rice / 0017400100780 | 1 | 396.89 | 161.25 | 235.64 |
| salmon | Lachsfilet / 4009239512298 | 1 | 250 | 250 | 0 |
| spinach | Baby Spinach / 0000000132176 | 3 | 255 | 250 | 5 |
| tofu | Tofu / 0018513003388 | 2 | 792 | 480 | 312 |
| wholemeal_bread | Vollkorntoast / 4009249019923 | 1 | 500 | 160 | 340 |
