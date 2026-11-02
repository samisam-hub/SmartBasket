const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const ts = require("typescript"), React = require("react"), { create, act } = require("react-test-renderer");
require("./register.cjs");
global.IS_REACT_ACT_ENVIRONMENT = true;
const stub = (name) => {
  const Stub = (props) => React.createElement(name, props, props.children);
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
const pushed = [];
const animatedView = stub("Animated.View");
const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "react-native")
    return { Text: "Text", View: "Ansehen", Pressable: "Pressable",
      Animated: { View: animatedView, Value: class { constructor(v) { this.value = v; } setValue(v) { this.value = v; } } },
      PanResponder: { create: (config) => ({ panHandlers: config }) } };
  if (request === "expo-router") return { router: { push: (to) => pushed.push(to), replace: (to) => pushed.push(to) } };
  if (request === "./ui" || request === "@/components/ui")
    return Object.fromEntries(["PrimaryButton", "SecondaryButton", "SectionCard", "SelectionChip", "TextButton",
      "Screen", "ScreenHeader", "ErrorMessage", "PreferenceRow"].map((name) => [name, stub(name)]));
  if (request === "./MealImage") return { MealImage: stub("MealImage") };
  if (request === "../lib/theme") return { colors: {}, spacing: {}, ui: {} };
  if (request.startsWith("@/")) request = path.resolve(path.dirname(require.resolve("../package.json")), request.slice(2));
  return original.call(this, request, parent, isMain);
};
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) =>
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
const { MealSwipeCards, swipeAction } = require("../components/MealSwipeCards.tsx");
const { WeekCalendar, dayState, weekSummary } = require("../components/WeekCalendar.tsx");
const { startWeek, toggleDay, chooseMeal } = require("../services/meals/weekPlanDraft.ts");
const { suggestMeals } = require("../services/meals/planner.ts");
const { prefs } = require("./basket-fixtures.cjs");
const { fullCatalog } = require("./meal-fixtures.cjs");

const monday = "2026-10-05";
const preferences = prefs({ householdSize: 2 });
const suggestion = (plan, date, slot) => suggestMeals(plan, date, slot, preferences, fullCatalog)[0];

test("a swipe only counts when it is clearly sideways and far enough", () => {
  // Right takes the card, left shows the next one, anything small or vertical does nothing.
  assert.equal(swipeAction(120, 10, 320), "take");
  assert.equal(swipeAction(-120, 10, 320), "next");
  assert.equal(swipeAction(20, 2, 320), "none", "a nudge is not a decision");
  assert.equal(swipeAction(120, 200, 320), "none", "a scroll is not a swipe");
  assert.equal(swipeAction(70, 0, 0), "take", "a minimum distance applies before layout is known");
  assert.equal(swipeAction(40, 0, 0), "none");
});

test("one card at a time: right takes it, left moves on, and tapping does the same", async () => {
  const taken = [], nexts = [], mores = [];
  const suggestions = [{ meal: { id: "a", name: "Meal A", ingredients: [], dietaryTags: [] }, servings: 2 },
    { meal: { id: "b", name: "Meal B", ingredients: [], dietaryTags: [] }, servings: 2 }];
  let renderer;
  const element = () => React.createElement(MealSwipeCards, { suggestions, exhausted: false,
    onTake: (s) => taken.push(s.meal.id), onNext: () => nexts.push(1), onMore: () => mores.push(1) });
  await act(() => { renderer = create(element()); });
  // Only the first card is on screen.
  const texts = renderer.root.findAllByType("Text").map((node) => node.props.children);
  assert.ok(JSON.stringify(texts).includes("Meal A"));
  assert.ok(!JSON.stringify(texts).includes("Meal B"));
  const button = (label) => renderer.root.findAll((node) => node.props.label === label)[0];
  await act(() => button("Dieses Gericht wählen").props.onPress());
  assert.deepEqual(taken, ["a"]);
  await act(() => button("Nächsten Vorschlag zeigen").props.onPress());
  assert.deepEqual(nexts, [1]);
  await act(() => button("Zwei andere zeigen").props.onPress());
  assert.deepEqual(mores, [1]);
  // The same decisions through the gesture handlers.
  const handlers = renderer.root.findByType(animatedView).props;
  await act(() => handlers.onPanResponderRelease({}, { dx: 200, dy: 5 }));
  assert.deepEqual(taken, ["a", "a"]);
  await act(() => handlers.onPanResponderRelease({}, { dx: -200, dy: 5 }));
  assert.deepEqual(nexts, [1, 1]);
  await act(() => handlers.onPanResponderRelease({}, { dx: 10, dy: 5 }));
  assert.deepEqual(taken, ["a", "a"], "a nudge decides nothing");
  assert.deepEqual(nexts, [1, 1]);
  await act(() => renderer.unmount());
});

test("an exhausted slot says so instead of offering a repeat", async () => {
  let renderer;
  await act(() => { renderer = create(React.createElement(MealSwipeCards,
    { suggestions: [], exhausted: true, onTake: () => {}, onNext: () => {}, onMore: () => {} })); });
  const text = JSON.stringify(renderer.root.findAllByType("Text").map((node) => node.props.children));
  assert.match(text, /Alle passenden Gerichte für diese Mahlzeit wurden angezeigt/);
  assert.deepEqual(renderer.root.findAll((node) => node.props.label === "Dieses Gericht wählen"), []);
  await act(() => renderer.unmount());
});

test("the calendar shows each day's state and only offers a basket once something is planned", async () => {
  let plan = startWeek(monday, preferences);
  assert.equal(dayState(plan, monday), "unplanned");
  assert.match(weekSummary(plan), /Noch keine Mahlzeiten geplant/);
  plan = toggleDay(plan, monday, preferences);
  assert.equal(dayState(plan, monday), "open");
  assert.match(weekSummary(plan), /1 Tag geplant · 0 Mahlzeiten ausgewählt · 3 noch offen/);
  for (const slot of ["breakfast", "lunch", "dinner"])
    plan = chooseMeal(plan, monday, slot, suggestion(plan, monday, slot), preferences);
  assert.equal(dayState(plan, monday), "done");
  assert.match(weekSummary(plan), /bereit für den Warenkorb/);
  assert.equal(dayState(plan, "2026-10-06"), "unplanned");
  let renderer, baskets = 0, weeks = [];
  const render = (current) => React.createElement(WeekCalendar, { plan: current, weekStart: monday,
    onWeek: (start) => weeks.push(start), onBasket: () => { baskets++; } });
  // An empty week offers picking days, not a basket.
  await act(() => { renderer = create(render(startWeek(monday, preferences))); });
  // findAll matches the stub component and the host element it renders, so count unique labels.
  const labelled = (label) => renderer.root.findAll((node) => node.props.label === label);
  assert.deepEqual(labelled("Warenkorb erstellen"), []);
  assert.ok(labelled("Mahlzeiten planen").length > 0);
  await act(() => { renderer.update(render(plan)); });
  const basket = labelled("Warenkorb erstellen")[0];
  assert.ok(basket);
  await act(() => basket.props.onPress());
  assert.equal(baskets, 1);
  // The arrows move whole weeks.
  await act(() => renderer.root.findAll((node) => node.props.accessibilityLabel === "Nächste Woche")[0].props.onPress());
  await act(() => renderer.root.findAll((node) => node.props.accessibilityLabel === "Vorherige Woche")[0].props.onPress());
  assert.deepEqual(weeks, ["2026-10-12", "2026-09-28"]);
  // A planned day opens that day; an unplanned one goes to the day picker.
  pushed.length = 0;
  const days = renderer.root.findAll((node) => typeof node.props.accessibilityLabel === "string" && node.props.accessibilityLabel.startsWith("Mo., 5. Okt."));
  await act(() => days[0].props.onPress());
  assert.deepEqual(pushed, [{ pathname: "/plan/[date]", params: { date: monday } }]);
  pushed.length = 0;
  const wednesday = renderer.root.findAll((node) => typeof node.props.accessibilityLabel === "string" && node.props.accessibilityLabel.startsWith("Mi., 7. Okt."));
  await act(() => wednesday[0].props.onPress());
  assert.deepEqual(pushed, ["/plan/week"]);
  await act(() => renderer.unmount());
});

test('an empty calendar offers copying the previous week when one exists', async () => {
  let copied = 0, renderer;
  await act(() => { renderer = create(React.createElement(WeekCalendar, {
    plan: startWeek('2026-10-12', preferences), weekStart: '2026-10-12',
    onWeek: () => {}, onBasket: () => {}, onCopyPrevious: () => { copied++; },
  })); });
  const copy = renderer.root.findAll(node => node.props.label === "Plan der Vorwoche übernehmen")[0];
  assert.ok(copy);
  const labels = renderer.root.findAll(node => typeof node.type === 'string' && node.props.label).map(node => node.props.label);
  assert.ok(labels.indexOf("Mahlzeiten planen") < labels.indexOf("Plan der Vorwoche übernehmen"));
  pushed.length = 0;
  await act(() => renderer.root.findAll(node => node.props.label === "Mahlzeiten planen")[0].props.onPress());
  assert.deepEqual(pushed, ['/plan/week']);
  await act(() => copy.props.onPress());
  assert.equal(copied, 1);
  await act(() => renderer.unmount());
});

test('the last taste card can still be rejected by button or swipe and never offers shuffle', async () => {
  let liked = 0, disliked = 0, screen;
  const plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  await act(() => { screen = create(React.createElement(MealSwipeCards, { mode: 'taste', suggestions: [suggestion(plan, monday, 'breakfast')],
    exhausted: false, onTake: () => liked++, onNext: () => disliked++, onMore: () => assert.fail('taste cannot shuffle') })); });
  const no = screen.root.findAllByType('SecondaryButton').find(n => n.props.label === 'Mögen wir nicht');
  assert.equal(no.props.disabled, false);
  await act(() => no.props.onPress());
  await act(() => screen.root.findByType('Animated.View').props.onPanResponderRelease({}, { dx: -120, dy: 0 }));
  await act(() => screen.root.findByType('PrimaryButton').props.onPress());
  assert.equal(disliked, 2); assert.equal(liked, 1);
  assert.equal(screen.root.findAllByType('TextButton').length, 0);
  await act(() => screen.unmount());
});
