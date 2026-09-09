require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {prefs}=require('./basket-fixtures.cjs');
const {meals}=require('../data/meals.ts');
const {generateMealPlan,mealNutrition,replaceMeal,replacementMeals,compatibleMeal}=require('../services/meals/planner.ts');
const {isMealPlan}=require('../services/meals/validation.ts');
const {aggregateIngredients}=require('../services/meals/aggregation.ts');
test('1500 kcal plans include one small snack per day within the daily total',()=>{
 for(const diet of ['none','lactose_free','vegan','gluten_free']){
  const p=prefs({planningDays:3,householdSize:1,dailyCalories:1500,dietaryPreferences:[diet]});
  const plan=generateMealPlan(p);assert.equal(plan.items.length,12);assert.equal(isMealPlan(plan),true);
  for(let d=0;d<3;d++){
   const items=plan.items.filter(i=>i.dayIndex===d),snack=items.filter(i=>i.mealSlot==='snack');
   assert.equal(snack.length,1);assert.ok(mealNutrition(snack[0]).calories>=100&&mealNutrition(snack[0]).calories<=150);
   assert.ok(Math.abs(items.reduce((n,i)=>n+mealNutrition(i).calories,0)-1500)<1);
   assert.ok(replacementMeals(plan,snack[0].id,p).every(m=>m.mealType==='snack'));
  }
  assert.ok(aggregateIngredients(plan).length>0);
 }
});
test('600 kcal dinner replacements rebalance the day and retain the snack',()=>{
 const p=prefs({planningDays:3,householdSize:1,dailyCalories:1500,dietaryPreferences:['lactose_free']});
 const plan=generateMealPlan(p),dinner=plan.items.find(i=>i.mealSlot==='dinner'),snack=plan.items.find(i=>i.mealSlot==='snack');
 for(const id of ['steak-greens','chicken-stroganoff','steak-chanterelles']){
  const next=replaceMeal(plan,dinner.id,id,p);
  assert.deepEqual(next.items.find(i=>i.id===snack.id),snack);
  const total=next.items.filter(i=>i.dayIndex===0).reduce((n,i)=>n+mealNutrition(i).calories,0);
  assert.ok(Math.abs(total-1500)<1,`${id}: ${total}`);assert.equal(isMealPlan(next),true);
 }
});
test('new recipe ingredients and restrictions remain explicit; legacy three-slot plans remain readable',()=>{
 const ham=meals.find(m=>m.id==='chicken-ham-toast'),salmon=meals.find(m=>m.id==='salmon-egg-toast');
 assert.ok(ham.ingredients.some(i=>i.ingredientKey==='chicken_ham'));
 assert.ok(!ham.ingredients.some(i=>i.ingredientKey==='chopped_tomatoes'));
 assert.ok(ham.ingredients.some(i=>i.ingredientKey==='pepper'));
 assert.equal(compatibleMeal(salmon,prefs({allergens:['fish']})),false);
 assert.equal(compatibleMeal(salmon,prefs({allergens:['eggs']})),false);
 assert.equal(compatibleMeal(meals.find(m=>m.id==='chicken-stroganoff'),prefs({allergens:['soy']})),false);
 const plan=generateMealPlan(prefs({planningDays:3}));delete plan.snacksIncluded;plan.items=plan.items.filter(i=>i.mealSlot!=='snack');
 assert.equal(isMealPlan(plan),true);
});
