# Phase 2: real product catalog

Image handling was subsequently audited and improved; see [the image audit](PRODUCT-IMAGES.md)
for current image variants, suitability rules and the 655 usable / 95 placeholder count.

## Architecture and preserved behavior

The existing standalone Expo SDK 54 / React Native 0.81.5 / React 19.1 app,
Expo Router root stack and four tabs, blue theme, SafeAreaProvider, dynamic tab
insets, anonymous Supabase identity, PreferenceStore and AsyncStorage remain.
The prior deterministic onboarding/edit exit reset is retained. Product details
are an additional native-header stack route: `/product/[id]`.

Open Food Facts bulk JSONL (or bounded single-product provider reads) → provider
normalization → SmartBasket Product input → administrative upsert → Supabase
products → ProductRepository → hooks → native list/cards/details.

No provider network code is called by mobile search. ProductRepository accepts
an injected Supabase client and demo catalog; the UI consumes normalized Product
objects. Provider attribution is registered separately. Future providers can
implement CatalogProvider without changing screen data structures.

## Database and permissions

Migration: `supabase/migrations/20260906005004_products_catalog.sql`, applied to
SmartBasket `oepajinqjkcqqyddpgne`. It creates `public.products` with UUID identity,
nullable optional fields, bounded numeric nutrition, nullable dietary booleans,
text arrays, an explicit nutrition basis, price provenance, and timestamps.
Unique barcode and `(source, external_id)` constraints prevent duplicate imports.
Canonical barcode identifiers collapse leading-zero GTIN variants. Updates keep
the database ID and created_at immutable and maintain updated_at on the server.

Indexes: GIN weighted name/brand search_document, name/id ordering, brand,
category/name/id, partial indexes for each positive dietary flag and high protein,
and GIN allergen/trace arrays. Barcode uniqueness supplies its index.

RLS is enabled. Both `anon` and `authenticated` have SELECT only, with an explicit
public-read policy because this is a public grocery catalog. There are no client
write policies or grants. Administrative imports use the connected database tool
or a server-only service-role credential. Preference RLS and auth are unchanged.
Hosted grants were verified: SELECT only for both app roles. Advisors report no
catalog-table finding; the existing anonymous-preference access notice and
disabled leaked-password-protection notice remain outside this catalog change.

## Import results

**750 real products successfully imported, with 750 distinct barcodes.** A repeat
upsert of the prepared catalog retained 750 rows. All selected products have a
name, brand, image and declared calories/protein/carbohydrates/fat. The stream
examined 37,601 records and rejected 34,871 as unsuitable or insufficient; extra
eligible records were skipped once their category quota filled. No millions of
rows or image files were downloaded. The gzip stream was closed at the target.

| Category | Products |
| --- | ---: |
| Fruit | 56 |
| Vegetables | 46 |
| Meat | 63 |
| Fish | 40 |
| Eggs | 9 |
| Dairy | 63 |
| Dairy alternatives | 63 |
| Bread | 63 |
| Grains | 63 |
| Pasta | 63 |
| Potatoes | 4 |
| Legumes | 28 |
| Breakfast | 63 |
| Snacks | 63 |
| Beverages | 63 |

Current coverage: ingredients 685/750; missing fiber 153, sugars 22, salt 31,
nutrition grade 34, and structured package size 367. Quantity labels are preserved
even when a machine-readable package size is unavailable. There are 33 explicitly
declared 100ml records; each remaining record uses its source's 100g representation.
Positive dietary evidence: vegetarian 172, vegan 135, lactose-free 11, gluten-free 71.
Unknowns are retained; these low counts do not mean other products fail that diet.

## Source field mapping

| Open Food Facts fields | SmartBasket fields / rule |
| --- | --- |
| code | externalId, canonical barcode; database generates id |
| product_name_en, product_name_de, product_name | name, first nonempty in that order |
| brands | nullable brand |
| categories_tags | one of the 15 grocery categories, otherwise other |
| image_front_url/image_url, image_front_small_url/image_small_url | imageUrl, imageThumbnailUrl |
| images.selected.front or legacy images.front_LANGUAGE | selected 400px/200px URL using code, revision and available sizes |
| quantity, product_quantity, product_quantity_unit | quantityLabel, packageSize and g/ml packageUnit |
| nutrition.input_sets | declared as-sold 100g/100ml nutrient values, excluding estimates/prepared/serving-only data |
| energy-kcal, energy-kj | caloriesPer100g; explicit kJ converts using 4.184 kJ/kcal |
| proteins, carbohydrates, fat, fiber, sugars, salt | corresponding normalized per-100 fields; mg converted to g when explicitly declared |
| legacy nutriments.*_100g | compatible legacy nutrient mapping, without filling missing values |
| ingredients_text_en/de/default | ingredientsText, HTML/control characters removed |
| allergens_tags | canonical allergens array |
| traces_tags | separate mayContainAllergens array |
| labels_tags, ingredients_analysis_tags | labels and nullable dietary flags |
| nutriscore_grade / nutrition_grades | validated a–e nutritionGrade |
| provider/code | source, sourceUrl and source attribution |
| import/database time | createdAt, updatedAt; these are catalog timestamps, not source freshness guarantees |

Recent OFF schemas changed nutrition and image structures. The implementation
was checked against a real bulk record and a v3.6 beverage record, rather than
assuming the legacy nutriments map remained populated. Missing, blank, negative,
out-of-range and nonnumeric values are rejected or left null. Source-computed
nutrients without declared values are not substituted. No nutrition is invented.

## Dietary, allergen and price semantics

Positive dietary labels or conclusive ingredient-analysis tags support TRUE.
Explicit non-vegan/non-vegetarian evidence supports FALSE; absence or “maybe”
remains null. Confirmed vegan implies vegetarian unless conflicting evidence is
present. Contradictory positive labels and declared allergens are treated as
unknown. Lactose-free requires an explicit label; milk allergens remain a separate
risk. Gluten-free requires a positive label without a conflicting declaration.

Canonical mapping covers the onboarding allergens, tree-nut subtypes and shellfish
groups; other source allergens are retained. A generic gluten declaration also
warns a user who selected wheat. Contains and may-contain are never merged into
a false certainty. Empty arrays do not certify absence of allergens.

Ordinary browsing marks selected allergen/trace conflicts. The explicit
“Matches your preferences” filter requires positive diet evidence and removes
known conflicts and traces. With allergies selected it also requires some source
ingredient/allergen information. Pescatarian matching accepts vegetarian evidence
or the fish category. This is discovery filtering, not a basket recommendation or
an allergy-safety guarantee. Source incompleteness remains prominently disclosed.

No prices were assigned to real imported products: priceEstimate is null and
priceKind is unavailable. Existing fictional fallback prices alone are retained
as demo-estimate and rendered “Est. €…”. They are not retailer offers. There is no
retailer-price or availability claim, no currency conversion and no live pricing.

## Search, pagination, images and fallback

Search tokenizes up to eight words and performs indexed simple-dictionary prefix
matching across name and brand; all words must match. This handles partial input
without passing user syntax into SQL or PostgREST expressions. It is not fuzzy or
translated search. Category and positive dietary flags are combined server-side.
High protein uses at least 20% of listed calories from protein, and requires
nonzero calories plus known protein. The criterion is explained beside the filter.

The search hook debounces text by 300ms, aborts obsolete requests, and ignores
stale responses. Each page contains 24 products, ordered by name then unique ID.
One extra row determines whether Load more is available. Loading failure on later
pages preserves current real results and offers retry; demo and real pages are
never silently mixed. Concurrent load-more taps are deduplicated.

FlatList virtualizes cards (six initially/per batch, window size five); filters
live in its scrollable header. Details use the shared Screen and explicit bottom
safe area below the native header. Source images keep fixed card/detail frames,
show loading indicators, reset state when URL changes, and fall back to a native
placeholder for missing or failed URLs. Three hosted thumbnails returned HTTP 200
image/jpeg, and actual component tests cover loading/failure/recycling.

Missing configuration or an unavailable initial Supabase query shows a clearly
labeled ten-item fictional fallback with Retry live catalog. Empty successful
queries remain empty, not replaced with demo results. OFF downtime cannot affect
an already imported Supabase catalog. No full offline copy of the live catalog is
cached; real detail requests need connectivity. Existing preference durability is
independent and unchanged.

## Reproduce the import

```powershell
npm run catalog:prepare
```

This streams the official bulk JSONL with a custom User-Agent, bounds the work to
750 selected records by default (CATALOG_TARGET accepts 500–1000), a per-category
cap, at most 80,000 scanned records and a ten-minute limit. Partial results and
failures are explicit. Output is ignored under `.expo/catalog`: normalized JSON,
a manifest and SQL batches of 50 rows. Supply OFF_USER_AGENT with your own app
contact for ongoing usage. No automatic schedule or CI import is installed.

Apply the migration first, then execute the SQL batches in order with an
administrative database session. They quote JSON safely and upsert by provider ID.
Alternatively, in a server-side shell with SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY configured:

```powershell
npm run catalog:apply -- --apply
```

Never expose the service-role key via EXPO_PUBLIC_, commit it, or put it in the
mobile bundle. Without --apply the script only reports the prepared count.
Failed batches can be rerun without duplicating rows. The initial hosted import
here used the connected Supabase database tool; no service-role key was retrieved.

```powershell
npm run catalog:verify
```

Verification uses only the existing public .env configuration, creates no users,
and checks actual hosted name/brand search, filters, pages, detail lookup, empty
results, preference exclusions and a few images.

## Verification and limits

TypeScript, ESLint, all 30 regression tests, Expo Doctor (18/18), and an
Android production export with Hermes pass. Tests cover normalization, missing
values, duplicate imports, real PostgreSQL constraints/RLS, search/filter request
construction, actual hook debounce and stale responses, image component recovery,
and all existing preference/navigation regressions. The test renderer is pinned
to React 19.1.0 and development-only; its upstream deprecation notice does not
affect the application. The inherited npm audit count remains 25 (16 moderate,
9 high); no unrelated upgrades or force overrides were made.

The existing GitHub Android workflow is untouched. No APK build was started,
following the user's instruction. A physical-device UI/scrolling test and iOS
safe-area check are still needed. The last installed APK does not contain these
source changes until a future build is requested.

This is a bounded international development sample, not a representative German
retailer catalog. Names and ingredients remain in the available source language;
fresh produce, eggs and potatoes are less represented than packaged goods.
Category assignment is heuristic, images may later break, nutrition may contain
source mistakes, and no product availability is verified. Offset pagination is
appropriate for this small catalog; live administrative edits during browsing can
change page boundaries. The hook deduplicates IDs but is not snapshot pagination.

No basket generation, optimization, meal planning, recipes, retailer checkout,
payments or recommendations were added.

## Source documentation and licensing

- [OFF API and bulk-export guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [OFF product schema changes](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-api-and-product-schema-change-log/)
- [OFF selected image URLs](https://openfoodfacts.github.io/openfoodfacts-server/api/how-to-download-images/)
- [OFF data](https://world.openfoodfacts.org/data) and [reuse terms](https://world.openfoodfacts.org/terms-of-use)
- [Supabase full-text search](https://supabase.com/docs/guides/database/full-text-search)

The imported database content is attributed to Open Food Facts under ODbL, with
individual contents under DbCL and images under CC BY-SA. Attribution links are
visible on the product list and detail screens. Retain the applicable licensing
and provenance when exporting or redistributing this catalog.


## Files modified or added

- `app/_layout.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/products.tsx`
- `app/basket-setup.tsx`
- `app/product/[id].tsx`
- `components/CatalogAttribution.tsx`
- `components/ProductCard.tsx`
- `components/ProductImage.tsx`
- `components/ui.tsx`
- `data/products.ts`
- `docs/PRODUCT-CATALOG.md`
- `hooks/useProducts.ts`
- `package-lock.json`
- `package.json`
- `README.md`
- `scripts/apply-catalog.cjs`
- `scripts/import-catalog.cjs`
- `scripts/register-typescript.cjs`
- `scripts/verify-catalog.cjs`
- `services/catalog/attribution.ts`
- `services/catalog/CatalogProvider.ts`
- `services/catalog/discovery.ts`
- `services/catalog/images.ts`
- `services/catalog/normalize.ts`
- `services/catalog/OpenFoodFactsProvider.ts`
- `services/catalog/product-row.ts`
- `services/catalog/ProductRepository.ts`
- `services/preference-navigation.ts`
- `services/products.ts`
- `supabase/migrations/20260906005004_products_catalog.sql`
- `tests/catalog-database.test.cjs`
- `tests/catalog-hook.test.cjs`
- `tests/catalog.test.cjs`
- `tests/product-image.test.cjs`
- `types/product.ts`
