require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const { PGlite } = require("@electric-sql/pglite");
// The row mapping is pure, but its module reaches the Supabase client, which pulls in React Native.
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../lib/supabase") return { getSupabaseClient: () => null };
  return loadModule.call(this, request, parent, isMain);
};
const { fromRow, toRow } = require("../services/preferences-repository.ts");
const { defaultSlotDefaults } = require("../types/preferences.ts");

const migrations = [
  "20260905231852_user_preferences.sql",
  "20260906005004_products_catalog.sql",
  "20260906124417_product_image_quality.sql",
  "20260906131336_generated_baskets.sql",
  "20260906194141_meal_based_baskets.sql",
  "20260907081513_ingredient_package_metadata.sql",
  "20260907100053_personal_profiles_and_participants.sql",
  "20260907120000_synthetic_price_metadata.sql",
  "20260907134938_basket_management.sql",
  "20260908173310_meal_plan_snacks.sql",
  "20260908185911_edit_saved_basket.sql",
  "20260908191622_refresh_saved_basket_products.sql",
  "20260908203211_checkout_and_pantry.sql",
  "20260913090000_diabetes_dietary_preference.sql",
  "20260924144255_ready_meal_metadata.sql",
  "20261006090000_calendar_week_plans.sql",
];
const user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const monday = "2026-10-05";
const meal = (id) => ({
  id, name: "Fixture meal", mealType: "dinner", servings: 1,
  caloriesPerServing: 600, proteinPerServing: 30, carbohydratesPerServing: 60, fatPerServing: 20,
  dietaryTags: [], allergens: [], ingredients: [], nutritionSource: "curated-development-estimate",
  createdAt: "2026-10-05T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z",
});
async function database() {
  const db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role;create schema auth;" +
      "create table auth.users(id uuid primary key);" +
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;" +
      "grant usage on schema public,auth to authenticated,anon;",
  );
  for (const file of migrations)
    await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
  await db.query("insert into auth.users values($1)", [user]);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
  return db;
}
const insertPreferences = (db, patch = {}) => {
  const row = {
    household_size: 2, planning_days: 7, daily_calories: 2000, primary_goal: "maintain",
    protein_mode: "automatic", protein_target_grams: null, dietary_preferences: ["none"],
    allergens: [], budget_enabled: true, weekly_budget_eur: 70, slot_defaults: null,
    participants: null, onboarding_completed: true, ...patch,
  };
  const columns = Object.keys(row);
  return db.query(
    `insert into public.user_preferences (user_id, ${columns.join(", ")}) values ($1, ${columns
      .map((_, i) => `$${i + 2}`)
      .join(", ")}) on conflict (user_id) do update set ${columns
      .map((name) => `${name} = excluded.${name}`)
      .join(", ")} returning *`,
    [user, ...columns.map((name) => (name === "slot_defaults" || name === "participants"
      ? row[name] === null ? null : JSON.stringify(row[name]) : row[name]))],
  );
};
// PostgREST hands the client JSON; the test driver returns its own types for numeric and
// timestamptz. Normalize those two so the row mapping itself is what gets exercised.
const asJsonRow = (row) => ({
  ...row,
  weekly_budget_eur: row.weekly_budget_eur === null ? null : Number(row.weekly_budget_eur),
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});
const person = (patch = {}) => ({
  id: "current-user", name: "You", age: null, sex: null, dailyCalories: 2000, proteinTarget: 100,
  dietaryPreferences: ["none"], allergens: [], intolerances: [], isCurrentUser: true,
  kind: "adult", activityLevel: null, ...patch,
});

test("the meal standard and the household reach the cloud and come back unchanged", async () => {
  const db = await database();
  try {
    const saved = { slotDefaults: { ...defaultSlotDefaults, snack: true }, householdSize: 1,
      participants: [person()], planningDays: 7, dailyCalories: 2000, primaryGoal: "maintain",
      proteinMode: "automatic", proteinTargetGrams: null, dietaryPreferences: ["none"], allergens: [],
      budgetEnabled: true, weeklyBudgetEur: 70, id: null, userId: null, onboardingCompleted: true,
      createdAt: "", updatedAt: "" };
    const row = toRow(saved, user);
    assert.deepEqual(row.slot_defaults, saved.slotDefaults);
    assert.equal(row.participants.length, 1);
    const stored = (await insertPreferences(db, {
      household_size: 1, slot_defaults: row.slot_defaults, participants: row.participants,
    })).rows[0];
    const back = fromRow(asJsonRow(stored));
    assert.deepEqual(back.slotDefaults, saved.slotDefaults);
    assert.deepEqual(back.participants, [person()]);
    assert.equal(back.participants[0].kind, "adult", "the new per-person fields survive the round trip");
    // A row written before the calendar onboarding has neither column set.
    const legacy = fromRow(asJsonRow((await insertPreferences(db)).rows[0]));
    assert.equal(legacy.slotDefaults, undefined);
    assert.equal(legacy.participants, undefined);
    assert.equal(legacy.householdSize, 2);
    // A standard that plans no meal at all, a wrong shape, or a people count that
    // contradicts the household size is refused.
    for (const slot_defaults of [{ breakfast: false, lunch: false, dinner: false, snack: false },
      { breakfast: true }, { breakfast: true, lunch: true, dinner: true, snack: "yes" }])
      await assert.rejects(insertPreferences(db, { slot_defaults }), (e) => e.code === "23514");
    await assert.rejects(insertPreferences(db, { household_size: 2, participants: [person()] }),
      (e) => e.code === "23514");
    await assert.rejects(insertPreferences(db, { participants: [] }), (e) => e.code === "23514");
  } finally { await db.close(); }
});

test("a calendar week stores real dates, keeps its gaps and refuses a non-Monday start", async () => {
  const db = await database();
  try {
    const plan = (patch = {}) => db.query(
      `insert into public.meal_plans(user_id,request_key,plan_version,planning_days,week_start,household_size,target_calories,target_protein,status,plan_snapshot)
       values($1,$2,$3,$4,$5,2,12000,600,'confirmed','{}'::jsonb) returning id`,
      [user, patch.key ?? "week", patch.version ?? "2", patch.days ?? null, patch.weekStart ?? monday]);
    const { rows } = await plan();
    const planId = rows[0].id;
    // Monday, Tuesday, Thursday: the week has a hole on purpose.
    for (const [date, slot] of [[monday, "dinner"], ["2026-10-06", "lunch"], ["2026-10-08", "dinner"]])
      await db.query(
        `insert into public.meal_plan_items(meal_plan_id,meal_id,plan_date,meal_slot,servings,item_snapshot)
         values($1,$2,$3,$4,2,'{}'::jsonb)`, [planId, "m1", date, slot]);
    const stored = await db.query(
      "select plan_date::text as date, meal_slot, day_index from public.meal_plan_items where meal_plan_id=$1 order by plan_date, meal_slot",
      [planId]);
    assert.deepEqual(stored.rows.map((r) => `${r.date} ${r.meal_slot}`),
      ["2026-10-05 dinner", "2026-10-06 lunch", "2026-10-08 dinner"]);
    assert.equal(stored.rows[0].day_index, null, "a calendar item has no day number");
    // One meal per date and slot.
    await assert.rejects(db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,plan_date,meal_slot,servings,item_snapshot)
       values($1,'m2',$2,'dinner',2,'{}'::jsonb)`, [planId, monday]), (e) => e.code === "23505");
    // Same slot on another date is a different meal, so it is allowed.
    await db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,plan_date,meal_slot,servings,item_snapshot)
       values($1,'m2','2026-10-11','dinner',2,'{}'::jsonb)`, [planId]);
    // A date outside the plan's week is rejected by the row policy, not silently stored.
    await assert.rejects(db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,plan_date,meal_slot,servings,item_snapshot)
       values($1,'m3','2026-10-12','lunch',2,'{}'::jsonb)`, [planId]), (e) => e.code === "42501");
    // An item carries either a date or a day number, never both and never neither.
    for (const [day_index, plan_date] of [[0, monday], [null, null]])
      await assert.rejects(db.query(
        `insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,plan_date,meal_slot,servings,item_snapshot)
         values($1,'m4',$2,$3,'snack',2,'{}'::jsonb)`, [planId, day_index, plan_date]),
        (e) => e.code === "23514" || e.code === "42501");
    // A week starts on a Monday, and a calendar plan has no fixed planning period.
    await assert.rejects(plan({ key: "tuesday", weekStart: "2026-10-06" }), (e) => e.code === "23514");
    await assert.rejects(plan({ key: "both", days: 7 }), (e) => e.code === "23514");
    await assert.rejects(plan({ key: "three", version: "3" }), (e) => e.code === "23514");
  } finally { await db.close(); }
});

test("plans saved as a fixed period keep working exactly as before", async () => {
  const db = await database();
  try {
    // Written the way the previous version wrote it: no plan_version, no week_start, day numbers.
    const { rows } = await db.query(
      `insert into public.meal_plans(user_id,request_key,planning_days,household_size,target_calories,target_protein,status,plan_snapshot)
       values($1,'legacy',3,2,12000,600,'confirmed','{}'::jsonb) returning id, plan_version, week_start`,
      [user]);
    assert.equal(rows[0].plan_version, "1", "existing rows default to version 1");
    assert.equal(rows[0].week_start, null);
    await db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,meal_slot,servings,item_snapshot)
       values($1,'m1',0,'dinner',2,'{}'::jsonb)`, [rows[0].id]);
    // The period rules still hold: a day beyond the plan, a second meal in the same slot,
    // a day number out of range and an unsupported period are all refused.
    await assert.rejects(db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,meal_slot,servings,item_snapshot)
       values($1,'m2',3,'dinner',2,'{}'::jsonb)`, [rows[0].id]), (e) => e.code === "42501");
    await assert.rejects(db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,meal_slot,servings,item_snapshot)
       values($1,'m3',0,'dinner',2,'{}'::jsonb)`, [rows[0].id]), (e) => e.code === "23505");
    // Out of range for both guards: the row policy and the 0-13 check constraint.
    await assert.rejects(db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,meal_slot,servings,item_snapshot)
       values($1,'m4',14,'dinner',2,'{}'::jsonb)`, [rows[0].id]),
      (e) => e.code === "23514" || e.code === "42501");
    await assert.rejects(db.query(
      `insert into public.meal_plans(user_id,request_key,planning_days,household_size,target_calories,target_protein,status,plan_snapshot)
       values($1,'four-days',4,2,12000,600,'confirmed','{}'::jsonb)`, [user]), (e) => e.code === "23514");
  } finally { await db.close(); }
});

test("the save RPC accepts both plan versions and still guards the fixed period", async () => {
  const db = await database();
  try {
    await insertPreferences(db, { household_size: 2, planning_days: 3 });
    const preferences = { planningDays: 3, householdSize: 2 };
    const basket = (plan) => ({ engineVersion: "2", status: "generated", score: 50,
      calorieTarget: 12000, proteinTarget: 600, estimatedTotalPrice: 42, items: [], mealPlan: plan });
    const save = (key, result, prefs = preferences) => db.query(
      "select public.save_generated_basket($1,$2,$3::jsonb,$4::jsonb) as id",
      [key, "Plan", JSON.stringify(prefs), JSON.stringify(result)]);
    // A calendar week: the week start and the dates are stored, the period stays empty.
    const week = { version: "2", weekStart: monday, status: "confirmed", householdSize: 2,
      targetCalories: 12000, targetProtein: 600, warnings: [],
      days: [{ date: monday, slots: ["dinner"] }, { date: "2026-10-08", slots: ["lunch"] }],
      items: [{ id: "i1", date: monday, mealSlot: "dinner", meal: meal("m1"), servings: 2 },
        { id: "i2", date: "2026-10-08", mealSlot: "lunch", meal: meal("m2"), servings: 2 }] };
    await save("week", basket(week));
    const stored = await db.query(
      "select plan_version, planning_days, week_start::text as week_start from public.meal_plans where request_key='week'");
    assert.deepEqual(stored.rows[0], { plan_version: "2", planning_days: null, week_start: monday });
    const dates = await db.query(
      `select plan_date::text as date from public.meal_plan_items
       where meal_plan_id=(select id from public.meal_plans where request_key='week') order by plan_date`);
    assert.deepEqual(dates.rows.map((r) => r.date), [monday, "2026-10-08"]);
    // Two planned days are a valid basket now, where the old rule allowed only 3, 5, 7 or 14.
    const savedBasket = await db.query("select planning_days from public.baskets where request_key='week'");
    assert.equal(savedBasket.rows[0].planning_days, 3, "the saved preferences still name the period");
    const noPeriod = await save("week-no-period", basket(week), { householdSize: 2 });
    assert.ok(noPeriod.rows[0].id);
    assert.equal((await db.query("select planning_days from public.baskets where request_key='week-no-period'"))
      .rows[0].planning_days, 2, "without a saved period the planned days are counted");
    // A fixed-period plan is still checked against the saved preferences.
    const legacy = { version: "1", planningDays: 3, householdSize: 2, status: "confirmed",
      targetCalories: 12000, targetProtein: 600, warnings: [],
      items: [{ id: "i1", dayIndex: 0, mealSlot: "dinner", meal: meal("m1"), servings: 2 }] };
    await save("legacy", basket(legacy));
    assert.equal((await db.query("select plan_version, planning_days from public.meal_plans where request_key='legacy'"))
      .rows[0].plan_version, "1");
    await assert.rejects(save("mismatch", basket({ ...legacy, planningDays: 7 })), /mismatch/);
    await assert.rejects(save("household", basket({ ...week, householdSize: 4 })), /mismatch/);
    await assert.rejects(save("unknown", basket({ ...week, version: "9" })), /version/);
    // The week start still has to be a Monday when it arrives through the RPC.
    await assert.rejects(save("tuesday", basket({ ...week, weekStart: "2026-10-06" })), (e) => e.code === "23514");
  } finally { await db.close(); }
});
