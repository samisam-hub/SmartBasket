import { ingredients } from '../../data/meals';
import { canonicalIngredientKey,ingredientMappings,preparedFoodKeywords } from '../../data/ingredient-mappings';
import type { Product } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import { normalizePackage } from '../catalog/package-size';
import { skuSafety } from './skuSafety';
export const normalizeIngredientText=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const contains=(name:string,phrase:string)=>` ${name} `.includes(` ${normalizeIngredientText(phrase)} `);
export interface SkuCandidate {
 product:Product; stage:'curated'|'alias'|'category-keyword'; score:number; reasons:string[]; dietaryUnknown:string[];
 packageSizeStatus:'known'|'unknown'|'conflicting'; optimizationProduct:Product|null; packageIssue:string|null;
}
export interface MatchDiagnostic {ingredientKey:string;considered:number;candidates:SkuCandidate[];rejected:Record<string,number>;rejectedProducts:{id:string;name:string;reason:string}[]}
export function uniqueCatalog(products:Product[]):Product[]{
 const map=new Map<string,Product>(),conflicts=new Set<string>();
 for(const p of products){if(map.has(p.id)&&JSON.stringify(map.get(p.id))!==JSON.stringify(p))conflicts.add(p.id);else map.set(p.id,p);}
 return [...map.values()].filter(p=>!conflicts.has(p.id)).sort((a,b)=>a.id.localeCompare(b.id));
}
export function diagnoseMatches(inputKey:string,products:Product[],preferences:UserPreferences):MatchDiagnostic {
 const key=canonicalIngredientKey(inputKey),definition=ingredients[key],config=ingredientMappings[key];
 const result:MatchDiagnostic={ingredientKey:key,considered:products.length,candidates:[],rejected:{},rejectedProducts:[]};
 const reject=(p:Product,reason:string)=>{result.rejected[reason]=(result.rejected[reason]??0)+1;result.rejectedProducts.push({id:p.id,name:p.name,reason});};
 if(!definition||!config)return result;
 for(const p of uniqueCatalog(products)){
  if(p.readyMeal){reject(p,'prepared_meal_not_ingredient');continue;}
  if(p.source==='demo'||!p.id||!p.name){reject(p,'missing_essential_product_data');continue;}
  const name=normalizeIngredientText(p.name),manual=config.preferredProductIds?.includes(p.id)||config.preferredBarcodes?.includes(p.barcode??'');
  const alias=config.aliases.some(a=>contains(name,a));
  const keyword=config.requiredKeywords.some(a=>normalizeIngredientText(a).split(' ').every(token=>contains(name,token)));
  if(!manual&&!alias&&!keyword){reject(p,'naming_mismatch');continue;}
  if(!config.allowedCategories.includes(p.category)){reject(p,'category_mismatch');continue;}
  if([...config.blockedKeywords,...preparedFoodKeywords].some(a=>contains(name,a))||
    (key==='salmon'&&/seelachs|pollock/.test(name))||
    (key==='tofu'&&/caseinat|milk|cheese|jalape/i.test(p.ingredientsText??''))){reject(p,'unsuitable_product_form');continue;}
  if(['chicken_breast','turkey'].includes(key)&&/nitrit|nitrite|carrageen|rauch|dextrose|gegart|stabilisator|konservierungs/i.test(p.ingredientsText??'')){reject(p,'unsuitable_product_form');continue;}
  const safety=skuSafety(p,preferences);if(safety.rejection){reject(p,safety.rejection);continue;}
  const kcal=p.caloriesPer100g;
  if(kcal!==null&&(!Number.isFinite(kcal)||kcal<definition.nutritionPer100.calories*.55||kcal>definition.nutritionPer100.calories*1.65)){reject(p,'nutrition_or_preparation_mismatch');continue;}
  const macros=[p.proteinPer100g,p.carbohydratesPer100g,p.fatPer100g];
  if(macros.every(n=>n!==null)&&kcal!==null){const [protein,carb,fat]=macros as number[];
   if(macros.some(n=>!Number.isFinite(n)||n!<0||n!>100)||protein+carb+fat>105||Math.abs(protein*4+carb*4+fat*9-kcal)>Math.max(40,kcal*.35)){reject(p,'inconsistent_nutrition');continue;}}
  const pack=normalizePackage({quantity:p.quantityLabel,name:p.name,size:p.packageSize,unit:p.packageUnit});
  let size=pack.packageSize,unit=pack.packageUnit,issue:string|null=null;
  if(p.packageSizeStatus==='conflicting'||pack.packageSizeStatus==='conflicting')issue='package_size_conflicting';
  else if(size===null)issue='package_size_unknown';
  if(unit==='piece'&&size!==null){if(p.packageMassPerUnit) {size*=p.packageMassPerUnit;unit='g';}else issue='piece_mass_unknown';}
  if(key==='eggs'&&unit==='g'&&size!==null&&size<150)issue='possible_serving_not_package';
  if(['tuna','chickpeas'].includes(key)){const drained=p.packageDrainedWeight??pack.packageDrainedWeight;
   if(drained&&size&&drained<=size){size=drained;unit='g';}else issue='drained_weight_unknown';}
  if(!issue&&unit!==definition.unit)issue='unit_conversion_unknown';
  const stage=manual?'curated':alias?'alias':'category-keyword';
  const completeness=[kcal,...macros].filter(n=>n!==null).length;
  const score=(manual?60:alias?45:30)+15+(!issue?10:0)+completeness*2+Math.max(0,10-safety.unknownDiet.length*5)+(p.imageQuality==='usable'?2:0)+(p.priceEstimate!==null?2:0);
  const reasons=[`${stage} ingredient match`,'compatible internal category',`${completeness}/4 nutrition values`,safety.unknownDiet.length?`Unverified lifestyle metadata: ${safety.unknownDiet.join(', ')}`:'No known dietary conflict',issue??'known compatible package quantity'];
  result.candidates.push({product:p,stage,score,reasons,dietaryUnknown:safety.unknownDiet,
   packageSizeStatus:issue==='package_size_conflicting'?'conflicting':pack.packageSize===null?'unknown':'known',packageIssue:issue,
   optimizationProduct:issue?null:{...p,packageSize:size,packageUnit:unit}});
 }
 result.candidates.sort((a,b)=>b.score-a.score||a.product.id.localeCompare(b.product.id));return result;
}
export function matchProducts(key:string,products:Product[],preferences:UserPreferences):Product[]{
 return diagnoseMatches(key,products,preferences).candidates.flatMap(c=>c.optimizationProduct?[c.optimizationProduct]:[]);
}
