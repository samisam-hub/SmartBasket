require("./register.cjs");
const { test } = require("node:test"), assert = require("node:assert/strict");
const { hasSavedWork } = require("../services/saved-work.ts");
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

test("liked meals travel with the draft, and a broken list is refused", () => {
  assert.ok(isDraft({ ...defaultDraft, preferredMealIds: ["oat-berries"] }));
  assert.ok(isDraft({ ...defaultDraft, preferredMealIds: [] }));
  assert.ok(isDraft(defaultDraft), "absent is fine; it means no preference");
  assert.equal(isDraft({ ...defaultDraft, preferredMealIds: "oat-berries" }), false);
  assert.equal(isDraft({ ...defaultDraft, preferredMealIds: [7] }), false);
});

test("the introduction says what was asked of it, in three pages, in both languages", async () => {
  const { setLocale, resetLocale } = require("../services/i18n/index.ts");
  const promises = {
    de: [/einkaufsliste/, /fitnessziel/, /budget/, /allerg/, /etikett/],
    en: [/shopping list/, /fitness goal/, /budget/, /allerg/, /check the label/],
  };
  for (const locale of ["de", "en"]) {
    await setLocale(locale);
    try {
      const pages = introPages();
      assert.equal(pages.length, 3);
      const all = JSON.stringify(pages).toLowerCase();
      // What it is, what it watches, how the week runs — and the allergy promise qualified.
      for (const promise of promises[locale]) assert.match(all, promise, `${locale}: ${promise}`);
      for (const page of pages) {
        assert.ok(page.title.length > 0, "every page is titled");
        // A page either says its piece in a line or lists it; an empty page says nothing.
        assert.ok(page.body?.length || page.points?.items.length, `${page.title} carries no content`);
        for (const item of page.points?.items ?? []) assert.ok(item.trim().length, "no empty list line");
        assert.ok(page.kind, "every page carries its illustration");
      }
    } finally { resetLocale(); }
  }
});
