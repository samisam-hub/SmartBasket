// Read-only example from the current hosted catalog. No user preferences or baskets are written.
require('./register-typescript.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const {loadBasketCatalog}=require('../services/basket/catalog.ts');
const {generateBasket}=require('../services/basket/basketGenerator.ts');
const {defaultDraft}=require('../types/preferences.ts');
(async()=>{
  const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
  const products=await loadBasketCatalog(client);
  const preferences={...defaultDraft,dailyCalories:1700,id:null,userId:null,onboardingCompleted:true,createdAt:'',updatedAt:''};
  const started=performance.now(),result=generateBasket(preferences,products),elapsedMs=Math.round(performance.now()-started);
  assert.ok(result.items.length);assert.ok(result.items.every(i=>products.some(p=>p.id===i.product.id)));
  assert.deepEqual(result,generateBasket(preferences,[...products].reverse()));
  const vegan=generateBasket({...preferences,dietaryPreferences:['vegan']},products);
  assert.ok(vegan.items.every(i=>i.product.vegan===true));
  const allergy=generateBasket({...preferences,allergens:['milk']},products);
  fs.mkdirSync('.expo/basket',{recursive:true});fs.writeFileSync('.expo/basket/example.json',JSON.stringify({preferences,result},null,2));
  console.log(JSON.stringify({catalog:products.length,elapsedMs,status:result.status,calories:result.totalCalories,protein:result.totalProtein,
    calorieCoverage:result.calorieCoveragePercent,proteinCoverage:result.proteinCoveragePercent,estimatedTotalPrice:result.estimatedTotalPrice,
    budgetStatus:result.budgetStatus,items:result.items.map(i=>({id:i.product.id,name:i.product.name,count:i.packageCount,packageAmount:i.packageAmount,unit:i.quantityUnit,assumed:i.quantityAssumed})),warnings:result.warnings,
    vegan:{status:vegan.status,items:vegan.items.length,coverage:vegan.calorieCoveragePercent},milkAllergy:{status:allergy.status,items:allergy.items.length,exclusions:allergy.exclusions}}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
