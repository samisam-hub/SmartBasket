require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PreferenceStore } = require("../services/preference-store.ts");
const {
  validatePreferences,
  toggleDiet,
  normalizedValues,
} = require("../services/preference-domain.ts");
const { defaultDraft } = require("../types/preferences.ts");
class MemoryStorage {
  data = new Map();
  fail = false;
  async getItem(key) {
    return this.data.get(key) ?? null;
  }
  async setItem(key, value) {
    if (this.fail) throw new Error("disk full");
    this.data.set(key, value);
  }
}
const row = (patch = {}) => ({
  ...normalizedValues(defaultDraft),
  id: "row-1",
  userId: "user-1",
  onboardingCompleted: true,
  createdAt: "2026-09-06T00:00:00Z",
  updatedAt: "2026-09-06T00:00:00Z",
  ...patch,
});

test("domain boundaries and incompatible dietary selections", () => {
  assert.deepEqual(validatePreferences(defaultDraft), {});
  for (const dailyCalories of [null, 999, 5001, 2000.5, NaN])
    assert.ok(
      validatePreferences({ ...defaultDraft, dailyCalories }).dailyCalories,
    );
  for (const dailyCalories of [1000, 5000])
    assert.equal(
      validatePreferences({ ...defaultDraft, dailyCalories }).dailyCalories,
      undefined,
    );
  assert.ok(
    validatePreferences({
      ...defaultDraft,
      proteinMode: "manual",
      proteinTargetGrams: null,
    }).proteinTargetGrams,
  );
  assert.ok(
    validatePreferences({ ...defaultDraft, weeklyBudgetEur: 0 })
      .weeklyBudgetEur,
  );
  assert.ok(
    validatePreferences({ ...defaultDraft, weeklyBudgetEur: 70.125 })
      .weeklyBudgetEur,
  );
  assert.deepEqual(toggleDiet(["vegan", "gluten_free"], "pescatarian"), [
    "gluten_free",
    "pescatarian",
  ]);
  assert.deepEqual(toggleDiet(["vegan"], "vegan"), ["none"]);
  assert.deepEqual(toggleDiet(["vegan", "gluten_free"], "none"), ["none"]);
  assert.ok(
    validatePreferences({
      ...defaultDraft,
      dietaryPreferences: ["none", "vegan"],
    }).dietaryPreferences,
  );
  assert.ok(
    validatePreferences({
      ...defaultDraft,
      dietaryPreferences: ["vegan", "vegetarian"],
    }).dietaryPreferences,
  );
  assert.ok(
    validatePreferences({ ...defaultDraft, allergens: ["milk", "milk"] })
      .allergens,
  );
  assert.equal(
    normalizedValues({ ...defaultDraft, budgetEnabled: false }).weeklyBudgetEur,
    null,
  );
});

test("back navigation, save & exit, and process restart retain answers and current step", async () => {
  const disk = new MemoryStorage();
  const a = new PreferenceStore(disk, "test", null);
  await a.initialize();
  a.begin();
  a.update({ householdSize: 3, planningDays: 14 });
  a.goTo("goals");
  a.update({ dailyCalories: 2400, primaryGoal: "build_muscle" });
  a.goTo("household");
  assert.equal(a.getSnapshot().draft.dailyCalories, 2400);
  await a.flushDraft();
  const b = new PreferenceStore(disk, "test", null);
  await b.initialize();
  assert.equal(b.begin(), "household");
  assert.equal(b.getSnapshot().draft.dailyCalories, 2400);
  assert.equal(b.getSnapshot().draft.householdSize, 3);
});

test("incomplete numeric input survives restart and cannot be completed", async () => {
  const disk = new MemoryStorage();
  const a = new PreferenceStore(disk, "test", null);
  await a.initialize();
  a.update({ dailyCalories: null });
  await a.flushDraft();
  const b = new PreferenceStore(disk, "test", null);
  await b.initialize();
  assert.equal(b.getSnapshot().draft.dailyCalories, null);
  assert.equal(await b.save(), false);
  assert.equal(b.getSnapshot().saved, null);
});

test("local-only completion persists, edits preserve saved Home values until saved", async () => {
  const disk = new MemoryStorage();
  const a = new PreferenceStore(disk, "test", null);
  await a.initialize();
  a.update({ dailyCalories: 1700, allergens: ["milk"] });
  assert.equal(await a.save(), true);
  assert.equal(a.getSnapshot().pendingSync, true);
  assert.equal(a.getSnapshot().saved.userId, null);
  a.begin();
  a.update({ dailyCalories: 2200 });
  assert.equal(a.getSnapshot().saved.dailyCalories, 1700);
  await a.flushDraft();
  const b = new PreferenceStore(disk, "test", null);
  await b.initialize();
  assert.equal(b.getSnapshot().saved.dailyCalories, 1700);
  assert.equal(b.getSnapshot().draft.dailyCalories, 2200);
  assert.equal(await b.save(), true);
  const c = new PreferenceStore(disk, "test", null);
  await c.initialize();
  assert.equal(c.getSnapshot().saved.dailyCalories, 2200);
});

test("failed local write never reports successful completion; retry recovers", async () => {
  const disk = new MemoryStorage();
  const a = new PreferenceStore(disk, "test", null);
  await a.initialize();
  disk.fail = true;
  assert.equal(await a.save(), false);
  assert.equal(a.getSnapshot().saved, null);
  assert.ok(a.getSnapshot().localError);
  disk.fail = false;
  assert.equal(await a.save(), true);
  assert.equal(a.getSnapshot().localError, null);
});

test("remote failure remains local-only across restart and explicit retry syncs latest saved values", async () => {
  const disk = new MemoryStorage();
  let online = false;
  let remoteRow = null;
  const remote = {
    load: async () => remoteRow,
    save: async (value) => {
      if (!online) throw new Error("offline");
      remoteRow = row(value);
      remoteRow.id = "row-1";
      remoteRow.userId = "user-1";
      return remoteRow;
    },
  };
  const a = new PreferenceStore(disk, "test", remote);
  await a.initialize();
  a.update({ weeklyBudgetEur: 95 });
  assert.equal(await a.save(), true);
  assert.ok(a.getSnapshot().remoteError);
  assert.equal(a.getSnapshot().pendingSync, true);
  const b = new PreferenceStore(disk, "test", remote);
  await b.initialize();
  assert.equal(b.getSnapshot().saved.weeklyBudgetEur, 95);
  online = true;
  await b.retryRemote();
  assert.equal(b.getSnapshot().pendingSync, false);
  assert.equal(remoteRow.weeklyBudgetEur, 95);
  assert.equal(b.getSnapshot().saved.userId, "user-1");
});

test("late cloud load preserves a draft being edited", async () => {
  const disk = new MemoryStorage();
  let resolve;
  const remote = {
    load: () =>
      new Promise((r) => {
        resolve = r;
      }),
    save: async (v) => row(v),
  };
  const a = new PreferenceStore(disk, "test", remote);
  const loading = a.initialize();
  await new Promise((r) => setImmediate(r));
  a.begin("goals");
  a.update({ dailyCalories: 3000 });
  resolve(row({ dailyCalories: 1600 }));
  await loading;
  assert.equal(a.getSnapshot().draft.dailyCalories, 3000);
  assert.equal(a.getSnapshot().saved.dailyCalories, 1600);
});

test("pending local save is never overwritten by older cloud state on launch", async () => {
  const disk = new MemoryStorage();
  const a = new PreferenceStore(disk, "test", null);
  await a.initialize();
  a.update({ dailyCalories: 3000 });
  await a.save();
  const b = new PreferenceStore(disk, "test", {
    load: async () => row({ dailyCalories: 1500 }),
    save: async (v) => row(v),
  });
  await b.initialize();
  assert.equal(b.getSnapshot().saved.dailyCalories, 3000);
  assert.equal(b.getSnapshot().pendingSync, true);
});

test("corrupt local state is reported and preserved rather than overwritten", async () => {
  const disk = new MemoryStorage();
  disk.data.set("test", "{broken");
  const a = new PreferenceStore(disk, "test", null);
  await a.initialize();
  assert.ok(a.getSnapshot().localError);
  assert.equal(await a.save(), false);
  assert.equal(disk.data.get("test"), "{broken");
});
