import type { CatalogProductInput } from '../../types/product';
import { normalizePackage } from '../catalog/package-size';
import { pricingConfig } from './pricingConfig';
export type PricingProduct = Pick<CatalogProductInput,'name'|'category'|'quantityLabel'|'packageSize'|'packageUnit'|'packageSizeStatus'|'priceEstimate'|'source'>;
export function estimatePackagePrice(p:PricingProduct) {
  if(p.priceEstimate!==null || p.source==='demo')return null;
  const pack=normalizePackage({quantity:p.quantityLabel,name:p.name,size:p.packageSize,unit:p.packageUnit});
  if(p.packageSizeStatus==='conflicting'||pack.packageSizeStatus!=='known'||!pack.packageSize||!pack.packageUnit)return null;
  const size=pack.packageSize,unit=pack.packageUnit;
  if(size>(unit==='piece'?1000:20000)||p.category==='eggs'&&unit==='g'&&size<150)return null;
  const name=p.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ');
  const type=pricingConfig.types.find(r=>r.categories.includes(p.category)&&r.words.test(name));
  const rates=type??pricingConfig.categories[p.category] as {kg?:number;liter?:number;piece?:number};
  const rate=unit==='g'?rates.kg:unit==='ml'?rates.liter:rates.piece;
  if(!rate)return null;
  const amount=rate*size/(unit==='piece'?1:1000);
  if(!Number.isFinite(amount)||amount>pricingConfig.maximumPackagePrice)return null;
  return {priceEstimate:Math.round(Math.max(pricingConfig.minimumPackagePrice,amount)*100)/100,
    currency:'EUR',priceKind:'estimate' as const,priceEstimateSource:'synthetic_mvp',
    priceConfidence:type&&pack.packageSizeSource!=='product-name'?'medium' as const:'low' as const,
    priceEstimateVersion:pricingConfig.version};
}
/** Only the administrative import/backfill pipeline assigns estimates; UI reads persisted prices. */
export function withMissingPriceEstimate<T extends CatalogProductInput>(p:T):T {
  const estimate=estimatePackagePrice(p);return estimate?{...p,...estimate}:p;
}
