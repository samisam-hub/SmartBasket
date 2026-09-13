import type { Product } from '../../types/product';
import type { UserPreferences, Allergen } from '../../types/preferences';
import { allergenConflicts, highSugar, requiredDiet, sugarsUnknown } from '../catalog/discovery';
const terms:Record<Allergen,RegExp>={milk:/\b(milk|milch|lait|caseinate|casein|whey|molke)\b/i,eggs:/\b(egg|eggs|ei|eier|oeuf)\b/i,fish:/\b(fish|fisch|salmon|lachs|tuna|thunfisch)\b/i,
 shellfish:/\b(shrimp|prawn|crab|garnelen|krabben|shellfish)\b/i,peanuts:/\b(peanut|peanuts|erdnuss|erdnüsse)\b/i,tree_nuts:/\b(almond|hazelnut|walnut|mandel|haselnuss|walnuss|cashew)\b/i,
 soy:/\b(soy|soya|soja|soybeans)\b/i,wheat:/\b(wheat|weizen|gluten)\b/i,sesame:/\b(sesame|sesam)\b/i};
const free:Record<Allergen,string[]>={milk:['milk free','dairy free'],eggs:['egg free','eggs free'],fish:['fish free'],shellfish:['shellfish free'],peanuts:['peanut free','peanuts free'],tree_nuts:['nut free','nuts free','tree nut free'],soy:['soy free','soya free'],wheat:['wheat free'],sesame:['sesame free']};
/** Lifestyle uncertainty is a warning, never a claim of verified suitability. Allergies stay strict. */
export function skuSafety(p:Product,preferences:UserPreferences):{rejection:string|null;unknownDiet:string[]} {
 const no=(rejection:string)=>({rejection,unknownDiet:[]});
 if(!Array.isArray(p.allergens)||!Array.isArray(p.mayContainAllergens)||!Array.isArray(p.labels))return no('malformed_safety_metadata');
 const conflict=allergenConflicts(p,preferences);
 if(conflict.contains.length||conflict.traces.length)return no('allergen_conflict');
 const text=(p.ingredientsText??'').replace(/<[^>]*>/g,' '),labels=p.labels.map(l=>l.toLowerCase().replace(/[-_]/g,' '));
 for(const allergen of preferences.allergens){
   if(terms[allergen].test(text))return no('allergen_conflict');
   if(!p.allergenInfoAvailable||!text.trim()||!free[allergen].some(label=>labels.includes(label)))return no('allergen_metadata_unknown');
 }
 const diets=preferences.dietaryPreferences,fields=requiredDiet(preferences);
 if(preferences.participants?.some(person=>person.intolerances.includes('gluten'))&&p.glutenFree!==true)return no(p.glutenFree===false?'allergen_conflict':'allergen_metadata_unknown');
 if(fields.some(f=>p[f]===false))return no('known_dietary_conflict');
 if((diets.includes('vegan')||diets.includes('vegetarian')||diets.includes('pescatarian'))&&p.category==='meat')return no('known_dietary_conflict');
 if((diets.includes('vegan')||diets.includes('vegetarian'))&&p.category==='fish')return no('known_dietary_conflict');
 if(diets.includes('vegan')&&(['dairy','eggs'].includes(p.category)||['milk','eggs','fish','shellfish'].some(a=>p.allergens.includes(a))))return no('known_dietary_conflict');
 if(diets.includes('lactose_free')&&p.lactoseFree!==true&&(p.category==='dairy'||p.allergens.includes('milk')||terms.milk.test(text)))return no('known_dietary_conflict');
 if(diets.includes('gluten_free')&&(p.allergens.some(a=>['wheat','gluten'].includes(a))||terms.wheat.test(text)))return no('known_dietary_conflict');
 if(diets.includes('vegan')&&[terms.milk,terms.eggs,terms.fish,terms.shellfish].some(r=>r.test(text)))return no('known_dietary_conflict');
 if(diets.includes('diabetes')&&highSugar(p))return no('known_dietary_conflict');
 const unknownDiet=fields.filter(f=>p[f]!==true).map(String);
 if(diets.includes('pescatarian')&&p.vegetarian!==true&&p.category!=='fish')unknownDiet.push('pescatarian');
 if(diets.includes('diabetes')&&sugarsUnknown(p))unknownDiet.push('diabetes');
 return {rejection:null,unknownDiet};
}
