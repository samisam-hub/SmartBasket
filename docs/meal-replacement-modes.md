# Meal replacement modes

The existing Replace meal action opens four modes, then either the existing compatible cooking alternatives or ready-meal categories. Eating out commits directly. Back and close do not alter the plan. The app keeps its English UI. Prepared artwork in `assets/meal-options/` illustrates modes, never a real SKU.

Legacy items without `mealMode` are cooking meals. Non-cooking choices use the existing item identity, day and slot, plus `mealMode` / `readyMealCategory`; their empty-ingredient `meal` is only a display snapshot, not a catalog product or recipe. Numeric zero is the internal aggregation identity for unrecorded nutrition, while the UI says unknown. These calories are not redistributed. Cooking-only days retain existing portion adjustment; mixed days preserve other servings.

After confirmation, `basketFromMealPlan` matches cooking ingredients as before, then matches ready meals against the remaining budget. `readyMeals.ts` checks category, explicit preparation modes, supported slot, catalog availability, source, positive dietary evidence, existing strict allergen rules, known package mass, portion mass, nutrition and EUR price. It never infers suitability from names such as dry lasagne sheets. If no safe candidate exists, the category remains a meal wish with an unresolved warning; no fake shopping item is created. Budgets rank safe candidates but never relax dietary constraints; over-budget results retain the existing warning.

Each matched meal records the actual SKU and planned nutrition. Household portions determine required mass; repeated uses of one SKU share whole packages. Existing shopping requirements, removal/recalculation, persistence, product detail navigation and checkout paths are reused. Eating out has no shopping demand. Breakfast/snack currently explain that the five categories are main meals; heating excludes salad.

## Catalog prerequisite

Migration `20260924144255_ready_meal_metadata.sql` adds optional `products.ready_meal` with constraints and a category index; existing catalog permissions stay read-only for app users. Existing JSON meal/basket snapshots need no new table or RPC. The migration was applied to SmartBasket `oepajinqjkcqqyddpgne` on 2026-09-24.

Verified catalog count after migration: **0 of 784 products**. This is intentional: available names alone do not establish whether a product is a complete ready meal, reheating-only, or still requires cooking. Do not populate metadata from those names alone. An administrator/importer must verify product-label/provider evidence, portion size, safety and catalog availability, e.g.:

```json
{
  "category": "lasagne",
  "modes": ["heat_and_eat"],
  "slots": ["lunch", "dinner"],
  "portionGrams": 350,
  "available": true,
  "evidence": "Verified product-label reference and date"
}
```

This is a schema example, not a real product assertion. `available` means enabled in SmartBasket's catalog, not live supermarket stock. Unknown dietary information excludes composite ready meals. Re-imports without preparation metadata preserve curated metadata. Ready-meal leftovers can be recorded through existing checkout, but automatic reuse as a ready-meal portion is not implemented in this change; cooking-ingredient pantry reuse remains unchanged.

## Verification

120 tests passed across the full suite; relevant database persistence tests also rerun after adding a mixed-mode RPC round trip. TypeScript and lint passed. Coverage includes two-stage UI/back navigation, category compatibility, reversible choices, mixed plans, no eating-out demand/redistribution, confirmed-only SKU assignment, household package aggregation, dietary/allergen rejection, budget selection, removal, local reopen, SQL snapshot persistence, metadata constraints/import preservation and existing RLS.

## Files in this change

- `types/meal.ts`, `types/product.ts`
- `services/meals/choices.ts`, `readyMeals.ts`, `planner.ts`, `aggregation.ts`, `basket.ts`, `matching.ts`, `validation.ts`
- `services/catalog/product-row.ts`
- `components/MealPlanReview.tsx`, `ConfirmedMeals.tsx`, `BasketResult.tsx`
- `lib/meal-option-images.ts`, `lib/meal-images.ts`; three existing prepared PNGs in `assets/meal-options/`
- `supabase/migrations/20260924144255_ready_meal_metadata.sql`
- `tests/meal-choices.test.cjs`, `meal-review-ui.test.cjs`, `meal-persistence.test.cjs`, `catalog-database.test.cjs`, `basket-database.test.cjs`

Unrelated voice changes already present in the workspace were preserved.
