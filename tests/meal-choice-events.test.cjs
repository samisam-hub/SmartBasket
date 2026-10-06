require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const { choiceEventRow, recordChoice } = require("../services/meals/choiceEvents.ts");
const { chooseMode, chooseMeal, startWeek, toggleDay } = require("../services/meals/weekPlanDraft.ts");
const { isWeekPlan } = require("../services/meals/validation.ts");
const { mealNutritionKnown } = require("../services/meals/choices.ts");
const { mealNutrition, suggestMeals } = require("../services/meals/planner.ts");
const { itemsOn } = require("../services/meals/weekPlan.ts");
const { prefs } = require("./basket-fixtures.cjs");
const { fullCatalog } = require("./meal-fixtures.cjs");

const monday = "2026-10-05";
const preferences = prefs({ householdSize: 2 });
const user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const event = (patch = {}) => ({
  planDate: monday, mealSlot: "dinner", shownMealIds: ["a", "b"], action: "chosen",
  chosenMealId: "a", round: 0, ...patch,
});

test("a decision becomes one row, and only a chosen meal carries a meal id", () => {
  assert.deepEqual(choiceEventRow(event(), user), {
    user_id: user, plan_date: monday, meal_slot: "dinner", shown_meal_ids: ["a", "b"],
    action: "chosen", chosen_meal_id: "a", round: 0,
  });
  // Every other action records what was on screen, never a meal nobody picked.
  for (const action of ["shuffled", "skipped", "eat_out", "heat_and_eat"])
    assert.equal(choiceEventRow(event({ action, chosenMealId: "a" }), user).chosen_meal_id, null);
  assert.deepEqual(choiceEventRow(event({ shownMealIds: Array.from({ length: 12 }, (_, i) => `m${i}`) }), user).shown_meal_ids.length, 8);
  assert.equal(choiceEventRow(event({ round: 99.6 }), user).round, 50);
  assert.equal(choiceEventRow(event({ round: -3 }), user).round, 0);
});

test("recording never stands in the way of planning", async () => {
  // No backend and no identity: the decision still counts, the event is simply not recorded.
  await recordChoice(null, user, event());
  await recordChoice({ from: () => { throw Error("should not be called"); } }, null, event());
  let inserted = null;
  await recordChoice({ from: (table) => ({ insert: (row) => { inserted = { table, row }; return Promise.resolve({ error: null }); } }) }, user, event());
  assert.equal(inserted.table, "meal_choice_events");
  assert.equal(inserted.row.action, "chosen");
  // A failing write is dropped rather than thrown at the person mid-decision.
  await recordChoice({ from: () => ({ insert: () => Promise.reject(Error("offline")) }) }, user, event());
  await recordChoice({ from: () => ({ insert: () => { throw Error("broken client"); } }) }, user, event())
    .catch(() => assert.fail("recording must not reject"));
});

test("heating something up or eating out fills the slot without inventing nutrition", () => {
  let plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  const out = chooseMode(plan, monday, "dinner", "eat_out", undefined, preferences);
  const outItem = itemsOn(out, monday)[0];
  assert.equal(outItem.mealMode, "eat_out");
  assert.equal(outItem.meal.nutritionSource, "unrecorded");
  assert.deepEqual(outItem.meal.ingredients, []);
  assert.equal(outItem.readyMealCategory, undefined);
  assert.equal(mealNutritionKnown(outItem), false, "eating out has no recorded nutrition");
  assert.deepEqual(mealNutrition(outItem), { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  assert.ok(isWeekPlan({ ...out, status: "confirmed" }));
  const heated = chooseMode(plan, monday, "dinner", "heat_and_eat", "lasagne", preferences);
  const heatedItem = itemsOn(heated, monday)[0];
  assert.equal(heatedItem.readyMealCategory, "lasagne");
  assert.equal(heatedItem.servings, preferences.householdSize);
  assert.ok(isWeekPlan({ ...heated, status: "confirmed" }));
  // A category that does not fit the slot, or a slot nobody planned, is refused.
  assert.throws(() => chooseMode(plan, monday, "breakfast", "heat_and_eat", "lasagne", preferences), /does not fit/);
  assert.throws(() => chooseMode(plan, monday, "snack", "eat_out", undefined, preferences), /not planned/);
  assert.throws(() => chooseMode(plan, "2026-10-07", "dinner", "eat_out", undefined, preferences), /not planned/);
  // The first yes still wins: a decided slot keeps what it has.
  const [suggestion] = suggestMeals(plan, monday, "dinner", preferences, fullCatalog);
  plan = chooseMeal(plan, monday, "dinner", suggestion, preferences);
  assert.equal(chooseMode(plan, monday, "dinner", "eat_out", undefined, preferences).items[0].meal.id, suggestion.meal.id);
});

test("the events table takes every action and keeps rows to their owner", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;" +
      "create table auth.users(id uuid primary key);" +
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;" +
      "grant usage on schema public,auth to authenticated,anon;");
    await db.exec(fs.readFileSync("supabase/migrations/20261006120000_meal_choice_events.sql", "utf8"));
    const other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    await db.query("insert into auth.users values($1),($2)", [user, other]);
    const asUser = async (id) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec("set role authenticated");
    };
    await asUser(user);
    const insert = (row) => db.query(
      `insert into public.meal_choice_events(user_id, plan_date, meal_slot, shown_meal_ids, action, chosen_meal_id, round)
       values($1,$2,$3,$4,$5,$6,$7)`,
      [row.user_id, row.plan_date, row.meal_slot, row.shown_meal_ids, row.action, row.chosen_meal_id, row.round]);
    for (const action of ["chosen", "shuffled", "skipped", "heat_and_eat", "ready_to_eat", "eat_out", "copied_day"])
      await insert(choiceEventRow(event({ action, round: 2 }), user));
    assert.equal((await db.query("select count(*)::int as n from public.meal_choice_events")).rows[0].n, 7);
    // A chosen meal needs its id, and every other action must not carry one.
    await assert.rejects(insert({ ...choiceEventRow(event(), user), chosen_meal_id: null }), (e) => e.code === "23514");
    await assert.rejects(insert({ ...choiceEventRow(event({ action: "skipped" }), user), chosen_meal_id: "a" }), (e) => e.code === "23514");
    await assert.rejects(insert(choiceEventRow(event({ action: "pondered" }), user)), (e) => e.code === "23514");
    await assert.rejects(insert(choiceEventRow(event({ mealSlot: "brunch" }), user)), (e) => e.code === "23514");
    // Rows belong to their owner: nobody writes or reads another identity's decisions.
    await assert.rejects(insert(choiceEventRow(event(), other)), (e) => e.code === "42501");
    await asUser(other);
    assert.equal((await db.query("select count(*)::int as n from public.meal_choice_events")).rows[0].n, 0);
    await assert.rejects(db.exec("update public.meal_choice_events set action='skipped'"), (e) => e.code === "42501");
    await assert.rejects(db.exec("delete from public.meal_choice_events"), (e) => e.code === "42501");
  } finally { await db.close(); }
});
