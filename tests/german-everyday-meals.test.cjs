const { test } = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../data/german-everyday-meals.json');

test('everyday catalog has unique stable IDs, ingredients and consistent time estimates', () => {
  assert.equal(catalog.schemaVersion, 2);
  assert.equal(catalog.locale, 'de-DE');
  assert.equal(catalog.status, 'active-estimated-recipes');
  assert.equal(catalog.timeBasis.servings, 4);
  const ids = new Set();
  for (const meal of catalog.meals) {
    assert.match(meal.id, /^de-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!ids.has(meal.id), `Duplicate: ${meal.id}`);
    ids.add(meal.id);
    assert.ok(meal.name.trim());
    assert.ok(meal.mealSlots.length > 0);
    assert.equal(new Set(meal.mealSlots).size, meal.mealSlots.length);
    assert.ok(meal.mealSlots.every(slot => ['breakfast', 'lunch', 'dinner'].includes(slot)));
    assert.ok(Number.isInteger(meal.activeMinutes) && meal.activeMinutes > 0);
    assert.ok(Number.isInteger(meal.totalMinutes) && meal.totalMinutes >= meal.activeMinutes);
    assert.ok(['assemble', 'cook', 'bake', 'soak'].includes(meal.method));
    assert.ok(meal.ingredients.length > 0 && meal.ingredients.every(item => item.trim()));
    assert.ok(meal.preparationNote.trim());
    if (meal.method === 'assemble') assert.equal(meal.totalMinutes, meal.activeMinutes);
  }
});

test('every meal slot includes no-cook options and advance preparation is explicit', () => {
  for (const slot of ['breakfast', 'lunch', 'dinner']) {
    assert.ok(catalog.meals.some(meal => meal.mealSlots.includes(slot) && meal.method === 'assemble'));
    assert.ok(catalog.meals.some(meal => meal.mealSlots.includes(slot) && meal.method === 'cook'));
  }
  const bread = catalog.meals.find(meal => meal.name === 'Marmeladenbrot');
  assert.equal(bread.method, 'assemble');
  assert.equal(bread.totalMinutes, 5);
  const oats = catalog.meals.find(meal => meal.method === 'soak');
  assert.ok(oats.totalMinutes >= oats.activeMinutes + 480);
  assert.match(oats.preparationNote, /Kühlschrank/);
  const potatoes = catalog.meals.find(meal => meal.name === 'Bratkartoffeln mit Ei');
  assert.ok(potatoes.ingredients.includes('Kartoffeln roh'));
  assert.match(potatoes.preparationNote, /Vorkochen ist enthalten/);
});

require('./register.cjs');
const { meals, ingredients } = require('../data/meals.ts');
const { compatibleMeal, fitsSlot, mealNutrition, suggestMeals } = require('../services/meals/planner.ts');
const { aggregateIngredients } = require('../services/meals/aggregation.ts');
const { startWeek, toggleDay, chooseMeal } = require('../services/meals/weekPlanDraft.ts');
const { isAnyMealPlan } = require('../services/meals/validation.ts');
const { ingredientMappings } = require('../data/ingredient-mappings.ts');
const { diagnoseMatches } = require('../services/meals/matching.ts');
const { prefs, product } = require('./basket-fixtures.cjs');

test('all 64 everyday recipes resolve quantities, units, macros, restrictions and all declared slots', () => {
  for (const entry of catalog.meals) {
    const meal = meals.find(item => item.id === entry.id);
    assert.ok(meal, entry.id);
    assert.equal(meal.servings, 1);
    assert.equal(meal.ingredients.length, entry.amounts.length);
    assert.ok(meal.caloriesPerServing > 100 && meal.caloriesPerServing < 1500, meal.name);
    assert.ok(compatibleMeal(meal, prefs()));
    assert.deepEqual(meal.preparation.referenceServings, 4);
    assert.deepEqual(meal.mealSlots, entry.mealSlots);
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
      assert.equal(fitsSlot(meal, slot), entry.mealSlots.includes(slot));
    }
    const expectedAllergens = new Set();
    for (const line of meal.ingredients) {
      assert.ok(line.quantity > 0 && Number.isFinite(line.quantity));
      const definition = ingredients[line.ingredientKey];
      assert.ok(definition && ingredientMappings[line.ingredientKey]);
      assert.equal(line.unit, definition.unit);
      for (const allergen of definition.allergens) expectedAllergens.add(allergen);
      for (const diet of meal.dietaryTags) assert.ok(definition.diets.includes(diet));
    }
    assert.deepEqual(new Set(meal.allergens), expectedAllergens);
    for (const allergen of expectedAllergens) assert.equal(compatibleMeal(meal, prefs({ allergens: [allergen] })), false);
    const n = mealNutrition({ meal, servings: 1, mealSlot: meal.mealType });
    assert.equal(n.calories, meal.caloriesPerServing);
    assert.equal(n.protein, meal.proteinPerServing);
    assert.equal(n.carbohydrates, meal.carbohydratesPerServing);
    assert.equal(n.fat, meal.fatPerServing);
  }
});

test('bread can be chosen, scaled, aggregated and restored without changing old meal snapshots', () => {
  const p = prefs({ householdSize: 2 });
  const date = '2026-10-19';
  let week = toggleDay(startWeek(date, p), date, p);
  const bread = meals.find(meal => meal.name === 'Marmeladenbrot');
  assert.ok(Math.abs(bread.caloriesPerServing - 389.4) < 1e-9);
  assert.deepEqual(bread.ingredients.map(i => i.ingredientKey), ['wholemeal_bread', 'butter', 'jam']);
  const excluded = meals.filter(meal => meal.id !== bread.id).map(meal => meal.id);
  assert.equal(suggestMeals(week, date, 'breakfast', p, [], excluded)[0].meal.id, bread.id);
  week = chooseMeal(week, date, 'breakfast', { meal: bread, servings: 2 }, p);
  const requirements = aggregateIngredients(week);
  assert.equal(requirements.find(line => line.ingredientKey === 'wholemeal_bread').requiredQuantity, 200);
  assert.equal(requirements.find(line => line.ingredientKey === 'jam').requiredQuantity, 60);
  assert.ok(isAnyMealPlan(JSON.parse(JSON.stringify(week))));
  const invalid = structuredClone(week);
  invalid.items[0].meal.preparation.activeMinutes = -1;
  assert.equal(isAnyMealPlan(invalid), false);
  const legacy = structuredClone(week);
  legacy.items[0].meal = meals.find(meal => meal.id === 'oat-berries');
  assert.ok(!legacy.items[0].meal.preparation);
  assert.ok(isAnyMealPlan(legacy));
});

test('convenience ingredients retain form checks and canned ingredients require drained weights', () => {
  const p = prefs();
  const beans = product(991, { name: 'Kidneybohnen', category: 'legumes',
    caloriesPer100g: 100, proteinPer100g: 7, carbohydratesPer100g: 14, fatPer100g: .5,
    quantityLabel: '400 g', packageSize: 400, packageUnit: 'g' });
  assert.equal(diagnoseMatches('kidney_beans', [beans], p).candidates[0].packageIssue, 'drained_weight_unknown');
  const drained = diagnoseMatches('kidney_beans', [{ ...beans, packageDrainedWeight: 240 }], p);
  assert.equal(drained.candidates[0].optimizationProduct.packageSize, 240);
  assert.equal(diagnoseMatches('kidney_beans', [{ ...beans, name: 'Kidneybohnen trocken' }], p).candidates.length, 0);
  const dough = product(992, { name: 'Pizza dough', category: 'bread', caloriesPer100g: 270,
    proteinPer100g: 7, carbohydratesPer100g: 48, fatPer100g: 5 });
  assert.equal(diagnoseMatches('pizza_dough', [dough], p).candidates.length, 1);
  assert.equal(diagnoseMatches('pizza_dough', [{ ...dough, name: 'Pizza dough mix' }], p).candidates.length, 0);
  const rice = product(993, { name: 'Milchreis gekocht', category: 'grains' });
  assert.equal(diagnoseMatches('pudding_rice', [rice], p).candidates.length, 0);
});

test('milk is purchased in ml and new allergen labels remain strict at product matching', () => {
  const milk = product(994, { name: 'Vollmilch', category: 'dairy', packageUnit: 'ml',
    packageSize: 1000, quantityLabel: '1 l', caloriesPer100g: 64, proteinPer100g: 3.3,
    carbohydratesPer100g: 4.8, fatPer100g: 3.5, nutritionBasis: '100ml', allergens: ['milk'] });
  assert.equal(diagnoseMatches('milk', [milk], prefs()).candidates[0].optimizationProduct.packageUnit, 'ml');
  assert.equal(diagnoseMatches('milk', [milk], prefs({ allergens: ['milk'] })).candidates.length, 0);
  for (const allergen of ['mustard', 'celery']) {
    const contaminated = { ...milk, allergens: [allergen] };
    assert.equal(diagnoseMatches('milk', [contaminated], prefs({ allergens: [allergen] })).candidates.length, 0);
  }
});
