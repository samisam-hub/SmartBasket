# Phase 3A — Basket generation engine V1

## Scope and architecture

The existing Expo/React Native project is retained. Home's existing **Create my
basket** flow still checks onboarding, then opens `basket-setup`. That screen now
loads the real SmartBasket catalog, runs the engine, displays its result and saves
it on request. The Basket tab lists saved snapshots and reopens them through the
same screen. Product details remain reachable. No basket editing, replacement,
recipe, checkout, payment, ML or LLM functionality was added.

`services/basket/` contains the pure generator, nutrition targets, constraints,
quantity planner, scoring/configuration, bounded catalog reader and persistence
adapters. `types/basket.ts` defines results, warnings, selection reasons and saved
snapshots. UI components only display results and manage loading/saving state.
Runtime generation calls Supabase, never Open Food Facts. It does not fall back to
fictional demo products. Saved device snapshots remain readable offline.

## Algorithm and objective

1. Validate completed saved preferences using the existing preference rules.
2. Deduplicate product IDs; reject conflicting duplicate records. Apply hard
   safety, nutrition and package/basis constraints before scoring.
3. If a budget is enabled and priced products cover every core group, prefer that
   priced pool and explicitly report excluded unpriced candidates. Otherwise
   retain eligible products and keep unknown pricing visible.
4. Rank each group by explicit product score; retain at most 14 candidates per
   group (98 overall). Sort by product ID for stable tie-breaking.
5. Greedily add the whole package that most reduces the weighted objective.
   Stop when no addition improves it, or after 1,600 additions.
6. Run at most 12 one-package removal/swap refinement passes. Return the best
   reached safe basket with structured warnings; never relax safety exclusions.

The objective uses squared relative calorie/protein error, squared category
amount shortfalls and diversity shortfall, a squared `log1p` relative budget
overrun, product calorie concentration, excess extras, and candidate quality.
It is a bounded heuristic, not a global-optimality or feasibility proof. It keeps
a nonempty best effort for an extremely low budget if eligible food exists.

| Central objective weight | Value |
| --- | ---: |
| Calorie deviation | 8 |
| Protein deviation | 5 |
| Budget overrun | 4 |
| Core category shortfall | 3 |
| Product diversity shortfall | 1.5 |
| Repeated-product calorie concentration | 0.6 |
| Excess extras | 2 |
| Candidate quality penalty | 0.08 |
| Each selected product with unknown price, when budget enabled | 0.02 |

Weights and search limits live in `scoring.ts`. Callers can supply alternative
weights; the applied weights are stored in each result. The reported score is
`100 / (1 + objective)`, or zero for an empty basket. It is an optimizer fit score,
not a health rating. Generation contains no randomness, clock reads or network
calls. Random request keys and timestamps belong only to save metadata.

Candidate quality has bounded factors: protein energy density (25 points), known
estimated kcal/€ efficiency (25), fiber density (10), optional nutrient
completeness (15), known package size (15), and dietary evidence (10). Hard
constraints always take precedence over these scores. Reasons such as
`category_coverage`, `diet:vegan`, `high_protein`, `price_efficiency` and
`assumed_package` are stored as codes plus short factual descriptions.

## Targets and category coverage

Calories = household size × planning days × daily calories. A manual protein
target uses saved grams per person/day. Automatic protein uses the selected
goal's calorie fraction divided by 4 kcal/g:

| Goal | Protein calorie fraction |
| --- | ---: |
| Balanced | 15% |
| Maintain | 20% |
| High protein | 25% |
| Lose weight | 25% |
| Build muscle | 27.5% |

The resulting daily protein target is also multiplied by household size and days.
These are transparent MVP planning rules supplied by the app specification, not
individual medical targets. All household members currently use the same target.

Core groups are protein sources, vegetables, fruit and carbohydrate staples.
Their soft planning amounts are respectively 100g, 200g, 150g and 100g per
person-day. Breakfast, dairy/alternatives and extras are optional. These amounts
guide variety; they do not claim to constitute a complete diet or serving plan.
Unavailable groups are reported rather than overriding a diet or allergy.
Successful coverage requires core representation and at least 75% of these soft
amount targets. Calories use a ±10% tolerance and protein 90–130% of target.

There are at most 24 distinct products. Diversity aims at four products for 3/5
days and six for 7/14 days, reduced if fewer candidates exist. No single product
may provide more than 35% of target calories. Extras normally stay below 10% and
breakfast below 25%; a single indivisible package may exceed those group limits
but not the overall 35% product limit. Per-product package counts are capped at
`max(2, ceil(person-days / 2))`.

Sugary breakfast products (>20g sugars/100g) and high-fat protein-category items
(>30g fat/100g) count as extras. High-energy preserved fruit/vegetables and drinks
do not count toward ordinary produce coverage. These are simple documented
classification heuristics, not retailer or dietary certifications.

## Hard constraints and source quality

Vegetarian, vegan, lactose-free and gluten-free restrictions require their
normalized flag to be TRUE. FALSE and unknown are both excluded. Known category
or allergen contradictions are excluded. Pescatarian requires vegetarian
evidence or an explicit pescatarian label; a fish category alone is insufficient.
Compatible overlapping restrictions are combined. Incompatible selections return
an invalid-preferences warning using the existing onboarding model.

For each selected allergen, declared contains and may-contain traces are excluded.
Wheat also conflicts with generic gluten declarations. Remaining candidates need
ingredient information and an explicit corresponding free-from label. Empty
allergen arrays, vegan status, lactose-free status or a gluten-free label alone
do not establish absence of milk/wheat allergens. This is intentionally stricter
than exploratory product browsing. Source free-from claims can still be wrong;
the result asks users to check actual packaging, without an allergy-safety claim.

Calories and all three main macros must be finite and usable. Zero-calorie foods
are not energy-planning candidates. Additional sanity checks reject macro totals
over 105g/100g, sugars exceeding carbohydrates by more than 2g, and macro-energy
discrepancies beyond `max(40 kcal, 35% of declared calories)`. Fruit with >10g
protein/100g and vegetables with >20g are held out as suspicious category data.
These checks exclude records; they never invent replacement nutrition.

The real audit found 25 nutrition inconsistencies, 12 incomplete/zero-energy
records and three suspicious category records in the standard example run.
For example, one flour record declared about 92 kcal alongside about 13g protein
and 73g carbohydrate, and a banana record declared 21g protein. Catalog data was
left unchanged; generation excludes unsuitable entries.

## Quantities and prices

Known package sizes use integer package counts. Nutrition = per-100 value ×
package amount × package count / 100. Weight and volume remain separate. Known
grams versus per-100ml (or ml versus per-100g) mismatches are excluded: no density
conversion is assumed. Packages above 20kg/20L or too large for the period are
excluded. Source quantity labels are used for display when available.

Missing or piece-based package amounts use explicit total-package assumptions:
fruit/vegetables/potatoes 1000g; meat/dairy/alternatives/bread/grains/pasta/breakfast
500g; fish/legumes 400g; eggs 360g; snacks 200g; other 500g. Per-100ml products use
1000ml. Assumptions are marked on items and in warnings. A piece count is never
silently treated as grams. Total fiber remains unknown if any selected fiber
value is missing; calories/macros never silently become zero.

The existing `weeklyBudgetEur` is the **whole-household total for the selected
planning period**, as already documented by onboarding and its database column.
It is not rescaled by days or household size a second time.

Only valid EUR `priceEstimate` values are used; no retailer prices or synthetic
prices are introduced. Missing/non-EUR prices produce a null total, null budget
difference and `unknown` budget status, with a separately labeled known-price
subtotal. The current 750 imported products have no price estimates, so a real
catalog basket cannot honestly show a numeric total or verified budget fit yet.
Fixture tests with prices exercise budgeting. `slightly_over` means up to 10%
over when other targets are met; `unachievable` means this search did not meet the
joint targets, not a mathematical proof. `disabled` applies when budget is off.

## Persistence and security

Applied migration: `20260906131336_generated_baskets.sql` in the existing
SmartBasket Supabase project. `baskets` stores owner, idempotency request key,
period/household/targets, nullable estimate, score/status and preference/result
snapshots. `basket_items` stores a product FK, integer count, weight or volume,
nutrition, nullable price, reasons and immutable item/product snapshots. If a
catalog product is later deleted, the FK becomes null while its saved snapshot
remains readable. Catalog edits do not silently recalculate historical baskets.

RLS restricts both tables to the authenticated owner's rows. Anonymous Supabase
identities use that authenticated role, just as existing preferences do.
Unauthenticated `anon` has no access. App grants are SELECT/INSERT only: no update,
delete or ownership transfer. `save_generated_basket` is SECURITY INVOKER, checks
auth.uid(), uses an empty search path, and saves the parent plus all items in one
transaction. Repeating the request key returns the existing basket ID. These are
user-owned planning snapshots, not authoritative price quotes or payments.

Device storage uses separate owner-scoped entries per basket and a small index.
It writes locally first; cloud failures keep the device snapshot and show Retry
cloud save. Failed device writes never claim success. Owner/session mismatches
are rejected. Concurrent saves serialize index writes. Cloud reads cache snapshots
for offline reopening; local-only device entries do not cross into another user.
No preference storage keys or auth behavior changed. The cloud history currently
loads the latest 50 baskets; device copies remain available independently.

Advisors report the expected [anonymous authenticated-user policy notices](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins).
Owner isolation was tested; these are not public-read policies. The pre-existing
[password-protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
is unchanged; the app uses anonymous sessions.

## Example from the real catalog

One person, seven days, 1,700 kcal/day, Maintain, automatic protein:
11,900 kcal and 595g protein targets. Generation selected the following real
products in the checked development catalog:

| Product (source name) | Whole-package quantity |
| --- | --- |
| No Salt Added Diced | 4 × 411.068g |
| Noix de coco rapee | 1 × 220g |
| Mozzarella cheese bar | 1 × 907.185g |
| Yellow Cling Peach Halves | 3 × 825g |
| Maple Pancake Granola | 1 × assumed 500g |
| Seelachsfilet (köhler) | 1 × 950g |
| Dave's killer bread, blues bread, cornmeal crust | 1 × 708.738g |

Total: **11,680.42 kcal (98.15%)**, **635.07g protein (106.74%)**, all four core
groups represented. Price and budget fit are unknown. This is a grocery package
plan with canned/packaged products, not a recipe or a daily menu. The source's
fractional gram amounts are unit conversions; package counts are integers.

`npm run basket:verify` reproduces a read-only hosted example, verifies reverse
catalog order produces the same result, and checks vegan and milk-allergy cases.
The measured standard run took about 36ms on this development computer; no phone
performance claim is made. The vegan case reached 96.13% calories; the milk-allergy
case had only one eligible product and correctly returned a partial result.

## Verification and limitations

- TypeScript and lint passed. There are 47 tests, including 13 new basket tests.
- New fixture tests cover target scaling, diets/allergens, price states, tiny
  budgets, variety, quantities/bases, duplicates, deterministic output and bounds.
  Catalog tests also check pagination, the exact 2,000-product limit, refusal to
  silently truncate and cancellation without fictional fallback.
- PGlite executes the real migration/RPC with two identities, retry checks,
  foreign keys, rollback on a bad item, anon denial and blocked writes to others.
- Device tests cover restart, failed writes, corruption preservation, concurrent
  saves, owner separation and cloud retry. The actual result component test
  covers generation, double-tap save, reopening and abandoned-request cancellation.
- Hosted transaction tested save/readback, idempotency and two-owner isolation.
  All temporary test users/baskets were rolled back.
- Expo Doctor: 18/18. Android production/Hermes export passed. No native dependency,
  safe-area layout, onboarding flow or Android workflow file was changed.
- A signed APK build was not run for this phase; the commit skips automatic CI.

The optimizer is not exhaustive and can miss feasible combinations after its
candidate/search caps. Package assumptions, unknown prices, sparse regional
coverage, prepared-food/dry-food differences and imperfect source labels limit
results. Full pantry completeness, spoilage, cooking yields, meals, micronutrient
adequacy and different needs per household member are not modeled. Restrictive
allergies can yield very small or empty baskets by design. Anonymous session loss
still prevents remote-account recovery. Physical-device UX remains to be checked
with an APK containing this phase. No basket editing phase has started.
