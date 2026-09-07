// Read-only live diagnostics. No OFF requests, user data writes or catalog mutations.
require('./register-typescript.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const {loadBasketCatalog}=require('../services/basket/catalog.ts');
const {ingredients}=require('../data/meals.ts');
const {diagnoseMatches}=require('../services/meals/matching.ts');
const {generateMealPlan}=require('../services/meals/planner.ts');
const {basketFromMealPlan}=require('../services/meals/basket.ts');
const {defaultDraft}=require('../types/preferences.ts');
(async()=>{
 const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
 const products=await loadBasketCatalog(client);fs.mkdirSync('.expo/phase3c',{recursive:true});
 if(!fs.existsSync('.expo/phase3c/catalog-before.json'))fs.writeFileSync('.expo/phase3c/catalog-before.json',JSON.stringify(products));
 const before=JSON.parse(fs.readFileSync('.expo/phase3c/catalog-before.json'));
 const p={...defaultDraft,planningDays:3,dailyCalories:1500,primaryGoal:'high_protein',weeklyBudgetEur:100,id:null,userId:null,onboardingCompleted:true,createdAt:'',updatedAt:''};
 const compact=(key,catalog,preferences)=>{const d=diagnoseMatches(key,catalog,preferences);return {ingredientKey:key,candidates:d.candidates.length,eligible:d.candidates.filter(c=>c.optimizationProduct).length,
  rejected:d.rejected,products:d.candidates.map(c=>({id:c.product.id,barcode:c.product.barcode,name:c.product.name,category:c.product.category,quantity:c.product.quantityLabel,packageSize:c.optimizationProduct?.packageSize??null,
   packageUnit:c.optimizationProduct?.packageUnit??null,packageIssue:c.packageIssue,score:c.score,stage:c.stage,dietaryUnknown:c.dietaryUnknown,sourceUrl:c.product.sourceUrl}))};};
 const coverage=Object.keys(ingredients).map(key=>compact(key,products,p));
 const lactose={...p,dietaryPreferences:['lactose_free']};
 const examples=[p,lactose].map(preferences=>{const mealPlan={...generateMealPlan(preferences,products),status:'confirmed'},result=basketFromMealPlan(mealPlan,preferences,products);
  assert.equal(mealPlan.items.length,9);assert.ok(result.items.length>=5);assert.ok(result.calorieCoveragePercent>=80);assert.ok(result.items.every(i=>products.some(p=>p.id===i.product.id)));
  assert.deepEqual(result,basketFromMealPlan(mealPlan,preferences,[...products].reverse()));return {preferences,result};});
 // Schema backfill may change updatedAt; original product facts must be preserved.
 for(const old of before){const current=products.find(p=>p.id===old.id);assert.ok(current);for(const [key,value] of Object.entries(old))if(!['updatedAt','priceEstimate','priceKind','currency','priceEstimateSource','priceConfidence','priceEstimateVersion'].includes(key))assert.deepEqual(current[key],value,`Original product changed: ${old.id}/${key}`);}
 const report={catalogCount:products.length,originalCount:before.length,originalFactsPreserved:true,coverage,
  existingCatalogWithNewLogic:Object.keys(ingredients).map(key=>compact(key,before,lactose)),examples};
 fs.writeFileSync('.expo/phase3c/after.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({catalog:products.length,resolved:coverage.filter(x=>x.eligible).length,total:coverage.length,examples:examples.map(x=>({diet:x.preferences.dietaryPreferences,products:x.result.items.length,packages:x.result.items.reduce((s,i)=>s+i.packageCount,0),kcal:x.result.totalCalories,protein:x.result.totalProtein,calorieCoverage:x.result.calorieCoveragePercent,proteinCoverage:x.result.proteinCoveragePercent,requirements:x.result.ingredientRequirements.length,resolved:x.result.matchingDiagnostics.filter(d=>d.selectedProductIds.length).length}))},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
