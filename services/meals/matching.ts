import { ingredients } from '../../data/meals';
import type { Product } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import { exclusionReason } from '../basket/constraints';
const normalize = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const contains = (name: string, phrase: string) => ` ${name} `.includes(` ${normalize(phrase)} `);
/** Reject conflicting duplicate IDs instead of depending on input order. */
export function uniqueCatalog(products: Product[]): Product[] {
  const map = new Map<string,Product>(), conflicts = new Set<string>();
  for (const p of products) { if (map.has(p.id) && JSON.stringify(map.get(p.id))!==JSON.stringify(p)) conflicts.add(p.id); else map.set(p.id,p); }
  return [...map.values()].filter(p=>!conflicts.has(p.id)).sort((a,b)=>a.id.localeCompare(b.id));
}
export function matchProducts(key: string, products: Product[], preferences: UserPreferences): Product[] {
  const ingredient=ingredients[key]; if (!ingredient) return [];
  return products.filter(p=>{
    if (exclusionReason(p,preferences) || !ingredient.categories.includes(p.category)) return false;
    if (!p.packageSize || !Number.isFinite(p.packageSize) || p.packageSize<=0 || p.packageSize>20000 || p.packageUnit!==ingredient.unit || p.nutritionBasis!==(ingredient.unit==='g'?'100g':'100ml')) return false;
    const name=normalize(p.name);
    if (!ingredient.aliases.some(a=>contains(name,a)) || ingredient.exclude.some(a=>name.includes(normalize(a)))) return false;
    if (/\b(soup|sauce|salad|salat|sandwich|burger|nuggets|dessert|meal|pizza|seasoned|marinated|breaded|paniert|gewürzt)\b/.test(name)) return false;
    // A tofu-based cheese substitute is not plain tofu, even when tagged lactose-free.
    if(key==='tofu' && (/\b(rella|cheese|käse|style)\b/.test(name) || /caseinat|milk|cheese|jalape/i.test(p.ingredientsText??'')))return false;
    // Ingredient form matters: cooked rice, dry chickpeas and sweetened concentrates aren't equivalent.
    const expected=ingredient.nutritionPer100.calories;
    if (p.caloriesPer100g! < expected*0.55 || p.caloriesPer100g! > expected*1.65) return false;
    // Drained recipe weights need an explicitly declared drained package weight, not gross can weight.
    if (['tuna','chickpeas'].includes(key) && !/drained|abtropf/i.test(p.quantityLabel??'')) return false;
    return true;
  });
}
