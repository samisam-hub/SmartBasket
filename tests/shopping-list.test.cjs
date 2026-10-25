require("./register.cjs");
const { test } = require("node:test"), assert = require("node:assert/strict");
const { listName, openingList } = require("../services/shopping-list.ts");

const basket = (id, createdAt, { purchased = false, name = `${id} list` } = {}) => ({
  id, name, createdAt, ownerId: null, cloudId: null, syncStatus: "local",
  preferences: {}, result: { items: [], purchasedAt: purchased ? "2026-10-20T10:00:00Z" : undefined },
});

test("the tab opens on the list still being shopped", () => {
  const older = basket("a", "2026-10-01T00:00:00Z");
  const newer = basket("b", "2026-10-20T00:00:00Z");
  // Someone standing in a shop wants the list they are holding, not the newest one.
  assert.equal(openingList([older, newer], older).id, "a");
  assert.equal(openingList([older, newer], null).id, "b", "without one in hand, the newest");
});

test("a bought list is a receipt, not a list", () => {
  const bought = basket("a", "2026-10-20T00:00:00Z", { purchased: true });
  const open = basket("b", "2026-10-01T00:00:00Z");
  assert.equal(openingList([bought, open], null).id, "b", "the open one wins even though it is older");
  assert.equal(openingList([bought, open], bought).id, "b", "and a bought one is not kept in hand");
  // Unless there is nothing else: then the receipt is better than an empty tab.
  assert.equal(openingList([bought], null).id, "a");
});

test("a remembered list that was deleted is not shown", () => {
  const gone = basket("gone", "2026-10-20T00:00:00Z");
  const kept = basket("kept", "2026-10-01T00:00:00Z");
  assert.equal(openingList([kept], gone).id, "kept");
  assert.equal(openingList([], gone), null);
});

test("nothing saved means nothing to open", () => {
  assert.equal(openingList([], null), null);
  assert.equal(openingList([{ id: "broken" }], null), null, "a row without a date is not a list");
});

test("a list carries the name of its basket, never a second one", () => {
  assert.equal(listName(basket("a", "2026-10-01T00:00:00Z", { name: "7-day basket" })), "7-day basket");
  assert.equal(listName(basket("a", "2026-10-01T00:00:00Z", { name: "   " })), "Shopping list");
  assert.equal(listName(null), "Shopping list");
});

const { groupedLines, shoppingLines } = require("../services/shopping-list.ts");
const result = (extra) => ({ items: [], ...extra });

test("the list is what the plan needs, as ingredients rather than packages", () => {
  const lines = shoppingLines(result({ ingredientRequirements: [
    { ingredientKey: "cherry_tomatoes", ingredientName: "Cherry tomatoes", requiredQuantity: 500, unit: "g" },
    { ingredientKey: "olive_oil", ingredientName: "Olive oil", requiredQuantity: 40, unit: "ml" },
  ] }));
  assert.deepEqual(lines.map((l) => [l.name, l.amount, l.unit]),
    [["Cherry tomatoes", 500, "g"], ["Olive oil", 40, "ml"]]);
  assert.equal(lines[0].category, "vegetables", "a known ingredient knows its aisle");
});

test("an ingredient the catalog does not know still reaches the list", () => {
  const lines = shoppingLines(result({ ingredientRequirements: [
    { ingredientKey: "moon_cheese", ingredientName: "Moon cheese", requiredQuantity: 100, unit: "g" },
  ] }));
  assert.equal(lines.length, 1, "nothing is dropped for being unrecognised");
  assert.equal(lines[0].category, "other");
  assert.deepEqual(groupedLines(lines).map((g) => g.label), ["Other"], "it lands in the catalog's own last category");
});

test("a quantity that is zero or broken is not a line to shop for", () => {
  const lines = shoppingLines(result({ ingredientRequirements: [
    { ingredientKey: "a", ingredientName: "Zero", requiredQuantity: 0, unit: "g" },
    { ingredientKey: "b", ingredientName: "Broken", requiredQuantity: NaN, unit: "g" },
    { ingredientKey: "olive_oil", ingredientName: "Olive oil", requiredQuantity: 10, unit: "ml" },
  ] }));
  assert.deepEqual(lines.map((l) => l.name), ["Olive oil"]);
});

test("a basket from the older engine still produces a list", () => {
  // Those carry no aggregated requirements; the packages they were built from are the next best truth.
  const lines = shoppingLines(result({ items: [
    { product: { id: "p1", name: "Tinned tomatoes", category: "vegetables" },
      ingredientKey: "chopped_tomatoes", packageCount: 2, packageAmount: 400,
      purchasedQuantity: 800, quantityUnit: "g" },
  ] }));
  assert.deepEqual(lines.map((l) => [l.name, l.amount, l.unit]), [["Tinned tomatoes", 800, "g"]]);
});

test("groups follow the order a shop is walked, and the unknown comes last", () => {
  const groups = groupedLines(shoppingLines(result({ ingredientRequirements: [
    { ingredientKey: "moon_cheese", ingredientName: "Moon cheese", requiredQuantity: 100, unit: "g" },
    { ingredientKey: "olive_oil", ingredientName: "Olive oil", requiredQuantity: 40, unit: "ml" },
    { ingredientKey: "cherry_tomatoes", ingredientName: "Cherry tomatoes", requiredQuantity: 500, unit: "g" },
  ] })));
  assert.equal(groups.at(-1).label, "Other");
  const labels = groups.map((g) => g.label);
  assert.ok(labels.indexOf("Vegetables") < labels.indexOf("Other"));
  assert.equal(new Set(labels).size, labels.length, "no category appears twice");
  assert.equal(groups.reduce((n, g) => n + g.lines.length, 0), 3, "every line lands in exactly one group");
});

const { shoppingListText } = require("../services/shopping-list.ts");
const { addCustomItem, customItemError, loadCustomItems, removeCustomItem,
  saveCustomItems } = require("../services/basket/custom-items.ts");
const device = (initial = {}) => {
  const kept = { ...initial };
  return { kept, getItem: async (k) => kept[k] ?? null, setItem: async (k, v) => { kept[k] = v; } };
};

test("own entries are added where they were typed and can be taken off again", () => {
  let items = addCustomItem([], "  Kitchen roll  ", " 2 packs ");
  assert.equal(items[0].name, "Kitchen roll");
  assert.equal(items[0].note, "2 packs");
  items = addCustomItem(items, "Coffee");
  assert.deepEqual(items.map((i) => i.name), ["Kitchen roll", "Coffee"], "the order the list was built in");
  assert.equal(items[1].note, null, "no amount is not an empty amount");
  assert.deepEqual(removeCustomItem(items, items[0].id).map((i) => i.name), ["Coffee"]);
});

test("an entry has to say something", () => {
  assert.match(customItemError("   "), /Type what you want/);
  assert.match(customItemError("x".repeat(81)), /80 characters/);
  assert.equal(customItemError("Coffee"), null);
  assert.throws(() => addCustomItem([], " "), /Type what you want/);
});

test("own entries survive leaving the screen, per list, and a broken file is dropped", async () => {
  const storage = device();
  await saveCustomItems(storage, "list-a", addCustomItem([], "Coffee"));
  assert.deepEqual((await loadCustomItems(storage, "list-a")).map((i) => i.name), ["Coffee"]);
  assert.deepEqual(await loadCustomItems(storage, "list-b"), [], "another list has its own additions");
  const broken = device({ "smartbasket.list-extras.v1:list-a": "{not json" });
  assert.deepEqual(await loadCustomItems(broken, "list-a"), []);
  const wrong = device({ "smartbasket.list-extras.v1:list-a": JSON.stringify([{ id: "x" }]) });
  assert.deepEqual(await loadCustomItems(wrong, "list-a"), [], "a half-written entry is not restored");
});

test("sharing sends one list: generated lines and own entries together", () => {
  const groups = groupedLines(shoppingLines(result({ ingredientRequirements: [
    { ingredientKey: "cherry_tomatoes", ingredientName: "Cherry tomatoes", requiredQuantity: 500, unit: "g" },
    { ingredientKey: "olive_oil", ingredientName: "Olive oil", requiredQuantity: 40, unit: "ml" },
  ] })));
  const extras = addCustomItem([], "Kitchen roll", "2 packs");
  const text = shoppingListText({ name: "7-day basket", groups, extras,
    ticked: ["cherry_tomatoes"], system: "metric" });
  assert.match(text, /^7-day basket/);
  assert.match(text, /\[x\] Cherry tomatoes — 500 g/, "what is in the trolley is marked, not dropped");
  assert.match(text, /\[ \] Olive oil — 40 ml/);
  assert.match(text, /ADDED BY YOU/);
  assert.match(text, /\[ \] Kitchen roll — 2 packs/, "own entries travel with the list, not separately");
});

test("sharing writes the units the household chose", () => {
  const groups = groupedLines(shoppingLines(result({ ingredientRequirements: [
    { ingredientKey: "cherry_tomatoes", ingredientName: "Cherry tomatoes", requiredQuantity: 500, unit: "g" },
  ] })));
  const us = shoppingListText({ name: "List", groups, extras: [], ticked: [], system: "us" });
  assert.match(us, /1\.1 lb/);
  assert.doesNotMatch(us, / 500 g/);
});

test("a list with nothing added has no empty section", () => {
  const groups = groupedLines(shoppingLines(result({ ingredientRequirements: [
    { ingredientKey: "olive_oil", ingredientName: "Olive oil", requiredQuantity: 40, unit: "ml" },
  ] })));
  const text = shoppingListText({ name: "List", groups, extras: [], ticked: [], system: "metric" });
  assert.doesNotMatch(text, /ADDED BY YOU/);
});
