require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
const { normalizeOpenFoodFacts, normalizeAllergens } = require("../services/catalog/normalize.ts");
const { safeImageUrl } = require("../services/catalog/images.ts");
const { OpenFoodFactsProvider } = require("../services/catalog/OpenFoodFactsProvider.ts");
const { ProductRepository, PAGE_SIZE } = require("../services/catalog/ProductRepository.ts");
const { productToRow, productFromRow } = require("../services/catalog/product-row.ts");
const { emptyFilters } = require("../types/product.ts");
const { defaultDraft } = require("../types/preferences.ts");
const { productMatches, matchesPreferences, allergenConflicts, highProtein, searchExpression } = require("../services/catalog/discovery.ts");
const raw = (patch = {}) => ({ code: "1234567890123", product_name: "Plain yogurt", brands: "Test Dairy",
  nutriments: { "energy-kcal_100g": 60, proteins_100g: 5, carbohydrates_100g: 6, fat_100g: 2 }, ...patch });
const product = (patch = {}) => ({ ...normalizeOpenFoodFacts(raw()), id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  createdAt: "2026-09-06T00:00:00Z", updatedAt: "2026-09-06T00:00:00Z", ...patch });
const prefs = (patch = {}) => ({ ...defaultDraft, id: null, userId: null, onboardingCompleted: true, createdAt: "", updatedAt: "", ...patch });
test("normalization rejects malformed names/nutrition and preserves missing, zero and unknown values", () => {
  for (const p of [null, [], {}, raw({ code: 1234567890123 }), raw({ product_name: " " }), raw({ nutriments: {} }), raw({ nutriments: { "energy-kcal_100g": -2, proteins_100g: 5 } })])
    assert.equal(normalizeOpenFoodFacts(p), null);
  const p = normalizeOpenFoodFacts(raw({ nutriments: { "energy-kcal_100g": "0", proteins_100g: "0", fat_100g: "" } }));
  assert.equal(p.caloriesPer100g, 0); assert.equal(p.proteinPer100g, 0); assert.equal(p.fatPer100g, null);
  assert.equal(p.vegan, null); assert.equal(p.lactoseFree, null); assert.equal(p.glutenFree, null);
  assert.equal(p.imageUrl, null); assert.equal(p.priceEstimate, null); assert.equal(p.priceKind, "unavailable");
  assert.equal(normalizeOpenFoodFacts(raw({ code: "01234567890123" })).externalId, normalizeOpenFoodFacts(raw()).externalId);
});
test("current OFF nutrition structure respects as-sold 100ml, units and declared values", () => {
  const set = { preparation: "as_sold", source: "packaging", per: "100ml", per_quantity: 100, nutrients: {
    "energy-kj": { value: 418.4, unit: "kJ" }, proteins: { value: 8, unit: "g" },
    salt: { value: 200, unit: "mg" }, sugars: { value_computed: 20, unit: "g" },
    fiber: { value: 2, unit: "g", modifier: "<" },
  } };
  const p = normalizeOpenFoodFacts(raw({ nutrition: { input_sets: [set] } }));
  assert.equal(p.nutritionBasis, "100ml"); assert.equal(p.caloriesPer100g, 100);
  assert.equal(p.saltPer100g, 0.2); assert.equal(p.sugarsPer100g, null); assert.equal(p.fiberPer100g, null);
  for (const patch of [{ source: "estimate" }, { preparation: "prepared" }, { per: "serving" }])
    assert.equal(normalizeOpenFoodFacts(raw({ nutrition: { input_sets: [{ ...set, ...patch }] } })), null);
  const ingredients = "oats, ".repeat(200);
  assert.equal(normalizeOpenFoodFacts(raw({ ingredients_text_en: ingredients })).ingredientsText, ingredients.trim());
});
test("diet and allergen evidence is conservative, with trace risks kept separate", () => {
  const p = normalizeOpenFoodFacts(raw({ labels_tags: ["en:lactose-free", "en:vegan"], allergens_tags: ["en:milk"], traces_tags: ["en:nuts"] }));
  assert.equal(p.lactoseFree, true); assert.equal(p.vegan, null);
  assert.deepEqual(p.allergens, ["milk"]); assert.deepEqual(p.mayContainAllergens, ["tree_nuts"]);
  assert.equal(normalizeOpenFoodFacts(raw({ ingredients_analysis_tags: ["en:maybe-vegan", "en:vegetarian-status-unknown"] })).vegan, null);
  assert.equal(normalizeOpenFoodFacts(raw({ ingredients_analysis_tags: ["en:non-vegan"] })).vegan, false);
  assert.equal(normalizeOpenFoodFacts(raw({ labels_tags: ["en:gluten-free"], allergens_tags: ["en:gluten"] })).glutenFree, null);
  assert.deepEqual(normalizeAllergens(["en:crustaceans", "en:molluscs", "en:soybeans", "en:sesame-seeds"]), ["sesame", "shellfish", "soy"]);
  const selected = prefs({ allergens: ["milk", "tree_nuts"] });
  assert.equal(matchesPreferences(product(p), selected), false);
  assert.deepEqual(allergenConflicts(product(p), selected), { contains: ["milk"], traces: ["tree_nuts"] });
  assert.equal(matchesPreferences(product({ allergens: [], allergenInfoAvailable: false }), selected), false);
});
test("search and combined filters match name/brand prefixes and require positive diet evidence", () => {
  const p = product({ vegan: true, lactoseFree: true, category: "dairy-alternatives" });
  assert.equal(productMatches(p, "yog dai", { ...emptyFilters, vegan: true, category: "dairy-alternatives" }, null), true);
  assert.equal(productMatches(p, "missing", emptyFilters, null), false);
  assert.equal(productMatches(p, "", { ...emptyFilters, glutenFree: true }, null), false);
  assert.equal(highProtein(p), true); assert.equal(highProtein(product({ caloriesPer100g: 0 })), false);
  assert.equal(matchesPreferences(p, prefs({ dietaryPreferences: ["vegan", "lactose_free"] })), true);
  assert.equal(matchesPreferences(p, prefs({ dietaryPreferences: ["gluten_free"] })), false);
  assert.equal(searchExpression("O'Brien (milk), !"), "o:* & brien:* & milk:*");
});
test("provider validates malformed responses, missing products and network failures", async () => {
  const provider = response => new OpenFoodFactsProvider("SmartBasket-test", async () => response);
  assert.equal(await provider(new Response("", { status: 404 })).getByBarcode("1234567890123"), null);
  await assert.rejects(provider(new Response("{}", { status: 503 })).getByBarcode("1234567890123"), /503/);
  await assert.rejects(provider(new Response("{}")).getByBarcode("1234567890123"), /Malformed/);
  await assert.rejects(provider(new Response("not json")).getByBarcode("1234567890123"));
  await assert.rejects(new OpenFoodFactsProvider("test", async () => { throw Error("offline"); }).getByBarcode("1234567890123"), /offline/);
});
test("images support current selected-image metadata and reject unsafe URLs", () => {
  for (const value of [null, "http://example.com/a.jpg", "javascript:alert(1)", "https://user:pass@example.com/a"]) assert.equal(safeImageUrl(value), null);
  const p = normalizeOpenFoodFacts(raw({ images: { selected: { front: { en: { rev: "4", sizes: { "200": {}, "400": {} } } } } } }));
  assert.equal(p.imageThumbnailUrl, "https://images.openfoodfacts.org/images/products/123/456/789/0123/front_en.4.200.jpg");
});
test("Supabase repository requests bounded pages, server filters, detail reads and explicit fallback", async () => {
  const calls = [];
  const row = { ...productToRow(product()), id: product().id, created_at: product().createdAt, updated_at: product().updatedAt };
  const client = createClient("https://catalog.example.test", "public-test-key", { auth: { persistSession: false }, global: {
    fetch: async (url, init) => { calls.push({ url: new URL(url), init }); return new Response(JSON.stringify(Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({ ...row, id: `${i}` }))), { headers: { "content-type": "application/json" } }); },
  } });
  const repository = new ProductRepository(client, [product()]);
  const page = await repository.page("yog dai", { ...emptyFilters, vegan: true, matchesPreferences: true }, prefs({ allergens: ["milk"] }));
  assert.equal(page.products.length, PAGE_SIZE); assert.equal(page.hasMore, true); assert.equal(page.mode, "catalog");
  assert.equal(calls[0].url.searchParams.get("limit"), "25");
  assert.equal(calls[0].url.searchParams.get("search_document"), "fts(simple).yog:* & dai:*");
  assert.equal(calls[0].url.searchParams.get("vegan"), "eq.true");
  assert.equal(calls[0].url.searchParams.get("allergens"), "not.ov.{milk}");
  await repository.page("", emptyFilters, null, 1); assert.equal(calls[1].url.searchParams.get("offset"), "24");
  const offlineClient = createClient("https://catalog.example.test", "public-test-key", { auth: { persistSession: false }, global: { fetch: async () => new Response("offline", { status: 503 }) } });
  const offline = new ProductRepository(offlineClient, [product()]);
  assert.equal((await offline.page("yog", emptyFilters, null)).mode, "demo");
  await assert.rejects(offline.page("", emptyFilters, null, 1));
  assert.throws(() => productFromRow({ ...row, allergens: "bad" }), /Malformed/);
  const details = new ProductRepository(createClient("https://catalog.example.test", "public-test-key", { auth: { persistSession: false }, global: {
    fetch: async () => new Response(JSON.stringify(row), { headers: { "content-type": "application/json" } }),
  } }), []);
  assert.equal((await details.get(row.id)).name, row.name);
});
