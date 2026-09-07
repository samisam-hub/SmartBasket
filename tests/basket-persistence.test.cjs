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

test('rename and delete survive offline restart, synchronize by owner and cannot resurrect stale snapshots',async()=>{
 const storage=memory(),cloud=new Map();let offline=false;
 const remote={save:async b=>{if(offline)throw Error();cloud.set(b.id,b);return 'cloud-id';},list:async owner=>{if(offline)throw Error();return [...cloud.values()].filter(b=>b.ownerId===owner).map(b=>({...b,syncStatus:'synced',cloudId:'cloud-id'}));},rename:async(owner,id,name)=>{if(offline)throw Error();const b=cloud.get(id);assert.equal(b.ownerId,owner);cloud.set(id,{...b,name});},remove:async(owner,id)=>{if(offline)throw Error();if(cloud.has(id))assert.equal(cloud.get(id).ownerId,owner);cloud.delete(id);}};
 const p=new BasketPersistence(storage,remote),b=draft();await p.save(b);offline=true;
 await assert.rejects(p.rename(b.ownerId,b.id,'   '));await assert.rejects(p.rename('someone-else',b.id,'Bad'));
 const response=await p.rename(b.ownerId,b.id,'  Weekend groceries  ');assert.ok(response.warning);
 const reopened=new BasketPersistence(storage,remote);assert.equal((await reopened.list(b.ownerId)).baskets[0].name,'Weekend groceries');
 offline=false;assert.equal((await reopened.list(b.ownerId)).baskets[0].name,'Weekend groceries');assert.equal(cloud.get(b.id).name,'Weekend groceries');
 offline=true;assert.ok((await reopened.remove(b.ownerId,b.id)).warning);assert.equal((await reopened.list(b.ownerId)).baskets.length,0);
 await assert.rejects(reopened.save(b),/deleted/);offline=false;assert.equal((await new BasketPersistence(storage,remote).list(b.ownerId)).baskets.length,0);assert.equal(cloud.size,0);
 assert.equal(storage.data.get(`smartbasket.baskets.v1:${b.ownerId}:${b.id}`),'');
});
test('another device deletion clears cached synced baskets; failed action writes do not alter cloud',async()=>{
 const storage=memory(),b=draft();let cloud=[{...b,cloudId:'cloud',syncStatus:'synced'}],writes=0;
 const remote={list:async()=>cloud,save:async()=> 'cloud',rename:async()=>writes++,remove:async()=>writes++};const p=new BasketPersistence(storage,remote);
 assert.equal((await p.list(b.ownerId)).baskets.length,1);cloud=[];assert.equal((await p.list(b.ownerId)).baskets.length,0);
 await p.save(b);const fail=new BasketPersistence({...storage,setItem:async()=>{throw Error('disk full');}},remote);
 await assert.rejects(fail.rename(b.ownerId,b.id,'New'),/disk full/);await assert.rejects(fail.remove(b.ownerId,b.id),/disk full/);assert.equal(writes,0);
});
