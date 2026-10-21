const { test } = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../data/german-everyday-meals.json');

test('everyday catalog has unique stable IDs, ingredients and consistent time estimates', () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.locale, 'de-DE');
  assert.equal(catalog.status, 'editorial-ideas');
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
  assert.ok(potatoes.ingredients.includes('Gekochte Kartoffeln'));
  assert.match(potatoes.preparationNote, /Vorkochen nicht enthalten/);
});
