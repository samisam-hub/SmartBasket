require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {prefs,product}=require('./basket-fixtures.cjs');
const {meals}=require('../data/meals.ts');
const {generateMealPlan,planNutrition,replaceMeal,compatibleMeal}=require('../services/meals/planner.ts');
const {aggregateIngredients}=require('../services/meals/aggregation.ts');
const {optimizePackages}=require('../services/meals/packageOptimizer.ts');
const {basketFromMealPlan}=require('../services/meals/basket.ts');
const {matchProducts}=require('../services/meals/matching.ts');
const {isBasketResult}=require('../services/basket/persistence.ts');
const requirement=(patch={})=>({ingredientKey:'chicken',ingredientName:'Chicken breast',unit:'g',requiredQuantity:620,flexible:true,minimumAcceptableQuantity:558,maximumAcceptableQuantity:682,sourceMealIds:['one'],...patch});
const sku=(size,patch={})=>product(size,{packageSize:size,...patch});
const {fullCatalog}=require('./meal-fixtures.cjs');

test('milk allergy evidence gaps explain empty baskets without weakening safety or confusing lactose-free',()=>{
 const p=prefs({householdSize:2,planningDays:3,dailyCalories:1500,primaryGoal:'build_muscle',proteinMode:'manual',proteinTargetGrams:100,dietaryPreferences:['lactose_free'],allergens:['milk']});
 const result=basketFromMealPlan({...generateMealPlan(p,fullCatalog),status:'confirmed'},p,fullCatalog);
 assert.equal(result.items.length,0);
 assert.ok(result.warnings.some(w=>w.code==='allergy_evidence_gap'&&w.message.includes('Milk allergy and lactose-free')));
 assert.ok(result.matchingDiagnostics.some(d=>d.unresolvedReason.includes('allergen_metadata_unknown')));
 assert.ok(result.warnings.some(w=>w.message.includes('This does not mean they contain those allergens')));
 const withoutAllergy={...p,allergens:[]};
 assert.ok(basketFromMealPlan({...generateMealPlan(withoutAllergy,fullCatalog),status:'confirmed'},withoutAllergy,fullCatalog).items.length>0);
 assert.deepEqual(p.allergens,['milk']);
});
test('A/C: flexible 620 g chooses one 600 or 650 g over two 500 g; small underfill is consumption',()=>{
 const r=optimizePackages(requirement(),[sku(500),sku(600),sku(650)]);
 assert.ok([600,650].includes(r.purchasedQuantity));assert.equal(r.choices.reduce((s,i)=>s+i.packageCount,0),1);
 const only=optimizePackages(requirement(),[sku(600)]);assert.equal(only.plannedConsumptionQuantity,600);assert.equal(only.leftoverQuantity,0);
});
test('B/D: full oats package cost, consumption and leftover; inflexible quantity cannot underfill',()=>{
 const oats=optimizePackages(requirement({requiredQuantity:300,minimumAcceptableQuantity:270,maximumAcceptableQuantity:330}),[sku(500)]);
 assert.equal(oats.purchasedQuantity,500);assert.equal(oats.plannedConsumptionQuantity,300);assert.equal(oats.leftoverQuantity,200);assert.equal(oats.choices[0].estimatedPrice,2);
 const fixed=optimizePackages(requirement({flexible:false}),[sku(600)]);assert.equal(fixed.purchasedQuantity,1200);assert.equal(fixed.plannedConsumptionQuantity,620);
});
test('E: broccoli aggregates across meals before any SKU matching',()=>{
 const p=generateMealPlan(prefs({planningDays:3}));const m=meals.find(m=>m.id==='chicken-potato');
 const r=aggregateIngredients({...p,items:[{id:'a',dayIndex:0,mealSlot:'lunch',servings:1,meal:m},{id:'b',dayIndex:1,mealSlot:'lunch',servings:2,meal:m}]}).find(r=>r.ingredientKey==='broccoli');
 assert.equal(r.requiredQuantity,450);assert.equal(r.minimumAcceptableQuantity,382.5);assert.deepEqual(r.sourceMealIds,['a','b']);
});
test('F: complete fixture catalog produces diverse 3-day meals and realistic packages with high consumption coverage',()=>{
 const p=prefs({planningDays:3,dailyCalories:1500,primaryGoal:'high_protein',dietaryPreferences:['lactose_free'],weeklyBudgetEur:100});
 const plan=generateMealPlan(p,fullCatalog);assert.equal(plan.items.length,12);assert.ok(new Set(plan.items.map(i=>i.meal.id)).size>=5);
 const result=basketFromMealPlan({...plan,status:'confirmed'},p,fullCatalog);
 assert.ok(result.items.length>=5);assert.ok(result.calorieCoveragePercent>=90&&result.calorieCoveragePercent<=110,JSON.stringify(result.warnings));
 assert.ok(result.proteinCoveragePercent>=90);assert.ok(result.items.every(i=>i.packageCount>0&&i.packageCount<10));assert.equal(isBasketResult(result),true);
 assert.deepEqual(result,basketFromMealPlan({...plan,status:'confirmed'},p,[...fullCatalog].reverse()));
 assert.ok(result.totalCalories < result.items.reduce((s,i)=>s+i.product.caloriesPer100g*i.purchasedQuantity/100,0));
});
test('nutrition recalculates underfill and does not count leftover package calories',()=>{
 const p=prefs({planningDays:3});const plan=generateMealPlan(p);
 const m=structuredClone(meals.find(m=>m.id==='chicken-potato'));m.ingredients=[{...m.ingredients[0],quantity:620}];
 const single={...plan,status:'confirmed',items:[{id:'a',dayIndex:0,mealSlot:'lunch',servings:1,meal:m}]};
 const chicken=fullCatalog.find(p=>p.name==='chicken breast');
 const result=basketFromMealPlan(single,p,[{...chicken,packageSize:600,quantityLabel:"600 g"}]);
 assert.equal(result.totalCalories,720);assert.equal(result.totalProtein,138);assert.equal(result.ingredientRatios.chicken_breast,600/620);
 assert.equal(result.adjustedMealNutrition[0].nutrition.calories,720);
});
test('meal safety, unknown ingredient and replacement constraints',()=>{
 assert.equal(meals.length,32);
 for(const diet of ['vegan','vegetarian','pescatarian','lactose_free','gluten_free']){
  const p=prefs({dietaryPreferences:[diet]});const plan=generateMealPlan(p);assert.ok(plan.items.length);assert.ok(plan.items.every(i=>compatibleMeal(i.meal,p)));
 }
 const p=prefs({allergens:['milk','eggs','soy','wheat']});const plan=generateMealPlan(p);assert.ok(plan.items.every(i=>i.meal.allergens.every(a=>!p.allergens.includes(a))));
 assert.equal(compatibleMeal({...meals[0],ingredients:[{...meals[0].ingredients[0],ingredientKey:'unknown'}]},p),false);
 const vegan=prefs({dietaryPreferences:['vegan']});const v=generateMealPlan(vegan);assert.throws(()=>replaceMeal(v,v.items[0].id,'eggs-toast',vegan));
 const normal=generateMealPlan(prefs());const replaced=replaceMeal(normal,normal.items[0].id,normal.items[0].meal.id==='chicken-ham-toast'?'oat-berries':'chicken-ham-toast',prefs());
 assert.notDeepEqual(planNutrition(normal),planNutrition(replaced));assert.equal(replaced.status,'review');
});
test('missing/unsafe SKU data warns, never invents packages, prices or unrelated foods',()=>{
 const p=prefs({planningDays:3,dietaryPreferences:['lactose_free']});const plan={...generateMealPlan(p),status:'confirmed'};
 const r=basketFromMealPlan(plan,p,[]);assert.equal(r.status,'empty');assert.equal(r.totalCalories,0);assert.equal(r.estimatedTotalPrice,null);assert.equal(r.budgetStatus,'unknown');assert.equal(isBasketResult(r),true);
 for(const patch of [{packageSize:null,quantityLabel:null},{packageUnit:'ml'},{name:'rice pudding'}])assert.equal(matchProducts('rice',[{...fullCatalog.find(p=>p.name==='rice'),...patch}],p).length,0);
 assert.equal(matchProducts('tofu',[{...fullCatalog.find(p=>p.name==='tofu'),name:'Tofu rella',ingredientsText:'Tofu, caseinate, jalapeno peppers'}],p).length,0);
 const unknownPrice=basketFromMealPlan(plan,p,fullCatalog.map(i=>({...i,priceEstimate:null,priceKind:'unavailable'})));assert.equal(unknownPrice.estimatedTotalPrice,null);
 assert.throws(()=>basketFromMealPlan({...plan,status:'review'},p,fullCatalog));
 const bad=structuredClone(unknownPrice);bad.items[0].plannedConsumptionQuantity=1e9;assert.equal(isBasketResult(bad),false);
});
test('mixed package combinations are considered and unknown prices do not appear free',()=>{
 const r=optimizePackages(requirement({flexible:false,requiredQuantity:1000,minimumAcceptableQuantity:1000,maximumAcceptableQuantity:1000}),[sku(400),sku(600)]);
 assert.equal(r.purchasedQuantity,1000);assert.equal(r.choices.length,2);
 const x=optimizePackages(requirement(),[sku(600,{priceEstimate:null})]);assert.equal(x.choices[0].estimatedPrice,null);
});
module.exports={fullCatalog};
