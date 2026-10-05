require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PreferenceStore } = require("../services/preference-store.ts");
const {
  activeSlotLabels,
  householdValues,
  isDraft,
  isSaved,
  validParticipantList,
  validSlotDefaults,
  validatePreferences,
} = require("../services/preference-domain.ts");
const {
  estimateCalories,
  estimateProtein,
  isParticipant,
  newParticipant,
  participantKind,
  patchParticipant,
  profileParticipant,
} = require("../services/profile-domain.ts");
const {
  activeSlots,
  defaultDraft,
  defaultSlotDefaults,
  slotDefaultsOf,
  steps,
} = require("../types/preferences.ts");
const { emptyProfile } = require("../types/profile.ts");

class MemoryStorage {
  data = new Map();
  async getItem(key) {
    return this.data.get(key) ?? null;
  }
  async setItem(key, value) {
    this.data.set(key, value);
  }
}
const adult = (patch = {}) => ({
  ...newParticipant("adult", "current-user", "You", "maintain"),
  isCurrentUser: true,
  ...patch,
});

test("the calorie suggestion follows the taps a person made and stays inside the stored range", () => {
  const plain = adult();
  assert.equal(plain.dailyCalories, estimateCalories(plain));
  assert.equal(plain.dailyCalories % 50, 0);
  assert.ok(plain.dailyCalories >= 1000 && plain.dailyCalories <= 5000);
  assert.equal(plain.proteinTarget, estimateProtein(plain.dailyCalories, "maintain"));
  // Mifflin-St Jeor: a man weighs and measures more, activity scales the basal rate, age lowers it.
  const male = estimateCalories({ sex: "male" }), female = estimateCalories({ sex: "female" });
  assert.ok(male > female);
  assert.ok(estimateCalories({ activityLevel: "high" }) > estimateCalories({ activityLevel: "low" }));
  assert.ok(estimateCalories({ age: 70 }) < estimateCalories({ age: 25 }));
  // A child is a smaller portion than an adult, and no estimate leaves the 1,000-5,000 range.
  assert.ok(estimateCalories({ kind: "child" }) < estimateCalories({ kind: "adult" }));
  for (const person of [
    { kind: "child", age: 1 },
    { kind: "child", age: 2, activityLevel: "low" },
    { kind: "adult", age: 120, sex: "female", activityLevel: "low" },
    { kind: "adult", age: 18, sex: "male", activityLevel: "very_high" },
  ]) {
    const estimate = estimateCalories(person);
    assert.ok(estimate >= 1000 && estimate <= 5000, `${JSON.stringify(person)} → ${estimate}`);
    assert.equal(estimate % 50, 0);
  }
});

test("details move the suggestion along; a corrected target is kept", () => {
  const person = adult();
  const child = patchParticipant(person, { kind: "child", age: 8 }, "maintain");
  assert.equal(child.dailyCalories, estimateCalories(child));
  assert.notEqual(child.dailyCalories, person.dailyCalories);
  const corrected = patchParticipant(child, { dailyCalories: 1800 }, "maintain");
  assert.equal(corrected.dailyCalories, 1800);
  assert.equal(corrected.proteinTarget, estimateProtein(1800, "maintain"));
  // Further detail taps must not overwrite the number the person entered.
  const stillCorrected = patchParticipant(corrected, { activityLevel: "high" }, "maintain");
  assert.equal(stillCorrected.dailyCalories, 1800);
  // The goal only changes the protein share, never the calorie suggestion.
  assert.equal(
    patchParticipant(person, { age: 30 }, "build_muscle").proteinTarget,
    estimateProtein(patchParticipant(person, { age: 30 }, "maintain").dailyCalories, "build_muscle"),
  );
});

test("the household list drives size and per-person calories, and every person stays valid", () => {
  const people = [adult({ dailyCalories: 2000, proteinTarget: 100 }),
    { ...newParticipant("child", "person-2", "Kid", "maintain"), dailyCalories: 1500, proteinTarget: 75 }];
  assert.deepEqual(householdValues(people), { householdSize: 2, dailyCalories: 1750 });
  assert.ok(people.every(isParticipant));
  assert.ok(validParticipantList(people));
  assert.equal(validParticipantList([]), false);
  assert.equal(validParticipantList([people[0], people[0]]), false, "duplicate ids");
  assert.equal(
    validParticipantList([people[0], { ...people[1], isCurrentUser: true }]),
    false,
    "only one person is the current user",
  );
  assert.equal(validParticipantList([{ ...people[0], dailyCalories: 400 }]), false);
  const draft = { ...defaultDraft, participants: people, ...householdValues(people) };
  assert.deepEqual(validatePreferences(draft), {});
  assert.ok(validatePreferences({ ...draft, householdSize: 5 }).householdSize);
  assert.ok(validatePreferences({ ...draft, participants: [] }).participants);
  assert.ok(
    validatePreferences({ ...draft, participants: [{ ...people[0], name: "  " }] }).participants,
  );
  // Personal defaults still produce a usable first participant for the calendar onboarding.
  const you = profileParticipant({ ...emptyProfile, displayName: "Sam", defaultDailyCalories: 2100 },
    { ...defaultDraft, dailyCalories: 2000 });
  assert.equal(participantKind(you), "adult");
  assert.ok(isParticipant(you));
});

test("the meal standard has a default, is validated, and needs at least one meal", () => {
  assert.deepEqual(defaultSlotDefaults, { breakfast: true, lunch: true, dinner: true, snack: false });
  assert.deepEqual(activeSlots({}), ["breakfast", "lunch", "dinner"]);
  assert.deepEqual(activeSlotLabels({}), ["Breakfast", "Lunch", "Dinner"]);
  assert.deepEqual(activeSlots({ slotDefaults: { ...defaultSlotDefaults, snack: true, lunch: false } }),
    ["breakfast", "dinner", "snack"]);
  assert.ok(validSlotDefaults(defaultSlotDefaults));
  for (const broken of [null, {}, { breakfast: true }, { ...defaultSlotDefaults, snack: "yes" },
    { breakfast: false, lunch: false, dinner: false, snack: false }])
    assert.equal(validSlotDefaults(broken), false);
  assert.ok(validatePreferences({ ...defaultDraft, slotDefaults: { breakfast: false, lunch: false, dinner: false, snack: false } }).slotDefaults);
  assert.deepEqual(validatePreferences({ ...defaultDraft, slotDefaults: defaultSlotDefaults }), {});
  assert.ok(steps.includes("meals"));
});

test("preferences and participants saved before the calendar onboarding stay readable", async () => {
  // Exactly the shape written by the previous version: no participants, no slot defaults.
  const legacyDraft = {
    householdSize: 2, planningDays: 7, dailyCalories: 2000, primaryGoal: "maintain",
    proteinMode: "automatic", proteinTargetGrams: null, dietaryPreferences: ["none"],
    allergens: [], budgetEnabled: true, weeklyBudgetEur: 70,
  };
  assert.ok(isDraft(legacyDraft));
  assert.deepEqual(validatePreferences(legacyDraft), {});
  assert.deepEqual(slotDefaultsOf(legacyDraft), defaultSlotDefaults);
  const legacySaved = {
    ...legacyDraft, id: "row-1", userId: "user-1", onboardingCompleted: true,
    createdAt: "2026-09-06T00:00:00Z", updatedAt: "2026-09-06T00:00:00Z",
  };
  assert.ok(isSaved(legacySaved));
  // A participant stored inside an old plan snapshot has no kind and no activity level.
  const legacyPerson = {
    id: "current-user", name: "You", age: null, sex: null, dailyCalories: 2000,
    proteinTarget: 100, dietaryPreferences: ["none"], allergens: [], intolerances: [],
    isCurrentUser: true,
  };
  assert.ok(isParticipant(legacyPerson));
  assert.equal(participantKind(legacyPerson), "adult");
  assert.equal(isParticipant({ ...legacyPerson, kind: "robot" }), false);
  assert.equal(isParticipant({ ...legacyPerson, activityLevel: "sprinting" }), false);
  const disk = new MemoryStorage();
  await disk.setItem("test", JSON.stringify({
    version: 1, draft: legacyDraft, saved: legacySaved, step: "household",
    editing: false, pendingSync: false,
  }));
  const store = new PreferenceStore(disk, "test", null);
  await store.initialize();
  const state = store.getSnapshot();
  assert.equal(state.localError, null, "an old cache must not be reported as unreadable");
  assert.equal(state.draft.householdSize, 2);
  assert.equal(state.saved.id, "row-1");
});
