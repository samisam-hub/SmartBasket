import { t , term } from '../i18n';
import type { AnyMealPlan } from '../../types/meal';
import type { BasketGenerationResult, BasketItem } from '../../types/basket';
import type { Product } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import { ingredients } from '../../data/meals';
import { weekNutritionTargets } from './weekTargets';
import { nutritionTargets } from '../basket/nutritionTargets';
import { groupOf } from '../basket/scoring';
import { aggregateIngredients } from './aggregation';
import { diagnoseMatches, uniqueCatalog } from './matching';
import { optimizePackages } from './packageOptimizer';
import { compatibleMeal, mealNutrition, planNutrition } from './planner';
import { packageWeights } from './config';
import { isAnyMealPlan, openPlanSlots } from './validation';
import { isWeekPlanShape } from './weekPlan';
import { isSaved } from '../preference-domain';
import type { PantryLot, PantryUse } from '../../types/pantry';
import { allocatePantry } from '../pantry-domain';
import { isCook } from './choices';
import { matchReadyMeals } from './readyMeals';
const round=(n:number)=>Math.round(n*100)/100;
export function basketFromMealPlan(plan: AnyMealPlan, preferences: UserPreferences, catalog: Product[], pantry: PantryLot[] = []): BasketGenerationResult {
  if(!isAnyMealPlan(plan)||!isSaved(preferences)||!preferences.onboardingCompleted||plan.status!=='confirmed')throw Error(t('mealBasket.confirmPlan'));
  // A calendar week carries its own days; only a fixed period has to match the saved planning period.
  if(plan.householdSize!==preferences.householdSize||(!isWeekPlanShape(plan)&&plan.planningDays!==preferences.planningDays))throw Error(t('mealBasket.settingsChanged'));
  if(plan.items.some(i=>isCook(i)&&!compatibleMeal(i.meal,preferences)))throw Error(t('mealBasket.planMismatch'));
  const requirements=aggregateIngredients(plan),products=uniqueCatalog(catalog);
  // Coverage is measured over what the household chose to eat at home, so neither an unplanned
  // day nor a dropped slot counts as a nutrition gap. The floor keeps the targets above zero.
  const targets=isWeekPlanShape(plan) ? weekNutritionTargets(plan, preferences) : nutritionTargets(preferences);
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
        diagnostic.rejected.allergen_metadata_unknown ? t('mealBasket.allergenEvidenceMissing', { count: diagnostic.rejected.allergen_metadata_unknown, allergens: preferences.allergens.map(a=>term(a)).join(', ') }) : '',
        diagnostic.rejected.allergen_conflict ? t('mealBasket.allergenConflict', { count: diagnostic.rejected.allergen_conflict }) : '',
        diagnostic.rejected.known_dietary_conflict ? t('mealBasket.dietConflict', { count: diagnostic.rejected.known_dietary_conflict }) : '',
      ].filter(Boolean).join(' ');
      ratios[r.ingredientKey]=fromPantry/r.requiredQuantity;warnings.push({code:`unmatched_${r.ingredientKey}`,message:t('mealBasket.unmatched', { ingredient: r.ingredientName, detail: diagnostic.candidates.length
        ? t('mealBasket.unresolvedPackages', { count: diagnostic.candidates.length, reasons: unresolvedReason?.split(', ').map(term).join(', ') ?? '' })
        : safetyDetails||t('mealBasket.noProduct') })});continue;
    }
    objective+=solution.score;ratios[r.ingredientKey]=(solution.plannedConsumptionQuantity+fromPantry)/r.requiredQuantity;
    for(const choice of solution.choices){
      const match=diagnostic.candidates.find(c=>c.product.id===choice.product.id)!;
      if(match.dietaryUnknown.length&&!warnings.some(w=>w.code===`diet_uncertain_${r.ingredientKey}`)){
        const unverified=match.dietaryUnknown.filter(d=>d!=='diabetes');
        warnings.push({code:`diet_uncertain_${r.ingredientKey}`,message:`${r.ingredientName}: ${[
          unverified.length?t('mealBasket.unverifiedLabels', { labels: unverified.map(term).join(', ') }):'',
          match.dietaryUnknown.includes('diabetes')?t('mealBasket.noSugarData'):'',
        ].filter(Boolean).join(' ')} Prüfe die Verpackung.`});
      }
      const n=ingredients[r.ingredientKey].nutritionPer100,factor=choice.plannedConsumptionQuantity/100;
      items.push({product:match.product,ingredientKey:r.ingredientKey,sourceMealIds:r.sourceMealIds,
        group:groupOf(choice.product),packageCount:choice.packageCount,packageAmount:choice.product.packageSize!,quantityUnit:r.unit,quantityAssumed:false,
        purchasedQuantity:choice.purchasedQuantity,plannedConsumptionQuantity:choice.plannedConsumptionQuantity,leftoverQuantity:choice.leftoverQuantity,
        quantityAdjustmentPercent:round((ratios[r.ingredientKey]-1)*100),totalWeight:r.unit==='g'?choice.purchasedQuantity:null,totalVolume:r.unit==='ml'?choice.purchasedQuantity:null,
        totalCalories:n.calories*factor,totalProtein:n.protein*factor,totalCarbohydrates:n.carbohydrates*factor,totalFat:n.fat*factor,totalFiber:null,
        estimatedPrice:choice.estimatedPrice,reasonSelected:[{code:'ingredient_match',detail:t('mealBasket.ingredientMatch', { stage: term(match.stage), ingredient: r.ingredientName, score: match.score, options: candidates.length })},
          {code:'package_fit',detail:t('mealBasket.packageFit', { bought: round(choice.purchasedQuantity), planned: round(choice.plannedConsumptionQuantity), leftover: round(choice.leftoverQuantity), unit: r.unit })},
          {code:'quantity_adjustment',detail:t('mealBasket.quantityAdjustment', { percent: round((ratios[r.ingredientKey]-1)*100) })}]});
    }
  }
  const ready = matchReadyMeals(plan, preferences, products.filter(p=>!items.some(i=>i.product.id===p.id)), targets.budgetTarget===null?null:targets.budgetTarget-items.reduce((sum,i)=>sum+(i.estimatedPrice??0),0));
  plan = ready.plan; items.push(...ready.items); requirements.push(...ready.requirements); warnings.push(...ready.warnings);
  for (const r of ready.requirements) ratios[r.ingredientKey] = 1;
  const outside = plan.items.some(i=>i.mealMode==='eat_out');
  // Only a slot the household chose and left undecided makes a basket partial; a day nobody
  // planned and a slot they deliberately dropped are not gaps.
  const openSlots = isWeekPlanShape(plan) ? openPlanSlots(plan).reduce((n,day)=>n+day.slots.length,0)
    : (plan.items.length!==preferences.planningDays*(plan.snacksIncluded?4:3)?1:0);
  if (isWeekPlanShape(plan)) for (const day of openPlanSlots(plan))
    warnings.push({code:`open_slot_${day.date}`,message:t('mealBasket.openSlot', { date: day.date, slots: day.slots.map(term).join(', ') })});
  if (outside) warnings.push({code:'eat_out_unknown',message:t('mealBasket.eatOut')});
  const n=planNutrition(plan,ratios),knownPriceSubtotal=items.reduce((s,i)=>s+(i.estimatedPrice??0),0);
  const incomplete=ready.unmatched>0||requirements.some(r=>ratios[r.ingredientKey]<r.minimumAcceptableQuantity/r.requiredQuantity-.0001);
  if(matchingDiagnostics.some(d=>d.unresolvedReason?.includes('allergen_metadata_unknown')))warnings.unshift({code:'allergy_evidence_gap',message:t('mealBasket.allergyGap', { allergens: preferences.allergens.map(a=>term(a)).join(', '), milk: preferences.allergens.includes('milk')&&preferences.dietaryPreferences.includes('lactose_free')?t('mealBasket.milkNote'):'' })});
  const estimatedTotalPrice=(items.length||pantryUsed.length)&&items.every(i=>i.estimatedPrice!==null)?round(knownPriceSubtotal):null;
  const budgetDifference=estimatedTotalPrice===null||targets.budgetTarget===null?null:round(estimatedTotalPrice-targets.budgetTarget);
  const budgetStatus=targets.budgetTarget===null?'disabled':budgetDifference===null?(items.length?'price_incomplete':'unknown'):budgetDifference<=0?'within_budget':budgetDifference<=targets.budgetTarget*.1?'slightly_over':'over_budget';
  if(estimatedTotalPrice===null)warnings.push({code:'unknown_total',message:items.length?t('mealBasket.noPriceEstimates'):t('mealBasket.noProducts')});
  if(incomplete&&estimatedTotalPrice!==null)warnings.push({code:'unmatched_cost_excluded',message:t('mealBasket.pricesPartial')});
  if(items.some(i=>i.product.priceEstimateSource==='synthetic_mvp'))warnings.push({code:'synthetic_prices',message:t('mealBasket.pricesDev')});
  if(budgetDifference!==null&&budgetDifference>0)warnings.push({code:'budget_exceeded',message:t('mealBasket.overBudget')});
  const calorieCoveragePercent=round(n.calories/targets.calorieTarget*100),proteinCoveragePercent=round(n.protein/targets.proteinTarget*100);
  objective+=requirements.filter(r=>ratios[r.ingredientKey]===0).length*10+8*Math.abs(1-calorieCoveragePercent/100)+5*Math.abs(1-proteinCoveragePercent/100);
  if(calorieCoveragePercent<90||calorieCoveragePercent>110||proteinCoveragePercent<90)warnings.push({code:'nutrition_gap',message:t('mealBasket.targetsMissed')});
  const sum=(key:'purchasedQuantity'|'plannedConsumptionQuantity'|'leftoverQuantity',unit:'g'|'ml')=>items.filter(i=>i.quantityUnit===unit).reduce((s,i)=>s+i[key]!,0);
  const purchased=sum('purchasedQuantity','g'),leftover=sum('leftoverQuantity','g');
  return {engineVersion:'2',mealPlan:plan,ingredientRequirements:requirements,ingredientRatios:ratios,matchingDiagnostics,pantryUsed,
    adjustedMealNutrition:plan.items.map(i=>({itemId:i.id,nutrition:mealNutrition(i,ratios)})),
    remaining:{totalPurchasedWeight:purchased,totalPlannedConsumption:sum('plannedConsumptionQuantity','g'),totalLeftoverWeight:leftover,
      totalPurchasedVolume:sum('purchasedQuantity','ml'),totalPlannedVolume:sum('plannedConsumptionQuantity','ml'),totalLeftoverVolume:sum('leftoverQuantity','ml'),estimatedWastePercent:purchased?round(leftover/purchased*100):0},
    optimizationWeights:{...packageWeights},status:!items.length&&!pantryUsed.length?'empty':incomplete||outside||openSlots>0||calorieCoveragePercent<90||calorieCoveragePercent>110||proteinCoveragePercent<90?'partial':'generated',
    items,totalCalories:round(n.calories),totalProtein:round(n.protein),totalCarbohydrates:round(n.carbohydrates),totalFat:round(n.fat),totalFiber:null,
    ...targets,estimatedTotalPrice,knownPriceSubtotal:round(knownPriceSubtotal),budgetDifference,budgetStatus,calorieCoveragePercent,proteinCoveragePercent,
    categoryCoverage:[],warnings,constraintsApplied:[t('mealBasket.fitsMeal'),"Gleichwertige Zutaten",t('mealBasket.knownPackage'),"Allergen- und Spurennachweise","Zutatenspezifischer Spielraum"],
    exclusions:{unmatchedIngredients:requirements.filter(r=>ratios[r.ingredientKey]===0).length,unmatchedReadyMeals:ready.unmatched},objective,score:round(100/(1+objective)),iterations:requirements.length};
}
