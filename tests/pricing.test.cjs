require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {product,prefs}=require('./basket-fixtures.cjs');
const {estimatePackagePrice,withMissingPriceEstimate}=require('../services/pricing/priceEstimator.ts');
const {fullCatalog}=require('./meal-fixtures.cjs');
const {generateMealPlan}=require('../services/meals/planner.ts');
const {basketFromMealPlan}=require('../services/meals/basket.ts');
const {optimizePackages}=require('../services/meals/packageOptimizer.ts');
const blank=(patch={})=>product(1,{priceEstimate:null,priceKind:'unavailable',...patch});
test('synthetic prices scale with declared packages and preserve input/unknown units',()=>{
 for(const [name,category,quantityLabel,packageSize,packageUnit,expected] of [
 ['Chicken breast','meat','500 g',500,'g',6],['Rice','grains','1 kg',1000,'g',3],['Broccoli','vegetables','500 g',500,'g',1.5],
 ['Eggs','eggs','6 eggs',6,'piece',1.92],['Olive oil','other','500 ml',500,'ml',5],['Almond milk','dairy-alternatives','1 L',1000,'ml',2]]){
 const p=blank({name,category,quantityLabel,packageSize,packageUnit}),r=estimatePackagePrice(p);
 assert.equal(r.priceEstimate,expected);assert.equal(r.currency,'EUR');assert.equal(r.priceEstimateSource,'synthetic_mvp');assert.equal(p.priceEstimate,null);
 }
 const small=blank({name:'Rice',quantityLabel:'500 g'});assert.equal(estimatePackagePrice(small).priceEstimate,1.5);
 for(const patch of [{packageSize:null,quantityLabel:null},{packageSize:1000,quantityLabel:'500g'},{quantityLabel:'1 serving 50g'},{category:'other',name:'Unknown'},{packageUnit:'piece',quantityLabel:'6 pcs',packageSize:6}])assert.equal(estimatePackagePrice(blank(patch)),null);
 const real=blank({priceEstimate:3.99,priceEstimateSource:'future-provider'});assert.equal(withMissingPriceEstimate(real),real);
});
test('whole purchased packages are charged and missing ingredients do not erase selected-item totals',()=>{
 const p=prefs({planningDays:3,dailyCalories:1500,weeklyBudgetEur:100});
 const priced=fullCatalog.map(x=>withMissingPriceEstimate({...x,priceEstimate:null,priceKind:'unavailable'}));
 const plan={...generateMealPlan(p,priced),status:'confirmed'},r=basketFromMealPlan(plan,p,priced);
 assert.ok(r.items.length>5);assert.ok(r.estimatedTotalPrice>0);assert.equal(r.budgetStatus,'within_budget');
 assert.equal(r.estimatedTotalPrice,Math.round(r.items.reduce((s,i)=>s+i.product.priceEstimate*i.packageCount,0)*100)/100);
 assert.equal(r.budgetDifference,Math.round((r.estimatedTotalPrice-100)*100)/100);
 const partial=basketFromMealPlan(plan,p,priced.filter(x=>x.category!=='vegetables'));
 assert.ok(partial.estimatedTotalPrice>0);assert.ok(partial.warnings.some(w=>w.code==='unmatched_cost_excluded'));
 const unknown=basketFromMealPlan(plan,p,priced.map(x=>({...x,priceEstimate:null,priceKind:'unavailable'})));
 assert.equal(unknown.budgetStatus,'price_incomplete');assert.equal(unknown.estimatedTotalPrice,null);
 const low=basketFromMealPlan(plan,{...p,weeklyBudgetEur:1},priced);assert.equal(low.budgetStatus,'over_budget');
 const oats=optimizePackages({requiredQuantity:300,minimumAcceptableQuantity:300,maximumAcceptableQuantity:300,unit:'g',flexible:false},[product(1,{packageSize:500,priceEstimate:1.79})]);
 assert.equal(oats.choices[0].estimatedPrice,1.79);assert.equal(oats.choices[0].plannedConsumptionQuantity,300);
});

test('category demo prices fill unknown packages without fabricating quantities or replacing existing prices',()=>{
 const {estimateCatalogPrice}=require('../services/pricing/priceEstimator.ts');
 const p=blank({name:'1% lowfat chocolate milk',category:'dairy',quantityLabel:null,packageSize:null,packageUnit:null,packageSizeStatus:'unknown'});
 const before=structuredClone(p),estimate=estimateCatalogPrice(p);assert.equal(estimate.priceEstimate,1.99);assert.equal(estimate.priceConfidence,'low');assert.equal(estimate.priceEstimateVersion,'synthetic-category-demo-2');assert.deepEqual(p,before);
 assert.equal(estimateCatalogPrice({...p,priceEstimate:4.99}),null);
 assert.equal(withMissingPriceEstimate(p).packageSize,null);
});
