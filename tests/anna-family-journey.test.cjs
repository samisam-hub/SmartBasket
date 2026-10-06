require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict');
const { WeekPlanStore } = require('../services/week-plan-store.ts');
const { quickIndividualMeals } = require('../services/meals/planner.ts');
const { basketFromMealPlan } = require('../services/meals/basket.ts');
const { itemsInSlot } = require('../services/meals/weekPlan.ts');
const { shoppingRows, rowChecked, shoppingListText } = require('../services/basket/shopping-list.ts');
const { ShoppingListStore, shoppingListKey } = require('../services/shopping-list-store.ts');
const { meals } = require('../data/meals.ts');
const { prefs } = require('./basket-fixtures.cjs');
const { fullCatalog } = require('./meal-fixtures.cjs');

class DeviceStorage {
  values = new Map();
  async getItem(key) { return this.values.get(key) ?? null; }
  async setItem(key, value) { this.values.set(key, value); }
}
const person = (id, name, kind, dailyCalories) => ({ id, name, kind, dailyCalories,
  proteinTarget: Math.round(dailyCalories * .2 / 4), age: null, sex: null,
  dietaryPreferences: ['none'], allergens: [], intolerances: [], isCurrentUser: id === 'anna' });

test('Anna plans school lunch, a separate lunchbox, and a shareable shopping trip end to end', async () => {
  const monday = '2026-10-05', tuesday = '2026-10-06';
  const preferences = prefs({ householdSize: 3, dailyCalories: 1870, participants: [
    person('anna', 'Anna', 'adult', 2200), person('partner', 'Partner', 'adult', 2000),
    person('mia', 'Mia', 'child', 1400),
  ] });
  const device = new DeviceStorage(), week = new WeekPlanStore(device, 'anna-weeks');
  await week.initialize(); week.open(monday, preferences);
  week.toggleAttendanceRule({ personId: 'mia', weekday: 0, slot: 'lunch' }, preferences);
  week.toggleDay(monday, preferences); week.toggleDay(tuesday, preferences);
  const chickenBowl = meals.find(meal => meal.id === 'chicken-potato');
  week.choose(monday, 'lunch', { meal: chickenBowl, servings: 3 }, preferences);
  week.choose(tuesday, 'lunch', { meal: chickenBowl, servings: 3 }, preferences);
  const lunchbox = quickIndividualMeals(week.getSnapshot().plan, 'lunch', preferences)
    .find(option => option.meal.id === 'chicken-ham-lunchbox');
  week.choose(tuesday, 'lunch', lunchbox, preferences, ['mia']);
  for (const date of [monday, tuesday]) for (const slot of ['breakfast', 'dinner'])
    week.skip(date, slot, preferences);
  const plan = week.getSnapshot().plan;
  assert.deepEqual(itemsInSlot(plan, monday, 'lunch').map(item => item.participantIds), [['anna', 'partner']]);
  assert.deepEqual(itemsInSlot(plan, tuesday, 'lunch').map(item => item.participantIds),
    [['anna', 'partner'], ['mia']]);
  const mondayFamily = itemsInSlot(plan, monday, 'lunch')[0];
  assert.ok(Math.abs(mondayFamily.servings - 3 * 4200 / 5600) < 1e-9);
  const result = basketFromMealPlan(week.confirm(preferences), preferences, fullCatalog);
  assert.equal(result.status, 'generated', result.warnings.map(w => w.code).join(', '));
  assert.ok(result.items.some(item => item.ingredientKey === 'chicken_ham'));
  assert.ok(result.items.some(item => item.ingredientKey === 'apple'));
  assert.ok(!result.warnings.some(warning => warning.code.startsWith('open_slot_')));

  const rows = shoppingRows(result);
  assert.ok(rows.length > 0);
  const checklist = new ShoppingListStore(device, shoppingListKey('anna', 'basket-1'));
  await checklist.initialize(); checklist.toggle(rows[0]); await checklist.flush();
  const reopened = new ShoppingListStore(device, shoppingListKey('anna', 'basket-1'));
  await reopened.initialize();
  assert.ok(rowChecked(rows[0], reopened.getSnapshot().checked));
  const sharedText = shoppingListText('Family week', rows, reopened.getSnapshot().checked);
  assert.match(sharedText, /Already picked up:/);
  assert.match(sharedText, /\[ \]/);
  assert.ok(sharedText.includes(`[x] ${rows[0].name}`));
  assert.equal(/Mia|allergen|kcal/.test(sharedText), false, 'private planning details stay out of the text');
  await week.flush();
  const nextSession = new WeekPlanStore(device, 'anna-weeks'); await nextSession.initialize();
  assert.deepEqual(nextSession.getSnapshot().plan, plan);
});
