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
// Every animation the card starts, so a test can see which way it moved and how long it took.
const animations = [];
class AnimatedValue {
  constructor(value) { this.value = value; }
  setValue(value) { this.value = value; }
  interpolate() { return this; }
}
// Animations finish at once, so a decision that waits for the card to leave still lands in one act().
const animate = (kind) => (value, config) => ({
  start: (done) => {
    animations.push({ kind, to: config.toValue, duration: config.duration });
    if (typeof config.toValue === "number") value.setValue(config.toValue);
    done?.({ finished: true });
  },
});
const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "react-native")
    return { Text: "Text", View: "View", Pressable: "Pressable",
      Animated: { View: animatedView, Value: AnimatedValue, timing: animate("timing"), spring: animate("spring") },
      Easing: { out: (easing) => easing, quad: (t) => t },
      PanResponder: { create: (config) => ({ panHandlers: config }) } };
  if (request === "expo-router") return { router: { push: (to) => pushed.push(to), replace: (to) => pushed.push(to) } };
  if (request === "./ui" || request === "@/components/ui")
    return Object.fromEntries(["PrimaryButton", "SecondaryButton", "SectionCard", "SelectionChip", "TextButton",
      "ChoiceButton", "IconButton", "FloatingButton",
      "Screen", "ScreenHeader", "ErrorMessage", "PreferenceRow"].map((name) => [name, stub(name)]));
  if (request === "./MealImage") return { MealImage: stub("MealImage") };
  if (request === "@expo/vector-icons/Feather") return { __esModule: true, default: stub("Feather") };
  if (request === "../lib/theme") return { colors: {}, spacing: {}, radii: {}, typography: {}, ui: {} };
  if (request.startsWith("@/")) request = path.resolve(path.dirname(require.resolve("../package.json")), request.slice(2));
  return original.call(this, request, parent, isMain);
};
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) =>
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
const { MealSwipeCards, swipeAction } = require("../components/MealSwipeCards.tsx");
const { WeekCalendar, dayState, mealFacts, openingDate, weekSummary } = require("../components/WeekCalendar.tsx");
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
  // The card in hand is the first suggestion; the second one lies under it, so the deck looks like
  // a deck and its picture is already loaded. It is covered, so assistive tech skips it.
  const card = () => renderer.root.findAll((node) => node.props.testID === "meal-card")[0];
  const inCard = JSON.stringify(card().findAllByType("Text").map((node) => node.props.children));
  assert.ok(inCard.includes("Meal A"));
  assert.ok(!inCard.includes("Meal B"), "the next card is not part of the card in hand");
  const behind = renderer.root.findAll((node) => node.props.accessibilityElementsHidden === true)[0];
  assert.ok(JSON.stringify(behind.findAllByType("Text").map((node) => node.props.children)).includes("Meal B"));
  assert.equal(behind.props.importantForAccessibility, "no-hide-descendants");
  const button = (label) => renderer.root.findAll((node) => node.props.label === label)[0];
  await act(() => button("Take this one").props.onPress());
  assert.deepEqual(taken, ["a"]);
  await act(() => button("Show the next one").props.onPress());
  assert.deepEqual(nexts, [1]);
  await act(() => button("Show two others").props.onPress());
  assert.deepEqual(mores, [1]);
  // The same decisions through the gesture handlers.
  const handlers = renderer.root.findAll((node) => node.props.testID === "meal-card")[0].props;
  await act(() => handlers.onPanResponderRelease({}, { dx: 200, dy: 5 }));
  assert.deepEqual(taken, ["a", "a"]);
  await act(() => handlers.onPanResponderRelease({}, { dx: -200, dy: 5 }));
  assert.deepEqual(nexts, [1, 1]);
  await act(() => handlers.onPanResponderRelease({}, { dx: 10, dy: 5 }));
  assert.deepEqual(taken, ["a", "a"], "a nudge decides nothing");
  assert.deepEqual(nexts, [1, 1]);
  await act(() => renderer.unmount());
});

test("a decision is visible: the card leaves in the direction it was decided", async () => {
  const taken = [], nexts = [];
  const suggestions = [{ meal: { id: "a", name: "Meal A", ingredients: [], dietaryTags: [] }, servings: 2 },
    { meal: { id: "b", name: "Meal B", ingredients: [], dietaryTags: [] }, servings: 2 }];
  let renderer;
  await act(() => { renderer = create(React.createElement(MealSwipeCards, { suggestions, exhausted: false,
    onTake: (s) => taken.push(s.meal.id), onNext: () => nexts.push(1), onMore: () => {} })); });
  const button = (label) => renderer.root.findAll((node) => node.props.label === label)[0];
  const handlers = renderer.root.findAll((node) => node.props.testID === "meal-card")[0].props;
  const since = (start) => animations.slice(start).filter((a) => a.kind === "timing" && a.to !== 1);

  let mark = animations.length;
  await act(() => button("Take this one").props.onPress());
  const take = since(mark);
  assert.equal(take.length, 1, "taking a meal moves the card exactly once");
  assert.ok(take[0].to > 0, "the card taken leaves to the right");
  assert.ok(take[0].duration <= 250, `a decision must not feel like waiting, was ${take[0].duration}ms`);
  assert.deepEqual(taken, ["a"], "the meal is taken once the card has left");

  mark = animations.length;
  await act(() => button("Show the next one").props.onPress());
  const next = since(mark);
  assert.equal(next.length, 1);
  assert.ok(next[0].to < 0, "a skipped card leaves to the left");
  assert.deepEqual(nexts, [1]);

  // A nudge decides nothing, so the card springs back instead of leaving.
  mark = animations.length;
  await act(() => handlers.onPanResponderRelease({}, { dx: 10, dy: 2 }));
  assert.deepEqual(since(mark), [], "an undecided card does not fly off");
  assert.deepEqual(animations.slice(mark).map((a) => [a.kind, a.to]), [["spring", 0]]);
  await act(() => renderer.unmount());
});

test("an exhausted slot says so instead of offering a repeat", async () => {
  let renderer;
  await act(() => { renderer = create(React.createElement(MealSwipeCards,
    { suggestions: [], exhausted: true, onTake: () => {}, onNext: () => {}, onMore: () => {} })); });
  const text = JSON.stringify(renderer.root.findAllByType("Text").map((node) => node.props.children));
  assert.match(text, /Every compatible meal for this slot has been shown/);
  assert.deepEqual(renderer.root.findAll((node) => node.props.label === "Take this one"), []);
  await act(() => renderer.unmount());
});

test("the calendar shows each day's state and only offers a basket once something is planned", async () => {
  let plan = startWeek(monday, preferences);
  assert.equal(dayState(plan, monday), "unplanned");
  assert.match(weekSummary(plan), /No day planned yet/);
  plan = toggleDay(plan, monday, preferences);
  assert.equal(dayState(plan, monday), "open");
  assert.match(weekSummary(plan), /1 day planned · 0 meals chosen · 3 still open/);
  for (const slot of ["breakfast", "lunch", "dinner"])
    plan = chooseMeal(plan, monday, slot, suggestion(plan, monday, slot), preferences);
  assert.equal(dayState(plan, monday), "done");
  assert.match(weekSummary(plan), /ready for a basket/);
  assert.equal(dayState(plan, "2026-10-06"), "unplanned");

  let renderer, baskets = 0, weeks = [], picked = [];
  let shown = monday;
  const render = (current) => React.createElement(WeekCalendar, { plan: current, weekStart: monday,
    selected: shown, onSelect: (date) => { picked.push(date); shown = date; },
    onWeek: (start) => weeks.push(start), onBasket: () => { baskets++; } });
  const labelled = (label) => renderer.root.findAll((node) => node.props.label === label);
  const byLabel = (prefix) => renderer.root.findAll((node) =>
    typeof node.props.accessibilityLabel === "string" && node.props.accessibilityLabel.startsWith(prefix));
  const texts = () => JSON.stringify(renderer.root.findAllByType("Text").map((node) => node.props.children));

  // An empty week offers picking days, not a basket.
  await act(() => { renderer = create(render(startWeek(monday, preferences))); });
  assert.deepEqual(labelled("Create my basket"), []);
  assert.ok(labelled("Pick your days").length > 0);
  assert.match(texts(), /Nothing is planned for this day/);

  await act(() => { renderer.update(render(plan)); });
  const basket = labelled("Create my basket")[0];
  assert.ok(basket);
  await act(() => basket.props.onPress());
  assert.equal(baskets, 1);
  // The day on screen shows its meals as cards, with what is actually recorded about them.
  assert.match(texts(), /Breakfast · \d+ kcal a portion/);
  assert.deepEqual(labelled("Plan this day"), [], "a planned day is not offered for planning again");

  // The arrows move whole weeks.
  await act(() => byLabel("Next week")[0].props.onPress());
  await act(() => byLabel("Previous week")[0].props.onPress());
  assert.deepEqual(weeks, ["2026-10-12", "2026-09-28"]);

  // Tapping a weekday switches the day shown; it does not leave the calendar.
  pushed.length = 0;
  await act(() => byLabel("Wed 7 Oct")[0].props.onPress());
  assert.deepEqual(picked, ["2026-10-07"]);
  assert.deepEqual(pushed, [], "picking a day navigates nowhere");
  await act(() => { renderer.update(render(plan)); });
  assert.match(texts(), /Nothing is planned for this day/, "an unplanned day says so and offers to plan it");
  assert.ok(labelled("Plan this day").length > 0);

  // Back on the planned day, a meal's menu opens its two answers.
  shown = monday;
  await act(() => { renderer.update(render(plan)); });
  const options = renderer.root.findAll((node) =>
    typeof node.props.label === "string" && node.props.label.startsWith("Options for"));
  assert.ok(options.length, "every card carries a menu");
  assert.deepEqual(labelled("Choose another"), [], "the menu stays closed until it is asked for");
  await act(() => options[0].props.onPress());
  assert.ok(labelled("Choose another").length > 0);
  pushed.length = 0;
  await act(() => labelled("Choose another")[0].props.onPress());
  assert.equal(pushed[0].pathname, "/plan/[date]/[slot]");
  assert.equal(pushed[0].params.date, monday);
  await act(() => renderer.unmount());
});

test("a planned day with an undecided meal offers that meal, and a week opens on a real day", async () => {
  const preferences = prefs();
  let plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  plan = chooseMeal(plan, monday, "breakfast", suggestion(plan, monday, "breakfast"), preferences);
  let renderer;
  await act(() => { renderer = create(React.createElement(WeekCalendar, { plan, weekStart: monday,
    selected: monday, onSelect: () => {}, onWeek: () => {}, onBasket: () => {} })); });
  // What is still open is a line of its own, not a silent gap.
  const open = renderer.root.findAll((node) => node.props.accessibilityLabel === "Choose Lunch");
  assert.ok(open.length);
  pushed.length = 0;
  await act(() => open[0].props.onPress());
  assert.deepEqual(pushed, [{ pathname: "/plan/[date]/[slot]", params: { date: monday, slot: "lunch" } }]);
  await act(() => renderer.unmount());

  // Today when it falls in the week, otherwise the first day that holds something.
  assert.equal(openingDate(plan, monday, "2026-10-07"), "2026-10-07", "today wins");
  assert.equal(openingDate(plan, monday, "2026-11-30"), monday, "otherwise the first planned day");
  assert.equal(openingDate(null, monday, "2026-11-30"), monday, "and failing that the Monday");
});

test("a meal card says what is recorded and never invents a cooking time", () => {
  const preferences = prefs();
  let plan = toggleDay(startWeek(monday, preferences), monday, preferences);
  plan = chooseMeal(plan, monday, "dinner", suggestion(plan, monday, "dinner"), preferences);
  const facts = mealFacts(plan.items[0]);
  assert.match(facts, /^Dinner · \d+ kcal a portion · [\d.]+ portions?$/);
  assert.doesNotMatch(facts, /min|Min/, "the curated meals carry no cooking time");
});
