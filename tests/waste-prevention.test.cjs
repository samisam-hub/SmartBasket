require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {wastePrevention,formatPreventedWaste}=require('../services/waste-prevention.ts');
const {shoppingImpact}=require('../services/waste-prevention.ts');
const purchase=(id,uses,confirmed=true)=>({basketId:id,basket:{result:{purchasedAt:confirmed?'2026-09-08':undefined,pantryUsed:uses}}});
test('lifetime reuse counts completed purchases once, excludes drafts and keeps mass separate from volume',()=>{
 const a=purchase('a',[{quantity:750,unit:'g'},{quantity:250,unit:'ml'}]);
 const b=purchase('b',[{quantity:500,unit:'g'},{quantity:1000,unit:'ml'},{quantity:-100,unit:'g'},{quantity:NaN,unit:'g'}]);
 const result=wastePrevention([a,a,b,purchase('draft',[{quantity:9000,unit:'g'}],false),purchase('legacy',undefined)]);
 assert.deepEqual(result,{grams:1250,millilitres:1250});
 assert.equal(formatPreventedWaste(result),'1.25 kg · 1.25 L');
 assert.equal(formatPreventedWaste(wastePrevention([])),'0 g');
 assert.equal(formatPreventedWaste({grams:20.5,millilitres:0}),'20.5 g');
});
test('impact values reused quantities at their original estimated price, counts shops once and uses calendar days',()=>{
 const original=purchase('original',[]);original.purchasedAt='2026-09-01T10:00:00Z';
 original.basket.result.items=[{product:{id:'rice',currency:'EUR'},quantityUnit:'g',purchasedQuantity:500,estimatedPrice:2}];
 const reused=purchase('next',[{lotId:'original:rice',quantity:250,unit:'g'},{lotId:'unknown',quantity:20,unit:'g'}]);reused.purchasedAt='2026-09-08T10:00:00Z';
 const impact=shoppingImpact([original,reused,reused],new Date('2026-09-08T12:00:00Z'));
 assert.equal(impact.days,8);assert.equal(impact.shops,2);assert.equal(impact.euros,1);assert.equal(impact.unpriced,1);assert.equal(impact.grams,270);
 assert.equal(shoppingImpact([]).days,0);
 original.basket.result.items[0].product.currency='USD';assert.equal(shoppingImpact([original,reused]).euros,0);
});
const {generateMealPlan,planNutrition}=require('../services/meals/planner.ts');
const {prefs}=require('./basket-fixtures.cjs');
test('target attainment uses individual planned days and excludes unconfirmed purchases',()=>{
 const plan={...generateMealPlan(prefs({planningDays:3})),status:'confirmed'};
 const p=purchase('plan',[]);p.purchasedAt='2026-09-08';p.basket.result.mealPlan=plan;
 plan.participants=[{id:'a',name:'A',dailyCalories:1500,proteinTarget:1},{id:'b',name:'B',dailyCalories:1500,proteinTarget:10000}];plan.householdSize=2;
 const dailyProtein=planNutrition(plan).protein / plan.planningDays / 2;
 plan.participants[0].proteinTarget=dailyProtein/.9;plan.participants[1].proteinTarget=dailyProtein/1.1;
 const result=shoppingImpact([p,p]);assert.equal(result.proteinTargetsMet,100);
 plan.participants[1].proteinTarget=dailyProtein/.9;assert.equal(shoppingImpact([p]).proteinTargetsMet,90);
 plan.participants.forEach(x=>x.proteinTarget=dailyProtein/1.2);assert.equal(shoppingImpact([p]).proteinTargetsMet,120);
 plan.participants.forEach(x=>x.dailyCalories=10000);
 assert.equal(shoppingImpact([p]).calorieTargetsMet,0);
 p.basket.result.purchasedAt=undefined;
 assert.equal(shoppingImpact([p]).proteinTargetsMet,null);
});

test('saved budget weights completed budgets, retains overspend and excludes incomplete costs',()=>{
 const a=purchase('a',[]),b=purchase('b',[]),missing=purchase('missing',[]);
 Object.assign(a.basket.result,{budgetTarget:100,estimatedTotalPrice:80,budgetStatus:'within_budget'});
 Object.assign(b.basket.result,{budgetTarget:200,estimatedTotalPrice:250,budgetStatus:'over_budget'});
 Object.assign(missing.basket.result,{budgetTarget:100,estimatedTotalPrice:20,budgetStatus:'price_incomplete'});
 assert.equal(shoppingImpact([a,b,a,missing]).savedBudgetPercent,-10);
 assert.equal(shoppingImpact([a]).savedBudgetPercent,20);
 assert.equal(shoppingImpact([missing]).savedBudgetPercent,null);
 assert.equal(shoppingImpact([missing]).budgetSkipped,1);
});
