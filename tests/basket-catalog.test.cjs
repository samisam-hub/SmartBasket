require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const {product}=require('./basket-fixtures.cjs');
const {productToRow}=require('../services/catalog/product-row.ts');
const {loadBasketCatalog}=require('../services/basket/catalog.ts');
test('basket catalog reads bounded real pages, handles exact limit, refuses truncation and aborts without demo substitution',async()=>{
  const row={...productToRow(product(1)),id:product(1).id,created_at:'2026-09-06',updated_at:'2026-09-06'};
  const calls=[];
  const client=(count)=>createClient('https://catalog.example.test','public-test-key',{auth:{persistSession:false},global:{fetch:async raw=>{
    const url=new URL(raw);calls.push(url);const offset=Number(url.searchParams.get('offset')),limit=Number(url.searchParams.get('limit'));
    return new Response(JSON.stringify(Array.from({length:Math.max(0,Math.min(limit,count-offset))},(_,i)=>({...row,id:String(offset+i)}))),{headers:{'content-type':'application/json'}});
  }}});
  assert.equal((await loadBasketCatalog(client(501))).length,501);
  assert.equal(calls[0].searchParams.get('limit'),'250');assert.equal(calls[0].searchParams.get('source'),'neq.demo');
  assert.equal((await loadBasketCatalog(client(2000))).length,2000);
  await assert.rejects(loadBasketCatalog(client(2001)),/exceeds/);
  await assert.rejects(loadBasketCatalog(null),/Connect/);
  const controller=new AbortController();controller.abort();await assert.rejects(loadBasketCatalog(client(10),controller.signal),/Cancelled/);
});
