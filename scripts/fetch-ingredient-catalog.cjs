// Bounded, cached administrative searches. Never called by mobile UI or CI.
const fs=require('node:fs');
const searches={chicken_breast:'chicken-breasts',salmon:'salmon-fillets',tuna:'tunas-in-brine',eggs:'chicken-eggs',tofu:'tofus',lentils:'lentils',rice:'rices',pasta:'dry-pastas',potatoes:'potatoes',wholemeal_bread:'wholemeal-breads',broccoli:'broccolis',carrots:'carrots',spinach:'spinachs',chopped_tomatoes:'canned-tomatoes',olive_oil:'olive-oils',oats:'oat-flakes',banana:'bananas',apple:'apples',berries:'strawberries',yogurt:'greek-yogurts',cottage:'cottage-cheeses',chickpeas:'chickpeas',turkey:'turkey-breasts'};
(async()=>{
 fs.mkdirSync('.expo/phase3c/raw',{recursive:true});
 for(const [key,category] of Object.entries(searches)){
  const file=`.expo/phase3c/raw/${key}.json`;if(fs.existsSync(file))continue;
  // OFF v3.6 product reads work; its API explicitly rejects the search action. v2 remains the supported search endpoint.
  const url=new URL('https://world.openfoodfacts.org/api/v2/search');
  url.search=new URLSearchParams({categories_tags:`en:${category}`,page_size:'12',sort_by:'popularity_key',...(process.env.CATALOG_GLOBAL==='1'?{}:{countries_tags:'en:germany'})});
  try{
   const r=await fetch(url,{headers:{'User-Agent':'SmartBasket/0.1 (https://github.com/samisam-hub/SmartBasket)'},signal:AbortSignal.timeout(25000)});
   if(!r.ok)throw Error(`HTTP ${r.status}`);const data=await r.json();if(!Array.isArray(data.products))throw Error('Malformed products');
   fs.writeFileSync(file,JSON.stringify({url:String(url),fetchedAt:new Date().toISOString(),...data}));
   console.log(`${key}: ${data.products.length} fetched (${data.count} in category)`);
  }catch(e){console.error(`${key}: ${e.message}`);}
  await new Promise(resolve=>setTimeout(resolve,7000)); // Below OFF's 10 searches/minute limit.
 }
})();
