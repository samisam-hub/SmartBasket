require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { prefs, product } = require('./basket-fixtures.cjs');
const { fullCatalog } = require('./meal-fixtures.cjs');
const { diets, labels } = require('../types/preferences.ts');
const { toggleDiet, validatePreferences, preferenceChips } = require('../services/preference-domain.ts');
const { matchesPreferences, highSugar, sugarsUnknown } = require('../services/catalog/discovery.ts');
const { exclusionReason } = require('../services/basket/constraints.ts');
const { skuSafety } = require('../services/meals/skuSafety.ts');
const { compatibleMeal, generateMealPlan } = require('../services/meals/planner.ts');
const { meals } = require('../data/meals.ts');

test('diabetes is an additional restriction that combines with every dietary pattern', () => {
  assert.ok(diets.includes('diabetes'));
  assert.equal(labels.diabetes, 'Diabetes-friendly');
  assert.deepEqual(toggleDiet(['none'], 'diabetes'), ['diabetes']);
  assert.deepEqual(toggleDiet(['vegan'], 'diabetes'), ['vegan', 'diabetes']);
  // An alternative pattern replaces only the other patterns, never the diabetes selection.
  assert.deepEqual(toggleDiet(['vegan', 'diabetes'], 'pescatarian'), ['diabetes', 'pescatarian']);
  assert.deepEqual(toggleDiet(['vegan', 'diabetes'], 'diabetes'), ['vegan']);
  assert.deepEqual(toggleDiet(['diabetes'], 'none'), ['none']);
  for (const dietaryPreferences of [['diabetes'], ['diabetes', 'gluten_free'], ['vegan', 'lactose_free', 'diabetes']])
    assert.equal(validatePreferences(prefs({ dietaryPreferences })).dietaryPreferences, undefined);
  assert.ok(validatePreferences(prefs({ dietaryPreferences: ['none', 'diabetes'] })).dietaryPreferences);
  assert.ok(validatePreferences(prefs({ dietaryPreferences: ['diabetes', 'diabetes'] })).dietaryPreferences);
  assert.ok(preferenceChips(prefs({ dietaryPreferences: ['diabetes'] })).includes('Diabetes-friendly'));
});

test('diabetes filters declared sugars and never reads an undeclared value as low', () => {
  const p = prefs({ dietaryPreferences: ['diabetes'] });
  const jam = product(1, { sugarsPer100g: 40, carbohydratesPer100g: 65 });
  const drink = product(2, { nutritionBasis: '100ml', sugarsPer100g: 12, carbohydratesPer100g: 13, caloriesPer100g: 60, proteinPer100g: 1, fatPer100g: 0.5 });
  const unknown = product(3, { sugarsPer100g: null });
  const low = product(4, { sugarsPer100g: 2 });
  assert.equal(highSugar(jam), true);
  assert.equal(highSugar(drink), true, 'drinks use the lower per-100 ml threshold');
  assert.equal(highSugar(product(5, { nutritionBasis: '100ml', sugarsPer100g: 10, carbohydratesPer100g: 13, caloriesPer100g: 60, proteinPer100g: 1, fatPer100g: 0.5 })), false);
  assert.equal(highSugar(low), false);
  assert.equal(sugarsUnknown(unknown), true);
  assert.equal(exclusionReason(jam, p), 'contradictory_diet');
  assert.equal(exclusionReason(unknown, p), 'sugar_content_unknown');
  assert.equal(exclusionReason(low, p), null);
  assert.equal(skuSafety(jam, p).rejection, 'known_dietary_conflict');
  assert.equal(skuSafety(unknown, p).rejection, null);
  assert.ok(skuSafety(unknown, p).unknownDiet.includes('diabetes'), 'missing sugars is a warning, not a silent pass');
  assert.deepEqual(skuSafety(low, p).unknownDiet, []);
  // Discovery demands the declared value, in line with the other dietary filters.
  assert.equal(matchesPreferences(low, p), true);
  assert.equal(matchesPreferences(jam, p), false);
  assert.equal(matchesPreferences(unknown, p), false);
  assert.equal(skuSafety(jam, prefs()).rejection, null, 'without the preference nothing is filtered on sugars');
});

test('curated meals stay plannable for diabetes alone and combined with other patterns', () => {
  const tagged = meals.filter(m => m.dietaryTags.includes('diabetes'));
  assert.ok(tagged.length >= 6);
  for (const meal of tagged)
    assert.ok(meal.carbohydratesPerServing <= (meal.mealType === 'snack' ? 30 : 75));
  assert.ok(!meals.find(m => m.id === 'snack-banana-chocolate').dietaryTags.includes('diabetes'));
  assert.ok(!meals.find(m => m.id === 'lentil-curry').dietaryTags.includes('diabetes'), 'a 100 g carbohydrate bowl is not tagged');
  for (const dietaryPreferences of [['diabetes'], ['diabetes', 'gluten_free'], ['vegan', 'diabetes'], ['vegan', 'gluten_free', 'diabetes']]) {
    const p = prefs({ planningDays: 3, householdSize: 1, dailyCalories: 1700, dietaryPreferences });
    const plan = generateMealPlan(p, fullCatalog);
    assert.equal(plan.items.length, 12, `${dietaryPreferences.join('+')} plans every slot`);
    for (const item of plan.items) {
      assert.ok(compatibleMeal(item.meal, p));
      for (const diet of dietaryPreferences) assert.ok(item.meal.dietaryTags.includes(diet));
    }
    assert.ok(!plan.warnings.some(w => w.code.startsWith('missing_')));
  }
});

test('stored dietary preferences accept diabetes and still reject unknown values', async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;");
    for (const f of ['20260905231852_user_preferences.sql', '20260906005004_products_catalog.sql', '20260906124417_product_image_quality.sql',
      '20260906131336_generated_baskets.sql', '20260906194141_meal_based_baskets.sql', '20260907100053_personal_profiles_and_participants.sql',
      '20260907134938_basket_management.sql', '20260908173310_meal_plan_snacks.sql', '20260913090000_diabetes_dietary_preference.sql'])
      await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
    const user = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    await db.query('insert into auth.users values($1)', [user]);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec('set role authenticated');
    const savePreferences = (dietary) => db.query(
      `insert into public.user_preferences (user_id, household_size, planning_days, daily_calories, primary_goal, protein_mode, weekly_budget_eur, onboarding_completed, dietary_preferences)
       values ($1, 2, 7, 2000, 'maintain', 'automatic', 70, true, $2) on conflict (user_id) do update set dietary_preferences = excluded.dietary_preferences`,
      [user, dietary]);
    await savePreferences(['diabetes']);
    await savePreferences(['vegan', 'lactose_free', 'gluten_free', 'diabetes']);
    await assert.rejects(savePreferences(['diabetes', 'keto']), e => e.code === '23514');
    await assert.rejects(savePreferences(['none', 'diabetes']), e => e.code === '23514');
    await assert.rejects(savePreferences(['vegan', 'pescatarian']), e => e.code === '23514');
    await db.query('insert into public.profiles(id, display_name, dietary_preferences) values($1,$2,$3)', [user, 'A', ['diabetes', 'gluten_free']]);
    await assert.rejects(db.query('update public.profiles set dietary_preferences=$1', [['diabetes', 'keto']]), e => e.code === '23514');
    await assert.rejects(db.query('update public.profiles set dietary_preferences=$1', [[]]), e => e.code === '23514');
  } finally {
    await db.close();
  }
});
