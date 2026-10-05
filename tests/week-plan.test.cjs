require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  DAYS_PER_WEEK,
  addDays,
  dayOf,
  defaultDaySlots,
  emptyWeekPlan,
  inWeek,
  isPlanDate,
  isWeekPlanShape,
  isWeekStart,
  itemDate,
  itemDayIndex,
  itemsOn,
  openSlots,
  parsePlanDate,
  planDate,
  plannedDates,
  plannedDayCount,
  sortSlots,
  weekDates,
  weekStartOf,
} = require("../services/meals/weekPlan.ts");
const { defaultSlotDefaults } = require("../types/preferences.ts");
const { prefs } = require("./basket-fixtures.cjs");
const { generateMealPlan } = require("../services/meals/planner.ts");

const monday = "2026-10-05";

test("plan dates are calendar days: parsed in UTC, validated, and never shifted by a time zone", () => {
  assert.equal(planDate(parsePlanDate(monday)), monday);
  assert.equal(parsePlanDate(monday).getUTCDay(), 1, "the reference day is a Monday");
  for (const bad of ["", "2026-10-5", "05.10.2026", "2026-13-01", "2026-02-30", "2026-10-05T00:00", null, 20261005])
    assert.equal(isPlanDate(bad), false, `${bad} is not a plan date`);
  assert.ok(isPlanDate("2028-02-29"), "a real leap day is a plan date");
  // Day arithmetic crosses months, years and the European daylight-saving switch unchanged.
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-10-24", 7), "2026-10-31");
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
  assert.throws(() => addDays("nope", 1));
});

test("a week runs Monday to Sunday and knows which dates belong to it", () => {
  assert.ok(isWeekStart(monday));
  assert.equal(isWeekStart("2026-10-06"), false, "a Tuesday does not start a week");
  for (const date of weekDates(monday)) assert.equal(weekStartOf(date), monday);
  assert.deepEqual(weekDates(monday), ["2026-10-05", "2026-10-06", "2026-10-07",
    "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.equal(weekDates(monday).length, DAYS_PER_WEEK);
  assert.equal(weekStartOf("2026-10-11"), monday, "Sunday still belongs to the week that began");
  assert.ok(inWeek(monday, "2026-10-11"));
  assert.equal(inWeek(monday, "2026-10-12"), false);
  assert.equal(inWeek(monday, "2026-10-04"), false);
});

test("an empty week carries the household over and starts without days", () => {
  const preferences = prefs({ householdSize: 2 });
  const plan = emptyWeekPlan(monday, preferences);
  assert.equal(plan.version, "2");
  assert.equal(plan.weekStart, monday);
  assert.deepEqual(plan.days, []);
  assert.deepEqual(plan.items, []);
  assert.equal(plan.status, "review");
  assert.equal(plan.householdSize, 2);
  assert.equal(plan.participants, undefined);
  assert.equal(plannedDayCount(plan), 0);
  assert.throws(() => emptyWeekPlan("2026-10-06", preferences), /Monday/);
  // Participants are snapshotted, not shared with the preferences object.
  const people = [{ id: "current-user", name: "You", age: null, sex: null, dailyCalories: 2000,
    proteinTarget: 100, dietaryPreferences: ["none"], allergens: [], intolerances: [], isCurrentUser: true }];
  const shared = emptyWeekPlan(monday, prefs({ householdSize: 1, participants: people }));
  assert.deepEqual(shared.participants, people);
  shared.participants[0].name = "Changed";
  assert.equal(people[0].name, "You");
});

test("days hold the chosen slots, and gaps between days are normal", () => {
  const plan = {
    ...emptyWeekPlan(monday, prefs()),
    // Monday, Tuesday, Thursday: the week deliberately has a hole.
    days: [
      { date: "2026-10-05", slots: ["breakfast", "lunch", "dinner"] },
      { date: "2026-10-06", slots: ["dinner"] },
      { date: "2026-10-08", slots: ["lunch", "dinner"] },
    ],
    items: [
      { id: "i1", date: "2026-10-05", mealSlot: "lunch", meal: { id: "m1" }, servings: 2 },
      { id: "i2", date: "2026-10-08", mealSlot: "dinner", meal: { id: "m2" }, servings: 2 },
    ],
  };
  assert.deepEqual(plannedDates(plan), ["2026-10-05", "2026-10-06", "2026-10-08"]);
  assert.equal(plannedDayCount(plan), 3);
  assert.deepEqual(dayOf(plan, "2026-10-06").slots, ["dinner"]);
  assert.equal(dayOf(plan, "2026-10-07"), null, "an unplanned day is absent, not empty");
  assert.deepEqual(itemsOn(plan, "2026-10-05").map(i => i.id), ["i1"]);
  assert.deepEqual(itemsOn(plan, "2026-10-07"), []);
  // Open slots are the chosen ones still undecided, in slot order.
  assert.deepEqual(openSlots(plan, "2026-10-05"), ["breakfast", "dinner"]);
  assert.deepEqual(openSlots(plan, "2026-10-08"), ["lunch"]);
  assert.deepEqual(openSlots(plan, "2026-10-07"), [], "a day nobody planned has no open slots");
  assert.deepEqual(sortSlots(["snack", "dinner", "breakfast"]), ["breakfast", "dinner", "snack"]);
  // The meal standard decides what a newly chosen day starts with; the snack stays off.
  assert.deepEqual(defaultDaySlots(prefs()), ["breakfast", "lunch", "dinner"]);
  assert.deepEqual(defaultDaySlots(prefs({ slotDefaults: { ...defaultSlotDefaults, snack: true } })),
    ["breakfast", "lunch", "dinner", "snack"]);
});

test("both plan shapes stay readable side by side", () => {
  const week = {
    ...emptyWeekPlan(monday, prefs()),
    days: [{ date: "2026-10-06", slots: ["dinner"] }, { date: "2026-10-09", slots: ["lunch"] }],
    items: [
      { id: "i1", date: "2026-10-09", mealSlot: "lunch", meal: { id: "m1" }, servings: 1 },
      { id: "i2", date: "2026-10-06", mealSlot: "dinner", meal: { id: "m2" }, servings: 1 },
    ],
  };
  assert.ok(isWeekPlanShape(week));
  assert.equal(itemDate(week, week.items[0]), "2026-10-09");
  assert.equal(itemDayIndex(week, week.items[0]), 1, "the later date is the second planned day");
  assert.equal(itemDayIndex(week, week.items[1]), 0);
  // A version 1 plan generated by the existing planner keeps working through the same readers.
  const legacy = generateMealPlan(prefs({ planningDays: 3, householdSize: 1, dailyCalories: 1700 }));
  assert.equal(legacy.version, "1");
  assert.equal(isWeekPlanShape(legacy), false);
  assert.equal(plannedDayCount(legacy), 3);
  assert.equal(itemDate(legacy, legacy.items[0]), null, "version 1 has day numbers, not dates");
  assert.equal(itemDayIndex(legacy, legacy.items[0]), legacy.items[0].dayIndex);
});
