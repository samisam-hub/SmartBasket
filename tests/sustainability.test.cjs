require("./register.cjs");
const { test } = require("node:test"), assert = require("node:assert/strict");
const { WeekPlanStore } = require("../services/week-plan-store.ts");
const { meals } = require("../data/meals.ts");
const { keepsDays, perishable } = require("../data/ingredient-keeping.ts");
const {
  cookTwicePairs, hasMeat, hasRedMeat, isSustainabilityLevel, leftoverUse, meatFreeDays,
  openAmount, openPacks, plannedLeftovers, redMeatDishes, reheatsWell, sustainabilityWeights,
} = require("../services/meals/sustainability.ts");
const { addDays } = require("../services/meals/weekPlan.ts");
const { prefs } = require("./basket-fixtures.cjs");
const { fullCatalog } = require("./meal-fixtures.cjs");

const monday = "2026-10-19";
class Storage {
  data = new Map();
  async getItem(key) { return this.data.get(key) ?? null; }
  async setItem(key, value) { this.data.set(key, value); }
}
async function plannedWeek(preferences) {
  const store = new WeekPlanStore(new Storage(), "anna");
  await store.initialize();
  store.open(monday, preferences);
  for (let day = 0; day < 7; day++) store.toggleDay(addDays(monday, day), preferences);
  store.generate(preferences, fullCatalog);
  return store.getSnapshot().plan;
}

test("what a pack leaves over is what the shop sells minus what the meals use", () => {
  // Chopped tomatoes come in 400 g tins: 858 g means three tins and 342 g left.
  assert.equal(openAmount("chopped_tomatoes", 858), 342);
  assert.equal(openAmount("chopped_tomatoes", 800), 0, "two whole tins leave nothing");
  assert.equal(openAmount("chopped_tomatoes", 0), 0, "what nobody buys leaves nothing");
  assert.equal(openAmount("not_an_ingredient", 500), 0);
});

test("fresh things are worth planning again soon, dry things any day", () => {
  assert.ok(keepsDays("parsley") <= 4, "a bunch of parsley wilts in days");
  assert.ok(keepsDays("mince") <= 3);
  assert.ok(keepsDays("pasta") > 100 && !perishable("pasta"));
  assert.ok(perishable("spinach") && keepsDays("spinach") < 10);
  assert.ok(keepsDays("chopped_tomatoes") > 100, "a tin outlasts any plan");
});

test("a dish is credited for what it finishes off, and only while it keeps", () => {
  const open = { amount: new Map([["spinach", 300], ["pasta", 200]]),
    lastUsed: new Map([["spinach", monday], ["pasta", monday]]) };
  const meal = { servings: 1, ingredients: [
    { ingredientKey: "spinach", quantity: 150 }, { ingredientKey: "pasta", quantity: 500 }] };
  // 150 g of spinach, and the pasta only as far as the open pack goes.
  assert.equal(leftoverUse(meal, 1, monday, open), 150 + 200);
  // Two days later the spinach still counts; two weeks later it does not, the pasta still does.
  assert.equal(leftoverUse(meal, 1, addDays(monday, 2), open), 350);
  assert.equal(leftoverUse(meal, 1, addDays(monday, 14), open), 200, "wilted greens are not a plan");
  assert.equal(leftoverUse(meal, 1, monday, { amount: new Map(), lastUsed: new Map() }), 0);
});

test("meat, red meat and what reheats are told apart", () => {
  const find = name => meals.find(meal => meal.name === name);
  assert.ok(hasMeat(find("Nudeln mit Pute")));
  assert.ok(!hasRedMeat(find("Nudeln mit Pute")), "poultry is meat but not red meat");
  assert.ok(hasRedMeat(find("Lasagne mit Hackfleisch")));
  assert.ok(!hasMeat(find("Haferbrei mit Beeren")));
  assert.ok(reheatsWell(find("Kartoffelsuppe mit Brot")), "a soup is as good the next day");
  assert.ok(!reheatsWell(find("Spiegelei auf Brot")), "a fried egg is not");
});

test("the level leans harder the fewer people eat from the same pack", () => {
  const off = sustainabilityWeights("off", 1);
  assert.deepEqual(Object.values(off).filter(value => value !== 0), []);
  const alone = sustainabilityWeights("balanced", 1), family = sustainabilityWeights("balanced", 4);
  assert.ok(alone.leftover > family.leftover, "one person wastes most and is helped most");
  assert.ok(alone.repeatRelief > family.repeatRelief);
  assert.ok(sustainabilityWeights("strict", 2).meatFreeDays > sustainabilityWeights("balanced", 2).meatFreeDays);
  assert.ok(["off", "balanced", "strict"].every(isSustainabilityLevel));
  assert.ok(!isSustainabilityLevel("sometimes") && !isSustainabilityLevel(null));
});

test("a week planned with care throws less away than one planned without", async () => {
  for (const householdSize of [1, 2, 4]) {
    const careless = await plannedWeek(prefs({ householdSize, sustainability: "off" }));
    const careful = await plannedWeek(prefs({ householdSize, sustainability: "balanced" }));
    const thrown = plannedLeftovers(careless.items), kept = plannedLeftovers(careful.items);
    assert.ok(kept.total < thrown.total, `${householdSize} people: ${kept.total} g instead of ${thrown.total} g`);
    // And the half-used fresh food, the part that really ends up in the bin, falls with it.
    assert.ok(kept.fresh <= thrown.fresh, `${householdSize} people: ${kept.fresh} g fresh instead of ${thrown.fresh} g`);
    assert.ok(kept.fresh <= kept.total);
    // And it stays a week of meals, not three dishes on rotation.
    assert.ok(new Set(careful.items.map(item => item.meal.id)).size >= careful.days.length);
    assert.ok(meatFreeDays(careful) >= 1);
    assert.ok(redMeatDishes(careful.items) <= 2, "red meat stays occasional");
  }
});

test("the same pot twice is one pair of days, never a repeated week", async () => {
  const plan = await plannedWeek(prefs({ householdSize: 1, sustainability: "strict" }));
  const pairs = cookTwicePairs(plan);
  for (const pair of pairs) {
    assert.equal(addDays(pair.dates[0], 1), pair.dates[1]);
    const sameDish = date => plan.items.filter(item => item.date === date).map(item => item.meal.id).sort();
    assert.notDeepEqual(sameDish(pair.dates[0]), sameDish(pair.dates[1]), "a whole day is never repeated");
  }
  // Nothing is offered as leftovers that nobody would eat cold the next day.
  for (const pair of pairs) {
    const meal = plan.items.find(item => item.meal.name === pair.name).meal;
    assert.ok(reheatsWell(meal), pair.name);
  }
});

test("open packs carry the day they were last cooked with", async () => {
  const plan = await plannedWeek(prefs({ householdSize: 2 }));
  const open = openPacks(plan);
  for (const [key, left] of open.amount) {
    assert.ok(left > 0, key);
    assert.ok(open.lastUsed.get(key), `${key} knows when it was last used`);
  }
});
