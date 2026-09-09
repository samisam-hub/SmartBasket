require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {meals,ingredients}=require('../data/meals.ts');
const {mealImageSource}=require('../lib/meal-images.ts');
const {compatibleMeal}=require('../services/meals/planner.ts');
const {prefs}=require('./basket-fixtures.cjs');
test('approved illustrations match ingredients, never legacy rice tofu snapshots',()=>{
  assert.equal(meals.length,32);
  for(const meal of meals)assert.ok(mealImageSource(meal),`Missing illustration: ${meal.id}`);
  const tofu=meals.find(m=>m.id==='tofu-teriyaki-noodles');
  assert.equal(mealImageSource({...tofu,id:'tofu-stirfry'}),null);
  assert.equal(mealImageSource({...tofu,ingredients:tofu.ingredients.filter(i=>i.ingredientKey!=='teriyaki')}),null);
});
test('noodle recipe counts sauce volume and nutrition and excludes wheat/soy restrictions',()=>{
  const meal=meals.find(m=>m.id==='tofu-teriyaki-noodles');
  assert.equal(meal.ingredients.find(i=>i.ingredientKey==='teriyaki').unit,'ml');
  assert.equal(meal.ingredients.some(i=>i.ingredientKey==='rice'),false);
  const total=meal.ingredients.reduce((n,i)=>n+ingredients[i.ingredientKey].nutritionPer100.calories*i.quantity/100,0);
  assert.equal(meal.caloriesPerServing,total);
  assert.equal(compatibleMeal(meal,prefs({allergens:['wheat']})),false);
  assert.equal(compatibleMeal(meal,prefs({allergens:['soy']})),false);
  assert.equal(meal.dietaryTags.includes('gluten_free'),false);
});
