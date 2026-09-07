require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {authService,emailError,passwordError}=require('../services/auth-service.ts');
const {ProfileStore}=require('../services/profile-store.ts');
const {emptyProfile}=require('../types/profile.ts');
const {profileParticipant,participantPreferences,validateProfile}=require('../services/profile-domain.ts');
const {nutritionTargets}=require('../services/basket/nutritionTargets.ts');
const {prefs}=require('./basket-fixtures.cjs');
const {generateMealPlan,compatibleMeal}=require('../services/meals/planner.ts');
const {fullCatalog}=require('./meal-fixtures.cjs');
const {skuSafety}=require('../services/meals/skuSafety.ts');
const {migrateOwnedCache}=require('../services/scope-migration.ts');
test('legacy/offline caches migrate only to their owner or their first anonymous claimant',async()=>{
 const values=new Map([['legacy',JSON.stringify({saved:{userId:'a'}})],['offline',JSON.stringify({saved:{id:null,displayName:'Private'}})]]),s={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>values.set(k,v)};
 await migrateOwnedCache(s,'legacy','b-cache','b',true,'userId');assert.equal(values.has('b-cache'),false);
 await migrateOwnedCache(s,'legacy','a-cache','a',true,'userId');assert.equal(values.has('a-cache'),true);
 await migrateOwnedCache(s,'offline','first','a',true,'id');await migrateOwnedCache(s,'offline','second','b',true,'id');assert.equal(values.has('first'),true);assert.equal(values.has('second'),false);
});
test('anonymous session resumes, email upgrade retains identity, password follows verification; sign-in/out and reset are explicit',async()=>{
 let session=null,anonymous=0,verified=false;const calls=[];
 const client={auth:{getSession:async()=>({data:{session}}),signInAnonymously:async()=>{anonymous++;session={user:{id:'guest-id',is_anonymous:true}};return {data:{session}};},
 updateUser:async value=>{calls.push(value);if(value.password&&!verified)return {error:Error('Verify email first')};return {data:{user:session.user}};},
 verifyOtp:async()=>{verified=true;session.user.is_anonymous=false;return {data:{session}};},
 signInWithPassword:async()=>{session={user:{id:'account-id',is_anonymous:false}};return {data:{session}};},
 resetPasswordForEmail:async()=>({data:{}}),signOut:async()=>{session=null;return {};}}};
 const auth=authService(client);await Promise.all([auth.ensureGuest(),auth.ensureGuest()]);assert.equal(anonymous,1);await auth.ensureGuest();assert.equal(anonymous,1);
 await auth.register('person@example.com','smartbasket://auth/callback');assert.equal(session.user.id,'guest-id');assert.deepEqual(calls,[{email:'person@example.com'}]);
 await assert.rejects(auth.setPassword('long-password'));await auth.verify('person@example.com','123456','email_change');await auth.setPassword('long-password');assert.equal(session.user.id,'guest-id');
 await auth.signOut();assert.equal(session,null);await auth.signIn('person@example.com','long-password');assert.equal(session.user.id,'account-id');await auth.reset('person@example.com','smartbasket://auth/callback');
 assert.ok(emailError('bad'));assert.ok(passwordError('short'));
});
test('personal defaults and participant overrides stay distinct; shared diets/allergens union and targets sum exactly',()=>{
 const profile={...structuredClone(emptyProfile),displayName:'You',defaultDailyCalories:1700,primaryNutritionGoal:'high_protein',dietaryPreferences:['lactose_free']};
 const copy=structuredClone(profile),me=profileParticipant(profile,prefs());assert.equal(me.dailyCalories,1700);
 const partner={...structuredClone(me),id:'partner',name:'Partner',dailyCalories:2201,proteinTarget:80,dietaryPreferences:['none'],allergens:['peanuts'],isCurrentUser:false};
 const input=participantPreferences(prefs({planningDays:3}),[{...me,dailyCalories:2200},partner]);
 assert.deepEqual(profile,copy);assert.equal(input.householdSize,2);assert.deepEqual(input.dietaryPreferences,['lactose_free']);assert.ok(input.allergens.includes('peanuts'));
 assert.equal(nutritionTargets(input).calorieTarget,(2200+2201)*3);
 const plan=generateMealPlan(input,fullCatalog);assert.equal(plan.participants.length,2);assert.ok(plan.items.every(i=>compatibleMeal(i.meal,input)));assert.deepEqual(profile,copy);
 const combined=participantPreferences(prefs(),[{...me,dietaryPreferences:['vegetarian']},{...partner,dietaryPreferences:['vegan'],intolerances:['gluten']}]);
 assert.deepEqual(combined.dietaryPreferences,['vegan','gluten_free']);assert.ok(combined.allergens.includes('wheat'));
 const wheatFree={...fullCatalog[0],allergens:[],mayContainAllergens:[],ingredientsText:'Rice',labels:['wheat free','peanut free'],allergenInfoAvailable:true,glutenFree:null};
 assert.equal(skuSafety(wheatFree,combined).rejection,'allergen_metadata_unknown');
 assert.throws(()=>participantPreferences(prefs(),[{...me,dailyCalories:null}]));assert.ok(validateProfile({...profile,heightCm:300}).heightCm);assert.deepEqual(validateProfile(profile),{});
});
test('profile drafts survive restart, cloud failure retries, owner caches isolate and failed local save is not claimed',async()=>{
 const values=new Map(),storage={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>values.set(k,v)};
 let fail=true;const remote={load:async()=>null,save:async p=>{if(fail)throw Error('offline');return {...p,id:'a'};}};
 const a=new ProfileStore(storage,'profile:a',remote);await a.initialize();a.update({displayName:'A',heightCm:300},1);await a.flush();
 const resumed=new ProfileStore(storage,'profile:a',remote);await resumed.initialize();assert.equal(resumed.getSnapshot().draft.heightCm,300);assert.equal(resumed.getSnapshot().step,1);
 resumed.update({heightCm:null});await resumed.save();assert.ok(resumed.getSnapshot().pending);fail=false;await resumed.save();assert.equal(resumed.getSnapshot().pending,false);
 const b=new ProfileStore(storage,'profile:b',null);await b.initialize();assert.equal(b.getSnapshot().saved,null);
 const broken=new ProfileStore({getItem:async()=>null,setItem:async()=>{throw Error('disk');}},'broken',null);await broken.initialize();await assert.rejects(broken.save());assert.equal(broken.getSnapshot().saved,null);
});

test('edits made during a slow profile save survive in the draft and on disk',async()=>{
 let release,block=false;const values=new Map(),storage={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>{if(block){block=false;await new Promise(r=>release=r);}values.set(k,v);}};
 const s=new ProfileStore(storage,'race',null);await s.initialize();s.update({displayName:'Saved name'});await s.flush();block=true;
 const save=s.save();await new Promise(r=>setImmediate(r));s.update({displayName:'New draft'});release();await save;await s.flush();
 assert.equal(s.getSnapshot().saved.displayName,'Saved name');assert.equal(s.getSnapshot().draft.displayName,'New draft');assert.equal(JSON.parse(values.get('race')).draft.displayName,'New draft');
});

test('email and password registration validates first, keeps guest identity and applies password only after verified ownership',async()=>{
 let user={id:'guest',is_anonymous:true,email:'a@example.com',email_confirmed_at:null},calls=[];
 const client={auth:{getSession:async()=>({data:{session:{user}}}),getUser:async()=>({data:{user}}),updateUser:async value=>{calls.push(value);return {data:{user}};}}};
 const s=authService(client);
 await assert.rejects(s.beginRegistration('a@example.com','short','callback'));assert.equal(calls.length,0);
 await s.beginRegistration('a@example.com','chosen-password','callback');assert.deepEqual(calls,[{email:'a@example.com'}]);
 await assert.rejects(s.completeRegistration(),/confirm your email/);assert.equal(calls.length,1);
 user={...user,is_anonymous:false,email_confirmed_at:'2026-09-07'};
 assert.equal(await s.completeRegistration(),true);assert.deepEqual(calls[1],{password:'chosen-password'});assert.equal(await s.completeRegistration(),false);
 user={...user,is_anonymous:true};await s.beginRegistration('a@example.com','another-password','callback');user={...user,id:'other',is_anonymous:false};await assert.rejects(s.completeRegistration(),/Account changed/);assert.equal(await s.completeRegistration(),false);
 user={...user,is_anonymous:true};await s.beginRegistration('a@example.com','another-password','callback');s.clearRegistration();assert.equal(await s.completeRegistration(),false);
});
