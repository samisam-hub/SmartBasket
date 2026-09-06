import type { IngredientRequirement } from '../../types/meal';
import type { Product } from '../../types/product';
import { packagePrice } from '../basket/quantityPlanner';
import { packageWeights } from './config';
export interface PackageChoice { product: Product; packageCount: number; purchasedQuantity: number; plannedConsumptionQuantity: number; leftoverQuantity: number; estimatedPrice: number|null }
export interface PackageSolution { choices: PackageChoice[]; purchasedQuantity: number; plannedConsumptionQuantity: number; leftoverQuantity: number; score: number }
/** Bounded exhaustive single/two-SKU search; whole packages, no universal upward rounding. */
export function optimizePackages(r: IngredientRequirement, candidates: Product[], budget: number|null=null): PackageSolution|null {
  if(!Number.isFinite(r.requiredQuantity)||r.requiredQuantity<=0||r.minimumAcceptableQuantity<=0||r.minimumAcceptableQuantity>r.requiredQuantity||r.maximumAcceptableQuantity<r.requiredQuantity)return null;
  const min=r.flexible?r.minimumAcceptableQuantity:r.requiredQuantity;
  const available=candidates.filter(p=>p.packageUnit===r.unit&&Number.isFinite(p.packageSize)&&p.packageSize!>0&&p.packageSize!<=20000)
    .sort((a,b)=>Math.abs(a.packageSize!-r.requiredQuantity)-Math.abs(b.packageSize!-r.requiredQuantity)||a.id.localeCompare(b.id)).slice(0,16);
  const w=packageWeights;let best: PackageSolution|null=null;
  const evaluate=(parts:{product:Product;count:number}[])=>{
    const purchased=parts.reduce((s,x)=>s+x.product.packageSize!*x.count,0);if(purchased+1e-7<min)return;
    const consumed=Math.min(purchased,r.requiredQuantity),leftover=purchased-consumed;
    const price=parts.reduce((s,x)=>s+(packagePrice(x.product)??0)*x.count,0),unknown=parts.some(x=>packagePrice(x.product)===null);
    const score=w.deviation*Math.abs(consumed-r.requiredQuantity)/r.requiredQuantity+w.remaining*leftover/r.requiredQuantity+
      w.price*price/(budget&&budget>0?budget:10)+w.packages*parts.reduce((s,x)=>s+x.count,0)+w.unavailablePrice*Number(unknown)+
      w.quality*parts.filter(x=>!x.product.ingredientsText).length;
    if(best && score>=best.score-1e-9)return;
    let remaining=consumed;
    const choices=parts.map(({product, count})=>{const purchasedQuantity=product.packageSize!*count,plannedConsumptionQuantity=Math.min(remaining,purchasedQuantity);remaining-=plannedConsumptionQuantity;
      return {product,packageCount:count,purchasedQuantity,plannedConsumptionQuantity,leftoverQuantity:purchasedQuantity-plannedConsumptionQuantity,estimatedPrice:packagePrice(product)===null?null:packagePrice(product)!*count};});
    best={choices,purchasedQuantity:purchased,plannedConsumptionQuantity:consumed,leftoverQuantity:leftover,score};
  };
  for(let i=0;i<available.length;i++){
    const a=available[i], count=Math.ceil(min/a.packageSize!);
    // The minimum feasible and next count cover underfill vs exact/overfill choices.
    for(const n of [count,count+1])if(n>0&&n<=1000)evaluate([{product:a,count:n}]);
    for(let j=i+1;j<available.length;j++){
      const b=available[j];
      for(let n=1;n<=Math.min(100,Math.ceil(r.requiredQuantity/a.packageSize!));n++){
        const need=Math.max(1,Math.ceil((min-n*a.packageSize!)/b.packageSize!));
        for(const m of [need,need+1])if(m<=1000)evaluate([{product:a,count:n},{product:b,count:m}]);
      }
    }
  }
  return best;
}
