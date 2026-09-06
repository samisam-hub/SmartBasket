require('./register.cjs');
const {product}=require('./basket-fixtures.cjs');
const {ingredients}=require('../data/meals.ts');
const fullCatalog=Object.values(ingredients).map((i,index)=>product(index+1,{name:i.aliases[0],category:i.categories[0],packageSize:i.key==='oil'?250:500,quantityLabel:'500 g drained',
 caloriesPer100g:i.nutritionPer100.calories,proteinPer100g:i.nutritionPer100.protein,carbohydratesPer100g:i.nutritionPer100.carbohydrates,fatPer100g:i.nutritionPer100.fat,
 sugarsPer100g:0,allergens:i.allergens,vegan:i.diets.includes('vegan'),vegetarian:i.diets.includes('vegetarian'),lactoseFree:i.diets.includes('lactose_free'),glutenFree:i.diets.includes('gluten_free')}));

module.exports={fullCatalog};
