// Read-only hosted verification; uses only the public app key and creates no users.
require("./register-typescript.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");
const { ProductRepository, PAGE_SIZE } = require("../services/catalog/ProductRepository.ts");
const { emptyFilters, categories } = require("../types/product.ts");
const { defaultDraft } = require("../types/preferences.ts");
const { highProtein, allergenConflicts } = require("../services/catalog/discovery.ts");
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw Error("Configure .env for SmartBasket first");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: {
  fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }),
} });
(async () => {
  const repository = new ProductRepository(client, []);
  const first = await repository.page("", emptyFilters, null);
  assert.equal(first.mode, "catalog"); assert.equal(first.products.length, PAGE_SIZE); assert.equal(first.hasMore, true);
  const second = await repository.page("", emptyFilters, null, 1);
  assert.equal(second.mode, "catalog"); assert.ok(second.products.every(p => !first.products.some(a => a.id === p.id)));
  const p = first.products[0];
  assert.equal((await repository.get(p.id)).name, p.name);
  const sample = first.products.find(p => /^[\p{L}][\p{L}\p{N}\s]+$/u.test(p.name) && p.name.length < 80) ?? p;
  const searched = await repository.page(sample.name, emptyFilters, null);
  assert.equal(searched.mode, "catalog"); assert.ok(searched.products.some(p => p.id === sample.id));
  const brand = await repository.page(sample.brand, emptyFilters, null);
  assert.equal(brand.mode, "catalog"); assert.ok(brand.products.length > 0);
  const high = await repository.page("", { ...emptyFilters, highProtein: true }, null);
  assert.equal(high.mode, "catalog"); assert.ok(high.products.length); assert.ok(high.products.every(highProtein));
  const counts = {};
  for (const category of categories.filter(c => c !== "other")) {
    const page = await repository.page("", { ...emptyFilters, category }, null);
    assert.equal(page.mode, "catalog"); assert.ok(page.products.length); assert.ok(page.products.every(p => p.category === category));
    counts[category] = page.products.length;
  }
  for (const field of ["vegan", "vegetarian", "lactoseFree", "glutenFree"]) {
    const page = await repository.page("", { ...emptyFilters, [field]: true }, null);
    assert.equal(page.mode, "catalog"); assert.ok(page.products.every(p => p[field] === true));
  }
  const preferences = { ...defaultDraft, allergens: ["milk", "tree_nuts", "wheat"], dietaryPreferences: ["vegan"] };
  const matching = await repository.page("", { ...emptyFilters, matchesPreferences: true }, preferences);
  assert.equal(matching.mode, "catalog"); assert.ok(matching.products.every(p => p.vegan === true && p.allergenInfoAvailable &&
    !allergenConflicts(p, preferences).contains.length && !allergenConflicts(p, preferences).traces.length));
  const empty = await repository.page("zzzznotacatalogproductzzzz", emptyFilters, null);
  assert.equal(empty.mode, "catalog"); assert.equal(empty.products.length, 0);
  const summary = await client.from("products").select("id", { count: "exact", head: true });
  if (summary.error) throw summary.error;
  assert.ok(summary.count >= 500 && summary.count <= 1000);
  const imageResults = [];
  for (const p of first.products.slice(0, 3)) {
    const response = await fetch(p.imageThumbnailUrl, { method: "HEAD", signal: AbortSignal.timeout(15000) });
    imageResults.push({ id: p.id, status: response.status, type: response.headers.get("content-type") });
    assert.ok(response.ok && response.headers.get("content-type")?.startsWith("image/"));
  }
  const report = { passed: true, checkedAt: new Date().toISOString(), count: summary.count,
    checks: ["public catalog read", "non-overlapping pagination", "detail lookup", "name and brand search", "15 categories", "dietary flags", "protein filter", "personalized allergen exclusion", "empty results"], imageResults };
  fs.mkdirSync(".expo/catalog", { recursive: true });
  fs.writeFileSync(".expo/catalog/hosted-verification.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
