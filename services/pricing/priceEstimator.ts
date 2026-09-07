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
  const estimate=estimateCatalogPrice(p);return estimate?{...p,...estimate}:p;
}
/** Catalog-only demo fallback. It never invents a package quantity for the basket engine. */
export function estimateCatalogPrice(p:PricingProduct){
 if(p.priceEstimate!==null||p.source==='demo')return null;
 const known=estimatePackagePrice(p);if(known)return known;
 const defaults:Record<string,number>={fruit:1.99,vegetables:1.99,meat:5.99,fish:6.99,eggs:2.49,dairy:1.99,'dairy-alternatives':2.49,bread:2.49,grains:1.99,pasta:1.49,potatoes:2.49,legumes:1.49,breakfast:2.99,snacks:2.49,beverages:1.99,other:2.99};
 return {priceEstimate:defaults[p.category]??2.99,currency:'EUR',priceKind:'estimate' as const,priceEstimateSource:'synthetic_mvp',priceConfidence:'low' as const,priceEstimateVersion:'synthetic-category-demo-2'};
}
