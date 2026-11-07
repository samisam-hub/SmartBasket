require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {meals,ingredients}=require('../data/meals.ts');
const {mealImageSource}=require('../lib/meal-images.ts');
const {compatibleMeal}=require('../services/meals/planner.ts');
const {prefs}=require('./basket-fixtures.cjs');
test('approved illustrations match ingredients, never legacy rice tofu snapshots',()=>{
  const originalMeals = meals.filter(meal => !meal.preparation);
  assert.equal(originalMeals.length,34);
  for(const meal of originalMeals)assert.ok(mealImageSource(meal),`Missing illustration: ${meal.id}`);
  for(const meal of meals) assert.ok(mealImageSource(meal),`Missing illustration: ${meal.id}`);
  const bread = meals.find(meal => meal.id === 'de-marmeladenbrot');
  assert.equal(mealImageSource({...bread,ingredients:bread.ingredients.filter(i=>i.ingredientKey!=='jam')}),null);
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

test('new everyday illustrations use distinct, compact offline JPEG assets',()=>{
  const fs = require('node:fs');
  const { everydayMealImages } = require('../lib/everyday-meal-images.ts');
  const sources = Object.values(everydayMealImages).map(entry => entry.source);
  assert.equal(new Set(sources).size, sources.length);
  let totalBytes = 0;
  for (const source of sources) {
    const bytes = fs.readFileSync(source);
    assert.equal(bytes.readUInt16BE(0), 0xffd8, source);
    assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, source);
    assert.ok(bytes.length < 180 * 1024, `Oversized meal illustration: ${source}`);
    totalBytes += bytes.length;
  }
  assert.ok(totalBytes < 6 * 1024 * 1024, `New illustrations add ${totalBytes} bytes`);
});
