require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {meals}=require('../data/meals.ts');
const {prefs,product}=require('./basket-fixtures.cjs');
const {compatibleMeal}=require('../services/meals/planner.ts');
const {matchProducts}=require('../services/meals/matching.ts');
test('sourdough breakfast includes cooking oil and greens, with egg and wheat restrictions',()=>{
 const meal=meals.find(m=>m.id==='sunny-side-toast');
 assert.equal(meal.mealType,'breakfast');
 for(const key of ['sourdough_bread','eggs','cherry_tomatoes','spinach','olive_oil','parsley','pepper'])assert.ok(meal.ingredients.some(i=>i.ingredientKey===key));
 assert.ok(meal.caloriesPerServing>380&&meal.caloriesPerServing<400);
 assert.ok(meal.proteinPerServing>20);
 assert.equal(compatibleMeal(meal,prefs({dietaryPreferences:['lactose_free']})),true);
 for(const allergen of ['eggs','wheat'])assert.equal(compatibleMeal(meal,prefs({allergens:[allergen]})),false);
 assert.equal(compatibleMeal(meal,prefs({dietaryPreferences:['vegan']})),false);
});
test('fresh cherry tomatoes and sourdough do not match canned tomatoes or ordinary toast',()=>{
 const tomato=product(401,{name:'Fresh cherry tomatoes',category:'vegetables',packageSize:250,quantityLabel:'250 g',caloriesPer100g:18,proteinPer100g:.9,carbohydratesPer100g:3.9,fatPer100g:.2});
 assert.equal(matchProducts('cherry_tomatoes',[tomato],prefs()).length,1);
 assert.equal(matchProducts('cherry_tomatoes',[{...tomato,name:'Canned cherry tomatoes'}],prefs()).length,0);
 const bread=product(402,{name:'Sourdough bread',category:'bread',packageSize:500,quantityLabel:'500 g',caloriesPer100g:250,proteinPer100g:9,carbohydratesPer100g:48,fatPer100g:1.5});
 assert.equal(matchProducts('sourdough_bread',[bread],prefs()).length,1);
 assert.equal(matchProducts('sourdough_bread',[{...bread,name:'Wholemeal toast'}],prefs()).length,0);
});
