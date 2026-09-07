// Read-only catalog snapshot -> reviewed SQL. Does not write the database or user preferences.
require('./register-typescript.cjs');
const fs=require('node:fs');
const {createClient}=require('@supabase/supabase-js');
const {loadBasketCatalog}=require('../services/basket/catalog.ts');
const {estimateCatalogPrice}=require('../services/pricing/priceEstimator.ts');
(async()=>{
 const client=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
 const products=await loadBasketCatalog(client),updates=[],missing=[];
 for(const p of products){const e=estimateCatalogPrice(p);if(e)updates.push({id:p.id,price:e.priceEstimate,confidence:e.priceConfidence,version:e.priceEstimateVersion});else if(p.priceEstimate===null)missing.push({id:p.id,name:p.name,category:p.category,quantity:p.quantityLabel,size:p.packageSize,unit:p.packageUnit});}
 fs.mkdirSync('.expo/pricing',{recursive:true});fs.writeFileSync('.expo/pricing/before.json',JSON.stringify(products));
 const json=JSON.stringify(updates).replace(/'/g,"''");
 const sql=`with values_to_fill as (select * from jsonb_to_recordset('${json}'::jsonb) as x(id uuid, price numeric, confidence text, version text)), updated as (update public.products p set price_estimate=x.price, price_kind='estimate',currency='EUR',price_estimate_source='synthetic_mvp',price_confidence=x.confidence,price_estimate_version=x.version from values_to_fill x where p.id=x.id and p.price_estimate is null returning p.id) select count(*) as updated from updated;`;
 fs.writeFileSync('.expo/pricing/backfill.sql',sql);
 fs.writeFileSync('.expo/pricing/manifest.json',JSON.stringify({total:products.length,existing:products.filter(p=>p.priceEstimate!==null).length,toFill:updates.length,missing},null,2));
 console.log(JSON.stringify({total:products.length,toFill:updates.length,remaining:missing.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
