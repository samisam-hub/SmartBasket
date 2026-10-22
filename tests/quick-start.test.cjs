require("./register.cjs");
const { test } = require("node:test"), assert = require("node:assert/strict");
const { quickStart, sampleHousehold } = require("../services/quick-start.ts");
const { defaultDraft } = require("../types/preferences.ts");
const { isSaved, normalizedValues } = require("../services/preference-domain.ts");

/** A preference store that records what a quick start does to it. */
function store({ ready = true, saving = false, saved = null, succeeds = true } = {}) {
  const state = { ready, saving, saved, draft: { ...defaultDraft } };
  const calls = { updates: [], saves: 0 };
  return {
    calls,
    get draft() { return state.draft; },
    getSnapshot: () => ({ ready: state.ready, saving: state.saving, saved: state.saved }),
    update(patch) { calls.updates.push(patch); state.draft = { ...state.draft, ...patch }; },
    async save() {
      calls.saves += 1;
      if (!succeeds) return false;
      const now = new Date().toISOString();
      state.saved = { ...normalizedValues(state.draft), id: null, userId: null,
        onboardingCompleted: true, createdAt: now, updatedAt: now };
      return true;
    },
  };
}
const completed = () => ({ ...defaultDraft, householdSize: 3, dietaryPreferences: ["vegan"],
  id: null, userId: null, onboardingCompleted: true, createdAt: "", updatedAt: "" });

test("a quick start lands on preferences the app accepts as complete", async () => {
  const device = store();
  assert.equal(await quickStart(device), "started");
  assert.equal(device.calls.saves, 1);
  assert.ok(isSaved(device.getSnapshot().saved), "the saved values pass the app's own check");
  assert.equal(device.getSnapshot().saved.onboardingCompleted, true);
  // The sample is a household, not an empty shell: a plan can be built from it straight away.
  assert.equal(device.getSnapshot().saved.householdSize, 2);
  assert.ok(device.getSnapshot().saved.dailyCalories > 0);
  assert.ok(device.getSnapshot().saved.planningDays > 0);
});

test("opening the link again leaves an existing setup alone", async () => {
  const device = store({ saved: completed() });
  assert.equal(await quickStart(device), "ready");
  assert.deepEqual(device.calls.updates, [], "nothing is written");
  assert.equal(device.calls.saves, 0, "and nothing is saved over");
  // This is the one that matters in a shop: a half-finished week survives a second scan.
  assert.equal(device.getSnapshot().saved.householdSize, 3);
  assert.deepEqual(device.getSnapshot().saved.dietaryPreferences, ["vegan"]);
});

test("a store that is not ready yet is left to finish loading", async () => {
  const loading = store({ ready: false });
  assert.equal(await quickStart(loading), "busy");
  assert.equal(loading.calls.saves, 0);
  const writing = store({ saving: true });
  assert.equal(await quickStart(writing), "busy");
  assert.equal(writing.calls.saves, 0);
});

test("a failed save is reported instead of pretending the app is set up", async () => {
  const broken = store({ succeeds: false });
  assert.equal(await quickStart(broken), "failed");
  assert.equal(broken.getSnapshot().saved, null);
});

test("the sample only sets what a plan needs, and nothing that looks like an answer", () => {
  // Diet, allergies and budget stay at their defaults rather than claiming a preference nobody gave.
  assert.deepEqual(Object.keys(sampleHousehold).sort(), ["dailyCalories", "householdSize", "planningDays"]);
  for (const [field, value] of Object.entries(sampleHousehold))
    assert.ok(value !== undefined && value !== null, `${field} is a real value`);
});
