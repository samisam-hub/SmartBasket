require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estimateCalories, isParticipant, participantPreferences } = require('../services/profile-domain.ts');
const { newParticipant, updateParticipant, onboardingHousehold, householdPatch } = require('../services/participant-domain.ts');
const { defaultDraft, defaultSlotDefaults, onboardingSteps } = require('../types/preferences.ts');
const { validatePreferences, isSaved } = require('../services/preference-domain.ts');
const { PreferenceStore } = require('../services/preference-store.ts');
const { nutritionTargets } = require('../services/basket/nutritionTargets.ts');
const { splitNutrition } = require('../services/meals/portions.ts');
const { prefs } = require('./basket-fixtures.cjs');
const adult = () => updateParticipant(newParticipant('me', 'You', true), { kind: 'adult' });
const child = () => updateParticipant(newParticipant('child', 'Child'), { kind: 'child' });
const draft = () => ({ ...structuredClone(defaultDraft), ...householdPatch([adult(), child()]), slotDefaults: { ...defaultSlotDefaults } });
const disk = () => { const data = new Map(); return { getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } }; };

test('one adult/child choice yields usable individual targets; snacks default off', () => {
  const initial = onboardingHousehold(defaultDraft);
  assert.equal(initial.participants.length, 1);
  assert.equal(initial.participants[0].isCurrentUser, true);
  assert.equal(initial.participants[0].kind, null);
  assert.ok(validatePreferences({ ...defaultDraft, ...initial }).participants);
  assert.equal(adult().dailyCalories, 2000);
  assert.equal(child().dailyCalories, 1400);
  assert.deepEqual(validatePreferences(draft()), {});
  assert.equal(draft().slotDefaults.snack, false);
  assert.equal(onboardingSteps.includes('goals'), false);
  assert.equal(onboardingSteps.includes('budget'), false);
});

test('Mifflin–St Jeor uses full adult measurements and activity; no invented measurements or adult formula for children', () => {
  const measured = { ...adult(), age: 30, heightCm: 180, weightKg: 80, sex: 'male', activityLevel: 'sedentary' };
  assert.equal(estimateCalories(measured), 2136);
  assert.equal(estimateCalories({ ...measured, sex: 'female' }), 1937);
  assert.equal(estimateCalories({ ...measured, activityLevel: 'active' }), 3071);
  for (const patch of [{ age: null }, { heightCm: null }, { weightKg: null }, { sex: 'other' }, { weightKg: NaN }])
    assert.equal(estimateCalories({ ...measured, ...patch }), 2000);
  assert.equal(estimateCalories({ ...measured, kind: 'child', age: 10 }), 1400);
});

test('recommendations recalculate while a manual target survives optional detail changes', () => {
  const recommended = updateParticipant(adult(), { age: 30, heightCm: 180, weightKg: 80, sex: 'male', activityLevel: 'sedentary' });
  assert.equal(recommended.dailyCalories, 2136);
  const manual = updateParticipant(recommended, { calorieTargetMode: 'manual', dailyCalories: 1900 });
  assert.equal(updateParticipant(manual, { activityLevel: 'active' }).dailyCalories, 1900);
  assert.equal(updateParticipant(manual, { calorieTargetMode: 'recommended' }).dailyCalories, 2136);
  assert.equal(isParticipant({ ...child(), age: 25 }), false);
  assert.equal(isParticipant({ ...adult(), age: 10 }), false);
  assert.equal(isParticipant({ ...adult(), heightCm: 500 }), false);
});

test('per-person totals and smaller child portions conserve the full household nutrition', () => {
  const input = participantPreferences(prefs({ planningDays: 3 }), [adult(), child()]);
  const totals = nutritionTargets(input);
  assert.equal(totals.calorieTarget, 3400 * 3);
  const plan = { householdSize: 2, planningDays: 3, participants: input.participants, targetCalories: totals.calorieTarget, targetProtein: totals.proteinTarget };
  const portions = splitNutrition(plan, { calories: 850, protein: 51 });
  assert.equal(portions[0].calories, 500);
  assert.equal(portions[1].calories, 350);
  assert.equal(portions.reduce((sum, p) => sum + p.protein, 0), 51);
  const restricted = participantPreferences(prefs(), [{ ...adult(), dietaryPreferences: ['diabetes'] }, { ...child(), allergens: ['milk'] }]);
  assert.ok(restricted.dietaryPreferences.includes('diabetes'));
  assert.ok(restricted.allergens.includes('milk'));
});

test('incomplete household, resumed steps, defaults and overrides survive restart without accepting invalid completion', async () => {
  const storage = disk();
  const store = new PreferenceStore(storage, 'household', null);
  await store.initialize();
  store.update(onboardingHousehold(store.getSnapshot().draft));
  store.goTo('household');
  assert.equal(await store.save(), false);
  await store.flushDraft();
  const resumed = new PreferenceStore(storage, 'household', null);
  await resumed.initialize();
  assert.equal(resumed.begin(), 'household');
  assert.equal(resumed.getSnapshot().localError, null);
  resumed.update(draft());
  resumed.goTo('meals');
  resumed.update({ slotDefaults: { ...defaultSlotDefaults, lunch: false } });
  assert.equal(await resumed.save(), true);
  const reopened = new PreferenceStore(storage, 'household', null);
  await reopened.initialize();
  assert.equal(reopened.getSnapshot().saved.participants[1].dailyCalories, 1400);
  assert.equal(reopened.getSnapshot().saved.slotDefaults.lunch, false);
  assert.equal(reopened.getSnapshot().saved.householdSize, 2);
  assert.ok(isSaved(reopened.getSnapshot().saved));
});

test('legacy saved preferences and participants remain readable without new calendar fields', async () => {
  const legacy = prefs({ householdSize: 3, planningDays: 14, dailyCalories: 2400 });
  const original = structuredClone(legacy);
  const storage = disk();
  await storage.setItem('legacy', JSON.stringify({ version: 1, draft: legacy, saved: legacy, step: 'goals', editing: true, pendingSync: false }));
  const store = new PreferenceStore(storage, 'legacy', null);
  await store.initialize();
  assert.equal(store.getSnapshot().localError, null);
  assert.deepEqual(store.getSnapshot().saved, legacy);
  const next = onboardingHousehold(legacy);
  assert.equal(next.participants.length, 3);
  assert.equal(next.participants[0].dailyCalories, 2400);
  assert.deepEqual(legacy, original);
  const oldPerson = { ...adult() }; delete oldPerson.kind; delete oldPerson.calorieTargetMode;
  delete oldPerson.heightCm; delete oldPerson.weightKg; delete oldPerson.activityLevel;
  assert.equal(isParticipant(oldPerson), true);
});

test('failed cloud sync cannot erase locally completed household data', async () => {
  const storage = disk();
  const remote = { load: async () => null, save: async () => { throw Error('Migration pending'); } };
  const store = new PreferenceStore(storage, 'pending', remote);
  await store.initialize(); store.update(draft());
  assert.equal(await store.save(), true);
  const reopened = new PreferenceStore(storage, 'pending', { ...remote, load: async () => prefs() });
  await reopened.initialize();
  assert.equal(reopened.getSnapshot().pendingSync, true);
  assert.equal(reopened.getSnapshot().saved.participants.length, 2);
});
