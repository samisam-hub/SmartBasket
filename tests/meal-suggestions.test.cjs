require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  SUGGESTIONS_PER_SLOT,
  compatibleMeal,
  mealNutrition,
  suggestMeals,
} = require("../services/meals/planner.ts");
const { emptyWeekPlan } = require("../services/meals/weekPlan.ts");
const { meals } = require("../data/meals.ts");
const { prefs } = require("./basket-fixtures.cjs");
const { fullCatalog } = require("./meal-fixtures.cjs");

const monday = "2026-10-05";
const week = (preferences, days) => ({ ...emptyWeekPlan(monday, preferences), days });
const fullDay = (date = monday) => [{ date, slots: ["breakfast", "lunch", "dinner"] }];
const item = (date, slot, mealId, servings = 2) => ({
  id: `${date}-${slot}`, date, mealSlot: slot, meal: meals.find((m) => m.id === mealId), servings,
});

test("a slot gets exactly two different meals that fit the slot and the household", () => {
  const preferences = prefs({ householdSize: 2 });
  const plan = week(preferences, fullDay());
  for (const slot of ["breakfast", "lunch", "dinner"]) {
    const suggestions = suggestMeals(plan, monday, slot, preferences, fullCatalog);
    assert.equal(suggestions.length, SUGGESTIONS_PER_SLOT, `${slot} offers two choices`);
    assert.equal(new Set(suggestions.map((s) => s.meal.id)).size, 2, "two different meals");
    for (const { meal, servings } of suggestions) {
      assert.ok(compatibleMeal(meal, preferences));
      assert.ok(servings > 0 && servings <= preferences.householdSize * 1.5);
      // Breakfast and snack are their own slots; lunch and dinner meals are interchangeable.
      if (slot === "breakfast") assert.equal(meal.mealType, "breakfast");
      else assert.ok(["lunch", "dinner"].includes(meal.mealType));
    }
  }
  // Best first: asking again without the first choice returns a different pair.
  const first = suggestMeals(plan, monday, "dinner", preferences, fullCatalog);
  const second = suggestMeals(plan, monday, "dinner", preferences, fullCatalog,
    first.map((s) => s.meal.id));
  assert.equal(second.length, 2);
  for (const { meal } of second) assert.ok(!first.some((s) => s.meal.id === meal.id));
  // Two rounds of "show me two others" never bring an excluded meal back.
  const third = suggestMeals(plan, monday, "dinner", preferences, fullCatalog,
    [...first, ...second].map((s) => s.meal.id));
  for (const { meal } of third) assert.ok(![...first, ...second].some((s) => s.meal.id === meal.id));
});

test("suggestions never break a diet or an allergy, whatever the combination", () => {
  for (const patch of [
    { dietaryPreferences: ["vegan"] },
    { dietaryPreferences: ["vegetarian", "gluten_free"] },
    { dietaryPreferences: ["diabetes"] },
    { dietaryPreferences: ["vegan", "gluten_free", "diabetes"] },
    { allergens: ["milk", "wheat"] },
    { dietaryPreferences: ["pescatarian"], allergens: ["eggs"] },
  ]) {
    const preferences = prefs({ householdSize: 1, ...patch });
    const plan = week(preferences, [{ date: monday, slots: ["breakfast", "lunch", "dinner", "snack"] }]);
    for (const slot of ["breakfast", "lunch", "dinner", "snack"])
      for (const { meal } of suggestMeals(plan, monday, slot, preferences, fullCatalog)) {
        assert.ok(compatibleMeal(meal, preferences),
          `${meal.id} must fit ${JSON.stringify(patch)}`);
        for (const allergen of preferences.allergens)
          assert.ok(!meal.allergens.includes(allergen), `${meal.id} must not contain ${allergen}`);
        for (const diet of preferences.dietaryPreferences)
          if (diet !== "none") assert.ok(meal.dietaryTags.includes(diet));
      }
  }
});

test("a decided slot has nothing left to choose, and an unplanned one is never suggested for", () => {
  const preferences = prefs({ householdSize: 2 });
  const plan = {
    ...week(preferences, [{ date: monday, slots: ["breakfast", "dinner"] }]),
    items: [item(monday, "dinner", "chicken-rice")],
  };
  // First come, first plan: the cards of a decided meal are gone.
  assert.deepEqual(suggestMeals(plan, monday, "dinner", preferences, fullCatalog), []);
  // Lunch is not part of this day, and Tuesday is not planned at all.
  assert.deepEqual(suggestMeals(plan, monday, "lunch", preferences, fullCatalog), []);
  assert.deepEqual(suggestMeals(plan, "2026-10-06", "dinner", preferences, fullCatalog), []);
  assert.equal(suggestMeals(plan, monday, "breakfast", preferences, fullCatalog).length, 2);
  // What is already on the plate that day is not offered again for another slot.
  const lunchAndDinner = {
    ...week(preferences, [{ date: monday, slots: ["lunch", "dinner"] }]),
    items: [item(monday, "lunch", "chicken-rice")],
  };
  for (const { meal } of suggestMeals(lunchAndDinner, monday, "dinner", preferences, fullCatalog))
    assert.notEqual(meal.id, "chicken-rice");
});

test("dinner only takes the rest of the day once the other chosen slots are decided", () => {
  const preferences = prefs({ householdSize: 2, dailyCalories: 2000 });
  const open = week(preferences, fullDay());
  const eaten = [item(monday, "breakfast", "scrambled-eggs"), item(monday, "lunch", "chicken-potato")];
  const decided = { ...open, items: eaten };
  const [openDinner] = suggestMeals(open, monday, "dinner", preferences, fullCatalog);
  const [restOfDay] = suggestMeals(decided, monday, "dinner", preferences, fullCatalog);
  assert.ok(openDinner && restOfDay);
  // With the day's other meals decided, the portion aims at what is left of the day
  // instead of a fixed share, within half and one and a half base servings.
  const priorPerPerson = eaten.reduce((sum, i) => sum + mealNutrition(i).calories / preferences.householdSize, 0);
  const remaining = preferences.dailyCalories - priorPerPerson;
  const expected = Math.max(0.5, Math.min(1.5, remaining / restOfDay.meal.caloriesPerServing))
    * preferences.householdSize;
  assert.ok(Math.abs(restOfDay.servings - expected) < 1e-9,
    `${restOfDay.servings} should follow the remaining ${Math.round(remaining)} kcal (${expected})`);
  // A day that is nearly eaten up leaves a smaller dinner than an undecided one.
  const small = prefs({ householdSize: 2, dailyCalories: 1200 });
  const [tight] = suggestMeals({ ...week(small, fullDay()), items: eaten }, monday, "dinner", small, fullCatalog);
  const [openTight] = suggestMeals(week(small, fullDay()), monday, "dinner", small, fullCatalog);
  assert.ok(tight.servings < openTight.servings, `${tight.servings} vs ${openTight.servings}`);
  assert.equal(tight.servings, small.householdSize * 0.5, "never below half a base serving");
  for (const suggestion of [openDinner, restOfDay, tight, openTight]) {
    assert.ok(suggestion.servings >= preferences.householdSize * 0.5);
    assert.ok(suggestion.servings <= preferences.householdSize * 1.5);
  }
});

test("a catalog that runs out is reported honestly instead of repeating a meal", () => {
  const preferences = prefs({ householdSize: 1 });
  const plan = week(preferences, [{ date: monday, slots: ["snack"] }]);
  const snacks = meals.filter((m) => m.mealType === "snack" && compatibleMeal(m, preferences));
  assert.ok(snacks.length >= 2, "the fixture catalog has at least two compatible snacks");
  // Exclude all but one: exactly that one comes back, never a filler repeat.
  const last = snacks[snacks.length - 1];
  const nearlyEmpty = suggestMeals(plan, monday, "snack", preferences, fullCatalog,
    snacks.filter((m) => m.id !== last.id).map((m) => m.id));
  assert.equal(nearlyEmpty.length, 1);
  assert.equal(nearlyEmpty[0].meal.id, last.id);
  // Nothing left at all: an empty answer, so the screen can offer skipping or eating out.
  assert.deepEqual(
    suggestMeals(plan, monday, "snack", preferences, fullCatalog, snacks.map((m) => m.id)),
    [],
  );
});

test("suggestions need valid, completed preferences", () => {
  const preferences = prefs();
  const plan = week(preferences, fullDay());
  assert.throws(() => suggestMeals(plan, monday, "dinner", { ...preferences, onboardingCompleted: false }),
    /preferences/);
  assert.throws(() => suggestMeals(plan, monday, "dinner", { ...preferences, dailyCalories: 10 }),
    /preferences/);
  // The catalog is optional: without it the suggestions still come, availability just scores 0.
  assert.equal(suggestMeals(plan, monday, "dinner", preferences).length, 2);
});
