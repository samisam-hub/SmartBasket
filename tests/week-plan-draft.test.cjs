require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  chooseMeal, clearChoice, confirmWeek, moveWeek, skipSlot, startWeek, toggleDay, toggleSlot,
} = require("../services/meals/weekPlanDraft.ts");
const { WeekPlanStore } = require("../services/week-plan-store.ts");
const { isWeekPlan, openPlanSlots } = require("../services/meals/validation.ts");
const { dayOf, plannedDates, plannedSlotShare } = require("../services/meals/weekPlan.ts");
const { suggestMeals } = require("../services/meals/planner.ts");
const { defaultSlotDefaults } = require("../types/preferences.ts");
const { prefs } = require("./basket-fixtures.cjs");
const { fullCatalog } = require("./meal-fixtures.cjs");

const monday = "2026-10-05";
const preferences = prefs({ householdSize: 2 });
const suggest = (plan, date, slot, p = preferences) => {
  const [first] = suggestMeals(plan, date, slot, p, fullCatalog);
  assert.ok(first, `a suggestion for ${date} ${slot}`);
  return first;
};
class MemoryStorage {
  data = new Map();
  fail = false;
  async getItem(key) { return this.data.get(key) ?? null; }
  async setItem(key, value) {
    if (this.fail) throw new Error("disk full");
    this.data.set(key, value);
  }
}

test("a week starts empty and picking a day prefills it from the meal standard", () => {
  const plan = startWeek(monday, preferences);
  assert.deepEqual(plan.days, []);
  assert.equal(plan.status, "review");
  assert.ok(plan.targetCalories > 0, "an empty week still has a positive target floor");
  const withMonday = toggleDay(plan, monday, preferences);
  assert.deepEqual(dayOf(withMonday, monday).slots, ["breakfast", "lunch", "dinner"]);
  // The snack is off by default and on when the household planned it.
  const withSnack = toggleDay(plan, monday, prefs({ slotDefaults: { ...defaultSlotDefaults, snack: true } }));
  assert.deepEqual(dayOf(withSnack, monday).slots, ["breakfast", "lunch", "dinner", "snack"]);
  // Days stay in calendar order however they were picked, and only days of this week are allowed.
  let plan3 = toggleDay(toggleDay(toggleDay(plan, "2026-10-08", preferences), monday, preferences), "2026-10-06", preferences);
  assert.deepEqual(plannedDates(plan3), ["2026-10-05", "2026-10-06", "2026-10-08"]);
  assert.deepEqual(plan3.days.map((day) => day.date), ["2026-10-05", "2026-10-06", "2026-10-08"]);
  assert.throws(() => toggleDay(plan, "2026-10-12", preferences), /not in this week/);
  // Targets grow with what is planned.
  assert.ok(plan3.targetCalories > withMonday.targetCalories);
  assert.ok(Math.abs(plannedSlotShare(plan3) - 3 * 0.89) < 1e-9);
});

test("unpicking a day drops what was planned on it, and a dropped slot drops its meal", () => {
  let plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  plan = chooseMeal(plan, monday, "lunch", suggest(plan, monday, "lunch"), preferences);
  plan = chooseMeal(plan, monday, "dinner", suggest(plan, monday, "dinner"), preferences);
  assert.equal(plan.items.length, 2);
  const withoutLunch = toggleSlot(plan, monday, "lunch", preferences);
  assert.deepEqual(dayOf(withoutLunch, monday).slots, ["breakfast", "dinner"]);
  assert.deepEqual(withoutLunch.items.map((i) => i.mealSlot), ["dinner"]);
  // A dropped slot is not an open slot: it is an answer, not a gap.
  assert.deepEqual(openPlanSlots(withoutLunch), [{ date: monday, slots: ["breakfast"] }]);
  const empty = toggleDay(plan, monday, preferences);
  assert.deepEqual(empty.days, []);
  assert.deepEqual(empty.items, []);
  // Adding a slot back leaves it open, never silently re-planned.
  const again = toggleSlot(withoutLunch, monday, "lunch", preferences);
  assert.deepEqual(dayOf(again, monday).slots, ["breakfast", "lunch", "dinner"]);
  assert.ok(openPlanSlots(again)[0].slots.includes("lunch"));
  // The last meal of a day cannot be dropped on its own; the day itself is unpicked instead.
  const onlyDinner = toggleSlot(toggleSlot(plan, monday, "breakfast", preferences), monday, "lunch", preferences);
  assert.throws(() => toggleSlot(onlyDinner, monday, "dinner", preferences), /at least one meal/);
  assert.deepEqual(skipSlot(onlyDinner, monday, "dinner", preferences).days, [], "skipping the last meal unpicks the day");
});

test("the first yes wins, clearing reopens the slot and skipping answers it", () => {
  let plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  const first = suggest(plan, monday, "dinner");
  plan = chooseMeal(plan, monday, "dinner", first, preferences);
  assert.equal(plan.items[0].id, `${monday}-dinner`);
  assert.equal(plan.items[0].meal.id, first.meal.id);
  // A second yes for the same meal changes nothing: the slot is taken.
  const other = { meal: { ...first.meal, id: "other-meal" }, servings: 2 };
  assert.equal(chooseMeal(plan, monday, "dinner", other, preferences).items[0].meal.id, first.meal.id);
  // Only a planned day and a chosen slot can be decided at all.
  assert.throws(() => chooseMeal(plan, "2026-10-07", "dinner", first, preferences), /not planned/);
  assert.throws(() => chooseMeal(plan, monday, "snack", first, preferences), /not planned/);
  const cleared = clearChoice(plan, monday, "dinner", preferences);
  assert.deepEqual(cleared.items, []);
  assert.ok(openPlanSlots(cleared)[0].slots.includes("dinner"), "clearing reopens the slot");
  const skipped = skipSlot(plan, monday, "dinner", preferences);
  assert.deepEqual(dayOf(skipped, monday).slots, ["breakfast", "lunch"]);
  assert.deepEqual(skipped.items, []);
  assert.equal(skipSlot(skipped, monday, "dinner", preferences), skipped, "skipping twice changes nothing");
});

test("a confirmed week is valid, and an empty one is refused with a reason", () => {
  let plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  assert.throws(() => confirmWeek(plan, preferences), /at least one meal/);
  for (const slot of ["breakfast", "lunch", "dinner"])
    plan = chooseMeal(plan, monday, slot, suggest(plan, monday, slot), preferences);
  const confirmed = confirmWeek(plan, preferences);
  assert.equal(confirmed.status, "confirmed");
  assert.ok(isWeekPlan(confirmed));
  assert.equal(plan.status, "review", "confirming hands over a copy and leaves the draft open");
  // Another week starts empty rather than carrying meals over to different dates.
  const next = moveWeek(confirmed, "2026-10-12", preferences);
  assert.equal(next.weekStart, "2026-10-12");
  assert.deepEqual(next.items, []);
  assert.equal(moveWeek(confirmed, monday, preferences), confirmed, "the same week is left alone");
});

test("the planned week survives a restart and reports a storage failure instead of losing it", async () => {
  const disk = new MemoryStorage();
  const first = new WeekPlanStore(disk, "week");
  await first.initialize();
  assert.equal(first.getSnapshot().plan, null);
  first.open(monday, preferences);
  first.toggleDay(monday, preferences);
  const suggestion = suggest(first.getSnapshot().plan, monday, "dinner");
  first.choose(monday, "dinner", suggestion, preferences);
  await first.flush();
  const second = new WeekPlanStore(disk, "week");
  await second.initialize();
  assert.equal(second.getSnapshot().error, null);
  assert.equal(second.getSnapshot().plan.weekStart, monday);
  assert.equal(second.getSnapshot().plan.items.length, 1);
  assert.equal(second.getSnapshot().plan.items[0].meal.id, suggestion.meal.id);
  // Opening the week again keeps what is in it; resetting clears it everywhere.
  second.open(monday, preferences);
  assert.equal(second.getSnapshot().plan.items.length, 1);
  second.reset();
  await second.flush();
  const third = new WeekPlanStore(disk, "week");
  await third.initialize();
  assert.equal(third.getSnapshot().plan, null);
  // A week that cannot be written is reported, not silently dropped.
  disk.fail = true;
  third.open(monday, preferences);
  third.toggleDay(monday, preferences);
  await third.flush().catch(() => {});
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(third.getSnapshot().error, /could not be saved/);
  assert.ok(third.getSnapshot().plan, "the plan stays in memory so nothing is lost mid-week");
  // Stored content that is not a valid week is reported and left untouched.
  const broken = new MemoryStorage();
  await broken.setItem("week", JSON.stringify({ version: 1, plan: { version: "2", weekStart: "nope" } }));
  const fourth = new WeekPlanStore(broken, "week");
  await fourth.initialize();
  assert.match(fourth.getSnapshot().error, /could not be read/);
  assert.equal(fourth.getSnapshot().plan, null);
  assert.equal(JSON.parse(await broken.getItem("week")).plan.weekStart, "nope", "not overwritten");
});
