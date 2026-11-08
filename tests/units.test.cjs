require("./register.cjs");
const { test } = require("node:test"), assert = require("node:assert/strict");
const { formatQuantity, isUnitSystem, unitSystemOf, unitSystems } = require("../services/units.ts");
const { isDraft, isSaved } = require("../services/preference-domain.ts");
const { defaultDraft } = require("../types/preferences.ts");

const metric = (amount, unit) => formatQuantity({ amount, unit }, "metric");
const us = (amount, unit) => formatQuantity({ amount, unit }, "us");

test("metric shows what the recipe holds, rounded to whole units", () => {
  assert.equal(metric(500, "g"), "500 g");
  assert.equal(metric(499.6, "g"), "500 g");
  assert.equal(metric(250, "ml"), "250 ml");
});

test("mass converts on the exact avoirdupois definitions", () => {
  // 1 oz = 28.349523125 g, 1 lb = 453.59237 g — both exact, not approximations.
  assert.equal(us(28.349523125, "g"), "1 oz");
  assert.equal(us(453.59237, "g"), "1 lb");
  assert.equal(us(907.18474, "g"), "2 lb");
  assert.equal(us(100, "g"), "3.5 oz");
  // The pound is where a shopper stops counting ounces.
  assert.match(us(450, "g"), /oz$/);
  assert.match(us(460, "g"), /lb$/);
});

test("fluid volume converts exactly too, and cups are only used for liquids", () => {
  assert.equal(us(29.5735295625, "ml"), "1 fl oz");
  assert.equal(us(236.5882365, "ml"), "8 fl oz", "a cup still reads as fluid ounces below a pint");
  assert.equal(us(473.176473, "ml"), "2 cups", "one US pint");
  assert.equal(us(1000, "ml"), "4.2 cups");
});

test("a quantity that is not a number says so instead of printing nonsense", () => {
  for (const broken of [NaN, Infinity, -5])
    for (const system of unitSystems)
      assert.match(formatQuantity({ amount: broken, unit: "g" }, system), /^— g$/);
});

test("anything saved before the question existed reads as metric", () => {
  assert.equal(unitSystemOf(undefined), "metric");
  assert.equal(unitSystemOf(null), "metric");
  assert.equal(unitSystemOf({}), "metric");
  assert.equal(unitSystemOf({ unitSystem: "us" }), "us");
  // A stored value nobody can honour is not quietly treated as a choice.
  assert.equal(unitSystemOf({ unitSystem: "imperial" }), "metric");
  assert.equal(isUnitSystem("imperial"), false);
  assert.equal(isUnitSystem("us"), true);
});

test("old preferences still load, and a broken unit system does not", () => {
  const { unitSystem, ...withoutTheQuestion } = defaultDraft;
  assert.ok(isDraft(withoutTheQuestion), "preferences saved before this question stay readable");
  assert.ok(isDraft({ ...defaultDraft, unitSystem: "us" }));
  assert.equal(isDraft({ ...defaultDraft, unitSystem: "imperial" }), false);
  assert.equal(isDraft({ ...defaultDraft, unitSystem: 7 }), false);
  const now = new Date().toISOString();
  const saved = (extra) => ({ ...defaultDraft, ...extra, id: null, userId: null,
    onboardingCompleted: true, createdAt: now, updatedAt: now });
  assert.ok(isSaved(saved({ unitSystem: "us" })));
  assert.ok(isSaved(saved({ unitSystem: undefined })));
  assert.equal(isSaved(saved({ unitSystem: "cups" })), false);
});
