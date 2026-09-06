import type { MealPlan } from '../../types/meal';
import type { BasketGenerationResult, BasketItem } from '../../types/basket';
import type { Product } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import { ingredients } from '../../data/meals';
import { nutritionTargets } from '../basket/nutritionTargets';
import { groupOf } from '../basket/scoring';
import { aggregateIngredients } from './aggregation';
import { matchProducts, uniqueCatalog } from './matching';
import { optimizePackages } from './packageOptimizer';
import { compatibleMeal, mealNutrition, planNutrition } from './planner';
import { packageWeights } from './config';
import { isMealPlan } from './validation';
import { isSaved } from '../preference-domain';
const round=(n:number)=>Math.round(n*100)/100;
export function basketFromMealPlan(plan: MealPlan, preferences: UserPreferences, catalog: Product[]): BasketGenerationResult {
  if(!isMealPlan(plan)||!isSaved(preferences)||!preferences.onboardingCompleted||plan.status!=='confirmed')throw Error('Confirm a valid meal plan before creating a basket.');
  if(plan.planningDays!==preferences.planningDays||plan.householdSize!==preferences.householdSize)throw Error('Preferences changed. Generate a new meal plan.');
  if(plan.items.some(i=>!compatibleMeal(i.meal,preferences)))throw Error('Meal plan conflicts with current preferences.');
  const requirements=aggregateIngredients(plan),products=uniqueCatalog(catalog),targets=nutritionTargets(preferences);
  const items: BasketItem[]=[],warnings=[...plan.warnings],ratios:Record<string,number>={};let objective=0;
  for(const r of requirements){
    // Never assign the same physical SKU to two non-equivalent ingredient requirements.
    const candidates=matchProducts(r.ingredientKey,products,preferences).filter(p=>!items.some(i=>i.product.id===p.id));
    const solution=optimizePackages(r,candidates,targets.budgetTarget===null?null:targets.budgetTarget/Math.max(1,requirements.length));
    if(!solution){ratios[r.ingredientKey]=0;warnings.push({code:`unmatched_${r.ingredientKey}`,message:`${r.ingredientName}: no safe equivalent SKU with a known compatible package size. This ingredient is missing; its nutrition is excluded from basket coverage.`});continue;}
    objective+=solution.score;ratios[r.ingredientKey]=solution.plannedConsumptionQuantity/r.requiredQuantity;
    for(const choice of solution.choices){
      const n=ingredients[r.ingredientKey].nutritionPer100,factor=choice.plannedConsumptionQuantity/100;
      items.push({product:choice.product,ingredientKey:r.ingredientKey,sourceMealIds:r.sourceMealIds,
        group:groupOf(choice.product),packageCount:choice.packageCount,packageAmount:choice.product.packageSize!,quantityUnit:r.unit,quantityAssumed:false,
        purchasedQuantity:choice.purchasedQuantity,plannedConsumptionQuantity:choice.plannedConsumptionQuantity,leftoverQuantity:choice.leftoverQuantity,
        quantityAdjustmentPercent:round((ratios[r.ingredientKey]-1)*100),totalWeight:r.unit==='g'?choice.purchasedQuantity:null,totalVolume:r.unit==='ml'?choice.purchasedQuantity:null,
        totalCalories:n.calories*factor,totalProtein:n.protein*factor,totalCarbohydrates:n.carbohydrates*factor,totalFat:n.fat*factor,totalFiber:null,
        estimatedPrice:choice.estimatedPrice,reasonSelected:[{code:'ingredient_match',detail:`Matches ${r.ingredientName}; ${candidates.length} compatible package candidates compared.`},
          {code:'package_fit',detail:`Buy ${round(choice.purchasedQuantity)} ${r.unit}, plan ${round(choice.plannedConsumptionQuantity)} ${r.unit}, left for later ${round(choice.leftoverQuantity)} ${r.unit}.`},
          {code:'quantity_adjustment',detail:`Ingredient consumption adjusted ${round((ratios[r.ingredientKey]-1)*100)}% within its allowed range.`}]});
    }
  }
  const n=planNutrition(plan,ratios),knownPriceSubtotal=items.reduce((s,i)=>s+(i.estimatedPrice??0),0);
  const incomplete=requirements.some(r=>ratios[r.ingredientKey]===0);
  const estimatedTotalPrice=items.length&&!incomplete&&items.every(i=>i.estimatedPrice!==null)?round(knownPriceSubtotal):null;
  const budgetDifference=estimatedTotalPrice===null||targets.budgetTarget===null?null:round(estimatedTotalPrice-targets.budgetTarget);
  const budgetStatus=targets.budgetTarget===null?'disabled':budgetDifference===null?'unknown':budgetDifference<=0?'within_budget':budgetDifference<=targets.budgetTarget*.1?'slightly_over':'unachievable';
  if(estimatedTotalPrice===null)warnings.push({code:'unknown_total',message:'Missing prices or ingredient matches: a complete basket cost and budget fit cannot be established.'});
  if(budgetDifference!==null&&budgetDifference>0)warnings.push({code:'budget_exceeded',message:'The selected package estimate exceeds your period budget. Dietary constraints were preserved.'});
  const calorieCoveragePercent=round(n.calories/targets.calorieTarget*100),proteinCoveragePercent=round(n.protein/targets.proteinTarget*100);
  objective+=requirements.filter(r=>ratios[r.ingredientKey]===0).length*10+8*Math.abs(1-calorieCoveragePercent/100)+5*Math.abs(1-proteinCoveragePercent/100);
  if(calorieCoveragePercent<90||calorieCoveragePercent>110||proteinCoveragePercent<90)warnings.push({code:'nutrition_gap',message:'Planned consumption does not closely meet all nutrition targets. Review meals and missing ingredients.'});
  const sum=(key:'purchasedQuantity'|'plannedConsumptionQuantity'|'leftoverQuantity',unit:'g'|'ml')=>items.filter(i=>i.quantityUnit===unit).reduce((s,i)=>s+i[key]!,0);
  const purchased=sum('purchasedQuantity','g'),leftover=sum('leftoverQuantity','g');
  return {engineVersion:'2',mealPlan:plan,ingredientRequirements:requirements,ingredientRatios:ratios,
    adjustedMealNutrition:plan.items.map(i=>({itemId:i.id,nutrition:mealNutrition(i,ratios)})),
    remaining:{totalPurchasedWeight:purchased,totalPlannedConsumption:sum('plannedConsumptionQuantity','g'),totalLeftoverWeight:leftover,
      totalPurchasedVolume:sum('purchasedQuantity','ml'),totalPlannedVolume:sum('plannedConsumptionQuantity','ml'),totalLeftoverVolume:sum('leftoverQuantity','ml'),estimatedWastePercent:purchased?round(leftover/purchased*100):0},
    optimizationWeights:{...packageWeights},status:!items.length?'empty':incomplete||plan.items.length!==preferences.planningDays*3||calorieCoveragePercent<90||calorieCoveragePercent>110||proteinCoveragePercent<90?'partial':'generated',
    items,totalCalories:round(n.calories),totalProtein:round(n.protein),totalCarbohydrates:round(n.carbohydrates),totalFat:round(n.fat),totalFiber:null,
    ...targets,estimatedTotalPrice,knownPriceSubtotal:round(knownPriceSubtotal),budgetDifference,budgetStatus,calorieCoveragePercent,proteinCoveragePercent,
    categoryCoverage:[],warnings,constraintsApplied:['Meal compatibility','Ingredient equivalence','Known package size and unit','Allergen and trace evidence','Ingredient-specific tolerance'],
    exclusions:{unmatchedIngredients:requirements.filter(r=>ratios[r.ingredientKey]===0).length},objective,score:round(100/(1+objective)),iterations:requirements.length};
}
