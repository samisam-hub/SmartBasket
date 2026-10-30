require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {prefs}=require('./basket-fixtures.cjs');
const {fullCatalog}=require('./meal-fixtures.cjs');
const {generateMealPlan,planNutrition}=require('../services/meals/planner.ts');
const {basketFromMealPlan}=require('../services/meals/basket.ts');
const {removeBasketProduct}=require('../services/basket/edit.ts');
const {BasketPersistence,newSavedBasket,isBasketResult}=require('../services/basket/persistence.ts');
test('removal recalculates totals, preserves meals and persists without changing identity',async()=>{
 const p=prefs({planningDays:3}),plan={...generateMealPlan(p),status:'confirmed'};
 const original=basketFromMealPlan(plan,p,fullCatalog);assert.ok(original.items.length>1);
 const before=JSON.stringify(original),removed=original.items[0],next=removeBasketProduct(original,removed.product.id);
 assert.equal(JSON.stringify(original),before);assert.equal(next.items.length,original.items.length-1);
 assert.deepEqual(next.mealPlan,original.mealPlan);assert.ok(isBasketResult(next));
 assert.ok(Math.abs(next.totalCalories-planNutrition(plan,next.ingredientRatios).calories)<0.001);
 assert.ok(Math.abs(next.knownPriceSubtotal-(original.knownPriceSubtotal-removed.estimatedPrice))<.02);
 assert.ok(next.remaining.totalPurchasedWeight<=original.remaining.totalPurchasedWeight);
 const store=new Map(),persistence=new BasketPersistence({getItem:async k=>store.get(k)??null,setItem:async(k,v)=>store.set(k,v)},null);
 const b=newSavedBasket(original,p,null);await persistence.save(b);await persistence.save({...b,result:next});
 const reopened=(await persistence.list(null)).baskets;assert.equal(reopened.length,1);assert.equal(reopened[0].id,b.id);assert.deepEqual(reopened[0].result,next);
 let empty=next;for(const item of next.items)empty=removeBasketProduct(empty,item.product.id);
 assert.equal(empty.totalCalories,0);assert.equal(empty.estimatedTotalPrice,0);assert.ok(isBasketResult(empty));
});

test('checkbox deselection persists, reduces totals and restores the exact quantities without duplicates', async()=>{
 const {toggleBasketProduct}=require('../services/basket/edit.ts');
 const p=prefs(),plan={...generateMealPlan(p),status:'confirmed'};
 const original=basketFromMealPlan(plan,p,fullCatalog),item=original.items[0];
 const unchecked=toggleBasketProduct(original,item.product.id);
 assert.ok(!unchecked.items.some(i=>i.product.id===item.product.id));
 assert.deepEqual(unchecked.excludedItems,[item]); assert.ok(isBasketResult(unchecked));
 assert.ok(Math.abs(unchecked.knownPriceSubtotal-(original.knownPriceSubtotal-item.estimatedPrice))<.02);
 const data=new Map(),persistence=new BasketPersistence({getItem:async k=>data.get(k)??null,setItem:async(k,v)=>data.set(k,v)},null);
 const b=newSavedBasket(unchecked,p,null);await persistence.save(b);
 const reopened=(await persistence.list(null)).baskets[0];
 const restored=toggleBasketProduct(reopened.result,item.product.id);
 assert.deepEqual(restored.items.find(i=>i.product.id===item.product.id),item);
 assert.equal(restored.excludedItems.length,0);assert.equal(restored.knownPriceSubtotal,original.knownPriceSubtotal);
 assert.ok(Math.abs(restored.totalCalories-original.totalCalories)<.01);assert.ok(isBasketResult(restored));
 assert.equal(isBasketResult({...unchecked,excludedItems:[null]}),false);
 assert.equal(isBasketResult({...original,excludedItems:[item]}),false);
 assert.throws(()=>toggleBasketProduct({...unchecked,items:[...unchecked.items,{...item,product:{...item.product,id:'replacement'}}]},item.product.id),/Alternative/);
 assert.throws(()=>toggleBasketProduct({...original,purchasedAt:'2026-10-21'},item.product.id),/Bereits eingekaufte/);
 let empty=original;for(const row of original.items)empty=toggleBasketProduct(empty,row.product.id);
 assert.equal(empty.items.length,0);assert.equal(empty.knownPriceSubtotal,0);assert.ok(isBasketResult(empty));
});

test('choosing an unchecked product as a replacement reconciles checkbox state',()=>{
 const {toggleBasketProduct}=require('../services/basket/edit.ts');
 const {addBasketReplacement}=require('../services/basket/replacements.ts');
 const p=prefs(),plan={...generateMealPlan(p),status:'confirmed'};
 const original=basketFromMealPlan(plan,p,fullCatalog),item=original.items[0];
 const unchecked=toggleBasketProduct(original,item.product.id);
 const requirement=original.ingredientRequirements.find(r=>r.ingredientKey===item.ingredientKey);
 const selected=addBasketReplacement(unchecked,requirement,item.product);
 assert.equal(selected.excludedItems.length,0);assert.ok(isBasketResult(selected));
 assert.ok(!selected.removedIngredientKeys.includes(item.ingredientKey));
 assert.throws(()=>addBasketReplacement(selected,requirement,item.product),/bereits ausgewählt/);
});
