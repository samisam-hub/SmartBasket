const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./register.cjs');
const catalog = require('../data/international-meals.json');
const { meals, ingredients } = require('../data/meals.ts');
const { ingredientMappings } = require('../data/ingredient-mappings.ts');
const { compatibleMeal, fitsSlot, mealNutrition } = require('../services/meals/planner.ts');
const { aggregateIngredients } = require('../services/meals/aggregation.ts');
const { startWeek, toggleDay, chooseMeal } = require('../services/meals/weekPlanDraft.ts');
const { isAnyMealPlan } = require('../services/meals/validation.ts');
const { prefs } = require('./basket-fixtures.cjs');
const find = id => meals.find(meal => meal.id === id);

test('international meals enter planning with complete shopping quantities, nutrition and restrictions', () => {
  assert.equal(catalog.meals.length, 5);
  assert.equal(new Set(meals.map(meal => meal.id)).size, meals.length);
  for (const entry of catalog.meals) {
    const meal = find(entry.id);
    assert.ok(meal, entry.id);
    assert.ok(compatibleMeal(meal, prefs()));
    assert.ok(fitsSlot(meal, 'lunch') && fitsSlot(meal, 'dinner'));
    assert.ok(!fitsSlot(meal, 'breakfast'));
    assert.equal(meal.preparation.referenceServings, 4);
    assert.ok(meal.preparation.totalMinutes >= meal.preparation.activeMinutes);
    assert.ok(meal.caloriesPerServing > 300 && meal.caloriesPerServing < 1200, meal.name);
    const date = '2026-11-02';
    const p = prefs({ householdSize: 4 });
    let week = toggleDay(startWeek(date, p), date, p);
    week = chooseMeal(week, date, 'lunch', { meal, servings: 4 }, p);
    assert.ok(isAnyMealPlan(JSON.parse(JSON.stringify(week))));
    const requirements = aggregateIngredients(week);
    for (const line of entry.amounts) {
      assert.ok(ingredients[line.ingredientKey] && ingredientMappings[line.ingredientKey], line.ingredientKey);
      assert.equal(requirements.find(item => item.ingredientKey === line.ingredientKey).requiredQuantity, line.quantity);
    }
    assert.ok(Math.abs(mealNutrition({ meal, servings: 4, mealSlot: 'lunch' }).calories - meal.caloriesPerServing * 4) < 1e-8);
    for (const allergen of meal.allergens) assert.ok(!compatibleMeal(meal, prefs({ allergens: [allergen] })));
  }
});

test('requested fillings, meat, sauce and frying oil are retained', () => {
  const keys = id => find(id).ingredients.map(line => line.ingredientKey);
  const borscht = keys('borschtsch-rind-ohne-bohnen');
  assert.ok(borscht.includes('beef_stew') && borscht.includes('beetroot'));
  assert.ok(!borscht.some(key => /bean|lentil|chickpea/.test(key)));
  for (const [id, filling] of [
    ['pirozhki-kartoffeln-pilze-gebraten', ['potatoes', 'mushrooms']],
    ['pirozhki-kohl-karotten-gebraten', ['white_cabbage', 'carrots']],
  ]) {
    const meal = find(id);
    for (const key of [...filling, 'flour', 'dry_yeast', 'sunflower_oil']) assert.ok(keys(id).includes(key));
    assert.equal(meal.ingredients.find(line => line.ingredientKey === 'sunflower_oil').quantity, 20);
    assert.ok(meal.dietaryTags.includes('vegan'));
    assert.ok(meal.allergens.includes('wheat'));
    assert.match(meal.preparation.note, /Pfanne/);
    assert.ok(meal.preparation.totalMinutes >= 110);
  }
  const kotlety = find('kotlety-kartoffelpueree-rahmsauce');
  for (const key of ['mince', 'potatoes', 'milk', 'cream', 'flour']) assert.ok(keys(kotlety.id).includes(key));
  for (const allergen of ['milk', 'eggs', 'wheat', 'celery']) assert.ok(kotlety.allergens.includes(allergen));
  const palau = find('af-qabeli-palau-lamm');
  for (const key of ['lamb_stew', 'basmati_rice', 'carrots', 'raisins', 'cumin', 'cardamom']) assert.ok(keys(palau.id).includes(key));
  for (const id of ['borschtsch-rind-ohne-bohnen', kotlety.id, palau.id]) {
    assert.ok(!compatibleMeal(find(id), prefs({ dietaryPreferences: ['vegetarian'] })));
  }
});
