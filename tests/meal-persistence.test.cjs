require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {prefs,product}=require('./basket-fixtures.cjs');
const {generateMealPlan}=require('../services/meals/planner.ts');
const {basketFromMealPlan}=require('../services/meals/basket.ts');
const {BasketPersistence,newSavedBasket}=require('../services/basket/persistence.ts');
const {catalogImportSql}=require('../services/catalog/product-row.ts');
const {replaceMealChoice}=require('../services/meals/choices.ts');
const p=prefs({planningDays:3});
const plan={...generateMealPlan(p),status:'confirmed'};
test('meal snapshots and empty ingredient coverage save locally, reopen offline and retry cloud',async()=>{
 const data=new Map(),storage={getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v);}};
 const original=newSavedBasket(basketFromMealPlan(plan,p,[]),p,p.userId);
 const result=await new BasketPersistence(storage,{save:async()=>{throw Error('offline');},list:async()=>[]}).save(original);
 assert.ok(result.warning);const reopened=(await new BasketPersistence(storage,null).list(p.userId)).baskets[0];assert.deepEqual(reopened,original);
 const synced=await new BasketPersistence(storage,{save:async()=> 'cloud',list:async()=>[]}).save(reopened);assert.equal(synced.basket.syncStatus,'synced');
});
test('meal migration/RPC is atomic, owner-private, idempotent and preserves existing V1 contract',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;`);
  for(const f of ['20260906005004_products_catalog.sql','20260906124417_product_image_quality.sql','20260906131336_generated_baskets.sql','20260906194141_meal_based_baskets.sql','20260907081513_ingredient_package_metadata.sql','20260907120000_synthetic_price_metadata.sql','20260908173310_meal_plan_snacks.sql','20260907134938_basket_management.sql','20260908185911_edit_saved_basket.sql','20260908191622_refresh_saved_basket_products.sql','20260908203211_checkout_and_pantry.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
  const a='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';await db.query('insert into auth.users values($1),($2)',[a,b]);
  await db.exec(fs.readFileSync('supabase/migrations/20260924144255_ready_meal_metadata.sql','utf8'));
  await db.exec(catalogImportSql([product(1)]));const productId=(await db.query('select id from products limit 1')).rows[0].id;
  const asUser=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  const empty=basketFromMealPlan(plan,p,[]);
  const save=(key,result=empty)=>db.query('select save_generated_basket($1,$2,$3::jsonb,$4::jsonb) id',[key,'Meals',JSON.stringify(p),JSON.stringify(result)]);
  await asUser(a);const id=(await save('meal-a')).rows[0].id;assert.equal((await save('meal-a')).rows[0].id,id);
  assert.equal((await db.query('select * from meal_plan_items')).rows.length,12);const parent=(await db.query('select * from meal_plans')).rows[0];
  assert.equal((await db.query('select meal_plan_id from baskets')).rows[0].meal_plan_id,parent.id);
  const bad=structuredClone(empty);bad.mealPlan.items[0].dayIndex=13;await assert.rejects(save('bad-day',bad));
  assert.equal((await db.query('select * from meal_plans')).rows.length,1);
  // Failure after parent/meal inserts must roll back all of them.
  const invalid=structuredClone(empty);invalid.items=[{product:product(1),packageCount:1,packageAmount:500,quantityUnit:'g',ingredientKey:'rice',purchasedQuantity:500,plannedConsumptionQuantity:300,leftoverQuantity:200,totalWeight:500,totalVolume:null,totalCalories:100,totalProtein:5,reasonSelected:[]}];
  await assert.rejects(save('bad-product',invalid),e=>e.code==='23503');assert.equal((await db.query('select * from meal_plans')).rows.length,1);
  invalid.items[0].product.id=productId;invalid.status='partial';await save('valid-package',invalid);
  const item=(await db.query('select * from basket_items')).rows[0];assert.equal(Number(item.purchased_quantity),500);assert.equal(Number(item.planned_consumption_quantity),300);assert.equal(Number(item.leftover_quantity),200);
  const checkout=()=>db.query('select checkout_basket($1,$2,$3::jsonb,$4::jsonb) result',['valid-package',0,'[]',JSON.stringify(invalid)]);
  const purchased=(await checkout()).rows[0].result;assert.ok(purchased.purchasedAt);assert.deepEqual((await checkout()).rows[0].result,purchased);
  assert.equal((await db.query('select version from pantry_state')).rows[0].version,1);
  assert.equal((await db.query('select * from purchase_history')).rows.length,1);
  await assert.rejects(db.query('select checkout_basket($1,$2,$3::jsonb,$4::jsonb)',['meal-a',0,'[]',JSON.stringify(empty)]));
  await assert.rejects(db.query('select update_saved_basket($1,$2::jsonb)',['valid-package',JSON.stringify(invalid)]));
  await asUser(b);assert.equal((await db.query('select * from purchase_history')).rows.length,0);assert.equal((await db.query('select * from pantry_state')).rows.length,0);assert.equal((await db.query('select * from meal_plans')).rows.length,0);assert.equal((await db.query('select * from meal_plan_items')).rows.length,0);
  await assert.rejects(db.query("insert into meal_plan_items(meal_plan_id,meal_id,day_index,meal_slot,servings,item_snapshot) values($1,'x',0,'lunch',1,'{}')",[parent.id]),e=>e.code==='42501');
  await assert.rejects(db.query('update meal_plans set user_id=$1',[b]),e=>e.code==='42501');assert.equal((await db.query('delete from meal_plans returning id')).rows.length,0);
  await save('meal-a');assert.equal((await db.query('select * from meal_plans')).rows.length,1);
  // Existing snapshot/RPC path preserves new modes and real ready-meal SKU links.
  let mixed=replaceMealChoice(plan,plan.items[0].id,'eat_out');
  const lunch=mixed.items.find(i=>i.mealSlot==='lunch');mixed=replaceMealChoice(mixed,lunch.id,'heat_and_eat','lasagne');
  const sku=product(1,{id:productId,readyMeal:{category:'lasagne',modes:['heat_and_eat'],slots:['lunch'],portionGrams:350,available:true,evidence:'Test label'}});
  const mixedBasket=basketFromMealPlan({...mixed,status:'confirmed'},p,[sku]);
  const mixedId=(await save('mixed-modes',mixedBasket)).rows[0].id;
  const snapshot=(await db.query('select result_summary from baskets where id=$1',[mixedId])).rows[0].result_summary;
  assert.equal(snapshot.mealPlan.items[0].mealMode,'eat_out');
  assert.equal(snapshot.mealPlan.items.find(i=>i.id===lunch.id).readyMealMatch.productId,productId);
  assert.equal((await db.query('select product_id from basket_items where basket_id=$1',[mixedId])).rows[0].product_id,productId);
  await db.exec('reset role;set role anon');await assert.rejects(db.exec('select * from meal_plans'),e=>e.code==='42501');await assert.rejects(save('anon'),e=>e.code==='42501');
 }finally{await db.close();}
});
