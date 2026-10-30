require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict');
const { WeekPlanStore } = require('../services/week-plan-store.ts');
const { meals } = require('../data/meals.ts');
const { tasteMeals } = require('../services/meals/taste.ts');
const { suggestMeals, compatibleMeal } = require('../services/meals/planner.ts');
const { openPlanSlots } = require('../services/meals/validation.ts');
const { prefs } = require('./basket-fixtures.cjs');
const { fullCatalog } = require('./meal-fixtures.cjs');
const { basketFromMealPlan } = require('../services/meals/basket.ts');
const monday = '2026-10-19';
class Storage {
  data = new Map();
  async getItem(key) { return this.data.get(key) ?? null; }
  async setItem(key, value) { this.data.set(key, value); }
}
async function week(preferences = prefs(), device = new Storage(), key = 'anna') {
  const store = new WeekPlanStore(device, key);
  await store.initialize(); store.open(monday, preferences); store.toggleDay(monday, preferences);
  return store;
}

test('ratings are not day choices, survive restart and stay scoped to the owner', async () => {
  const device = new Storage(), p = prefs(), store = await week(p, device);
  const liked = tasteMeals('breakfast', p)[0];
  store.rateMeal(liked.id, true);
  assert.equal(store.getSnapshot().plan.items.length, 0);
  await store.flush();
  const reopened = new WeekPlanStore(device, 'anna'); await reopened.initialize();
  assert.equal(reopened.getSnapshot().mealRatings[liked.id], true);
  const other = new WeekPlanStore(device, 'other'); await other.initialize();
  assert.deepEqual(other.getSnapshot().mealRatings, {});
  reopened.rateMeal(liked.id, false); reopened.rateMeal(liked.id, null);
  assert.deepEqual(reopened.getSnapshot().mealRatings, {});
});

test('liked meals outrank neutrals, dislikes are excluded, and restrictions always win', async () => {
  const p = prefs(), store = await week(p), plan = store.getSnapshot().plan;
  const initial = suggestMeals(plan, monday, 'breakfast', p, fullCatalog);
  const liked = tasteMeals('breakfast', p).find(meal => !initial.some(s => s.meal.id === meal.id));
  const ratings = { [liked.id]: true, [initial[0].meal.id]: false };
  const ranked = suggestMeals(plan, monday, 'breakfast', p, fullCatalog, [], undefined, ratings);
  assert.equal(ranked[0].meal.id, liked.id);
  assert.ok(ranked.every(s => ratings[s.meal.id] !== false));
  const milk = meals.find(meal => meal.name === 'Quark mit Beeren');
  const allergic = prefs({ allergens: ['milk'] });
  assert.ok(!tasteMeals('breakfast', allergic).some(meal => meal.id === milk.id));
  assert.ok(suggestMeals(plan, monday, 'breakfast', allergic, fullCatalog, [], undefined, { [milk.id]: true })
    .every(s => compatibleMeal(s.meal, allergic) && s.meal.id !== milk.id));
});

test('one action fills the week, respects attendance, preserves decisions and reaches a basket', async () => {
  const people = [2200, 1400].map((dailyCalories, i) => ({ id: `p${i}`, name: `Person ${i}`, kind: i ? 'child' : 'adult',
    dailyCalories, proteinTarget: 70, age: null, sex: null, dietaryPreferences: ['none'], allergens: [], intolerances: [], isCurrentUser: !i }));
  const p = prefs({ householdSize: 2, participants: people }), store = await week(p);
  store.toggleAttendanceRule({ personId: 'p1', weekday: 0, slot: 'lunch' }, p);
  const liked = meals.find(m => m.id === 'chicken-potato'); store.rateMeal(liked.id, true);
  store.generate(p, fullCatalog);
  const plan = store.getSnapshot().plan;
  assert.deepEqual(openPlanSlots(plan), []);
  const lunch = plan.items.find(item => item.mealSlot === 'lunch');
  assert.equal(lunch.meal.id, liked.id);
  assert.deepEqual(lunch.participantIds, ['p0']);
  assert.ok(plan.items.every(item => compatibleMeal(item.meal, p)));
  assert.equal(new Set(plan.items.map(item => item.meal.id)).size, plan.items.length);
  store.rateMeal(liked.id, false); store.generate(p, fullCatalog);
  assert.deepEqual(store.getSnapshot().plan.items, plan.items, 'new ratings never replace existing decisions');
  assert.ok(basketFromMealPlan(store.confirm(p), p, fullCatalog).items.length > 0);
  store.toggleDay('2026-10-20', p); store.generate(p, fullCatalog);
  assert.deepEqual(store.getSnapshot().plan.items.filter(item => item.date === monday), plan.items);
});

test('an exhausted pool stays visibly open rather than filling with rejected meals', async () => {
  const p = prefs(), store = await week(p);
  for (const meal of meals) store.rateMeal(meal.id, false);
  store.generate(p, []);
  assert.equal(store.getSnapshot().plan.items.length, 0);
  assert.ok(openPlanSlots(store.getSnapshot().plan).length);
});

test('old caches without ratings still load; corrupt ratings cannot overwrite stored data', async () => {
  const device = new Storage(), store = await week(prefs(), device); await store.flush();
  const old = JSON.parse(device.data.get('anna')); delete old.mealRatings;
  device.data.set('old', JSON.stringify(old));
  const legacy = new WeekPlanStore(device, 'old'); await legacy.initialize();
  assert.deepEqual(legacy.getSnapshot().mealRatings, {});
  assert.deepEqual(legacy.getSnapshot().plan, store.getSnapshot().plan);
  const corrupt = JSON.stringify({ ...old, mealRatings: { x: 'yes' } }); device.data.set('bad', corrupt);
  const bad = new WeekPlanStore(device, 'bad'); await bad.initialize();
  assert.ok(bad.getSnapshot().error);
  assert.throws(() => bad.rateMeal(meals[0].id, true));
  assert.throws(() => bad.generate(prefs(), []));
  assert.equal(device.data.get('bad'), corrupt);
});

test('one run shows every dish once, in meal order, and skips what is already rated', () => {
  const { tastePasses } = require('../services/meals/taste.ts');
  const p = prefs({ householdSize: 2 });
  const slots = ['breakfast', 'lunch', 'dinner', 'snack'];
  const passes = tastePasses(p, slots);
  assert.deepEqual(passes.map(pass => pass.key), ['breakfast', 'main', 'snack'], 'breakfast, then the main meals, then snacks');
  // Three quarters of the recipes fit both lunch and dinner; asking twice showed the same dish again.
  const shown = passes.flatMap(pass => pass.meals.map(meal => meal.id));
  assert.equal(new Set(shown).size, shown.length, 'no dish is asked about twice');
  const lunchAndDinner = passes.find(pass => pass.key === 'main');
  assert.deepEqual(lunchAndDinner.slots, ['lunch', 'dinner']);
  // A household that only plans breakfast is not asked about dinner.
  assert.deepEqual(tastePasses(p, ['breakfast']).map(pass => pass.key), ['breakfast']);
  // What was answered before is not asked again, and nothing else is dropped.
  const [first, second] = shown;
  const resumed = tastePasses(p, slots, { [first]: true, [second]: false }).flatMap(pass => pass.meals.map(meal => meal.id));
  assert.deepEqual(resumed, shown.filter(id => id !== first && id !== second));
});

test('the dishes offered already respect the household: no lactose where it is avoided', () => {
  const { tastePasses } = require('../services/meals/taste.ts');
  const { compatibleMeal } = require('../services/meals/planner.ts');
  const slots = ['breakfast', 'lunch', 'dinner', 'snack'];
  const lactoseFree = prefs({ dietaryPreferences: ['lactose_free'] });
  const offered = tastePasses(lactoseFree, slots).flatMap(pass => pass.meals);
  assert.ok(offered.length, 'a lactose-free household still has dishes to rate');
  for (const meal of offered) assert.ok(compatibleMeal(meal, lactoseFree), `${meal.name} fits the household`);
  // And fewer than a household with no restriction at all.
  const all = tastePasses(prefs({}), slots).flatMap(pass => pass.meals);
  assert.ok(offered.length < all.length, 'a restriction takes dishes out before the first card');
});
