require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setPresence, chooseMeal, startWeek, toggleDay } = require("../services/meals/weekPlanDraft.ts");
const { isMealPlan, isWeekPlan } = require("../services/meals/validation.ts");
const { aggregateIngredients } = require("../services/meals/aggregation.ts");
const { mealNutrition, planNutrition, suggestMeals, generateMealPlan } = require("../services/meals/planner.ts");
const { portionsFor, splitNutrition } = require("../services/meals/portions.ts");
const { basketFromMealPlan } = require("../services/meals/basket.ts");
const { dayOf, itemsOn } = require("../services/meals/weekPlan.ts");
const { prefs } = require("./basket-fixtures.cjs");
const { fullCatalog } = require("./meal-fixtures.cjs");

const monday = "2026-10-05";
const person = (id, name, dailyCalories, patch = {}) => ({
  id, name, age: null, sex: null, dailyCalories, proteinTarget: Math.round(dailyCalories * 0.2 / 4),
  dietaryPreferences: ["none"], allergens: [], intolerances: [], isCurrentUser: id === "current-user",
  kind: "adult", activityLevel: null, ...patch,
});
const household = [person("current-user", "You", 2200), person("partner", "Partner", 2000),
  person("kid", "Kid", 1400, { kind: "child" })];
const preferences = prefs({ householdSize: 3, dailyCalories: 1870, participants: household });
const plannedDay = () => {
  let plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  const [suggestion] = suggestMeals(plan, monday, "dinner", preferences, fullCatalog);
  return chooseMeal(plan, monday, "dinner", suggestion, preferences);
};
const dinner = (plan) => itemsOn(plan, monday).find((item) => item.mealSlot === "dinner");

test("everybody eats along by default, and that is stored as no list at all", () => {
  const plan = plannedDay();
  assert.equal(dinner(plan).participantIds, undefined);
  assert.ok(isWeekPlan({ ...plan, status: "confirmed" }));
  // Marking everybody present again keeps it that way rather than writing the full list.
  const all = setPresence(plan, monday, "dinner", household.map((p) => p.id), preferences);
  assert.equal(dinner(all).participantIds, undefined);
  assert.equal(dinner(all).servings, dinner(plan).servings);
});

test("the quantity follows the heads at the table", () => {
  const plan = plannedDay();
  const full = dinner(plan).servings;
  const withoutKid = setPresence(plan, monday, "dinner", ["current-user", "partner"], preferences);
  assert.deepEqual(dinner(withoutKid).participantIds, ["current-user", "partner"]);
  assert.ok(Math.abs(dinner(withoutKid).servings - full * 2 / 3) < 1e-9, `${dinner(withoutKid).servings} of ${full}`);
  // Less food on the list, and less nutrition counted for that meal.
  assert.ok(mealNutrition(dinner(withoutKid)).calories < mealNutrition(dinner(plan)).calories);
  const before = aggregateIngredients(plan), after = aggregateIngredients(withoutKid);
  assert.equal(before.length, after.length);
  for (const requirement of before) {
    const shrunk = after.find((r) => r.ingredientKey === requirement.ingredientKey);
    assert.ok(shrunk.requiredQuantity < requirement.requiredQuantity,
      `${requirement.ingredientKey}: ${shrunk.requiredQuantity} should be below ${requirement.requiredQuantity}`);
  }
  // Adding the person back restores the original quantity exactly.
  const again = setPresence(withoutKid, monday, "dinner", household.map((p) => p.id), preferences);
  assert.ok(Math.abs(dinner(again).servings - full) < 1e-9);
  assert.equal(dinner(again).participantIds, undefined);
  // One person alone gets one person's worth.
  const alone = setPresence(plan, monday, "dinner", ["kid"], preferences);
  assert.ok(Math.abs(dinner(alone).servings - full / 3) < 1e-9);
});

test("nobody at the table means the meal is not planned at all", () => {
  const plan = plannedDay();
  const empty = setPresence(plan, monday, "dinner", [], preferences);
  assert.deepEqual(itemsOn(empty, monday), [], "the decision is dropped with the slot");
  assert.ok(!dayOf(empty, monday).slots.includes("dinner"), "a meal nobody eats at home is skipped");
  assert.ok(isWeekPlan({ ...empty, status: "confirmed" }) || !empty.days.length);
  // A person who is not in this plan cannot be seated at it.
  assert.throws(() => setPresence(plan, monday, "dinner", ["stranger"], preferences), /not in this plan/);
  // And an undecided slot has no presence to set.
  assert.throws(() => setPresence(plan, monday, "lunch", ["kid"], preferences), /Choose a meal/);
});

test("only the people eating a meal share its nutrition", () => {
  const plan = setPresence(plannedDay(), monday, "dinner", ["current-user", "kid"], preferences);
  const item = dinner(plan);
  const shares = splitNutrition(plan, mealNutrition(item), 1, item.participantIds);
  assert.deepEqual(shares.map((s) => s.id), ["current-user", "kid"]);
  const total = shares.reduce((sum, s) => sum + s.calories, 0);
  assert.ok(Math.abs(total - mealNutrition(item).calories) < 1e-6, "the meal is fully accounted for");
  // The bigger eater still gets the bigger share, now measured among those present.
  assert.ok(shares[0].calories > shares[1].calories);
  assert.ok(Math.abs(portionsFor(plan, item.participantIds).reduce((sum, p) => sum + p.share, 0) - 1) < 1e-9);
  // Without a list the whole household shares it, exactly as before.
  assert.equal(splitNutrition(plan, { calories: 100, protein: 10 }).length, 3);
  assert.deepEqual(portionsFor(plan, []), portionsFor(plan), "an empty list is no list");
});

test("a basket from a week with absences stays valid and buys less", () => {
  let plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  for (const slot of ["breakfast", "lunch", "dinner"]) {
    const [suggestion] = suggestMeals(plan, monday, slot, preferences, fullCatalog);
    plan = chooseMeal(plan, monday, slot, suggestion, preferences);
  }
  const everyone = { ...plan, status: "confirmed" };
  const kidAway = { ...setPresence(plan, monday, "lunch", ["current-user", "partner"], preferences), status: "confirmed" };
  assert.ok(isWeekPlan(kidAway));
  const full = basketFromMealPlan(everyone, preferences, fullCatalog);
  const reduced = basketFromMealPlan(kidAway, preferences, fullCatalog);
  assert.ok(planNutrition(kidAway).calories < planNutrition(everyone).calories);
  assert.ok(reduced.totalCalories < full.totalCalories, `${reduced.totalCalories} vs ${full.totalCalories}`);
  // Participant lists do not make a basket partial on their own.
  assert.deepEqual(reduced.warnings.filter((w) => w.code.startsWith("open_slot_")), []);
});

test("plans saved before per-meal presence keep meaning the whole household", () => {
  const legacy = generateMealPlan(prefs({ planningDays: 3, householdSize: 2, dailyCalories: 1700 }));
  assert.ok(isMealPlan(legacy));
  assert.ok(legacy.items.every((item) => item.participantIds === undefined));
  assert.equal(splitNutrition(legacy, { calories: 100, protein: 10 }).length, 2);
  // A list that names someone the plan does not know is refused, in both plan shapes.
  const withStranger = { ...legacy, participants: undefined,
    items: legacy.items.map((item, index) => index ? item : { ...item, participantIds: ["ghost"] }) };
  assert.ok(isMealPlan(withStranger), "without participants any id is just a label");
  const planned = plannedDay();
  const broken = { ...planned, status: "confirmed",
    items: planned.items.map((item) => ({ ...item, participantIds: ["ghost"] })) };
  assert.equal(isWeekPlan(broken), false);
  assert.equal(isWeekPlan({ ...planned, status: "confirmed",
    items: planned.items.map((item) => ({ ...item, participantIds: [] })) }), false, "an empty list is not a meal");
  assert.equal(isWeekPlan({ ...planned, status: "confirmed",
    items: planned.items.map((item) => ({ ...item, participantIds: ["kid", "kid"] })) }), false);
});
