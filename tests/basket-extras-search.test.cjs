require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  addableProducts, addableToBasket, stapleIngredientKeys, stapleSuggestions,
} = require("../services/basket/extras.ts");
const { addBasketProduct } = require("../services/basket/add-product.ts");
const { generateBasket } = require("../services/basket/basketGenerator.ts");
const { prefs, product, catalog } = require("./basket-fixtures.cjs");
const { fullCatalog } = require("./meal-fixtures.cjs");

const preferences = prefs();
const basket = () => generateBasket(preferences, catalog);

test("only products a basket can actually take are offered", () => {
  assert.equal(addableToBasket(product(1, { name: "Rice" })), true);
  for (const broken of [{ source: "demo" }, { packageSize: null }, { packageSize: 0 },
    { packageUnit: "piece" }, { packageUnit: null }])
    assert.equal(addableToBasket(product(1, broken)), false, JSON.stringify(broken));
  // Everything offered survives the add, so no suggestion fails on the tap.
  const result = basket();
  for (const candidate of addableProducts(fullCatalog, "rice"))
    assert.doesNotThrow(() => addBasketProduct(result, candidate));
});

test("search needs something to go on and matches name and brand", () => {
  const products = [
    product(1, { name: "Brown rice", brand: "Mill Co" }),
    product(2, { name: "Rice cakes", brand: "Snacky" }),
    product(3, { name: "Oat flakes", brand: "Ricefield Farm" }),
    product(4, { name: "Rice pudding", source: "demo" }),
    product(5, { name: "Rice flour", packageSize: null }),
  ];
  assert.deepEqual(addableProducts(products, ""), [], "a blank query offers nothing");
  assert.deepEqual(addableProducts(products, "r"), [], "one letter is not a search");
  const found = addableProducts(products, "rice").map((p) => p.name);
  assert.deepEqual(found, ["Brown rice", "Rice cakes", "Oat flakes"]);
  assert.ok(!found.includes("Rice pudding"), "demo products never enter a real basket");
  assert.ok(!found.includes("Rice flour"), "a product without a package size cannot be added");
  assert.equal(addableProducts(Array.from({ length: 30 }, (_, i) => product(i + 10, { name: `Rice ${i}` })), "rice").length, 6);
});

test("the always-with-me list is fixed, safe and never repeats what is already in the basket", () => {
  const result = basket();
  const staples = stapleSuggestions(fullCatalog, preferences, result);
  assert.ok(staples.length > 0);
  assert.ok(staples.every((staple) => stapleIngredientKeys.includes(staple.key)));
  assert.ok(staples.every((staple) => addableToBasket(staple.product)));
  // Nothing already in the basket is suggested again.
  const withStaple = addBasketProduct(result, staples[0].product);
  assert.ok(!stapleSuggestions(fullCatalog, preferences, withStaple).some((s) => s.product.id === staples[0].product.id));
  // The list goes through the same safety rules as a planned ingredient: a milk allergy
  // leaves no dairy staple in it.
  const allergic = prefs({ allergens: ["milk", "eggs"] });
  for (const staple of stapleSuggestions(fullCatalog, allergic, result))
    assert.ok(!["milk", "eggs"].some((allergen) => staple.product.allergens.includes(allergen)),
      `${staple.product.name} must not be suggested with that allergy`);
  // An extra is shopping only: no portions, no nutrition, and it is marked as an extra.
  const added = withStaple.items.find((item) => item.product.id === staples[0].product.id);
  assert.equal(added.isExtra, true);
  assert.equal(added.plannedConsumptionQuantity, 0);
  assert.equal(added.totalCalories, 0);
  assert.equal(added.ingredientKey, `extra:${staples[0].product.id}`);
});
