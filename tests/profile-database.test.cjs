require('./register.cjs');const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {prefs}=require('./basket-fixtures.cjs');const {emptyProfile}=require('../types/profile.ts');
const {profileToRow}=require('../services/profile-repository.ts');
const {profileParticipant,participantPreferences}=require('../services/profile-domain.ts');
const {generateMealPlan}=require('../services/meals/planner.ts');const {basketFromMealPlan}=require('../services/meals/basket.ts');
test('profile ownership, optional constraints, immutable parent-owned participants and atomic basket RPC',async()=>{
 const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;");
 for(const f of ['20260906005004_products_catalog.sql','20260906124417_product_image_quality.sql','20260906131336_generated_baskets.sql','20260906194141_meal_based_baskets.sql','20260907100053_personal_profiles_and_participants.sql','20260907134938_basket_management.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 const a='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';await db.query('insert into auth.users values($1),($2)',[a,b]);
 const asUser=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 await asUser(a);await db.query('insert into profiles(id,display_name) values($1,$2)',[a,'A']);await db.exec("update profiles set default_daily_calories=1700,height_cm=null,weight_kg=null");
 await assert.rejects(db.exec('update profiles set age=0'),e=>e.code==='23514');await assert.rejects(db.query('insert into profiles(id) values($1)',[b]),e=>e.code==='42501');
 const me=profileParticipant({...emptyProfile,displayName:'You',defaultDailyCalories:1700},prefs()),partner={...me,id:'partner',name:'Partner',dailyCalories:2201,proteinTarget:80,allergens:['peanuts'],isCurrentUser:false};
 const input=participantPreferences(prefs({planningDays:3}),[me,partner]),result=basketFromMealPlan({...generateMealPlan(input),status:'confirmed'},input,[]);
 const save=key=>db.query('select save_generated_basket($1,$2,$3::jsonb,$4::jsonb) id',[key,'Plan',JSON.stringify(input),JSON.stringify(result)]);
 const first=(await save('participants')).rows[0].id;assert.equal((await save('participants')).rows[0].id,first);
 const rows=(await db.query('select * from plan_participants')).rows;assert.equal(rows.length,2);assert.ok(rows.some(r=>r.allergens.includes('peanuts')));assert.equal((await db.query('select default_daily_calories from profiles')).rows[0].default_daily_calories,1700);
 await assert.rejects(db.exec('delete from plan_participants'),e=>e.code==='42501');
 const broken=structuredClone(result);broken.mealPlan.participants[1].dailyCalories=-1;await assert.rejects(db.query('select save_generated_basket($1,$2,$3::jsonb,$4::jsonb)',['broken','Plan',JSON.stringify(input),JSON.stringify(broken)]));assert.equal((await db.query('select * from meal_plans')).rows.length,1);
 await asUser(b);assert.equal((await db.query('select * from profiles')).rows.length,0);assert.equal((await db.query('select * from plan_participants')).rows.length,0);
 assert.equal((await db.query("update profiles set display_name='B' returning id")).rows.length,0);
 await assert.rejects(db.query('select rename_saved_basket($1,$2)',['participants','Other account']));
 await db.query('select delete_saved_basket($1)',['participants']);
 await asUser(a);assert.equal((await db.query('select name from baskets')).rows[0].name,'Plan');
 await db.query('select rename_saved_basket($1,$2)',['participants',' Weekend ']);assert.equal((await db.query('select name from baskets')).rows[0].name,'Weekend');
 await assert.rejects(db.query('select rename_saved_basket($1,$2)',['participants','  ']));
 await assert.rejects(db.exec("update baskets set result_summary='{}'::jsonb"),e=>e.code==='42501');
 await db.query('select delete_saved_basket($1)',['participants']);await db.query('select delete_saved_basket($1)',['participants']);
 for(const table of ['baskets','basket_items','meal_plans','meal_plan_items','plan_participants'])assert.equal((await db.query(`select count(*)::integer n from ${table}`)).rows[0].n,0);
 assert.equal((await db.query('select count(*)::integer n from profiles')).rows[0].n,1);
 await db.exec('reset role;set role anon');await assert.rejects(db.exec('select * from profiles'),e=>e.code==='42501');await assert.rejects(db.exec('select * from plan_participants'),e=>e.code==='42501');
 assert.equal(profileToRow({...emptyProfile,displayName:'Test'},a).id,a);
 }finally{await db.close();}
});
