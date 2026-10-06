require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isAnyMealPlan, isMealPlan, isWeekPlan, openPlanSlots } = require("../services/meals/validation.ts");
const { basketFromMealPlan } = require("../services/meals/basket.ts");
const { aggregateIngredients } = require("../services/meals/aggregation.ts");
const { generateMealPlan, ingredientAvailability, planNutrition, suggestMeals } = require("../services/meals/planner.ts");
const { replaceMealChoice } = require("../services/meals/choices.ts");
const { participantPortions } = require("../services/meals/portions.ts");
const { emptyWeekPlan, itemDayLabel, planDays, plannedDayCount, plannedSlotShare } = require("../services/meals/weekPlan.ts");
const { nutritionTargets } = require("../services/basket/nutritionTargets.ts");
const { shoppingImpact } = require("../services/waste-prevention.ts");
const { prefs } = require("./basket-fixtures.cjs");
const { fullCatalog } = require("./meal-fixtures.cjs");

const monday = "2026-10-05";
// Monday, Tuesday, Thursday: Wednesday is deliberately unplanned, and Tuesday skips breakfast.
const chosenDays = [
  { date: "2026-10-05", slots: ["breakfast", "lunch", "dinner"] },
  { date: "2026-10-06", slots: ["lunch", "dinner"] },
  { date: "2026-10-08", slots: ["breakfast", "dinner"] },
];
/** Fills every chosen slot the way the calendar screens will. The fixture catalog cannot match
 *  every curated ingredient (teriyaki has no package), so prefer a suggestion it can cover:
 *  that keeps this test about the calendar rather than about a known catalog gap. */
function filledWeek(preferences, days = chosenDays, { leaveOpen = [], anySuggestion = false } = {}) {
  const targets = nutritionTargets({ ...preferences,
    planningDays: days.reduce((sum, day) => sum + day.slots.length, 0) / 4 });
  const availability = ingredientAvailability(fullCatalog, preferences);
  const buyable = (meal) => meal.ingredients.every((line) => availability.get(line.ingredientKey)?.available);
  let plan = { ...emptyWeekPlan(monday, preferences), days,
    targetCalories: targets.calorieTarget, targetProtein: targets.proteinTarget };
  for (const day of days)
    for (const slot of day.slots) {
      if (leaveOpen.some(([date, open]) => date === day.date && open === slot)) continue;
      let chosen = null, exclude = [];
      for (let round = 0; round < 8 && !chosen; round++) {
        const suggestions = suggestMeals(plan, day.date, slot, preferences, fullCatalog, exclude);
        if (!suggestions.length) break;
        chosen = suggestions.find((s) => anySuggestion || buyable(s.meal)) ?? null;
        exclude = [...exclude, ...suggestions.map((s) => s.meal.id)];
      }
      assert.ok(chosen, `a usable suggestion for ${day.date} ${slot}`);
      plan = { ...plan, items: [...plan.items,
        { id: `${day.date}-${slot}`, date: day.date, mealSlot: slot, meal: chosen.meal, servings: chosen.servings }] };
    }
  return { ...plan, status: "confirmed" };
}

test("isWeekPlan accepts a week with gaps and rejects anything it cannot place", () => {
  const preferences = prefs({ householdSize: 2 });
  const plan = filledWeek(preferences);
  assert.ok(isWeekPlan(plan));
  assert.ok(isAnyMealPlan(plan));
  assert.equal(isMealPlan(plan), false, "a week is not a fixed-period plan");
  const broken = (patch) => ({ ...plan, ...patch });
  // The week starts on a Monday, and every chosen day lies inside it.
  assert.equal(isWeekPlan(broken({ weekStart: "2026-10-06" })), false);
  assert.equal(isWeekPlan(broken({ days: [...chosenDays, { date: "2026-10-13", slots: ["dinner"] }] })), false);
  assert.equal(isWeekPlan(broken({ days: [...chosenDays, { date: "2026-10-05", slots: ["snack"] }] })), false);
  assert.equal(isWeekPlan(broken({ days: [{ date: "2026-10-05", slots: [] }] })), false, "a planned day plans something");
  assert.equal(isWeekPlan(broken({ days: [{ date: "2026-10-05", slots: ["brunch"] }] })), false);
  assert.equal(isWeekPlan(broken({ days: [{ date: "05.10.2026", slots: ["dinner"] }] })), false);
  // Every meal sits on a planned day, in a slot chosen for that day, once.
  const item = plan.items[0];
  assert.equal(isWeekPlan(broken({ items: [...plan.items, { ...item, id: "x", date: "2026-10-07" }] })), false,
    "Wednesday is not planned");
  assert.equal(isWeekPlan(broken({ items: [...plan.items, { ...item, id: "y", date: "2026-10-06", mealSlot: "breakfast" }] })), false,
    "Tuesday has no breakfast");
  assert.equal(isWeekPlan(broken({ items: [...plan.items, { ...item, id: "z" }] })), false, "one meal per date and slot");
  assert.equal(isWeekPlan(broken({ items: plan.items.map((i) => ({ ...i, id: "same" })) })), false, "ids stay unique");
  assert.equal(isWeekPlan(broken({ items: [{ ...item, servings: 0 }, ...plan.items.slice(1)] })), false);
  assert.equal(isWeekPlan(broken({ householdSize: 0 })), false);
  assert.equal(isWeekPlan(broken({ targetCalories: 0 })), false);
  // A week nobody filled in yet is still a valid, empty week.
  assert.ok(isWeekPlan({ ...emptyWeekPlan(monday, preferences), targetCalories: 1, targetProtein: 1 }));
});

test("a basket from a week with gaps and dropped slots is not partial", () => {
  const preferences = prefs({ householdSize: 2, planningDays: 7 });
  const plan = filledWeek(preferences);
  assert.equal(plannedDayCount(plan), 3);
  assert.deepEqual(openPlanSlots(plan), [], "every chosen slot is decided");
  const result = basketFromMealPlan(plan, preferences, fullCatalog);
  assert.equal(result.engineVersion, "2");
  assert.ok(result.items.length > 0);
  // The calendar shape is no reason to call a basket partial: no open slot, no missing day.
  assert.deepEqual(result.warnings.filter((w) => w.code.startsWith("open_slot_")), []);
  assert.deepEqual(result.warnings.filter((w) => w.code.startsWith("missing_")), []);
  assert.equal(result.status, "generated", result.warnings.map((w) => w.code).join(", "));
  // The saved planning period no longer has to match: the week carries its own days.
  assert.equal(preferences.planningDays, 7);
  assert.doesNotThrow(() => basketFromMealPlan(plan, prefs({ householdSize: 2, planningDays: 14 }), fullCatalog));
  assert.throws(() => basketFromMealPlan(plan, prefs({ householdSize: 3 }), fullCatalog), /Preferences changed/);
  // Coverage is measured over the meals they chose, not over a seven-day week: three days with
  // seven chosen slots out of twelve possible ones.
  const share = plannedSlotShare(plan);
  assert.ok(share > 1.9 && share < 2.5, `${share} day equivalents`);
  const expectedCalorieTarget = nutritionTargets({ ...preferences, planningDays: share }).calorieTarget;
  assert.ok(Math.abs(result.calorieTarget - expectedCalorieTarget) < 1e-8,
    `calorie target ${result.calorieTarget}, expected ${expectedCalorieTarget}`);
  assert.ok(result.calorieCoveragePercent >= 90 && result.calorieCoveragePercent <= 110,
    `coverage ${result.calorieCoveragePercent}`);
});

test("an open chosen slot is what makes a week basket partial, and it says which", () => {
  const preferences = prefs({ householdSize: 2 });
  const plan = filledWeek(preferences, chosenDays, { leaveOpen: [["2026-10-06", "dinner"]] });
  assert.deepEqual(openPlanSlots(plan), [{ date: "2026-10-06", slots: ["dinner"] }]);
  const result = basketFromMealPlan(plan, preferences, fullCatalog);
  assert.equal(result.status, "partial");
  const warning = result.warnings.find((w) => w.code === "open_slot_2026-10-06");
  assert.ok(warning);
  assert.match(warning.message, /dinner still open/);
  // A day nobody planned is never reported as a gap.
  for (const w of result.warnings) assert.ok(!w.code.includes("2026-10-07"));
});

test("ingredients, nutrition and portions read a week plan the same way", () => {
  const preferences = prefs({ householdSize: 2 });
  const plan = filledWeek(preferences);
  const requirements = aggregateIngredients(plan);
  assert.ok(requirements.length > 0);
  for (const r of requirements) {
    assert.ok(r.requiredQuantity > 0);
    assert.ok(r.sourceMealIds.every((id) => plan.items.some((i) => i.id === id)));
  }
  const nutrition = planNutrition(plan);
  assert.ok(nutrition.calories > 0 && nutrition.protein > 0);
  // Per-person daily targets divide by the planned days, not by a fixed period.
  const [person] = participantPortions(plan);
  assert.ok(Math.abs(person.calorieTarget - plan.targetCalories / 3 / 2) < 1e-9);
  // Day labels: a fixed-period plan counts days, a week names them.
  const labels = planDays(plan).map((day) => day.label);
  assert.deepEqual(labels, ["Mon 5 Oct", "Tue 6 Oct", "Thu 8 Oct"]);
  assert.equal(itemDayLabel(plan, plan.items[0]), "Mon 5 Oct");
  const legacy = generateMealPlan(prefs({ planningDays: 3, householdSize: 1, dailyCalories: 1700 }));
  assert.deepEqual(planDays(legacy).map((day) => day.label), ["Day 1", "Day 2", "Day 3"]);
  assert.equal(itemDayLabel(legacy, legacy.items[0]), "Day 1");
  assert.equal(planDays(legacy).every((day) => day.items.length), true);
});

test("choosing to heat something up or eat out keeps the day it belongs to", () => {
  const preferences = prefs({ householdSize: 2 });
  const plan = filledWeek(preferences);
  const target = plan.items.find((i) => i.mealSlot === "dinner" && i.date === "2026-10-06");
  const out = replaceMealChoice(plan, target.id, "eat_out");
  const replaced = out.items.find((i) => i.id === target.id);
  assert.equal(replaced.date, "2026-10-06", "the calendar date survives the mode change");
  assert.equal(replaced.mealMode, "eat_out");
  assert.equal(replaced.meal.nutritionSource, "unrecorded");
  assert.equal(out.status, "review");
  assert.ok(isWeekPlan({ ...out, status: "confirmed" }), "the plan stays valid after the change");
  const heated = replaceMealChoice(plan, target.id, "heat_and_eat", "lasagne");
  const heatedItem = heated.items.find((i) => i.id === target.id);
  assert.equal(heatedItem.readyMealCategory, "lasagne");
  assert.equal(heatedItem.date, "2026-10-06");
  assert.ok(isWeekPlan({ ...heated, status: "confirmed" }));
  // An eating-out meal has no shopping items, and the basket says so.
  const result = basketFromMealPlan({ ...out, status: "confirmed" }, preferences, fullCatalog);
  assert.ok(result.warnings.some((w) => w.code === "eat_out_unknown"));
});

test("shopping impact counts the days a week plan actually covers", () => {
  const preferences = prefs({ householdSize: 2 });
  const plan = {
    ...filledWeek(preferences),
    participants: [
      { id: "a", name: "A", dailyCalories: 1700, proteinTarget: 90 },
      { id: "b", name: "B", dailyCalories: 1700, proteinTarget: 90 },
    ],
  };
  const purchase = { basketId: "week", basket: { result: { purchasedAt: "2026-10-09", mealPlan: plan, pantryUsed: [] } } };
  const impact = shoppingImpact([purchase], new Date("2026-10-09T12:00:00Z"));
  // Before the calendar, the day loop ran over a fixed period a week plan does not have.
  assert.ok(Number.isFinite(impact.proteinTargetsMet), `${impact.proteinTargetsMet}`);
  assert.ok(Number.isFinite(impact.calorieTargetsMet));
  assert.ok(impact.proteinTargetsMet > 0);
  // Targets nobody could reach are reported as unmet rather than silently passing.
  const unreachable = structuredClone(purchase);
  unreachable.basket.result.mealPlan.participants.forEach((person) => { person.dailyCalories = 10000; });
  assert.equal(shoppingImpact([unreachable], new Date("2026-10-09T12:00:00Z")).calorieTargetsMet, 0);
});
