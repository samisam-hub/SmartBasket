require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict');
const i18n = require('../services/i18n/index.ts');
const { de } = require('../services/i18n/de.ts');
const { en } = require('../services/i18n/en.ts');
const { contentName } = require('../services/i18n/content.ts');
const { planDateLabel } = require('../services/meals/weekPlan.ts');
const { basketDisplayName } = require('../services/basket/naming.ts');
const { diets, goals, allergens } = require('../types/preferences.ts');
const { categories } = require('../types/product.ts');
const { mealSlots } = require('../types/meal.ts');

class Disk {
  values = new Map(); fail = false;
  async getItem(key) { if (this.fail) throw Error('unreadable'); return this.values.get(key) ?? null; }
  async setItem(key, value) { if (this.fail) throw Error('disk full'); this.values.set(key, value); }
}
const inLocale = async (locale, body) => {
  await i18n.setLocale(locale);
  try { return body(); } finally { i18n.resetLocale(); }
};

test('both locales carry exactly the same keys, and none of them is empty', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort(),
    'a key in one locale and not the other would show a German line to an English reader');
  for (const [key, phrase] of [...Object.entries(de), ...Object.entries(en)]) {
    const forms = typeof phrase === 'string' ? [phrase] : [phrase.one, phrase.other];
    for (const form of forms) assert.ok(form.trim().length, `${key} is empty`);
  }
  // Every value the app stores and shows as a word has one.
  for (const value of [...goals, ...diets, ...allergens, ...mealSlots]) assert.ok(`term.${value}` in de, value);
  for (const value of categories) assert.ok(`category.${value}` in de, value);
});

test('German is the default, a device can change it, and the viewer can override the device', async () => {
  assert.equal(i18n.locale(), 'de');
  assert.equal(i18n.localeFromTags(['de-AT']), 'de');
  assert.equal(i18n.localeFromTags(['en-GB']), 'en');
  assert.equal(i18n.localeFromTags(['fr-FR']), 'en', 'a language we do not have falls back to English');
  assert.equal(i18n.localeFromTags([]), 'en');
  const disk = new Disk();
  // A device alone is not a choice: it must not be written back as one.
  assert.ok(['de', 'en'].includes(await i18n.initLocale(disk)));
  assert.equal(disk.values.size, 0);
  assert.equal(i18n.localeChosen(), false);
  await i18n.setLocale('en', disk);
  assert.equal(i18n.locale(), 'en');
  assert.equal(i18n.localeChosen(), true);
  assert.equal(disk.values.get(i18n.STORAGE_KEY), 'en');
  i18n.resetLocale();
  assert.equal(await i18n.initLocale(disk), 'en', 'the choice survives a restart');
  assert.equal(i18n.localeChosen(), true);
  // A storage that cannot be read is not worth an error on screen.
  i18n.resetLocale();
  disk.fail = true;
  assert.equal(await i18n.initLocale(disk), i18n.detectLocale() ?? 'de');
  i18n.resetLocale();
  await assert.rejects(() => i18n.setLocale('fr'));
});

test('a screen is told when the locale changes, so switching needs no restart', async () => {
  let changes = 0;
  const stop = i18n.subscribeLocale(() => { changes++; });
  await i18n.setLocale('en');
  await i18n.setLocale('en');
  assert.equal(changes, 1, 'the same locale again is not a change');
  await i18n.setLocale('de');
  assert.equal(changes, 2);
  stop();
  await i18n.setLocale('en');
  assert.equal(changes, 2, 'a screen that is gone is not notified');
  i18n.resetLocale();
});

test('counts and names are filled in, and a missing one is a bug rather than a blank', async () => {
  assert.equal(i18n.t('household.full', { max: 10 }), 'Ein Plan hält bis zu 10 Personen.');
  assert.throws(() => i18n.t('household.full'), /Missing parameter \{max\}/);
  await inLocale('en', () => assert.equal(i18n.t('household.add'), 'Add person'));
  // A value the app stores that nobody translated is shown as it is, not swallowed.
  assert.equal(i18n.term('vegan'), 'Vegan');
  assert.equal(i18n.term('some_future_code'), 'some_future_code');
});

test('numbers, money and dates follow the locale; the catalogue stays in euro', async () => {
  assert.equal(i18n.formatNumber(1234.5, 1), '1.234,5');
  assert.equal(i18n.formatDecimal(12.5), '12,50');
  assert.equal(i18n.formatMoney(12.5), '12,50 €');
  assert.equal(planDateLabel('2026-10-05'), 'Mo., 5. Okt.');
  await inLocale('en', () => {
    assert.equal(i18n.formatNumber(1234.5, 1), '1,234.5');
    assert.equal(i18n.formatMoney(12.5), '€12.50');
    assert.equal(planDateLabel('2026-10-05'), 'Mon, Oct 5');
  });
});

test('content the data holds in English is shown in German without rewriting a snapshot', async () => {
  const snapshot = { name: '3-day basket', preferences: { planningDays: 3 }, result: { mealPlan: { version: '1', planningDays: 5 } } };
  const before = JSON.stringify(snapshot);
  assert.equal(basketDisplayName(snapshot), 'Warenkorb für 5 Tage');
  assert.equal(JSON.stringify(snapshot), before, 'nothing stored is changed by showing it');
  assert.equal(contentName('Oatmeal with berries'), 'Haferbrei mit Beeren');
  assert.equal(contentName('Omas Lieblingsgericht'), 'Omas Lieblingsgericht');
  await inLocale('en', () => assert.equal(contentName('Oatmeal with berries'), 'Oatmeal with berries'));
});

test('account errors say what to do, in the right language, without the provider text', async () => {
  assert.equal(i18n.authError({ code: 'invalid_credentials', message: 'Invalid login credentials' }).message,
    'E-Mail-Adresse oder Passwort ist falsch.');
  assert.match(i18n.authError({ message: 'Failed to fetch' }).message, /Netzwerkfehler/);
  assert.equal(i18n.authError({ code: 'unknown', message: 'internal provider details' }).message,
    'Die Kontoanfrage ist fehlgeschlagen. Bitte versuche es erneut.');
  await inLocale('en', () => {
    assert.match(i18n.authError({ code: 'invalid_credentials' }).message, /not right/);
    assert.match(i18n.authError({ message: 'network down' }).message, /Network error/);
  });
});

test("every key a screen asks for exists, and every key in the dictionary is asked for", () => {
  const fs = require('node:fs'), path = require('node:path');
  const roots = ['app', 'components', 'services', 'hooks', 'context'];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !full.startsWith('services/i18n')) files.push(full);
    }
  };
  for (const root of roots) walk(root);
  const asked = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    // Keys written out in full. A key built from a value (`term.${slot}`) is checked by the
    // type-checker instead, which is why the helpers in the layer are typed.
    for (const match of source.matchAll(/\bt\(\s*'([a-zA-Z][\w.-]*)'/g)) asked.set(match[1], file);
    for (const match of source.matchAll(/\bt\(\s*"([a-zA-Z][\w.-]*)"/g)) asked.set(match[1], file);
  }
  assert.ok(asked.size > 100, `only ${asked.size} keys found; the scan is probably broken`);
  for (const [key, file] of asked) assert.ok(key in de, `${file} asks for ${key}, which no locale has`);
  // The other direction: a key nobody asks for any more is dead weight a translator still pays for.
  // Here any mention counts, since a key can reach `t` through a condition or a variable.
  const mentioned = new Set();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/['"]([a-z][\w-]*(?:\.[\w-]+)+)['"]/g)) mentioned.add(match[1]);
  }
  const dynamic = /^(term|category|group|kind|mode|ready|units|filter|auth|intro\.\d|language)\./;
  const unused = Object.keys(de).filter(key => !mentioned.has(key) && !dynamic.test(key));
  assert.deepEqual(unused, [], 'these keys are no longer used by any screen');
});
