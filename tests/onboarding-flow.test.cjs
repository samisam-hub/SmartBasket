require("./register.cjs");
const { test } = require("node:test"), assert = require("node:assert/strict");
const { hasSavedWork } = require("../services/saved-work.ts");
const { likedMeals, preferenceDeck } = require("../services/meals/preference-deck.ts");
const { isDraft } = require("../services/preference-domain.ts");
const { defaultDraft } = require("../types/preferences.ts");
const { introPages } = require("../services/intro-content.ts");

test("a guest who has set nothing up has nothing to fetch", () => {
  // The notice "showing baskets saved on this device" in front of somebody who saved nothing
  // was the bug: nothing is ever written before preferences are completed.
  assert.equal(hasSavedWork(null), false);
  assert.equal(hasSavedWork(undefined), false);
  assert.equal(hasSavedWork({ onboardingCompleted: false }), false);
  assert.equal(hasSavedWork({ onboardingCompleted: true }), true);
});

test("the deck only shows meals the household could actually eat", () => {
  const vegan = preferenceDeck({ ...defaultDraft, dietaryPreferences: ["vegan"] });
  assert.ok(vegan.length, "a vegan household still gets a deck");
  for (const meal of vegan) assert.ok(meal.dietaryTags.includes("vegan"), `${meal.name} is vegan`);
  const nutFree = preferenceDeck({ ...defaultDraft, allergens: ["fish", "milk"] });
  for (const meal of nutFree)
    assert.ok(!meal.allergens.some((a) => ["fish", "milk"].includes(a)), `${meal.name} avoids the allergens`);
});

test("the deck mixes meal types instead of showing three blocks", () => {
  const deck = preferenceDeck(defaultDraft, 6);
  assert.equal(deck.length, 6);
  assert.ok(new Set(deck.map((m) => m.mealType)).size > 1, "not all of one type");
  assert.notDeepEqual(deck[0].mealType, deck[1].mealType, "the first two differ");
  // Stable: coming back does not reshuffle the cards under somebody.
  assert.deepEqual(preferenceDeck(defaultDraft, 6).map((m) => m.id), deck.map((m) => m.id));
});

test("a deck that cannot be filled is short rather than padded with repeats", () => {
  const deck = preferenceDeck(defaultDraft, 500);
  assert.equal(new Set(deck.map((m) => m.id)).size, deck.length, "no meal appears twice");
});

test("liking nothing is an answer, not a household that eats nothing", () => {
  assert.deepEqual(likedMeals([]), []);
  assert.deepEqual(likedMeals(["a", "a", "b", ""]), ["a", "b"], "duplicates and blanks drop out");
});

test("liked meals travel with the draft, and a broken list is refused", () => {
  assert.ok(isDraft({ ...defaultDraft, preferredMealIds: ["oat-berries"] }));
  assert.ok(isDraft({ ...defaultDraft, preferredMealIds: [] }));
  assert.ok(isDraft(defaultDraft), "absent is fine; it means no preference");
  assert.equal(isDraft({ ...defaultDraft, preferredMealIds: "oat-berries" }), false);
  assert.equal(isDraft({ ...defaultDraft, preferredMealIds: [7] }), false);
});

test("the introduction says what was asked of it, in three pages", () => {
  assert.equal(introPages.length, 3);
  const all = JSON.stringify(introPages).toLowerCase();
  // What it is, what it watches, how the week runs.
  assert.match(all, /shopping list/);
  for (const promise of ["fitness goal", "budget", "allerg"])
    assert.ok(all.includes(promise), `the introduction mentions ${promise}`);
  // The allergy promise is qualified rather than absolute.
  assert.match(all, /check the label/);
  for (const page of introPages) {
    assert.ok(page.title.length > 0 && page.body.length > 0);
    assert.ok(page.kind, "every page carries its illustration");
  }
});
