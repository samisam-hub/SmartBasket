// Read-only hosted-catalog example. Does not modify preferences or create user data.
require('./register-typescript.cjs');
const fs=require('node:fs');const {createClient}=require('@supabase/supabase-js');
const {loadBasketCatalog}=require('../services/basket/catalog.ts');
const {generateMealPlan,mealNutrition}=require('../services/meals/planner.ts');
const {basketFromMealPlan}=require('../services/meals/basket.ts');
const {defaultDraft}=require('../types/preferences.ts');
(async()=>{
 const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
 const catalog=await loadBasketCatalog(client);
 const preferences={...defaultDraft,planningDays:3,dailyCalories:1500,primaryGoal:'high_protein',dietaryPreferences:['lactose_free'],weeklyBudgetEur:100,id:null,userId:null,onboardingCompleted:true,createdAt:'',updatedAt:''};
 const plan={...generateMealPlan(preferences,catalog),status:'confirmed'},result=basketFromMealPlan(plan,preferences,catalog);
 const daily=Array.from({length:3},(_,day)=>({day:day+1,meals:plan.items.filter(i=>i.dayIndex===day).map(i=>({name:i.meal.name,slot:i.mealSlot,servings:i.servings,...mealNutrition(i)}))}));
 fs.mkdirSync('.expo/meals',{recursive:true});fs.writeFileSync('.expo/meals/example.json',JSON.stringify({catalogCount:catalog.length,preferences,daily,result},null,2));
 console.log(JSON.stringify({catalog:catalog.length,daily,status:result.status,products:result.items.length,packages:result.items.reduce((s,i)=>s+i.packageCount,0),calories:result.totalCalories,protein:result.totalProtein,calorieCoverage:result.calorieCoveragePercent,proteinCoverage:result.proteinCoveragePercent,cost:result.estimatedTotalPrice,remaining:result.remaining,warnings:result.warnings},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
