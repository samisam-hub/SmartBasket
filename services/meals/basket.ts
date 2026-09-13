import type { MealPlan } from '../../types/meal';
import type { BasketGenerationResult, BasketItem } from '../../types/basket';
import type { Product } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import { labels } from '../../types/preferences';
import { ingredients } from '../../data/meals';
import { nutritionTargets } from '../basket/nutritionTargets';
import { groupOf } from '../basket/scoring';
import { aggregateIngredients } from './aggregation';
import { diagnoseMatches, uniqueCatalog } from './matching';
import { optimizePackages } from './packageOptimizer';
import { compatibleMeal, mealNutrition, planNutrition } from './planner';
import { packageWeights } from './config';
import { isMealPlan } from './validation';
import { isSaved } from '../preference-domain';
import type { PantryLot, PantryUse } from '../../types/pantry';
import { allocatePantry } from '../pantry-domain';
const round=(n:number)=>Math.round(n*100)/100;
export function basketFromMealPlan(plan: MealPlan, preferences: UserPreferences, catalog: Product[], pantry: PantryLot[] = []): BasketGenerationResult {
  if(!isMealPlan(plan)||!isSaved(preferences)||!preferences.onboardingCompleted||plan.status!=='confirmed')throw Error('Confirm a valid meal plan before creating a basket.');
  if(plan.planningDays!==preferences.planningDays||plan.householdSize!==preferences.householdSize)throw Error('Preferences changed. Generate a new meal plan.');
  if(plan.items.some(i=>!compatibleMeal(i.meal,preferences)))throw Error('Meal plan conflicts with current preferences.');
  const requirements=aggregateIngredients(plan),products=uniqueCatalog(catalog),targets=nutritionTargets(preferences);
  const items: BasketItem[]=[],warnings=[...plan.warnings],ratios:Record<string,number>={};let objective=0;
  const matchingDiagnostics:NonNullable<BasketGenerationResult['matchingDiagnostics']>=[];
  const pantryUsed: PantryUse[] = [], stock = structuredClone(pantry);
  for(const r of requirements){
    const uses = allocatePantry(r, stock, preferences);
    pantryUsed.push(...uses);
    for (const use of uses) { const lot = stock.find(l => l.id === use.lotId)!; lot.quantity -= use.quantity; }
    const fromPantry = uses.reduce((sum, use) => sum + use.quantity, 0);
    const needed = Math.max(0, r.requiredQuantity - fromPantry);
    if (needed < .001) { ratios[r.ingredientKey] = 1; continue; }
    const purchaseRequirement = { ...r, requiredQuantity: needed, minimumAcceptableQuantity: Math.max(.001, r.minimumAcceptableQuantity - fromPantry), maximumAcceptableQuantity: Math.max(needed, r.maximumAcceptableQuantity - fromPantry) };
    // Never assign the same physical SKU to two non-equivalent ingredient requirements.
    const diagnostic=diagnoseMatches(r.ingredientKey,products,preferences);
    const candidates=diagnostic.candidates.flatMap(c=>c.optimizationProduct?[c.optimizationProduct]:[]).filter(p=>!items.some(i=>i.product.id===p.id));
    const solution=optimizePackages(purchaseRequirement,candidates,targets.budgetTarget===null?null:targets.budgetTarget/Math.max(1,requirements.length),Object.fromEntries(diagnostic.candidates.map(c=>[c.product.id,c.score])));
    const safetyReasons=['allergen_metadata_unknown','allergen_conflict','known_dietary_conflict'].filter(reason=>diagnostic.rejected[reason]);
    const unresolvedReason=solution?null:diagnostic.candidates.length?[...new Set(diagnostic.candidates.map(c=>c.packageIssue??'product_already_allocated'))].join(', '):safetyReasons.join(', ')||'no_compatible_product';
    matchingDiagnostics.push({ingredientKey:r.ingredientKey,candidatesFound:diagnostic.candidates.length,rejected:diagnostic.rejected,eligibleProductIds:candidates.map(p=>p.id),selectedProductIds:solution?.choices.map(c=>c.product.id)??[],unresolvedReason});
    if(!solution){
      const safetyDetails=[
        diagnostic.rejected.allergen_metadata_unknown ? `${diagnostic.rejected.allergen_metadata_unknown} matching products lack the explicit free-from evidence required by your selected allergies (${preferences.allergens.map(a=>labels[a]).join(', ')}). This does not mean they contain those allergens.` : '',
        diagnostic.rejected.allergen_conflict ? `${diagnostic.rejected.allergen_conflict} matching products have a declared ingredient or trace conflict with your selected allergies.` : '',
        diagnostic.rejected.known_dietary_conflict ? `${diagnostic.rejected.known_dietary_conflict} matching products conflict with your dietary preferences.` : '',
      ].filter(Boolean).join(' ');
      ratios[r.ingredientKey]=fromPantry/r.requiredQuantity;warnings.push({code:`unmatched_${r.ingredientKey}`,message:`${r.ingredientName}: ${diagnostic.candidates.length?`${diagnostic.candidates.length} ingredient matches found, but package optimization is unresolved (${unresolvedReason}).`:safetyDetails||'No compatible ingredient product found.'} Uncovered quantities are excluded from shopping coverage.`});continue;
    }
    objective+=solution.score;ratios[r.ingredientKey]=(solution.plannedConsumptionQuantity+fromPantry)/r.requiredQuantity;
    for(const choice of solution.choices){
      const match=diagnostic.candidates.find(c=>c.product.id===choice.product.id)!;
      if(match.dietaryUnknown.length&&!warnings.some(w=>w.code===`diet_uncertain_${r.ingredientKey}`)){
        const unverified=match.dietaryUnknown.filter(d=>d!=='diabetes');
        warnings.push({code:`diet_uncertain_${r.ingredientKey}`,message:`${r.ingredientName}: ${[
          unverified.length?`selected product has unverified lifestyle labels (${unverified.join(', ')}); it is not marked as verified free-from.`:'',
          match.dietaryUnknown.includes('diabetes')?'the selected product declares no sugar content, so it could not be checked against your diabetes-friendly preference.':'',
        ].filter(Boolean).join(' ')} Check the packaging.`});
      }
      const n=ingredients[r.ingredientKey].nutritionPer100,factor=choice.plannedConsumptionQuantity/100;
      items.push({product:match.product,ingredientKey:r.ingredientKey,sourceMealIds:r.sourceMealIds,
        group:groupOf(choice.product),packageCount:choice.packageCount,packageAmount:choice.product.packageSize!,quantityUnit:r.unit,quantityAssumed:false,
        purchasedQuantity:choice.purchasedQuantity,plannedConsumptionQuantity:choice.plannedConsumptionQuantity,leftoverQuantity:choice.leftoverQuantity,
        quantityAdjustmentPercent:round((ratios[r.ingredientKey]-1)*100),totalWeight:r.unit==='g'?choice.purchasedQuantity:null,totalVolume:r.unit==='ml'?choice.purchasedQuantity:null,
        totalCalories:n.calories*factor,totalProtein:n.protein*factor,totalCarbohydrates:n.carbohydrates*factor,totalFat:n.fat*factor,totalFiber:null,
        estimatedPrice:choice.estimatedPrice,reasonSelected:[{code:'ingredient_match',detail:`${match.stage} match for ${r.ingredientName}, compatibility score ${match.score}; ${candidates.length} package candidates compared.`},
          {code:'package_fit',detail:`Buy ${round(choice.purchasedQuantity)} ${r.unit}, plan ${round(choice.plannedConsumptionQuantity)} ${r.unit}, left for later ${round(choice.leftoverQuantity)} ${r.unit}.`},
          {code:'quantity_adjustment',detail:`Ingredient consumption adjusted ${round((ratios[r.ingredientKey]-1)*100)}% within its allowed range.`}]});
    }
  }
  const n=planNutrition(plan,ratios),knownPriceSubtotal=items.reduce((s,i)=>s+(i.estimatedPrice??0),0);
  const incomplete=requirements.some(r=>ratios[r.ingredientKey]<r.minimumAcceptableQuantity/r.requiredQuantity-.0001);
  if(matchingDiagnostics.some(d=>d.unresolvedReason?.includes('allergen_metadata_unknown')))warnings.unshift({code:'allergy_evidence_gap',message:`Your selected allergies (${preferences.allergens.map(a=>labels[a]).join(', ')}) require explicit free-from evidence that this catalog often lacks. Matching foods are excluded when that evidence is unknown.${preferences.allergens.includes('milk')&&preferences.dietaryPreferences.includes('lactose_free')?' Milk allergy and lactose-free are separate settings; lactose-free alone does not satisfy the milk-allergy check.':''}`});
  const estimatedTotalPrice=(items.length||pantryUsed.length)&&items.every(i=>i.estimatedPrice!==null)?round(knownPriceSubtotal):null;
  const budgetDifference=estimatedTotalPrice===null||targets.budgetTarget===null?null:round(estimatedTotalPrice-targets.budgetTarget);
  const budgetStatus=targets.budgetTarget===null?'disabled':budgetDifference===null?(items.length?'price_incomplete':'unknown'):budgetDifference<=0?'within_budget':budgetDifference<=targets.budgetTarget*.1?'slightly_over':'over_budget';
  if(estimatedTotalPrice===null)warnings.push({code:'unknown_total',message:items.length?'Some selected products lack usable price estimates. A selected-basket total cannot be established.':'No products were selected, so a basket cost cannot be established.'});
  if(incomplete&&estimatedTotalPrice!==null)warnings.push({code:'unmatched_cost_excluded',message:'Estimated total and budget fit cover selected packages only. Unmatched ingredients are not included; the complete meal-plan cost remains unknown.'});
  if(items.some(i=>i.product.priceEstimateSource==='synthetic_mvp'))warnings.push({code:'synthetic_prices',message:'Prices are synthetic development estimates based on product type and package size, not live retailer offers.'});
  if(budgetDifference!==null&&budgetDifference>0)warnings.push({code:'budget_exceeded',message:'The selected package estimate exceeds your period budget. Dietary constraints were preserved.'});
  const calorieCoveragePercent=round(n.calories/targets.calorieTarget*100),proteinCoveragePercent=round(n.protein/targets.proteinTarget*100);
  objective+=requirements.filter(r=>ratios[r.ingredientKey]===0).length*10+8*Math.abs(1-calorieCoveragePercent/100)+5*Math.abs(1-proteinCoveragePercent/100);
  if(calorieCoveragePercent<90||calorieCoveragePercent>110||proteinCoveragePercent<90)warnings.push({code:'nutrition_gap',message:'Planned consumption does not closely meet all nutrition targets. Review meals and missing ingredients.'});
  const sum=(key:'purchasedQuantity'|'plannedConsumptionQuantity'|'leftoverQuantity',unit:'g'|'ml')=>items.filter(i=>i.quantityUnit===unit).reduce((s,i)=>s+i[key]!,0);
  const purchased=sum('purchasedQuantity','g'),leftover=sum('leftoverQuantity','g');
  return {engineVersion:'2',mealPlan:plan,ingredientRequirements:requirements,ingredientRatios:ratios,matchingDiagnostics,pantryUsed,
    adjustedMealNutrition:plan.items.map(i=>({itemId:i.id,nutrition:mealNutrition(i,ratios)})),
    remaining:{totalPurchasedWeight:purchased,totalPlannedConsumption:sum('plannedConsumptionQuantity','g'),totalLeftoverWeight:leftover,
      totalPurchasedVolume:sum('purchasedQuantity','ml'),totalPlannedVolume:sum('plannedConsumptionQuantity','ml'),totalLeftoverVolume:sum('leftoverQuantity','ml'),estimatedWastePercent:purchased?round(leftover/purchased*100):0},
    optimizationWeights:{...packageWeights},status:!items.length&&!pantryUsed.length?'empty':incomplete||plan.items.length!==preferences.planningDays*(plan.snacksIncluded?4:3)||calorieCoveragePercent<90||calorieCoveragePercent>110||proteinCoveragePercent<90?'partial':'generated',
    items,totalCalories:round(n.calories),totalProtein:round(n.protein),totalCarbohydrates:round(n.carbohydrates),totalFat:round(n.fat),totalFiber:null,
    ...targets,estimatedTotalPrice,knownPriceSubtotal:round(knownPriceSubtotal),budgetDifference,budgetStatus,calorieCoveragePercent,proteinCoveragePercent,
    categoryCoverage:[],warnings,constraintsApplied:['Meal compatibility','Ingredient equivalence','Known package size and unit','Allergen and trace evidence','Ingredient-specific tolerance'],
    exclusions:{unmatchedIngredients:requirements.filter(r=>ratios[r.ingredientKey]===0).length},objective,score:round(100/(1+objective)),iterations:requirements.length};
}
