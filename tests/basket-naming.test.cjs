require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict');
const { prefs } = require('./basket-fixtures.cjs');
const { basketDayCount, basketDisplayName } = require('../services/basket/naming.ts');
const { newSavedBasket } = require('../services/basket/persistence.ts');
test('basket names count selected days including gaps instead of the old three-day preference', () => {
 const preferences = prefs({ planningDays: 3 });
 for (const count of [1,2,5,7]) {
  const result = { mealPlan: { version: '2', days: Array.from({length:count}, (_,i)=>({ date:`2026-10-${19+i}`,slots:['dinner'] })) } };
  const basket = newSavedBasket(result, preferences, null);
  assert.equal(basket.name, `Warenkorb für ${count} ${count === 1 ? "Tag" : "Tage"}`);
  assert.equal(basketDisplayName({...basket,name:'3-day basket'}), `Warenkorb für ${count} ${count === 1 ? "Tag" : "Tage"}`);
  assert.equal(basketDisplayName({...basket,name:'My holiday'}),'My holiday');
 }
 assert.equal(basketDayCount({mealPlan:{version:'1',planningDays:5}},preferences),5);
 assert.equal(basketDayCount({},preferences),3);
});
