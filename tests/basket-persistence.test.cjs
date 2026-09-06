require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict');
const { prefs,catalog } = require('./basket-fixtures.cjs');
const { generateBasket } = require('../services/basket/basketGenerator.ts');
const { BasketPersistence,newSavedBasket } = require('../services/basket/persistence.ts');
const memory = () => { const data=new Map(); return { data,getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v);} }; };
const draft = () => newSavedBasket(generateBasket(prefs(),catalog),prefs(),prefs().userId);
test('save, close/reopen, owner isolation and explicit offline cloud retry retain snapshots', async () => {
  const storage=memory(); let offline=true; const cloud=new Map(); let calls=0;
  const remote={ save:async b=>{calls++;if(offline)throw Error('offline');cloud.set(b.id,b);return 'cloud-id';},list:async()=>{if(offline)throw Error('offline');return [...cloud.values()].map(b=>({...b,cloudId:'cloud-id',syncStatus:'synced'}));} };
  const persistence=new BasketPersistence(storage,remote), original=draft();
  const local=await persistence.save(original); assert.equal(local.basket.syncStatus,'local'); assert.ok(local.warning);
  const restarted=new BasketPersistence(storage,remote);
  const reopened=await restarted.list(original.ownerId);assert.deepEqual(reopened.baskets[0].result,original.result);
  assert.equal((await restarted.list('other-user')).baskets.length,0);
  offline=false;const saved=await restarted.save(reopened.baskets[0]);assert.equal(saved.basket.syncStatus,'synced');assert.equal(cloud.size,1);
  await restarted.save(saved.basket);assert.equal(cloud.size,1);assert.equal(calls,3);
  assert.equal((await restarted.list(original.ownerId)).baskets.length,1);
});
test('failed local writes do not claim a save or send a cloud request; corrupt state is preserved',async()=>{
  let calls=0;const persistence=new BasketPersistence({getItem:async()=>null,setItem:async()=>{throw Error('disk full');}},{save:async()=>{calls++;return 'id';},list:async()=>[]});
  await assert.rejects(persistence.save(draft()),/disk full/);assert.equal(calls,0);
  const storage=memory();const key=`smartbasket.baskets.v1:${prefs().userId}`;storage.data.set(key,'not json');
  await assert.rejects(new BasketPersistence(storage,null).list(prefs().userId));assert.equal(storage.data.get(key),'not json');
});
test('concurrent saves retain both index entries and reject empty results',async()=>{
  const persistence=new BasketPersistence(memory(),null),a=draft(),b={...draft(),id:'different-id'};
  await Promise.all([persistence.save(a),persistence.save(b)]);
  assert.equal((await persistence.list(a.ownerId)).baskets.length,2);
  await assert.rejects(persistence.save({...a,result:{...a.result,items:[]}}));
});
