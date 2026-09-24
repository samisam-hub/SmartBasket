require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {prefs,product}=require('./basket-fixtures.cjs');
const {fullCatalog}=require('./meal-fixtures.cjs');
const {generateMealPlan,replaceMeal,replacementMeals,mealNutrition}=require('../services/meals/planner.ts');
const {replaceMealChoice,readyCategories,mealNutritionKnown}=require('../services/meals/choices.ts');
const {aggregateIngredients}=require('../services/meals/aggregation.ts');
const {readyMealCandidates}=require('../services/meals/readyMeals.ts');
const {basketFromMealPlan}=require('../services/meals/basket.ts');
const {removeBasketProduct}=require('../services/basket/edit.ts');
const {isMealPlan}=require('../services/meals/validation.ts');
const {isBasketResult,BasketPersistence}=require('../services/basket/persistence.ts');
const {newSavedBasket}=require('../services/basket/persistence.ts');
const p=prefs({planningDays:3,dietaryPreferences:['vegan']});
const make=()=>generateMealPlan(p,fullCatalog);
const prepared=(id=900,patch={})=>product(id,{name:'Verified vegetable lasagne',category:'other',packageSize:400,packageSizeStatus:'known',
 caloriesPer100g:150,proteinPer100g:8,carbohydratesPer100g:20,fatPer100g:4,
 readyMeal:{category:'lasagne',modes:['heat_and_eat'],slots:['lunch','dinner'],portionGrams:350,available:true,evidence:'Test-only label fixture'},...patch});
const lunch=plan=>plan.items.find(i=>i.mealSlot==='lunch');

test('mode choices store intentions only; mixed modes can be changed back to cooking',()=>{
 let plan=make(),id=lunch(plan).id;const other=structuredClone(plan.items.filter(i=>i.id!==id));
 plan=replaceMealChoice(plan,id,'heat_and_eat','lasagne');
 const choice=lunch(plan);assert.equal(choice.mealMode,'heat_and_eat');assert.equal(choice.readyMealCategory,'lasagne');
 assert.equal(choice.readyMealMatch,undefined);assert.deepEqual(choice.meal.ingredients,[]);assert.equal(mealNutritionKnown(choice),false);
 assert.deepEqual(plan.items.filter(i=>i.id!==id),other);assert.ok(isMealPlan(plan));
 const dinner=plan.items.find(i=>i.mealSlot==='dinner');plan=replaceMealChoice(plan,dinner.id,'ready_to_eat','salad');
 plan=replaceMealChoice(plan,plan.items[0].id,'eat_out');assert.ok(isMealPlan(plan));
 const recipe=replacementMeals(plan,id,p)[0];plan=replaceMeal(plan,id,recipe.id,p);
 assert.equal(lunch(plan).mealMode,'cook');assert.equal(lunch(plan).readyMealCategory,undefined);assert.ok(lunch(plan).meal.ingredients.length);
 assert.equal(plan.items.find(i=>i.id===dinner.id).mealMode,'ready_to_eat');
 assert.ok(!readyCategories('heat_and_eat','lunch').includes('salad'));
 assert.equal(readyCategories('ready_to_eat','lunch').length,5);
 for(const slot of ['breakfast','snack'])assert.deepEqual(readyCategories('heat_and_eat',slot),[]);
 assert.throws(()=>replaceMealChoice(plan,id,'heat_and_eat','salad'));
 const broken=structuredClone(plan);broken.items[0].readyMealMatch={productId:'x'};assert.equal(isMealPlan(broken),false);
});

test('eating out removes only that meal demand and never reallocates its calories',()=>{
 let plan=make();const before=structuredClone(plan);plan=replaceMealChoice(plan,lunch(plan).id,'eat_out');
 assert.deepEqual(plan.items.filter(i=>i.id!==lunch(plan).id),before.items.filter(i=>i.id!==lunch(plan).id));
 assert.ok(aggregateIngredients(plan).every(r=>!r.sourceMealIds.includes(lunch(plan).id)));
 for(const item of plan.items)plan=replaceMealChoice(plan,item.id,'eat_out');
 const result=basketFromMealPlan({...plan,status:'confirmed'},p,fullCatalog);
 assert.equal(result.items.length,0);assert.equal(result.ingredientRequirements.length,0);assert.equal(result.totalCalories,0);
 assert.ok(result.mealPlan.items.every(i=>!mealNutritionKnown(i)));assert.ok(isBasketResult(result));
});

test('confirmed ready meals match actual SKUs; packages scale, combine and survive persistence',async()=>{
 const pp={...p,householdSize:2};let plan=generateMealPlan(pp,fullCatalog);
 for(const item of plan.items.filter(i=>i.mealSlot==='lunch'))plan=replaceMealChoice(plan,item.id,'heat_and_eat','lasagne');
 const sku=prepared();const result=basketFromMealPlan({...plan,status:'confirmed'},pp,[...fullCatalog,sku]);
 assert.equal(lunch(plan).readyMealMatch,undefined);const items=result.items.filter(i=>i.product.id===sku.id);assert.equal(items.length,1);
 assert.equal(items[0].plannedConsumptionQuantity,2100);assert.equal(items[0].packageCount,6);assert.equal(items[0].estimatedPrice,12);
 assert.equal(items[0].sourceMealIds.length,3);assert.equal(lunch(result.mealPlan).readyMealMatch.productId,sku.id);
 assert.equal(mealNutrition(lunch(result.mealPlan)).calories,1050);assert.ok(isBasketResult(result));
 const data=new Map(),storage={getItem:async k=>data.get(k)??null,setItem:async(k,v)=>data.set(k,v)};
 const persistence=new BasketPersistence(storage,null);await persistence.save(newSavedBasket(result,pp,pp.userId));
 const reopened=(await persistence.list(pp.userId)).baskets[0];assert.deepEqual(reopened.result.mealPlan,result.mealPlan);
 const removed=removeBasketProduct(result,sku.id);assert.equal(mealNutrition(lunch(removed.mealPlan),removed.ingredientRatios).calories,0);
 assert.equal(mealNutritionKnown(lunch(removed.mealPlan),removed.ingredientRatios),false);assert.ok(isBasketResult(removed));
});

test('ready matching requires category, preparation, slot, availability, dietary and allergy evidence',()=>{
 const plan=replaceMealChoice(make(),lunch(make()).id,'heat_and_eat','lasagne'),item=lunch(plan),good=prepared();
 assert.equal(readyMealCandidates(item,[good],p).length,1);
 const wrong=[prepared(901,{readyMeal:null}),prepared(902,{readyMeal:{...good.readyMeal,modes:['ready_to_eat']}}),
  prepared(903,{readyMeal:{...good.readyMeal,category:'pizza'}}),prepared(904,{readyMeal:{...good.readyMeal,available:false}}),
  prepared(905,{readyMeal:{...good.readyMeal,slots:['dinner']}}),prepared(906,{vegan:null}),prepared(907,{vegan:false}),
  prepared(908,{source:'demo'}),prepared(909,{proteinPer100g:null}),prepared(910,{packageSize:null})];
 assert.deepEqual(readyMealCandidates(item,wrong,p),[]);
 const allergic={...p,allergens:['soy']};assert.equal(readyMealCandidates(item,[good],allergic).length,0);
 assert.equal(readyMealCandidates(item,[prepared(911,{labels:['soy free']})],allergic).length,1);
 assert.equal(readyMealCandidates(item,[prepared(912,{labels:['soy free'],mayContainAllergens:['soy']})],allergic).length,0);
 const result=basketFromMealPlan({...plan,status:'confirmed'},p,wrong);
 assert.equal(result.exclusions.unmatchedReadyMeals,1);assert.equal(result.mealPlan.items.find(i=>i.id===item.id).readyMealMatch,undefined);
 assert.ok(result.warnings.some(w=>w.code.startsWith('unmatched_ready_')));
});

test('budget selects affordable safe SKU, never an unsafe cheap alternative',()=>{
 let plan=replaceMealChoice(make(),lunch(make()).id,'heat_and_eat','lasagne');
 const cheap=prepared(920,{priceEstimate:2}),expensive=prepared(921,{priceEstimate:15}),unsafe=prepared(922,{priceEstimate:1,vegan:false});
 const result=basketFromMealPlan({...plan,status:'confirmed'},p,[expensive,unsafe,cheap]);
 assert.equal(lunch(result.mealPlan).readyMealMatch.productId,cheap.id);
});
