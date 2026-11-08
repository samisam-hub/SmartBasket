const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), Module = require("node:module");
const ts = require("typescript"), React = require("react"), { create, act } = require("react-test-renderer");
require("./register.cjs");
global.IS_REACT_ACT_ENVIRONMENT = true;
const stub = (name) => {
  const Stub = (props) => React.createElement(name, props, props.children);
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "react-native") return { Text: "Text", View: "View", Pressable: "Pressable" };
  if (request === "@expo/vector-icons/Feather") return { __esModule: true, default: stub("Feather") };
  if (request === "./ProductImage") return { ProductImage: stub("ProductImage") };
  if (request === "../lib/theme")
    return { colors: {}, radii: {}, spacing: {}, typography: { body: {} }, ui: {} };
  return original.call(this, request, parent, isMain);
};
require.extensions[".tsx"] = (module, file) =>
  module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, file);
const { BasketItemRow } = require("../components/BasketItemRow.tsx");
const { keptTicks, loadTicks, saveTicks } = require("../services/basket/ticks.ts");

/** Storage that records what it was asked to keep. */
const storage = (initial = {}) => {
  const kept = { ...initial };
  return { kept, getItem: async (key) => kept[key] ?? null, setItem: async (key, value) => { kept[key] = value; } };
};
const row = (props) => React.createElement(BasketItemRow, {
  name: "Rolled oats", quantity: "2 × 500 g", price: "€2.00",
  image: { uri: null, width: null, height: null },
  ticked: false, expanded: false, onTick: () => {}, onToggle: () => {}, ...props,
}, React.createElement("Text", null, "Planned: 700 g"));

test("the tick and the line are separate targets", async () => {
  const ticks = [], toggles = [];
  let renderer;
  await act(() => { renderer = create(row({ onTick: () => ticks.push(1), onToggle: () => toggles.push(1) })); });
  const press = renderer.root.findAllByType("Pressable");
  const check = press.filter((node) => node.props.accessibilityRole === "checkbox");
  const line = press.filter((node) => node.props.accessibilityRole === "button");
  assert.equal(check.length, 1, "one checkbox");
  assert.ok(line.length, "and the rest of the line is its own button");
  // This is what was missing: the product line itself answers a tap.
  await act(() => line[0].props.onPress());
  assert.deepEqual(toggles, [1]);
  assert.deepEqual(ticks, [], "opening a product does not put it in the trolley");
  await act(() => check[0].props.onPress());
  assert.deepEqual(ticks, [1]);
  await act(() => renderer.unmount());
});

test("a line says in words whether it is in the trolley, and hides its details until asked", async () => {
  let renderer;
  await act(() => { renderer = create(row({})); });
  const texts = () => JSON.stringify(renderer.root.findAllByType("Text").map((node) => node.props.children));
  assert.match(texts(), /Rolled oats/);
  assert.match(texts(), /2 × 500 g · €2.00/);
  assert.doesNotMatch(texts(), /Planned: 700 g/, "the detail is folded away");
  const checkbox = () => renderer.root.findAll((node) => node.props.accessibilityRole === "checkbox")[0];
  assert.equal(checkbox().props.accessibilityState.checked, false);
  assert.match(checkbox().props.accessibilityLabel, /noch zu kaufen/);

  await act(() => { renderer.update(row({ ticked: true, expanded: true })); });
  assert.equal(checkbox().props.accessibilityState.checked, true);
  assert.match(checkbox().props.accessibilityLabel, /im Wagen/);
  assert.match(texts(), /Planned: 700 g/, "opening it shows what is known");
  await act(() => renderer.unmount());
});

test("a price that is not known is left out instead of shown as zero", async () => {
  let renderer;
  await act(() => { renderer = create(row({ price: null })); });
  const texts = JSON.stringify(renderer.root.findAllByType("Text").map((node) => node.props.children));
  assert.match(texts, /"2 × 500 g"/);
  assert.doesNotMatch(texts, /€/);
  await act(() => renderer.unmount());
});

test("ticks survive leaving the screen and are kept per basket", async () => {
  const device = storage();
  assert.deepEqual(await loadTicks(device, "basket-a"), []);
  await saveTicks(device, "basket-a", ["p1", "p2", "p1"]);
  assert.deepEqual(await loadTicks(device, "basket-a"), ["p1", "p2"], "a product is ticked once");
  assert.deepEqual(await loadTicks(device, "basket-b"), [], "another basket has its own trip");
});

test("unreadable ticks are dropped, never repaired into something half true", async () => {
  const broken = storage({ "smartbasket.basket-ticks.v1:basket-a": "{not json" });
  assert.deepEqual(await loadTicks(broken, "basket-a"), []);
  const wrong = storage({ "smartbasket.basket-ticks.v1:basket-a": JSON.stringify(["p1", 7]) });
  assert.deepEqual(await loadTicks(wrong, "basket-a"), []);
});

test("a tick does not outlive the product it belongs to", () => {
  // Replacing a product must not hand its tick to the one that took its place.
  assert.deepEqual(keptTicks(["p1", "p2"], ["p2", "p3"]), ["p2"]);
  assert.deepEqual(keptTicks([], ["p1"]), []);
  assert.deepEqual(keptTicks(["p1", "p1"], ["p1"]), ["p1"]);
});
