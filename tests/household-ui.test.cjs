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
  if (request === "./ui") return { PrimaryButton: stub("PrimaryButton") };
  if (request === "../lib/theme")
    return { colors: {}, radii: {}, spacing: {}, typography: { body: {}, h3: {} }, ui: {} };
  return original.call(this, request, parent, isMain);
};
require.extensions[".tsx"] = (module, file) =>
  module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, file);
const { HouseholdList, PersonRow, avatarTint, initials, maxHousehold } =
  require("../components/HouseholdList.tsx");
const { newParticipant } = require("../services/profile-domain.ts");
const { setLocale, resetLocale } = require("../services/i18n/index.ts");

const person = (id, name, kind = "adult") => ({ ...newParticipant(kind, id, name, "maintain") });
async function render(people, onOpen = () => {}, onAdd = () => {}) {
  let renderer;
  await act(() => { renderer = create(React.createElement(HouseholdList, { people, onOpen, onAdd })); });
  const texts = () => JSON.stringify(renderer.root.findAllByType("Text").map((n) => n.props.children));
  return { renderer, texts, add: () => renderer.root.findAllByType("PrimaryButton")[0].props };
}

test("a person is a face, a name and what they eat", async () => {
  const people = [{ ...person("current-user", "You"), isCurrentUser: true }, person("p2", "Mia Berger", "child")];
  const view = await render(people);
  const shown = view.texts();
  assert.match(shown, /You \(du\)/, "the phone's owner is marked");
  assert.match(shown, /Mia Berger/);
  assert.match(shown, /Erwachsene Person · [\d.]+ kcal pro Tag/);
  assert.match(shown, /Kind · [\d.]+ kcal pro Tag/);
  // Initials stand in until there is a picture to show.
  assert.match(shown, /"YO"/);
  assert.match(shown, /"MB"/);
  await act(() => view.renderer.unmount());
});

test("initials cope with one name, several names and none at all", () => {
  assert.equal(initials("You"), "YO");
  assert.equal(initials("Mia Berger"), "MB");
  assert.equal(initials("Anna Maria Berger"), "AB");
  assert.equal(initials("  "), "?");
  assert.equal(initials(""), "?");
});

test("a face keeps its colour between visits", () => {
  assert.equal(avatarTint("p2"), avatarTint("p2"));
  assert.equal(typeof avatarTint("current-user"), typeof avatarTint("p9"));
});

test("a person saved before kinds existed is shown as an adult", async () => {
  const legacy = { id: "p1", name: "Alex", age: 30, sex: null, dailyCalories: 2000, proteinTarget: 100,
    dietaryPreferences: ["none"], allergens: [], intolerances: [], isCurrentUser: false };
  let renderer;
  await act(() => { renderer = create(React.createElement(PersonRow, { person: legacy, onPress: () => {} })); });
  const shown = JSON.stringify(renderer.root.findAllByType("Text").map((n) => n.props.children));
  assert.match(shown, /Erwachsene Person · 2.000 kcal pro Tag/);
  await act(() => renderer.unmount());
});

test("tapping a person opens them; an empty household says what the list is for", async () => {
  const opened = [];
  const view = await render([person("p1", "Alex")], (id) => opened.push(id));
  await act(() => view.renderer.root.findAllByType("Pressable")[0].props.onPress());
  assert.deepEqual(opened, ["p1"]);
  await act(() => view.renderer.unmount());

  const empty = await render([]);
  assert.match(empty.texts(), /Noch niemand da/);
  assert.equal(empty.add().disabled, false, "an empty household can still be added to");
  await act(() => empty.renderer.unmount());
});

test("a plan holds ten people, and the button says so instead of failing on the eleventh", async () => {
  const full = Array.from({ length: maxHousehold }, (_, index) => person(`p${index}`, `Person ${index}`));
  const view = await render(full);
  assert.equal(view.add().disabled, true);
  assert.match(view.texts(), new RegExp(`bis zu ${maxHousehold} Personen`));
  await act(() => view.renderer.unmount());

  const room = await render(full.slice(1));
  assert.equal(room.add().disabled, false);
  await act(() => room.renderer.unmount());
});

test("the same list reads in English when the locale says so", async () => {
  await setLocale("en");
  try {
    const view = await render([{ ...person("current-user", "You"), isCurrentUser: true }]);
    const shown = view.texts();
    assert.match(shown, /You \(you\)/);
    assert.match(shown, /Adult · [\d,]+ kcal a day/, "numbers follow the locale too");
    assert.equal(view.add().label, "Add person");
    await act(() => view.renderer.unmount());
  } finally { resetLocale(); }
});
