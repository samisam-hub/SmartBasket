import type { SavedBasket, BasketGenerationResult } from '../../types/basket';
import type { UserPreferences } from '../../types/preferences';
import { isSaved } from '../preference-domain';
import { groups } from './scoring';
import { isMealPlan } from '../meals/validation';
export interface BasketStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export interface RemoteBaskets { save(basket: SavedBasket): Promise<string>; list(ownerId: string): Promise<SavedBasket[]>; rename?(ownerId:string,id:string,name:string):Promise<void>; remove?(ownerId:string,id:string):Promise<void> }
export function isBasketResult(v: unknown): v is BasketGenerationResult {
  if (!v || typeof v !== 'object') return false;
  const r = v as BasketGenerationResult;
  return ['1','2'].includes(r.engineVersion) && (r.engineVersion==='2'?['generated','partial','empty']:['generated','partial']).includes(r.status) &&
    (r.engineVersion!=='2'||(isMealPlan(r.mealPlan)&&r.mealPlan.status==='confirmed'&&Array.isArray(r.ingredientRequirements)&&r.ingredientRequirements.every(x=>x&&typeof x.ingredientKey==='string'&&Number.isFinite(x.requiredQuantity)&&x.requiredQuantity>0))) &&
    [r.totalCalories, r.totalProtein, r.totalCarbohydrates, r.totalFat, r.calorieTarget, r.proteinTarget, r.score, r.calorieCoveragePercent, r.proteinCoveragePercent, r.knownPriceSubtotal, r.dailyProteinTarget].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) &&
    typeof r.proteinRule === 'string' && ['disabled','unknown','within_budget','slightly_over','unachievable','over_budget','price_incomplete'].includes(r.budgetStatus) &&
    (r.budgetTarget === null || (typeof r.budgetTarget === 'number' && Number.isFinite(r.budgetTarget) && r.budgetTarget > 0)) &&
    (r.budgetDifference === null || (typeof r.budgetDifference === 'number' && Number.isFinite(r.budgetDifference))) &&
    (r.estimatedTotalPrice === null || (typeof r.estimatedTotalPrice === 'number' && Number.isFinite(r.estimatedTotalPrice) && r.estimatedTotalPrice >= 0)) &&
    Array.isArray(r.warnings) && r.warnings.every(w => w && typeof w.code === 'string' && typeof w.message === 'string') &&
    Array.isArray(r.categoryCoverage) && r.categoryCoverage.every(c => c && groups.includes(c.group) && typeof c.represented === 'boolean') &&
    Array.isArray(r.items) && (r.engineVersion==='2'||r.items.length>0) && r.items.length <= (r.engineVersion==='2'?64:24) && r.items.every(i => i && i.product && typeof i.product.id === 'string' && typeof i.product.name === 'string' &&
      (r.engineVersion!=='2'||(typeof i.ingredientKey==='string'&&Array.isArray(i.sourceMealIds)&&i.sourceMealIds.every(s=>typeof s==='string')&&
        [i.purchasedQuantity,i.plannedConsumptionQuantity,i.leftoverQuantity].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)&&
        Math.abs(i.purchasedQuantity!-i.plannedConsumptionQuantity!-i.leftoverQuantity!)<0.01&&Math.abs(i.purchasedQuantity!-i.packageCount*i.packageAmount)<0.01))&&
      typeof i.product.source === 'string' && (i.product.brand === null || typeof i.product.brand === 'string') &&
      (i.product.quantityLabel === null || typeof i.product.quantityLabel === 'string') &&
      Number.isInteger(i.packageCount) && i.packageCount > 0 && typeof i.packageAmount === 'number' && Number.isFinite(i.packageAmount) && i.packageAmount > 0 &&
      ['g', 'ml'].includes(i.quantityUnit) && typeof i.quantityAssumed === 'boolean' &&
      [i.totalCalories, i.totalProtein, i.totalCarbohydrates, i.totalFat].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) &&
      (i.estimatedPrice === null || (typeof i.estimatedPrice === 'number' && Number.isFinite(i.estimatedPrice) && i.estimatedPrice >= 0)) &&
      Array.isArray(i.reasonSelected) && i.reasonSelected.every(reason => reason && typeof reason.code === 'string' && typeof reason.detail === 'string'));
}
export function isSavedBasket(v: unknown): v is SavedBasket {
  if (!v || typeof v !== 'object') return false;
  const b = v as SavedBasket;
  return typeof b.id === 'string' && typeof b.name === 'string' && typeof b.createdAt === 'string' &&
    (b.ownerId === null || typeof b.ownerId === 'string') && (b.cloudId === null || typeof b.cloudId === 'string') &&
    ['local', 'synced'].includes(b.syncStatus) && isSaved(b.preferences) && isBasketResult(b.result);
}
/** Each basket is its own entry, avoiding oversized Android AsyncStorage values. */
type Change = {kind:'rename';name:string}|{kind:'delete';synced?:boolean};
export function basketName(value:string){const name=value.trim();if(!name||name.length>120)throw Error('Enter a basket name with 1–120 characters.');return name;}
export class BasketPersistence {
 private tail:Promise<unknown>=Promise.resolve();
 constructor(private storage:BasketStorage,private remote:RemoteBaskets|null){}
 private key(owner:string|null){return `smartbasket.baskets.v1:${owner??'device'}`;}
 private queue<T>(run:()=>Promise<T>):Promise<T>{const task=this.tail.then(run);this.tail=task.catch(()=>{});return task;}
 private async changes(owner:string|null):Promise<Record<string,Change>>{
  const raw=await this.storage.getItem(`${this.key(owner)}:changes`);if(!raw)return {};
  const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v)||!Object.values(v).every((x)=>{const c=x as Change;return c?.kind==='delete'||c?.kind==='rename'&&typeof c.name==='string'&&c.name===basketName(c.name);}))throw Error('Basket changes could not be read. They have been preserved.');return v;
 }
 private putChanges(owner:string|null,v:Record<string,Change>){return this.storage.setItem(`${this.key(owner)}:changes`,JSON.stringify(v));}
 private async local(owner:string|null):Promise<SavedBasket[]>{
  const raw=await this.storage.getItem(this.key(owner)),ids:unknown=raw?JSON.parse(raw):[];
  if(!Array.isArray(ids)||!ids.every(id=>typeof id==='string'))throw Error('Saved basket index is unreadable. It has been preserved.');
  const changes=await this.changes(owner),rows:SavedBasket[]=[];
  for(const id of ids){if(changes[id]?.kind==='delete')continue;const value=await this.storage.getItem(`${this.key(owner)}:${id}`);if(!value)throw Error('A saved basket is missing from device storage.');const b:unknown=JSON.parse(value);if(!isSavedBasket(b)||b.ownerId!==owner)throw Error('A saved basket is unreadable or belongs to another session.');const c=changes[id];rows.push(c?.kind==='rename'?{...b,name:c.name,syncStatus:'local'}:b);}
  return rows;
 }
 private async write(b:SavedBasket){const raw=await this.storage.getItem(this.key(b.ownerId)),ids:unknown=raw?JSON.parse(raw):[];if(!Array.isArray(ids)||!ids.every(id=>typeof id==='string'))throw Error('Saved basket index is unreadable. It has been preserved.');await this.storage.setItem(`${this.key(b.ownerId)}:${b.id}`,JSON.stringify(b));await this.storage.setItem(this.key(b.ownerId),JSON.stringify([...new Set([b.id,...ids])]));}
 private async erase(owner:string|null,id:string){
  const raw=await this.storage.getItem(this.key(owner)),ids:unknown=raw?JSON.parse(raw):[];
  if(!Array.isArray(ids)||!ids.every(x=>typeof x==='string'))throw Error('Saved basket index is unreadable.');
  await this.storage.setItem(this.key(owner),JSON.stringify(ids.filter(x=>x!==id)));
  // Clear snapshot contents, also on storage adapters without removeItem.
  await this.storage.setItem(`${this.key(owner)}:${id}`,'');
 }
 private async syncChanges(owner:string|null){
  const changes=await this.changes(owner);if(!Object.keys(changes).length)return null;
  let failed=false;
  for(const [id,c] of Object.entries(changes)){
   try{
    if(c.kind==='delete'){
     await this.erase(owner,id);
     if(owner&&this.remote&&!c.synced){if(!this.remote.remove)throw Error();await this.remote.remove(owner,id);}
     if(!c.synced){changes[id]={kind:'delete',synced:true};await this.putChanges(owner,changes);}
     // Keep an ID-only tombstone to prevent stale open screens from restoring a deletion.
    }else{
     const b=(await this.local(owner)).find(x=>x.id===id);if(!b)throw Error('Missing renamed basket');
     let updated=b;
     if(owner&&this.remote){if(!this.remote.rename)throw Error();const cloudId=b.cloudId??await this.remote.save(b);await this.remote.rename(owner,id,c.name);updated={...b,cloudId,syncStatus:'synced'};}
     await this.write(updated);delete changes[id];await this.putChanges(owner,changes);
    }
   }catch{failed=true;}
  }
  return failed?'Changes saved on this device. Cloud sync is pending; use Reload saved baskets when connected.':null;
 }
 cache(b:SavedBasket):Promise<void>{return this.queue(async()=>{if(!isSavedBasket(b))throw Error('Invalid basket snapshot');if((await this.changes(b.ownerId))[b.id]?.kind==='delete')return;await this.write(b);});}
 save(b:SavedBasket):Promise<{basket:SavedBasket;warning:string|null}>{return this.queue(async()=>{
  if(!isSavedBasket(b))throw Error('This basket cannot be saved. Generate a valid nonempty basket first.');
  const existing=(await this.local(b.ownerId)).find(x=>x.id===b.id);if(existing?.result.purchasedAt&&JSON.stringify(existing.result)!==JSON.stringify(b.result))throw Error('Purchased baskets cannot be edited.');
  const changes=await this.changes(b.ownerId);if(changes[b.id]?.kind==='delete')throw Error('This basket has been deleted.');
  const c=changes[b.id];if(c?.kind==='rename')b={...b,name:c.name};await this.write(b);
  if(!this.remote||!b.ownerId)return {basket:b,warning:'Saved on this device only. Cloud storage is unavailable for this session.'};
  try{const cloudId=await this.remote.save(b),synced:SavedBasket={...b,cloudId,syncStatus:'synced'};try{await this.write(synced);}catch{return {basket:synced,warning:'Saved online; the device sync marker could not be updated. Retrying is safe.'};}return {basket:synced,warning:null};}
  catch{return {basket:b,warning:'Saved on this device. Cloud save failed; use Retry cloud save when connected.'};}
 });}
 rename(owner:string|null,id:string,value:string){return this.queue(async()=>{
  const name=basketName(value);if(!(await this.local(owner)).some(b=>b.id===id))throw Error('Basket not found in this account.');
  const changes=await this.changes(owner);changes[id]={kind:'rename',name};await this.putChanges(owner,changes);return {warning:await this.syncChanges(owner)};
 });}
 remove(owner:string|null,id:string){return this.queue(async()=>{
  const changes=await this.changes(owner);if(changes[id]?.kind!=='delete'&&!(await this.local(owner)).some(b=>b.id===id))throw Error('Basket not found in this account.');
  changes[id]={kind:'delete'};await this.putChanges(owner,changes);return {warning:await this.syncChanges(owner)};
 });}
 list(owner:string|null):Promise<{baskets:SavedBasket[];warning:string|null}>{return this.queue(async()=>{
  const pending=await this.syncChanges(owner),local=await this.local(owner);
  if(!owner||!this.remote)return {baskets:local,warning:pending??'Showing baskets saved on this device.'};
  try{
   const cloud=await this.remote.list(owner);if(!cloud.every(b=>isSavedBasket(b)&&b.ownerId===owner))throw Error('Invalid cloud basket');
   const changes=await this.changes(owner),merged=new Map(local.filter(b=>b.syncStatus!=='synced'||changes[b.id]).map(b=>[b.id,b]));
   for(const b of cloud){if(changes[b.id])continue;merged.set(b.id,b);}
   let warning=pending;
   try{for(const b of merged.values())await this.write(b);for(const b of local)if(!merged.has(b.id))await this.erase(owner,b.id);}catch{warning='Loaded online; device cache could not be updated.';}
   return {baskets:[...merged.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)),warning};
  }catch{return {baskets:local,warning:pending??'Cloud baskets could not be loaded. Showing device copies.'};}
 });}
}
export function newSavedBasket(result: BasketGenerationResult, preferences: UserPreferences, ownerId: string | null): SavedBasket {
  return { id: `basket-${Date.now()}-${Math.random().toString(36).slice(2)}`, cloudId: null, ownerId,
    name: `${preferences.planningDays}-day basket`, createdAt: new Date().toISOString(), preferences,
    result, syncStatus: 'local' };
}
