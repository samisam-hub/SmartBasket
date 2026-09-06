require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict');
const { prefs, product, catalog } = require('./basket-fixtures.cjs');
const { generateBasket } = require('../services/basket/basketGenerator.ts');
const { nutritionTargets } = require('../services/basket/nutritionTargets.ts');
const { exclusionReason } = require('../services/basket/constraints.ts');
const { planPackage } = require('../services/basket/quantityPlanner.ts');
test('nutrition targets scale household and period; automatic and manual rules are transparent', () => {
  assert.equal(nutritionTargets(prefs()).calorieTarget, 11900);
  for (const days of [3,5,7,14]) for (const size of [1,2,10]) {
    const t = nutritionTargets(prefs({ planningDays: days, householdSize: size, proteinMode: 'manual', proteinTargetGrams: 100 }));
    assert.equal(t.calorieTarget, 1700 * days * size); assert.equal(t.proteinTarget, 100 * days * size);
    assert.equal(t.budgetTarget, 70); // Existing budget is the total for this period.
  }
  for (const [goal, fraction] of Object.entries({ balanced: .15, maintain: .20, high_protein: .25, lose_weight: .25, build_muscle: .275 }))
    assert.equal(nutritionTargets(prefs({ primaryGoal: goal, dailyCalories: 2000 })).dailyProteinTarget, 2000 * fraction / 4);
});
test('positive dietary evidence is mandatory and contradictions cannot bypass exclusions', () => {
  for (const [diet, flag] of [['vegan','vegan'], ['vegetarian','vegetarian'], ['lactose_free','lactoseFree'], ['gluten_free','glutenFree']]) {
    for (const value of [false, null]) assert.ok(exclusionReason(product(1, { [flag]: value }), prefs({ dietaryPreferences: [diet] })));
    assert.equal(exclusionReason(product(1), prefs({ dietaryPreferences: [diet] })), null);
  }
  assert.ok(exclusionReason(product(1, { category: 'meat' }), prefs({ dietaryPreferences: ['vegetarian'] })));
  assert.ok(exclusionReason(product(1, { category: 'fish', vegetarian: false }), prefs({ dietaryPreferences: ['pescatarian'] })));
  assert.ok(exclusionReason(product(1, { allergens: ['gluten'] }), prefs({ dietaryPreferences: ['gluten_free'] })));
  const vegan = generateBasket(prefs({ dietaryPreferences: ['vegan', 'lactose_free', 'gluten_free'] }), catalog);
  assert.ok(vegan.items.length); assert.ok(vegan.items.every(i => i.product.vegan === true && i.product.lactoseFree === true && i.product.glutenFree === true));
});
test('allergens, traces and missing free-from evidence are excluded conservatively', () => {
  const p = prefs({ allergens: ['milk'] });
  const safe = product(1, { labels: ['milk free'] });
  assert.equal(exclusionReason(safe, p), null);
  for (const patch of [{ allergens: ['milk'] }, { mayContainAllergens: ['milk'] }, { labels: [] }, { ingredientsText: null }, { allergenInfoAvailable: false }])
    assert.ok(exclusionReason({ ...safe, ...patch }, p));
  assert.ok(exclusionReason(product(2, { glutenFree: true, labels: ['gluten free'] }), prefs({ allergens: ['wheat'] })));
  assert.ok(exclusionReason(product(2, { labels: ['wheat free'], allergens: ['gluten'] }), prefs({ allergens: ['wheat'] })));
  assert.equal(generateBasket(p, catalog).items.length, 0);
});
test('whole packages, category coverage, nutrition sums and deterministic order', () => {
  const r = generateBasket(prefs(), catalog);
  assert.deepEqual(r, generateBasket(prefs(), [...catalog].reverse()));
  const duplicate = generateBasket(prefs(), [...catalog, catalog[0]]);
  assert.deepEqual(duplicate.items, r.items); assert.equal(duplicate.exclusions.duplicate, 1);
  assert.ok(r.items.every(i => Number.isInteger(i.packageCount) && i.packageCount > 0));
  assert.ok(r.categoryCoverage.filter(c => c.required).every(c => c.represented));
  assert.ok(r.calorieCoveragePercent >= 90 && r.calorieCoveragePercent <= 110, JSON.stringify(r));
  assert.ok(r.proteinCoveragePercent >= 90 && r.proteinCoveragePercent <= 130);
  assert.equal(r.totalCalories, Math.round(r.items.reduce((s, i) => s + i.totalCalories, 0) * 100) / 100);
  for (const i of r.items) { assert.equal(i.totalWeight, i.packageCount * i.packageAmount); assert.ok(i.reasonSelected.length); }
});
test('budget conflicts and unknown prices never become a false within-budget claim', () => {
  const normal = generateBasket(prefs(), catalog); assert.equal(normal.budgetStatus, 'within_budget');
  const mixed = generateBasket(prefs(), [...catalog,product(99,{priceEstimate:null,priceKind:'unavailable'})]);
  assert.ok(mixed.items.every(i=>i.estimatedPrice!==null));assert.ok(mixed.warnings.some(w=>w.code==='unpriced_candidates_excluded'));
  const low = generateBasket(prefs({ weeklyBudgetEur: 0.01 }), catalog);
  assert.ok(low.items.length); assert.equal(low.budgetStatus, 'unachievable'); assert.ok(low.warnings.some(w => w.code === 'budget_conflict'));
  const unknown = generateBasket(prefs(), catalog.map(p => ({ ...p, priceEstimate: null, priceKind: 'unavailable' })));
  assert.ok(unknown.items.length); assert.equal(unknown.estimatedTotalPrice, null); assert.equal(unknown.budgetDifference, null); assert.equal(unknown.budgetStatus, 'unknown');
  assert.equal(generateBasket(prefs({ budgetEnabled: false }), catalog).budgetStatus, 'disabled');
});
test('missing package sizes use explicit assumptions; mass and volume never silently convert', () => {
  assert.deepEqual(planPackage(product(1, { packageSize: null, packageUnit: null })), { amount: 500, unit: 'g', assumed: true });
  assert.equal(planPackage(product(1, { packageUnit: 'ml' })), null);
  const liquid = product(1, { packageUnit: 'ml', nutritionBasis: '100ml', category: 'dairy-alternatives' });
  const r = generateBasket(prefs(), [liquid]); assert.ok(r.items.length); assert.equal(r.items[0].totalWeight, null); assert.ok(r.items[0].totalVolume > 0);
  const assumed = generateBasket(prefs(), catalog.map(p => ({ ...p, packageSize: null, packageUnit: null })));
  assert.ok(assumed.warnings.some(w => w.code === 'assumed_packages'));
});
test('empty, malformed nutrition, conflicting duplicates, restricted and maximum household inputs are bounded', () => {
  assert.equal(generateBasket(prefs(), []).status, 'empty');
  assert.equal(generateBasket(prefs(), [product(1, { proteinPer100g: null })]).items.length, 0);
  assert.ok(exclusionReason(product(1, { caloriesPer100g: 91, proteinPer100g: 13, carbohydratesPer100g: 73, fatPer100g: 0 }), prefs()));
  assert.ok(exclusionReason(product(1, { category: 'fruit', proteinPer100g: 21, carbohydratesPer100g: 1, fatPer100g: 8, caloriesPer100g: 160 }), prefs()));
  assert.equal(generateBasket(prefs(), [product(1), product(1, { vegan: false })]).items.length, 0);
  assert.equal(generateBasket(prefs({ dailyCalories: NaN }), catalog).status, 'invalid');
  for (const days of [3,5,7,14]) {
    const r = generateBasket(prefs({ householdSize: 3, planningDays: days, budgetEnabled: false }), catalog);
    assert.ok(r.items.length); assert.ok(Number.isFinite(r.objective));
  }
  const high = generateBasket(prefs({ householdSize: 10, planningDays: 14, dailyCalories: 5000, budgetEnabled: false }), catalog);
  assert.ok(high.items.length); assert.ok(high.iterations <= 1600); assert.ok(Number.isFinite(high.totalCalories));
});
