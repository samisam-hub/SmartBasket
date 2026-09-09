// Explicitly synthetic null-only backfill. Never generates ingredients or allergy claims.
const fs=require('node:fs');
const rows=JSON.parse(fs.readFileSync('.expo/catalog-completeness/before.json','utf8'));
const fields=['calories_per_100g','protein_per_100g','carbohydrates_per_100g','fat_per_100g','fiber_per_100g','sugars_per_100g','salt_per_100g'];
const median=values=>{values.sort((a,b)=>a-b);const m=Math.floor(values.length/2);return values.length%2?values[m]:(values[m-1]+values[m])/2;};
const updates=[];
for(const p of rows){
 const patch={},estimated=[];
 for(const field of fields)if(p[field]===null){
  let peers=rows.filter(r=>r.category===p.category&&r.nutrition_basis===p.nutrition_basis&&r[field]!==null);
  if(!peers.length)peers=rows.filter(r=>r.nutrition_basis===p.nutrition_basis&&r[field]!==null);
  if(!peers.length)throw Error(`No reference values for ${field}`);
  let value=median(peers.map(r=>r[field]));
  if(field==='sugars_per_100g')value=Math.min(value,p.carbohydrates_per_100g??patch.carbohydrates_per_100g??100);
  patch[field]=Math.round(value*100)/100;estimated.push(field);
 }
 if(p.package_size===null||p.package_unit===null){
  const unit=p.package_unit??(p.nutrition_basis==='100ml'||['beverages','dairy-alternatives'].includes(p.category)?'ml':'g');
  const peers=rows.filter(r=>r.category===p.category&&r.package_unit===unit&&r.package_size>0);
  patch.package_size=p.package_size??(peers.length?Math.max(1,Math.round(median(peers.map(r=>r.package_size)))):500);
  patch.package_unit=unit;patch.package_size_status='known';patch.package_size_source='smartbasket-synthetic-demo-v1';estimated.push('package_size');
 }
 if(p.quantity_label===null){patch.quantity_label=`${patch.package_size??p.package_size} ${patch.package_unit??p.package_unit}`;}
 if(Object.keys(patch).length)updates.push({id:p.id,name:p.name,patch,estimated});
}
fs.mkdirSync('.expo/demo-completeness',{recursive:true});
fs.writeFileSync('.expo/demo-completeness/manifest.json',JSON.stringify(updates,null,2));
const statements=updates.map(({id,patch,estimated})=>{
 const json=JSON.stringify([{id,...patch}]).replace(/'/g,"''");
 const tags=estimated.map(f=>`smartbasket:demo:${f}`);
 return `update public.products p set ${Object.keys(patch).map(f=>`${f}=${f==='package_size_source'||f==='package_size_status'?`r.${f}`:`coalesce(p.${f},r.${f})`}`).join(', ')},labels=(select array_agg(distinct v) from unnest(p.labels || array[${tags.map(t=>`'${t}'`).join(',')}]::text[]) v) from jsonb_populate_recordset(null::public.products,'${json}'::jsonb) r where p.id=r.id;`;
});
fs.writeFileSync('.expo/demo-completeness/backfill.sql','begin;\n'+statements.join('\n')+'\ncommit;');
console.log(JSON.stringify({products:updates.length,nutrition:updates.filter(u=>u.estimated.some(f=>f.endsWith('100g'))).length,packages:updates.filter(u=>u.estimated.includes('package_size')).length,quantityLabels:updates.filter(u=>u.patch.quantity_label).length}));
