// Read-only source audit. Produces null-only SQL patches for review; never writes the database.
require('./register-typescript.cjs');
const fs=require('node:fs'),{Readable}=require('node:stream'),{createGunzip}=require('node:zlib'),{createInterface}=require('node:readline');
const {createClient}=require('@supabase/supabase-js');
const {normalizeOpenFoodFacts}=require('../services/catalog/normalize.ts');
const {productToRow}=require('../services/catalog/product-row.ts');
const out='.expo/catalog-completeness';
const nutrition=['calories_per_100g','protein_per_100g','carbohydrates_per_100g','fat_per_100g','fiber_per_100g','sugars_per_100g','salt_per_100g'];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
 const {data,error}=await client.from('products').select('*').order('id').limit(1000);if(error)throw error;
 fs.writeFileSync(`${out}/before.json`,JSON.stringify(data));
 const wanted=new Map(data.filter(p=>p.source==='open-food-facts'&&(p.package_size===null||nutrition.some(k=>p[k]===null))).map(p=>[p.barcode,p]));
 const updates=[],evidence=[];let scanned=0,found=0;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),600000);let input,unzip,lines;
 try{
 const response=await fetch('https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz',{signal:controller.signal,headers:{'User-Agent':'SmartBasket/0.1 (https://github.com/samisam-hub/SmartBasket)'}});
 if(!response.ok)throw Error(`OFF HTTP ${response.status}`);
 input=Readable.fromWeb(response.body);unzip=input.pipe(createGunzip());input.on('error',e=>unzip.destroy(e));lines=createInterface({input:unzip,crlfDelay:Infinity});
 for await(const line of lines){
 if(++scanned>80000)break;
 const raw=JSON.parse(line),code=String(raw.code??''),canonical=code.length===14&&code.startsWith('0')?code.slice(1):code.padStart(13,'0');
 const before=wanted.get(canonical);if(!before)continue;wanted.delete(canonical);found++;
 const normalized=normalizeOpenFoodFacts(raw);if(!normalized)continue;const row=productToRow(normalized),patch={id:before.id};
 if(row.nutrition_basis===before.nutrition_basis)for(const k of nutrition)if(before[k]===null&&row[k]!==null)patch[k]=row[k];
 if(before.package_size===null&&row.package_size_status==='known'&&row.package_size!==null){
 for(const k of ['package_size','package_unit','package_size_status','package_size_source','package_count_units','package_mass_per_unit','package_drained_weight'])patch[k]=row[k];
 if(before.quantity_label===null&&row.quantity_label!==null)patch.quantity_label=row.quantity_label;
 }
 if(Object.keys(patch).length>1){updates.push(patch);evidence.push({id:before.id,code,sourceUrl:normalized.sourceUrl,quantity:raw.quantity,product_quantity:raw.product_quantity,product_quantity_unit:raw.product_quantity_unit,patch});}
 if(!wanted.size)break;
 }
 }finally{clearTimeout(timer);lines?.close();input?.destroy();unzip?.destroy();controller.abort();}
 fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));
 const statements=updates.map(p=>{const fields=Object.keys(p).filter(k=>k!=='id'),json=JSON.stringify([p]).replace(/'/g,"''");return `update public.products p set ${fields.map(k=>`${k} = ${['package_size_status','package_size_source'].includes(k)?`r.${k}`:`coalesce(p.${k},r.${k})`}`).join(', ')} from jsonb_populate_recordset(null::public.products,'${json}'::jsonb) r where p.id=r.id${p.package_size!==undefined?' and p.package_size is null':''};`;});
 fs.writeFileSync(`${out}/backfill.sql`,'begin;\n'+statements.join('\n')+'\ncommit;');
 const report={total:data.length,scanned,found,notFound:wanted.size,updatedProducts:updates.length,fieldCounts:Object.fromEntries([...new Set(updates.flatMap(p=>Object.keys(p).filter(k=>k!=='id')))].map(k=>[k,updates.filter(p=>k in p).length]))};
 fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
