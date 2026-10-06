require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict');
const { shoppingRows, shoppingListText, rowChecked } = require('../services/basket/shopping-list.ts');
const { ShoppingListStore, shoppingListKey } = require('../services/shopping-list-store.ts');
const { product } = require('./basket-fixtures.cjs');
const item = (id, patch = {}) => ({ product: product(id), packageCount: 2, packageAmount: 500, quantityUnit: 'g', quantityAssumed: false, ingredientKey: 'rice', plannedConsumptionQuantity: 800, ...patch });
const requirement = (key, qty) => ({ ingredientKey: key, ingredientName: key, requiredQuantity: qty, minimumAcceptableQuantity: qty * .9, unit: 'g' });
const result = () => ({ items: [item(1)], ingredientRequirements: [requirement('rice', 1000), requirement('beans', 200)], pantryUsed: [{ ingredientKey: 'rice', quantity: 200 }] });
class Disk { values = new Map(); fail = false; async getItem(k) { return this.values.get(k) ?? null; } async setItem(k, v) { if (this.fail) throw Error('disk full'); this.values.set(k, v); } }

test('shopping rows distinguish packages, pantry coverage, extras and missing ingredients', () => {
  const input = result(); input.items.push(item(2, { ingredientKey: 'extra:2', isExtra: true }));
  const rows = shoppingRows(input);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].quantity, '2 × 500 g');
  assert.equal(rows[2].id, 'ingredient:beans');
  assert.equal(rows[2].quantity, '200 g still needed');
  assert.equal(rows.some(r => r.id === 'ingredient:rice'), false, 'pantry stock is not bought twice');
  input.pantryUsed = [];
  assert.equal(shoppingRows(input).find(r => r.id === 'ingredient:rice').quantity, '200 g still needed');
  input.items[0].plannedConsumptionQuantity = 950;
  assert.equal(shoppingRows(input).some(r => r.id === 'ingredient:rice'), false, 'allowed flexible portions are not missing food');
});

test('checkmarks survive restart, remain private to basket/account, and reopen changed or replaced products', async () => {
  const disk = new Disk(), key = shoppingListKey('anna', 'basket-1');
  const store = new ShoppingListStore(disk, key); await store.initialize();
  const row = shoppingRows(result())[0]; store.toggle(row); await store.flush();
  const again = new ShoppingListStore(disk, key); await again.initialize();
  assert.ok(rowChecked(row, again.getSnapshot().checked));
  const changed = shoppingRows({ ...result(), items: [item(1, { packageCount: 3 })] })[0];
  assert.equal(rowChecked(changed, again.getSnapshot().checked), false);
  again.reconcile([changed]); await again.flush();
  assert.equal(rowChecked(row, again.getSnapshot().checked), false, 'old check does not reappear after another quantity change');
  again.toggle(changed); again.toggle(changed); await again.flush();
  assert.deepEqual(again.getSnapshot().checked, {});
  again.toggle(row); again.reconcile([shoppingRows({ ...result(), items: [item(9)] })[0]]); await again.flush();
  assert.deepEqual(again.getSnapshot().checked, {});
  for (const otherKey of [shoppingListKey('partner', 'basket-1'), shoppingListKey('anna', 'basket-2'), shoppingListKey(null, 'basket-1')]) {
    const other = new ShoppingListStore(disk, otherKey); await other.initialize(); assert.deepEqual(other.getSnapshot().checked, {});
  }
});

test('unreadable checkmarks are preserved; write failures are visible and can be retried', async () => {
  const disk = new Disk(), row = shoppingRows(result())[0];
  await disk.setItem('bad', '{broken');
  const broken = new ShoppingListStore(disk, 'bad'); await broken.initialize();
  assert.equal(broken.getSnapshot().blocked, true); broken.toggle(row); broken.reconcile([]); broken.retry();
  await broken.flush(); assert.equal(await disk.getItem('bad'), '{broken');
  const store = new ShoppingListStore(disk, 'good'); await store.initialize();
  disk.fail = true; store.toggle(row); await assert.rejects(store.flush());
  assert.ok(store.getSnapshot().error); assert.ok(rowChecked(row, store.getSnapshot().checked));
  disk.fail = false; store.retry(); await store.flush();
  assert.equal(store.getSnapshot().error, null);
  const reopened = new ShoppingListStore(disk, 'good'); await reopened.initialize(); assert.ok(rowChecked(row, reopened.getSnapshot().checked));
});

test('shared text separates picked-up items from remaining purchases and includes unresolved ingredients', () => {
  const rows = shoppingRows(result()), checked = { [rows[0].id]: rows[0].signature };
  const text = shoppingListText('Family week', rows, checked);
  assert.match(text, /SmartBasket · Family week/);
  assert.match(text, /\[ \] beans — 200 g still needed \(choose a suitable product\)/);
  assert.match(text, /Already picked up:/);
  assert.ok(text.includes(`[x] ${rows[0].name} — 2 × 500 g`));
  assert.equal(/kcal|allerg|userId|calorie/.test(text), false);
});
