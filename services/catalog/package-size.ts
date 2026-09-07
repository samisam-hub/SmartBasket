export interface PackageMetadata {
  packageSize:number|null; packageUnit:'g'|'ml'|'piece'|null; packageCountUnits:number|null;
  packageSizeStatus:'known'|'unknown'|'conflicting'; packageSizeSource:string|null;
  packageMassPerUnit:number|null; packageDrainedWeight:number|null;
}
const amount=(n:string)=>Number(n.replace(',','.'));
const multipliers:Record<string,number>={kg:1000,g:1,l:1000,cl:10,ml:1,oz:28.349523125,lb:453.59237};
function parseText(text:string):{size:number;unit:'g'|'ml'|'piece'}|null {
  const s=text.toLowerCase().replace(/ℓ/g,'l');
  // Prefer explicit metric declaration over parenthesized imperial equivalents.
  const mass=/\b(?:(\d+)\s*[x×*]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/.exec(s)??/\b(?:(\d+)\s*[x×*]\s*)?(\d+(?:[.,]\d+)?)\s*(oz|lb)\b/.exec(s);
  if(mass){const unit=['l','cl','ml'].includes(mass[3])?'ml':'g';return {size:(mass[1]?amount(mass[1]):1)*amount(mass[2])*multipliers[mass[3]],unit};}
  const count=/\b(\d+(?:[.,]\d+)?)\s*(?:pcs|pieces?|stück|stueck|eggs?|eier|oeufs?)\b/.exec(s);
  if(count)return {size:amount(count[1]),unit:'piece'};
  const dozen=/\b(\d+)\s*dozen\b/.exec(s);return dozen?{size:Number(dozen[1])*12,unit:'piece'}:null;
}
export function normalizePackage(input:{quantity?:unknown;name?:unknown;size?:unknown;unit?:unknown;servingText?:unknown;drainedWeight?:unknown}):PackageMetadata {
  const text=typeof input.quantity==='string'?input.quantity:'',name=typeof input.name==='string'?input.name:'';
  const unit=typeof input.unit==='string'?input.unit.toLowerCase():'';
  const numeric=typeof input.size==='number'?input.size:typeof input.size==='string'&&/^\d+(?:[.,]\d+)?$/.test(input.size)?amount(input.size):NaN;
  const explicit=Number.isFinite(numeric)&&numeric>0&&(unit in multipliers||['piece','pcs','count'].includes(unit))?
    {size:numeric*(multipliers[unit]??1),unit:unit in multipliers?(['l','cl','ml'].includes(unit)?'ml' as const:'g' as const):'piece' as const}:null;
  // Never treat a serving declaration in product-name/quantity text as a whole package.
  const parsed=/serving|portion|per\s+100/i.test(text)?null:parseText(text);
  const fromName=/serving|portion|per\s+100/i.test(name)?null:parseText(name);
  const chosen=/serving|portion|per\s+100/i.test(text)?null:parsed??explicit??fromName;
  const conflicting=!!(parsed&&explicit&&(parsed.unit!==explicit.unit||Math.abs(parsed.size-explicit.size)>Math.max(2,explicit.size*0.03)));
  const valid=chosen&&chosen.size>0&&chosen.size<100000&&(!['piece'].includes(chosen.unit)||Number.isInteger(chosen.size));
  const serving=typeof input.servingText==='string'?input.servingText:'';
  const single=/\b1\s*(?:egg|ei|piece|stück|oeuf)\b[^\d]*(\d+(?:[.,]\d+)?)\s*g\b/i.exec(serving);
  const massPerUnit=single&&amount(single[1])>=20&&amount(single[1])<=100?amount(single[1]):null;
  const drained=/\b(?:drained(?:\s+weight)?|abtropfgewicht|abgetropft)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i.exec(text);
  const drainedWeight=typeof input.drainedWeight==='number'&&input.drainedWeight>0?input.drainedWeight:drained?amount(drained[1])*(drained[2].toLowerCase()==='kg'?1000:1):null;
  return {packageSize:valid&&!conflicting?chosen.size:null,packageUnit:valid&&!conflicting?chosen.unit:null,
    packageCountUnits:valid&&chosen.unit==='piece'?chosen.size:null,packageSizeStatus:conflicting?'conflicting':valid?'known':'unknown',
    packageSizeSource:valid?(parsed?'quantity-label':explicit?'provider-quantity':'product-name'):null,
    packageMassPerUnit:massPerUnit,packageDrainedWeight:drainedWeight};
}
