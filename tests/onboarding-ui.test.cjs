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
  if (request === "react-native") return { Text: "Text", View: "View" };
  if (request === "./ui" && parent.filename.endsWith("HouseholdFields.tsx"))
    return Object.fromEntries(["PreferenceRow", "SecondaryButton", "SectionCard", "SelectionChip", "TextInput"]
      .map((name) => [name, stub(name)]));
  if (request === "./NumberInput" && parent.filename.endsWith("HouseholdFields.tsx"))
    return { NumberInput: stub("NumberInput") };
  if (request === "./ProfileFields" && parent.filename.endsWith("HouseholdFields.tsx"))
    return { OptionalNumber: stub("OptionalNumber") };
  if (request === "../lib/theme") return { ui: {} };
  return original.call(this, request, parent, isMain);
};
require.extensions[".tsx"] = (module, file) =>
  module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, file);
const { HouseholdFields } = require("../components/HouseholdFields.tsx");
const { estimateCalories, newParticipant } = require("../services/profile-domain.ts");

const you = {
  ...newParticipant("adult", "current-user", "You", "maintain"),
  isCurrentUser: true,
};
async function render(initial) {
  let people = initial, renderer;
  const onChange = (next) => {
    people = next;
    void act(() => renderer.update(element()));
  };
  const element = () =>
    React.createElement(HouseholdFields, { people, goal: "maintain", onChange });
  await act(() => { renderer = create(element()); });
  return { get people() { return people; }, renderer,
    rows: () => renderer.root.findAllByType("PreferenceRow"),
    press: (type, index = 0) => act(() => renderer.root.findAllByType(type)[index].props.onPress()),
    chip: (label) => renderer.root.findAllByType("SelectionChip").find((c) => c.props.label === label),
  };
}

test("one tap adds a person with a calorie suggestion, and removing them is possible", async () => {
  const view = await render([you]);
  assert.equal(view.rows().length, 1);
  assert.match(view.rows()[0].props.label, /You \(you\)/);
  assert.match(view.rows()[0].props.value, /Adult · about \d+ kcal a day/);
  // "Add a child" is the second of the two add buttons.
  await view.press("SecondaryButton", 1);
  assert.equal(view.people.length, 2);
  const child = view.people[1];
  assert.equal(child.kind, "child");
  assert.equal(child.isCurrentUser, false);
  assert.equal(child.dailyCalories, estimateCalories(child));
  assert.ok(child.dailyCalories < view.people[0].dailyCalories);
  // The editor opens on the new person, and only they can be removed.
  const remove = view.renderer.root.findAllByType("SecondaryButton")
    .find((b) => b.props.label === "Remove this person");
  assert.ok(remove);
  await act(() => remove.props.onPress());
  assert.equal(view.people.length, 1);
  assert.equal(view.people[0].id, "current-user");
});

test("activity and sex refine the suggestion; a typed amount survives further taps", async () => {
  const view = await render([you]);
  await act(() => view.rows()[0].props.onEdit());
  const before = view.people[0].dailyCalories;
  await act(() => view.chip("Active").props.onPress());
  assert.ok(view.people[0].dailyCalories > before);
  await act(() => view.chip("Female").props.onPress());
  assert.equal(view.people[0].sex, "female");
  assert.equal(view.people[0].dailyCalories, estimateCalories(view.people[0]));
  const input = () => view.renderer.root.findByType("NumberInput");
  await act(() => input().props.onChange(2345));
  assert.equal(view.people[0].dailyCalories, 2345);
  await act(() => view.chip("Mostly sitting").props.onPress());
  assert.equal(view.people[0].dailyCalories, 2345, "a typed amount is not overwritten");
  assert.match(input().props.hint, /Your own number/);
  // Clearing the field hands the suggestion back.
  await act(() => input().props.onChange(null));
  assert.equal(view.people[0].dailyCalories, estimateCalories(view.people[0]));
  assert.match(input().props.hint, /Our suggestion/);
});

test("a person saved without a kind is shown as an adult", async () => {
  const legacy = { id: "p1", name: "Alex", age: 30, sex: null, dailyCalories: 2000,
    proteinTarget: 100, dietaryPreferences: ["none"], allergens: [], intolerances: [], isCurrentUser: false };
  const view = await render([legacy]);
  assert.match(view.rows()[0].props.value, /^Adult · about 2000 kcal a day$/);
});
