require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const {
  chooseMeal, chooseMode, clearChoice, setPresence, startWeek, toggleDay,
} = require("../services/meals/weekPlanDraft.ts");
const { isWeekPlan } = require("../services/meals/validation.ts");
const { aggregateIngredients } = require("../services/meals/aggregation.ts");
const { basketFromMealPlan } = require("../services/meals/basket.ts");
const { mealNutrition, quickIndividualMeals, suggestMeals } = require("../services/meals/planner.ts");
const { meals } = require('../data/meals.ts');
const { coveredInSlot, itemGroup, itemsInSlot } = require("../services/meals/weekPlan.ts");
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
const familyDinner = () => {
  const plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  const [suggestion] = suggestMeals(plan, monday, "dinner", preferences, fullCatalog);
  return chooseMeal(plan, monday, "dinner", suggestion, preferences);
};
const ownDish = (plan, ids = ["kid"]) => {
  const [own] = suggestMeals(plan, monday, "dinner", preferences, fullCatalog, [], ids);
  assert.ok(own, "a dish for that person");
  return chooseMeal(plan, monday, "dinner", own, preferences, ids);
};

test("one slot can hold a family meal and somebody's own dish", () => {
  const family = familyDinner();
  const familyServings = itemsInSlot(family, monday, "dinner")[0].servings;
  const split = ownDish(family);
  const dishes = itemsInSlot(split, monday, "dinner");
  assert.equal(dishes.length, 2);
  const [familyDish, kidDish] = dishes;
  // Taking an own dish means leaving the family meal: the groups never share a person.
  assert.deepEqual(familyDish.participantIds, ["current-user", "partner"]);
  assert.deepEqual(kidDish.participantIds, ["kid"]);
  assert.deepEqual(coveredInSlot(split, monday, "dinner").sort(), ["current-user", "kid", "partner"]);
  assert.notEqual(familyDish.id, kidDish.id);
  // Each dish is scaled to the nutritional share of its own group.
  assert.ok(Math.abs(familyDish.servings - familyServings * 4200 / 5600) < 1e-9);
  assert.ok(Math.abs(kidDish.servings - suggestMeals(family, monday, "dinner", preferences, fullCatalog, [], ["kid"])[0].servings * 1400 / 5600) < 1e-9);
  assert.ok(isWeekPlan({ ...split, status: "confirmed" }));
  // Everyone keeps eating: the shopping list covers both dishes.
  const requirements = aggregateIngredients(split);
  assert.ok(requirements.some(r => r.sourceMealIds.includes(familyDish.id)));
  assert.ok(requirements.some(r => r.sourceMealIds.includes(kidDish.id)));
  const basket = basketFromMealPlan({ ...split, status: "confirmed" }, preferences, fullCatalog);
  assert.ok(basket.items.length > 0);
  // Only dinner was planned here, so breakfast and lunch are open; the split itself is not a gap.
  for (const warning of basket.warnings.filter(w => w.code.startsWith("open_slot_")))
    assert.ok(!warning.message.includes("dinner"), warning.message);
});

test('a child can take a simple lunchbox while the family keeps its meal, with only its ingredients added', () => {
  let plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  const familyMeal = meals.find(meal => meal.id === 'chicken-potato');
  plan = chooseMeal(plan, monday, 'lunch', { meal: familyMeal, servings: 3 }, preferences);
  const quick = quickIndividualMeals(plan, 'lunch', preferences);
  assert.deepEqual(quick.map(option => option.meal.id), ['cottage-carrot-bread', 'chicken-ham-lunchbox']);
  const lunchbox = quick.find(option => option.meal.id === 'chicken-ham-lunchbox');
  plan = chooseMeal(plan, monday, 'lunch', lunchbox, preferences, ['kid']);
  const dishes = itemsInSlot(plan, monday, 'lunch');
  assert.deepEqual(dishes.map(dish => dish.participantIds), [['current-user', 'partner'], ['kid']]);
  const expectedServings = 1400 * .32 / lunchbox.meal.caloriesPerServing;
  assert.ok(Math.abs(dishes[1].servings - expectedServings) < 1e-9);
  const requirements = aggregateIngredients(plan);
  assert.ok(requirements.some(line => line.ingredientKey === 'chicken_ham' && line.sourceMealIds.includes(dishes[1].id)));
  assert.ok(requirements.some(line => line.ingredientKey === 'apple' && line.sourceMealIds.includes(dishes[1].id)));
  assert.ok(!requirements.some(line => line.ingredientKey === 'cottage'));
  assert.ok(basketFromMealPlan({ ...plan, status: 'confirmed' }, preferences, fullCatalog).items.length > 0);
  assert.deepEqual(quickIndividualMeals(plan, 'dinner', preferences), []);
  assert.deepEqual(quickIndividualMeals(plan, 'lunch', prefs({ ...preferences, allergens: ['wheat'] })), []);
  assert.deepEqual(quickIndividualMeals(plan, 'lunch', prefs({ ...preferences, allergens: ['milk'] })).map(option => option.meal.id),
    ['chicken-ham-lunchbox']);
});

test("nobody eats twice in one slot, however the dishes are added", () => {
  const split = ownDish(familyDinner());
  const [familyDish, kidDish] = itemsInSlot(split, monday, "dinner");
  // The slot is covered, so the household meal is not offered again.
  assert.deepEqual(suggestMeals(split, monday, "dinner", preferences, fullCatalog), []);
  // Neither is a second dish for somebody who already has their own.
  assert.deepEqual(suggestMeals(split, monday, "dinner", preferences, fullCatalog, [], ["kid"]), []);
  // Somebody still eating the family meal can be given their own dish.
  assert.ok(suggestMeals(split, monday, "dinner", preferences, fullCatalog, [], ["partner"]).length > 0);
  const three = ownDish(split, ["partner"]);
  assert.equal(itemsInSlot(three, monday, "dinner").length, 3);
  assert.deepEqual(itemsInSlot(three, monday, "dinner")[0].participantIds, ["current-user"]);
  // Seating somebody at a dish they are not eating is refused rather than silently moved.
  assert.throws(() => setPresence(split, familyDish.id, ["current-user", "partner", "kid"], preferences),
    /already eating something else/);
  // A plan that feeds one person twice in a slot is invalid, whoever built it.
  assert.equal(isWeekPlan({ ...split, status: "confirmed",
    items: split.items.map(item => item.id === kidDish.id ? { ...item, participantIds: ["kid", "partner"] } : item) }),
    false);
  // A dish for the whole household is the only one its slot may hold.
  assert.equal(isWeekPlan({ ...split, status: "confirmed",
    items: split.items.map(item => item.id === familyDish.id ? { ...item, participantIds: undefined } : item) }),
    false);
});

test("an own dish can also be eating out or heating something up", () => {
  const out = chooseMode(familyDinner(), monday, "dinner", "eat_out", undefined, preferences, ["kid"]);
  const dishes = itemsInSlot(out, monday, "dinner");
  assert.equal(dishes.length, 2);
  assert.deepEqual(dishes[1].participantIds, ["kid"]);
  assert.equal(dishes[1].mealMode, "eat_out");
  assert.equal(mealNutrition(dishes[1]).calories, 0, "eating out records no nutrition");
  assert.deepEqual(dishes[0].participantIds, ["current-user", "partner"]);
  assert.ok(isWeekPlan({ ...out, status: "confirmed" }));
  // Splitting needs people: a household without a participant list cannot divide a slot.
  const plain = prefs({ householdSize: 2 });
  let noPeople = toggleDay(startWeek(monday, plain), monday, plain);
  const [suggestion] = suggestMeals(noPeople, monday, "dinner", plain, fullCatalog);
  noPeople = chooseMeal(noPeople, monday, "dinner", suggestion, plain);
  assert.throws(() => chooseMeal(noPeople, monday, "dinner", suggestion, plain, ["someone"]), /people of your household/);
  assert.throws(() => chooseMeal(familyDinner(), monday, "dinner", suggestion, preferences, ["ghost"]), /not in this plan/);
});

test("removing dishes leaves the slot in an honest state", () => {
  const split = ownDish(familyDinner());
  const [familyDish, kidDish] = itemsInSlot(split, monday, "dinner");
  // Dropping the own dish leaves the family meal and the person without a meal at home.
  const withoutOwn = clearChoice(split, kidDish.id, preferences);
  assert.deepEqual(itemsInSlot(withoutOwn, monday, "dinner").map(item => item.id), [familyDish.id]);
  assert.deepEqual(itemGroup(withoutOwn, itemsInSlot(withoutOwn, monday, "dinner")[0]), ["current-user", "partner"]);
  // That person can take their own dish again, or be seated back at the family meal.
  assert.ok(suggestMeals(withoutOwn, monday, "dinner", preferences, fullCatalog, [], ["kid"]).length > 0);
  const back = setPresence(withoutOwn, familyDish.id, ["current-user", "partner", "kid"], preferences);
  assert.equal(itemsInSlot(back, monday, "dinner")[0].participantIds, undefined, "the whole household again");
  // Emptying the own dish removes only it; emptying the last dish skips the slot.
  const emptied = setPresence(split, kidDish.id, [], preferences);
  assert.deepEqual(itemsInSlot(emptied, monday, "dinner").map(item => item.id), [familyDish.id]);
  const lastGone = setPresence(withoutOwn, familyDish.id, [], preferences);
  assert.deepEqual(itemsInSlot(lastGone, monday, "dinner"), []);
  assert.ok(!lastGone.days.find(day => day.date === monday)?.slots.includes("dinner"));
});

test("the database takes several dishes per slot and still one meal per dish", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;" +
      "create table auth.users(id uuid primary key);" +
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;" +
      "grant usage on schema public,auth to authenticated,anon;");
    for (const file of fs.readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort())
      await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
    const user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    await db.query("insert into auth.users values($1)", [user]);
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec("set role authenticated");
    const { rows } = await db.query(
      `insert into public.meal_plans(user_id,request_key,plan_version,week_start,household_size,target_calories,target_protein,status,plan_snapshot)
       values($1,'week','2',$2,3,12000,600,'confirmed','{}'::jsonb) returning id`, [user, monday]);
    const planId = rows[0].id;
    const insert = (itemKey, participants, slot = "dinner") => db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,plan_date,item_key,participant_ids,meal_slot,servings,item_snapshot)
       values($1,'m1',$2,$3,$4,$5,2,'{}'::jsonb)`, [planId, monday, itemKey, participants, slot]);
    await insert(`${monday}-dinner`, ["current-user", "partner"]);
    await insert(`${monday}-dinner-2`, ["kid"]);
    assert.equal((await db.query("select count(*)::int as n from public.meal_plan_items")).rows[0].n, 2);
    // The same dish cannot be stored twice, and a dish needs its key on a calendar row.
    await assert.rejects(insert(`${monday}-dinner`, ["kid"]), (e) => e.code === "23505");
    await assert.rejects(insert(null, ["kid"]), (e) => e.code === "23514");
    await assert.rejects(insert(`${monday}-dinner-3`, []), (e) => e.code === "23514");
    // A fixed-period row keeps one meal per day number and slot, and names no participants.
    const legacy = (await db.query(
      `insert into public.meal_plans(user_id,request_key,planning_days,household_size,target_calories,target_protein,status,plan_snapshot)
       values($1,'legacy',3,3,12000,600,'confirmed','{}'::jsonb) returning id`, [user])).rows[0].id;
    await db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,meal_slot,servings,item_snapshot)
       values($1,'m1',0,'dinner',2,'{}'::jsonb)`, [legacy]);
    await assert.rejects(db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,meal_slot,servings,item_snapshot)
       values($1,'m2',0,'dinner',2,'{}'::jsonb)`, [legacy]), (e) => e.code === "23505");
    await assert.rejects(db.query(
      `insert into public.meal_plan_items(meal_plan_id,meal_id,day_index,participant_ids,meal_slot,servings,item_snapshot)
       values($1,'m3',1,$2,'dinner',2,'{}'::jsonb)`, [legacy, ["kid"]]), (e) => e.code === "23514");
  } finally { await db.close(); }
});

test("the save RPC stores every dish of a slot with who eats it", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;" +
      "create table auth.users(id uuid primary key);" +
      "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;" +
      "grant usage on schema public,auth to authenticated,anon;");
    for (const file of fs.readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort())
      await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
    const user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    await db.query("insert into auth.users values($1)", [user]);
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec("set role authenticated");
    const plan = { ...ownDish(familyDinner()), status: "confirmed" };
    const result = { engineVersion: "2", status: "generated", score: 50, calorieTarget: 12000,
      proteinTarget: 600, estimatedTotalPrice: 42, items: [], mealPlan: plan };
    await db.query("select public.save_generated_basket($1,$2,$3::jsonb,$4::jsonb)",
      ["week", "Plan", JSON.stringify({ householdSize: 3 }), JSON.stringify(result)]);
    const stored = await db.query(
      `select item_key, participant_ids, meal_slot from public.meal_plan_items
       where meal_plan_id=(select id from public.meal_plans where request_key='week') order by item_key`);
    assert.equal(stored.rows.length, plan.items.length);
    const dinner = stored.rows.filter(row => row.meal_slot === "dinner");
    assert.equal(dinner.length, 2, "both dishes of the slot are stored");
    assert.deepEqual(dinner.map(row => row.participant_ids).sort(),
      [["current-user", "partner"], ["kid"]].sort());
  } finally { await db.close(); }
});

test('an absent person can choose a dish again without erasing the remaining family meal', () => {
  const split = ownDish(familyDinner());
  const own = itemsInSlot(split, monday, 'dinner').find(item => item.participantIds?.includes('kid'));
  const without = clearChoice(split, own.id, preferences);
  const restored = ownDish(without);
  assert.equal(itemsInSlot(restored, monday, 'dinner').length, 2);
  assert.deepEqual(coveredInSlot(restored, monday, 'dinner').sort(), ['current-user', 'kid', 'partner']);
});
