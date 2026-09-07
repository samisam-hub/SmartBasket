// Read-only hosted verification. Does not create saved baskets or alter preferences.
require('./register-typescript.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const {loadBasketCatalog}=require('../services/basket/catalog.ts');
const {packagePrice}=require('../services/basket/quantityPlanner.ts');
const {generateMealPlan}=require('../services/meals/planner.ts');
const {basketFromMealPlan}=require('../services/meals/basket.ts');
const {isBasketResult}=require('../services/basket/persistence.ts');
const {defaultDraft}=require('../types/preferences.ts');
(async()=>{
 const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
 const products=await loadBasketCatalog(client);
 const preferences={...defaultDraft,householdSize:1,planningDays:3,dailyCalories:1500,weeklyBudgetEur:100,primaryGoal:'high_protein',dietaryPreferences:['lactose_free'],id:null,userId:null,onboardingCompleted:true,createdAt:'',updatedAt:''};
 const result=basketFromMealPlan({...generateMealPlan(preferences,products),status:'confirmed'},preferences,products);
 assert.ok(isBasketResult(result));assert.ok(result.items.length>5);assert.ok(result.estimatedTotalPrice>0);assert.notEqual(result.budgetStatus,'price_incomplete');
 assert.ok(result.items.every(i=>i.estimatedPrice!==null));
 assert.equal(result.estimatedTotalPrice,Math.round(result.items.reduce((sum,i)=>sum+packagePrice(i.product)*i.packageCount,0)*100)/100);
 const beforePath='.expo/pricing/before.json';
 if(fs.existsSync(beforePath)){
  const before=JSON.parse(fs.readFileSync(beforePath));assert.equal(before.length,products.length);
  const priceKeys=['priceEstimate','priceKind','currency','priceEstimateSource','priceConfidence','priceEstimateVersion','updatedAt'];
  for(const old of before){const current=products.find(p=>p.id===old.id);assert.ok(current);for(const [key,value] of Object.entries(old))if(!priceKeys.includes(key))assert.deepEqual(current[key],value,`${old.id}/${key}`);
   if(old.priceEstimate!==null)for(const key of priceKeys.filter(k=>k!=='updatedAt'))assert.deepEqual(current[key],old[key]);
  }
 }
 const priced=products.filter(p=>packagePrice(p)!==null).length;
 const report={productCount:products.length,priced,unpriced:products.length-priced,coveragePercent:Math.round(priced/products.length*10000)/100,
  missing:products.filter(p=>packagePrice(p)===null).map(p=>({id:p.id,name:p.name,category:p.category,quantity:p.quantityLabel,packageSize:p.packageSize,packageUnit:p.packageUnit})),
  examples:['4061458010627','4056489095736','4250241204668','0029653831007','4104420248823'].map(b=>products.find(p=>p.barcode===b)),
  almondMilk:products.filter(p=>p.category==='dairy-alternatives'&&/almond|mandel/i.test(p.name)).slice(0,3),
  preferences,result};
 fs.mkdirSync('.expo/pricing',{recursive:true});fs.writeFileSync('.expo/pricing/after.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({total:products.length,priced,unpriced:report.unpriced,coverage:report.coveragePercent,items:result.items.length,packages:result.items.reduce((s,i)=>s+i.packageCount,0),totalPrice:result.estimatedTotalPrice,budgetDifference:result.budgetDifference,budgetStatus:result.budgetStatus,calorieCoverage:result.calorieCoveragePercent,unmatched:result.exclusions.unmatchedIngredients}));
})().catch(e=>{console.error(e);process.exitCode=1;});
