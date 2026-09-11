import { ingredients, meals } from '../../data/meals';
import { canonicalIngredientKey } from '../../data/ingredient-mappings';
import type { Meal, MealPlan, MealPlanItem, MealSlot, Nutrition } from '../../types/meal';
import type { UserPreferences } from '../../types/preferences';
import type { Product } from '../../types/product';
import { nutritionTargets } from '../basket/nutritionTargets';
import { packagePrice } from '../basket/quantityPlanner';
import { isSaved } from '../preference-domain';
import { mealWeights as w } from './config';
import { matchProducts, uniqueCatalog } from './matching';
export function compatibleMeal(meal: Meal, p: UserPreferences): boolean {
  if (!meal.ingredients.length || !Array.isArray(meal.allergens) || !Array.isArray(meal.dietaryTags)) return false;
  if (p.dietaryPreferences.some(d=>d!=='none'&&!meal.dietaryTags.includes(d)) || p.allergens.some(a=>meal.allergens.includes(a))) return false;
  return meal.ingredients.every(line=>{const def=ingredients[line.ingredientKey];
    return def && Number.isFinite(line.quantity) && line.quantity>0 && line.unit===def.unit &&
      p.dietaryPreferences.every(d=>d==='none'||def.diets.includes(d)) && !p.allergens.some(a=>def.allergens.includes(a));});
}
export function mealNutrition(item: MealPlanItem, ratios: Record<string,number> = {}): Nutrition {
  const n: Nutrition={calories:0,protein:0,carbohydrates:0,fat:0};
  for(const line of item.meal.ingredients) for(const k of Object.keys(n) as (keyof Nutrition)[])
    n[k]+=ingredients[line.ingredientKey].nutritionPer100[k]*line.quantity*item.servings/item.meal.servings*(ratios[canonicalIngredientKey(line.ingredientKey)]??ratios[line.ingredientKey]??1)/100;
  return n;
}
export function planNutrition(plan: MealPlan, ratios: Record<string,number> = {}): Nutrition {
  return plan.items.reduce((sum,item)=>{const n=mealNutrition(item,ratios);for(const k of Object.keys(sum) as (keyof Nutrition)[])sum[k]+=n[k];return sum;}, {calories:0,protein:0,carbohydrates:0,fat:0});
}
const slots: MealSlot[]=['snack','breakfast','lunch','dinner'];
const fitsSlot = (meal: Meal, slot: MealSlot) => slot==='breakfast'||slot==='snack' ? meal.mealType===slot : meal.mealType==='lunch'||meal.mealType==='dinner';
export function generateMealPlan(p: UserPreferences, catalog: Product[] = []): MealPlan {
  if (!isSaved(p) || !p.onboardingCompleted) throw Error('Complete valid preferences before planning meals.');
  const targets=nutritionTargets(p), products=uniqueCatalog(catalog);
  const dailyCalories=targets.calorieTarget/(p.planningDays*p.householdSize);
  const plan: MealPlan={version:'1',snacksIncluded:true,planningDays:p.planningDays,householdSize:p.householdSize,targetCalories:targets.calorieTarget,targetProtein:targets.proteinTarget,status:'review',items:[],warnings:[],...(p.participants?{participants:structuredClone(p.participants)}:{})};
  const compatible=meals.filter(m=>compatibleMeal(m,p));
  const ingredientCosts=new Map(Object.keys(ingredients).map(key=>{
    const matches=matchProducts(key,products,p), priced=matches.filter(x=>packagePrice(x)!==null);
    return [key,{available:matches.length>0,cost:priced.length?Math.min(...priced.map(x=>packagePrice(x)!/x.packageSize!)):null}];
  }));
  for(let day=0;day<p.planningDays;day++) for(const slot of slots){
    const allOptions=compatible.filter(m=>fitsSlot(m,slot));
    // Include each spoken meal wish once when compatible; keep the usual portion scoring.
    const wished=allOptions.filter(m=>p.preferredMealIds?.includes(m.id)&&!plan.items.some(i=>i.meal.id===m.id));
    const options=wished.length?wished:allOptions;
    if(!options.length){plan.warnings.push({code:`missing_${day}_${slot}`,message:`Day ${day+1}: no compatible ${slot} meal. No unsafe replacement was selected.`});continue;}
    const fraction=slot==='snack'?0.08:slot==='breakfast'?0.25:0.32;
    const used=new Set(plan.items.flatMap(i=>i.meal.ingredients.map(l=>l.ingredientKey)));
    const prior=plan.items.filter(i=>i.dayIndex===day).reduce((n,i)=>{const x=mealNutrition(i);return {calories:n.calories+x.calories/p.householdSize,protein:n.protein+x.protein/p.householdSize};},{calories:0,protein:0});
    const candidates=options.flatMap(meal=>(slot==='snack'?[1]:slot==='dinner'?[Math.max(0.5,Math.min(1.5,(dailyCalories-prior.calories)/meal.caloriesPerServing))]:[0.5,0.75,1,1.25,1.5]).map(scale=>{
      const servings=p.householdSize*scale, calories=meal.caloriesPerServing*scale, protein=meal.proteinPerServing*scale;
      const calorieGoal=slot==='dinner'?Math.max(dailyCalories*0.2,dailyCalories-prior.calories):dailyCalories*fraction;
      const proteinGoal=slot==='dinner'?Math.max(targets.dailyProteinTarget*0.2,targets.dailyProteinTarget-prior.protein):targets.dailyProteinTarget*fraction;
      const repeat=plan.items.filter(i=>i.meal.id===meal.id).length;
      const sameDay=plan.items.some(i=>i.dayIndex===day&&i.meal.id===meal.id)?1:0;
      const reuse=meal.ingredients.filter(l=>used.has(l.ingredientKey)).length;
      const knownCost=meal.ingredients.reduce((sum,l)=>sum+(ingredientCosts.get(l.ingredientKey)?.cost??0)*l.quantity*servings,0);
      const unavailable=meal.ingredients.filter(l=>!ingredientCosts.get(l.ingredientKey)?.available).length;
      const score=w.calories*Math.abs(calories-calorieGoal)/calorieGoal+w.protein*Math.abs(protein-proteinGoal)/proteinGoal+
        w.repetition*repeat+w.sameDay*sameDay-w.reuse*reuse+w.simplicity*meal.ingredients.length+w.unavailable*unavailable+
        (targets.budgetTarget ? w.budget*knownCost/(targets.budgetTarget/(p.planningDays*4)):0);
      return {meal,servings,score};
    })).sort((a,b)=>a.score-b.score||a.meal.id.localeCompare(b.meal.id)||a.servings-b.servings);
    const chosen=candidates[0]; plan.items.push({id:`day-${day}-${slot}`,dayIndex:day,mealSlot:slot,meal:chosen.meal,servings:chosen.servings});
  }
  const order:MealSlot[]=['breakfast','lunch','dinner','snack'];
  plan.items.sort((a,b)=>a.dayIndex-b.dayIndex||order.indexOf(a.mealSlot)-order.indexOf(b.mealSlot));
  if(compatible.length<6) plan.warnings.push({code:'limited_variety',message:'Few compatible curated meals are available; repetition may be necessary.'});
  plan.warnings.push({code:'recipe_estimates',message:'Meal nutrition uses curated development ingredient estimates and raw/dry weights. Check product labels and preparation suitability.'});
  return plan;
}
export function replacementMeals(plan: MealPlan, itemId: string, preferences: UserPreferences): Meal[] {
  const item=plan.items.find(i=>i.id===itemId); if(!item)return [];
  return meals.filter(m=>m.id!==item.meal.id&&compatibleMeal(m,preferences)&&
    fitsSlot(m,item.mealSlot)).sort((a,b)=>a.name.localeCompare(b.name));
}
export function replaceMeal(plan: MealPlan, itemId: string, mealId: string, p: UserPreferences): MealPlan {
  const meal=replacementMeals(plan,itemId,p).find(m=>m.id===mealId);if(!meal)throw Error('This replacement is not compatible.');
  const previous=plan.items.find(i=>i.id===itemId)!;
  const updated=plan.items.map(i=>i.id===itemId?{...i,meal,servings:plan.householdSize}:i);
  // Preserve the chosen meal's normal portion; distribute the remaining daily budget
  // over the other main meals. Snacks stay small and are always counted.
  const flexible=updated.filter(i=>i.dayIndex===previous.dayIndex&&i.id!==itemId&&i.mealSlot!=='snack');
  const fixed=updated.filter(i=>i.dayIndex===previous.dayIndex&&!flexible.includes(i)).reduce((n,i)=>n+mealNutrition(i).calories,0);
  const available=plan.targetCalories/plan.planningDays-fixed;
  const total=flexible.reduce((n,i)=>n+mealNutrition(i).calories,0);
  const factor=total>0?Math.max(0,available)/total:1;
  return {...plan,status:'review',items:updated.map(i=>flexible.includes(i)?{...i,servings:Math.max(plan.householdSize*0.5,Math.min(plan.householdSize*1.5,i.servings*factor))}:i)};
}
