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
  assert.equal(listName(basket("a", "2026-10-01T00:00:00Z", { name: "   " })), "Einkaufsliste");
  assert.equal(listName(null), "Einkaufsliste");
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
  assert.deepEqual(groupedLines(lines).map((g) => g.label), ["Sonstiges"], "it lands in the catalog's own last category");
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
  assert.equal(groups.at(-1).label, "Sonstiges");
  const labels = groups.map((g) => g.label);
  assert.ok(labels.indexOf("Gemüse") < labels.indexOf("Sonstiges"));
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
  assert.match(customItemError("   "), /Schreib, was du hinzufügen willst/);
  assert.match(customItemError("x".repeat(81)), /80 Zeichen/);
  assert.equal(customItemError("Coffee"), null);
  assert.throws(() => addCustomItem([], " "), /Schreib, was du hinzufügen willst/);
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
  assert.match(text, /VON DIR ERGÄNZT/);
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
  assert.doesNotMatch(text, /VON DIR ERGÄNZT/);
});

const { fromDemoCatalogue, listEstimate } = require("../services/shopping-list.ts");
const priced = (ingredientKey, estimatedPrice, source = "catalog") =>
  ({ ingredientKey, estimatedPrice, product: { id: `p-${ingredientKey}-${source}`, source }, packageCount: 1,
    packageAmount: 100, quantityUnit: "g" });

test("a line is priced by the amount it asks for, at average supermarket prices", () => {
  const lines = shoppingLines(result({
    ingredientRequirements: [
      { ingredientKey: "chicken_breast", ingredientName: "Hähnchenbrust", requiredQuantity: 300, unit: "g" },
      { ingredientKey: "olive_oil", ingredientName: "Olivenöl", requiredQuantity: 40, unit: "ml" },
      { ingredientKey: "moon_cheese", ingredientName: "Moon cheese", requiredQuantity: 100, unit: "g" },
    ],
    items: [priced("chicken_breast", 7.2), priced("olive_oil", null)],
  }));
  // Ten euro a kilo for chicken, ten a litre for oil: the amount on the line is what is charged,
  // not whatever package the catalogue happened to pick.
  assert.deepEqual(lines.map((l) => l.estimate), [3, 0.4, null]);
  assert.deepEqual(listEstimate(lines), { total: 3.4, complete: false });
  assert.deepEqual(listEstimate(lines.slice(0, 2)), { total: 3.4, complete: true });
  assert.deepEqual(listEstimate(lines.slice(0, 2), 1), { total: 3.4, complete: false },
    "something typed by hand has no price either");
});

test("a dish knows what one portion of it costs", () => {
  const { mealCostPerServing, ingredientCost } = require("../services/pricing/ingredientCost.ts");
  assert.equal(ingredientCost("butter", 25), 0.23, "to the cent, not to the tenth of one");
  assert.equal(ingredientCost("moon_cheese", 100), null);
  const dish = { servings: 2, ingredients: [
    { ingredientKey: "chicken_breast", quantity: 300 },
    { ingredientKey: "rice", quantity: 160 },
  ] };
  // (3.00 + 0.40) for two portions.
  assert.equal(mealCostPerServing(dish), 1.7);
  assert.equal(mealCostPerServing({ servings: 1, ingredients: [{ ingredientKey: "moon_cheese", quantity: 10 }] }), null,
    "one unpriced ingredient leaves the dish without a figure rather than a wrong one");
});

test("a list built from the fictional catalogue is marked as such", () => {
  const demo = { result: { items: [priced("salt", 1, "demo")] } };
  const real = { result: { items: [priced("salt", 1)] } };
  assert.equal(fromDemoCatalogue(demo), true);
  assert.equal(fromDemoCatalogue(real), false);
  assert.equal(fromDemoCatalogue({ result: { items: [] } }), false);
});

test("every ingredient the app plans with carries a price", () => {
  const { ingredients, meals } = require("../data/meals.ts");
  const { ingredientPrices } = require("../data/ingredient-prices.ts");
  const { mealCostPerServing } = require("../services/pricing/ingredientCost.ts");
  // A new ingredient without a price would quietly leave lines and dishes unpriced.
  assert.deepEqual(Object.keys(ingredients).filter((key) => !(key in ingredientPrices)), []);
  assert.deepEqual(Object.keys(ingredientPrices).filter((key) => !(key in ingredients)), [],
    "a price for an ingredient nobody cooks with is dead weight");
  const unpriced = meals.filter((meal) => mealCostPerServing(meal) === null);
  assert.deepEqual(unpriced.map((meal) => meal.name), []);
  // Portions stay inside what a home-cooked meal plausibly costs.
  const costs = meals.map((meal) => mealCostPerServing(meal));
  assert.ok(Math.min(...costs) >= 0.15, `cheapest ${Math.min(...costs)}`);
  assert.ok(Math.max(...costs) <= 9, `dearest ${Math.max(...costs)}`);
});

test("a list says what the till will ask for, and an amount can be corrected", () => {
  const { listPurchase, withAmount } = require("../services/shopping-list.ts");
  const { packCost } = require("../services/pricing/ingredientCost.ts");
  // Nobody sells 300 g of butter: two 250 g blocks is what the shop charges for.
  assert.deepEqual(packCost("butter", 300), { packs: 2, amount: 500, cost: 4.5 });
  assert.equal(packCost("moon_cheese", 100), null);
  const lines = shoppingLines(result({ ingredientRequirements: [
    { ingredientKey: "butter", ingredientName: "Butter", requiredQuantity: 300, unit: "g" },
    { ingredientKey: "rice", ingredientName: "Reis", requiredQuantity: 260, unit: "g" },
  ] }));
  assert.deepEqual(lines.map((l) => l.purchase.cost), [4.5, 2.5]);
  assert.deepEqual(listPurchase(lines), { total: 7, complete: true });
  assert.ok(listPurchase(lines).total > listEstimate(lines).total, "packages cost more than what is cooked");
  // A corrected amount is priced again, by the kilo and by the package.
  const kilo = withAmount(lines[0], 1000);
  assert.equal(kilo.amount, 1000);
  assert.equal(kilo.estimate, 9);
  assert.deepEqual(kilo.purchase, { packs: 4, amount: 1000, cost: 9 });
});

test("a corrected amount is kept per list, and setting it back drops the correction", () => {
  const { withLineAmount, validAmount, loadLineAmounts, saveLineAmounts } = require("../services/basket/line-amounts.ts");
  assert.equal(validAmount(0), false);
  assert.equal(validAmount("500"), false);
  assert.deepEqual(withLineAmount({}, "butter", 1000, 300), { butter: 1000 });
  assert.deepEqual(withLineAmount({ butter: 1000 }, "butter", 300, 300), {}, "back to the plan is no correction");
  assert.deepEqual(withLineAmount({ butter: 1000 }, "butter", -5, 300), {}, "a nonsense amount is not stored");
  const store = new Map();
  const storage = { getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => { store.set(k, v); } };
  return saveLineAmounts(storage, "list-1", { butter: 1000, broken: Number.NaN })
    .then(() => loadLineAmounts(storage, "list-1"))
    .then((loaded) => {
      assert.deepEqual(loaded, { butter: 1000 }, "an unreadable entry drops only itself");
      return loadLineAmounts(storage, "other-list").then((empty) => assert.deepEqual(empty, {}));
    });
});
