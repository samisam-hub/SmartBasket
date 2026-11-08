require("./register.cjs");
const { test } = require("node:test"), assert = require("node:assert/strict");
const path = require("node:path"), Module = require("node:module");
const React = require("react"), { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;

// How often the catalog was actually fetched, and whether the next fetch should fail.
let loads = 0, fail = null;
const products = [{ id: "p1", name: "Oats" }];
const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@/lib/supabase") return { getSupabaseClient: () => ({ from: () => {} }) };
  if (request === "@/services/basket/catalog")
    return { loadBasketCatalog: async () => { loads += 1; if (fail) throw Error(fail); return products; } };
  if (request.startsWith("@/")) request = path.resolve(path.dirname(require.resolve("../package.json")), request.slice(2));
  return original.call(this, request, parent, isMain);
};
const { useBasketCatalog, primeBasketCatalog, resetBasketCatalog } = require("../hooks/useBasketCatalog.ts");

/** One screen asking for the catalog. */
async function mount(seen) {
  const Screen = () => { seen.push(useBasketCatalog()); return null; };
  Screen.displayName = "Screen";
  let renderer;
  await act(async () => { renderer = create(React.createElement(Screen)); });
  return renderer;
}
const settle = async () => { await act(async () => { await new Promise((resolve) => setImmediate(resolve)); }); };

test("the catalog is fetched once for the whole app run, not once per screen", async () => {
  resetBasketCatalog();
  loads = 0;
  const first = [];
  const screen = await mount(first);
  await settle();
  assert.equal(loads, 1);
  assert.deepEqual(first.at(-1), { products, loading: false, error: null });
  await act(() => screen.unmount());

  // Choosing a meal moves on to the next slot, which mounts this hook again. That used to pay for
  // the whole catalog a second time, which is what made every decision feel slow.
  const second = [];
  const next = await mount(second);
  await settle();
  assert.equal(loads, 1, "a second screen reuses the catalog");
  assert.equal(second[0].loading, false, "and does not start out waiting for it");
  assert.equal(second[0].products, products, "it is the same array, so memoised work stays valid");
  await act(() => next.unmount());
});

test("two screens opening at once share a single fetch", async () => {
  resetBasketCatalog();
  loads = 0;
  const a = [], b = [];
  const first = await mount(a);
  const second = await mount(b);
  await settle();
  assert.equal(loads, 1);
  assert.deepEqual(a.at(-1).products, products);
  assert.deepEqual(b.at(-1).products, products);
  await act(() => { first.unmount(); second.unmount(); });
});

test("priming it on the calendar means the first meal card does not wait", async () => {
  resetBasketCatalog();
  loads = 0;
  primeBasketCatalog();
  await settle();
  assert.equal(loads, 1, "the fetch runs while days are still being picked");
  const seen = [];
  const screen = await mount(seen);
  assert.equal(seen[0].loading, false, "the slot screen starts with the catalog in hand");
  assert.deepEqual(seen[0].products, products);
  primeBasketCatalog();
  assert.equal(loads, 1, "priming again fetches nothing");
  await act(() => screen.unmount());
});

test("a failed load is not remembered, so the next screen can retry", async () => {
  resetBasketCatalog();
  loads = 0;
  fail = "Offline";
  const offline = [];
  const screen = await mount(offline);
  await settle();
  assert.equal(offline.at(-1).error, "Offline");
  assert.deepEqual(offline.at(-1).products, []);
  await act(() => screen.unmount());
  fail = null;
  const online = [];
  const retry = await mount(online);
  await settle();
  assert.equal(loads, 2, "being offline once does not disable the catalog for the app run");
  assert.deepEqual(online.at(-1).products, products);
  await act(() => retry.unmount());
});
