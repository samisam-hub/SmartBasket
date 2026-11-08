require("./register.cjs");
const { test } = require("node:test"), assert = require("node:assert/strict");
const { loadListEdits, noEdits, saveListEdits, withLine, withoutLine } = require("../services/basket/list-edits.ts");

const store = () => {
  const map = new Map();
  return { map, getItem: async k => map.get(k) ?? null, setItem: async (k, v) => { map.set(k, v); },
    removeItem: async k => { map.delete(k); } };
};

test("a fresh list is unsaved and complete", async () => {
  const storage = store();
  assert.deepEqual(await loadListEdits(storage, "a"), noEdits);
});

test("what a household took out and saved survives a restart", async () => {
  const storage = store();
  let edits = withoutLine(noEdits, "rice");
  edits = withoutLine(edits, "olive_oil");
  edits = { ...edits, saved: true };
  await saveListEdits(storage, "a", edits);
  assert.deepEqual(await loadListEdits(storage, "a"), { saved: true, removed: ["rice", "olive_oil"] });
  // Each list keeps its own state; nothing leaks into the next one.
  assert.deepEqual(await loadListEdits(storage, "b"), noEdits);
});

test("taking the same line out twice changes nothing, and undo puts it back", () => {
  const once = withoutLine(noEdits, "rice");
  assert.deepEqual(withoutLine(once, "rice"), once);
  assert.deepEqual(withLine(once, "rice").removed, []);
  assert.deepEqual(withLine(once, "unknown").removed, ["rice"], "undoing something else leaves it out");
});

test("a broken or hostile stored value does not break the list", async () => {
  const storage = store();
  for (const raw of ["{", "null", "[]", '"saved"', '{"saved":"yes","removed":"rice"}']) {
    storage.map.set("smartbasket.list-edits.v1:a", raw);
    assert.deepEqual(await loadListEdits(storage, "a"), noEdits, raw);
  }
  // One unreadable entry costs that line's removal, not the whole state.
  storage.map.set("smartbasket.list-edits.v1:a", '{"saved":true,"removed":["rice",7,null,""]}');
  assert.deepEqual(await loadListEdits(storage, "a"), { saved: true, removed: ["rice"] });
});
