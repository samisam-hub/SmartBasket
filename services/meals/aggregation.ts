import type { IngredientRequirement, MealPlan } from '../../types/meal';
export function aggregateIngredients(plan: MealPlan): IngredientRequirement[] {
  const map=new Map<string,IngredientRequirement>();
  for(const item of plan.items) for(const line of item.meal.ingredients){
    const quantity=line.quantity*item.servings/item.meal.servings;
    if(!Number.isFinite(quantity)||quantity<=0)throw Error('Invalid meal quantity');
    const key=line.ingredientKey, previous=map.get(key);
    if(previous && previous.unit!==line.unit)throw Error('Cannot aggregate incompatible ingredient units');
    const row=previous??{ingredientKey:key,ingredientName:line.ingredientName,requiredQuantity:0,unit:line.unit,flexible:true,minimumAcceptableQuantity:0,maximumAcceptableQuantity:0,sourceMealIds:[]};
    row.requiredQuantity+=quantity;
    row.minimumAcceptableQuantity+=quantity*(1+(line.flexible?line.minAdjustmentPercent:0)/100);
    row.maximumAcceptableQuantity+=quantity*(1+(line.flexible?line.maxAdjustmentPercent:0)/100);
    row.flexible=row.flexible&&line.flexible;
    row.sourceMealIds=[...new Set([...row.sourceMealIds,item.id])];map.set(key,row);
  }
  // Mixed fixed/flexible lines stay exact; avoid scaling fixed quantities indirectly.
  return [...map.values()].map(r=>r.flexible?r:{...r,minimumAcceptableQuantity:r.requiredQuantity,maximumAcceptableQuantity:r.requiredQuantity})
    .sort((a,b)=>a.ingredientKey.localeCompare(b.ingredientKey));
}
