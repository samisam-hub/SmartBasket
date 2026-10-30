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
  if (request === "react-native") return { Text: "Text", View: "Ansehen" };
  if (request === "./ui" && parent.filename.endsWith("HouseholdFields.tsx"))
    return Object.fromEntries(["IconButton", "SecondaryButton", "SectionCard", "SelectionChip", "TextInput"]
      .map((name) => [name, stub(name)]));
  // The list has its own test; here it only has to report what it was handed.
  if (request === "./HouseholdList" && parent.filename.endsWith("HouseholdFields.tsx"))
    return { HouseholdList: stub("HouseholdList"), maxHousehold: 10,
      kindLabels: { adult: "Adult", child: "Child" } };
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
  ...newParticipant("adult", "current-user", "Du", "maintain"),
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
  const list = () => renderer.root.findAllByType("HouseholdList")[0].props;
  return { get people() { return people; }, renderer, list,
    shown: () => list().people,
    open: (id) => act(() => list().onOpen(id)),
    add: () => act(() => list().onAdd()),
    chip: (label) => renderer.root.findAllByType("SelectionChip").find((c) => c.props.label === label),
  };
}

test("one tap adds a person with a calorie suggestion, and removing them is possible", async () => {
  const view = await render([you]);
  assert.equal(view.shown().length, 1);
  assert.equal(view.shown()[0].name, "Du");
  // One way to add. The person starts as an adult and their editor opens straight away.
  await view.add();
  assert.equal(view.people.length, 2);
  assert.equal(view.people[1].kind, "adult");
  assert.equal(view.people[1].isCurrentUser, false);
  // Adult or child is the first choice in that editor, so a child is one tap further.
  await act(() => view.chip("Child").props.onPress());
  const child = view.people[1];
  assert.equal(child.kind, "child");
  assert.equal(child.dailyCalories, estimateCalories(child));
  assert.ok(child.dailyCalories < view.people[0].dailyCalories);
  // The editor opens on the new person, and only they can be removed.
  const remove = view.renderer.root.findAllByType("SecondaryButton")
    .find((b) => b.props.label === "Diese Person entfernen");
  assert.ok(remove);
  await act(() => remove.props.onPress());
  assert.equal(view.people.length, 1);
  assert.equal(view.people[0].id, "current-user");
});

test("activity and sex refine the suggestion; a typed amount survives further taps", async () => {
  const view = await render([you]);
  await view.open("current-user");
  const before = view.people[0].dailyCalories;
  await act(() => view.chip("Aktiv").props.onPress());
  assert.ok(view.people[0].dailyCalories > before);
  await act(() => view.chip("Weiblich").props.onPress());
  assert.equal(view.people[0].sex, "female");
  assert.equal(view.people[0].dailyCalories, estimateCalories(view.people[0]));
  const input = () => view.renderer.root.findByType("NumberInput");
  await act(() => input().props.onChange(2345));
  assert.equal(view.people[0].dailyCalories, 2345);
  await act(() => view.chip("Überwiegend sitzend").props.onPress());
  assert.equal(view.people[0].dailyCalories, 2345, "a typed amount is not overwritten");
  assert.match(input().props.hint, /Dein eigener Wert/);
  // Clearing the field hands the suggestion back.
  await act(() => input().props.onChange(null));
  assert.equal(view.people[0].dailyCalories, estimateCalories(view.people[0]));
  assert.match(input().props.hint, /Unser Vorschlag/);
});

test("a heading and its add button appear only where the screen has no header of its own", async () => {
  let renderer;
  const element = (props) => React.createElement(HouseholdFields,
    { people: [you], goal: "maintain", onChange: () => {}, ...props });
  await act(() => { renderer = create(element()); });
  assert.deepEqual(renderer.root.findAllByType("IconButton"), [], "onboarding brings its own header");
  await act(() => { renderer.update(element({ title: "Haushalt" })); });
  const add = renderer.root.findAllByType("IconButton")[0];
  assert.equal(add.props.label, "Person hinzufügen");
  assert.equal(add.props.icon, "plus");
  await act(() => renderer.unmount());
});
