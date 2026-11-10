require("./register.cjs");
const { test } = require("node:test"), assert = require("node:assert/strict");
const { meals } = require("../data/meals.ts");
const { festiveMealIds, isFestiveMeal, mealFamilies, mealFamily } = require("../data/meal-families.ts");
const { tastePasses, festiveTasteCount } = require("../services/meals/taste.ts");
const { fitsSlot } = require("../services/meals/planner.ts");

const preferences = { onboardingCompleted: true, userId: "u", householdSize: 2, planningDays: 7,
  dailyCalories: 2000, proteinMode: "balanced", primaryNutritionGoal: "maintain",
  dietaryPreferences: ["none"], allergens: [], intolerances: [], budgetEnabled: false,
  weeklyBudgetEur: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" };

test("every dish is named after one kind, and the kinds are real groups", () => {
  for (const meal of meals) assert.ok(mealFamilies.includes(mealFamily(meal)), meal.name);
  // A family of one is a label, not a group: the breakfast run would show the same dish forever.
  const counted = new Map();
  for (const meal of meals) counted.set(mealFamily(meal), (counted.get(mealFamily(meal)) ?? 0) + 1);
  for (const [family, count] of counted) assert.ok(count >= 2, `${family} has only ${count}`);
  assert.equal(mealFamily(meals.find(m => /^Spiegelei auf Brot$/.test(m.name))), "eggs");
  assert.equal(mealFamily(meals.find(m => /^Haferbrei mit Beeren$/.test(m.name))), "porridge");
  assert.equal(mealFamily(meals.find(m => /^Käsebrot mit Gurke$/.test(m.name))), "bread");
  assert.equal(mealFamily(meals.find(m => /Lasagne/.test(m.name))), "bake");
});

test("a taste run shows a range of breakfasts, not five slices of bread", () => {
  const [pass] = tastePasses(preferences, ["breakfast"]);
  assert.equal(pass.key, "breakfast");
  assert.equal(pass.meals.length, 5);
  const families = pass.meals.map(mealFamily);
  assert.equal(new Set(families).size, 5, `all five are different kinds: ${families.join(", ")}`);
  // And nothing festive slips into an ordinary morning.
  assert.ok(!pass.meals.some(isFestiveMeal));
});

test("every meal of the day gets its own pass, and nothing is asked about twice", () => {
  const passes = tastePasses(preferences, ["breakfast", "lunch", "dinner"]);
  assert.deepEqual(passes.map(pass => pass.key), ["breakfast", "lunch", "dinner"]);
  const shown = passes.flatMap(pass => pass.meals.map(meal => meal.id));
  assert.equal(new Set(shown).size, shown.length);
});

test("festive dishes come only when asked for", () => {
  const without = tastePasses(preferences, ["breakfast", "dinner"]);
  assert.ok(!without.some(pass => pass.key === "festive"));
  assert.ok(!without.flatMap(pass => pass.meals).some(isFestiveMeal));
  const withFestive = tastePasses(preferences, ["breakfast", "dinner"], {}, undefined, true);
  const pass = withFestive.find(p => p.key === "festive");
  assert.ok(pass, "the festive pass is there once it is asked for");
  assert.ok(pass.meals.every(isFestiveMeal));
  assert.equal(festiveTasteCount(preferences), festiveMealIds.length);
  // Rated dishes are not asked about again, the festive ones no more than the rest.
  const rated = Object.fromEntries(festiveMealIds.map(id => [id, false]));
  assert.equal(festiveTasteCount(preferences, rated), 0);
  assert.ok(!tastePasses(preferences, ["dinner"], rated, undefined, true).some(p => p.key === "festive"));
});

test("a festive dish is still a dish somebody could cook", () => {
  for (const id of festiveMealIds) {
    const meal = meals.find(m => m.id === id);
    assert.ok(meal, id);
    assert.ok(fitsSlot(meal, "dinner") || fitsSlot(meal, "lunch"), `${id} fits a main meal`);
  }
});

const { startWeek, toggleDay } = require("../services/meals/weekPlanDraft.ts");
const { suggestMeals } = require("../services/meals/planner.ts");
const { isWeekend } = require("../services/meals/weekPlan.ts");
const { prefs } = require("./basket-fixtures.cjs");

test("a roast is only ever suggested for a Saturday or a Sunday", () => {
  const p = prefs({ householdSize: 2 });
  // 2026-11-09 is a Monday, 2026-11-14 the Saturday of the same week.
  assert.equal(isWeekend("2026-11-09"), false);
  assert.equal(isWeekend("2026-11-14"), true);
  assert.equal(isWeekend("2026-11-15"), true, "Sunday counts too");
  const liked = Object.fromEntries(festiveMealIds.map(id => [id, true]));
  const everythingElse = meals.filter(meal => !isFestiveMeal(meal)).map(meal => meal.id);
  const onDay = date => {
    let week = startWeek("2026-11-09", p);
    week = toggleDay(week, date, p);
    return suggestMeals(week, date, "dinner", p, [], everythingElse, undefined, liked);
  };
  // With every other dish excluded, a weekday has nothing left to suggest rather than a roast.
  assert.deepEqual(onDay("2026-11-09"), [], "no festive dish on a Monday, however much it is liked");
  const weekend = onDay("2026-11-14");
  assert.ok(weekend.length, "the same dish is offered on the Saturday");
  assert.ok(weekend.every(suggestion => isFestiveMeal(suggestion.meal)));
});
