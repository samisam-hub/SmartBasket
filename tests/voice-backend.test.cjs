require('./register.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {voiceDefaults}=require('../services/voice/plan.ts');
const {defaultDraft}=require('../types/preferences.ts');
test('voice backend validates auth, missing secret, input and model output',async t=>{
 let handler,key;const priorFetch=global.fetch,priorDeno=global.Deno;
 global.Deno={env:{get:n=>n==='OPENAI_API_KEY'?key:n==='SUPABASE_URL'?'https://test.supabase.co':'test'},serve:fn=>handler=fn};
 require('../supabase/functions/basket-voice/index.ts');
 t.after(()=>{global.fetch=priorFetch;global.Deno=priorDeno;});
 let user={id:'test-user',email_confirmed_at:'2026-09-10',is_anonymous:false};let upstream=[];let output;
 global.fetch=async(url,init)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json(user);
  upstream.push({url,init});return Response.json(output);
 };
 const call=(body,auth=true)=>handler(new Request('https://test/voice',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test'}:{})},body:JSON.stringify(body)}));
 assert.equal((await call({},false)).status,401);assert.equal(upstream.length,0);
 assert.equal((await call({})).status,503);assert.equal(upstream.length,0);
 key='test-placeholder';user.is_anonymous=true;assert.equal((await call({})).status,403);user.is_anonymous=false;
 assert.equal((await call({plan:{}})).status,400);assert.equal(upstream.length,0);
 const plan={...voiceDefaults([{name:'Sam',dailyCalories:1500,proteinTarget:100,dietaryPreferences:['none'],allergens:[]}],defaultDraft),days:30};
 output={status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({reply:'Ready',language:'de',unresolved:null,plan})}]}]};
 const response=await call({plan,text:'30 Tage',history:[],meals:[]});assert.equal(response.status,200);
 const result=await response.json();assert.match(result.reply,/3, 5, 7 oder 14/);assert.ok(result.unresolved);assert.equal(result.plan.days,30);
 const sent=JSON.parse(upstream[0].init.body);assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);
 output={status:'completed',output:[{content:[{type:'output_text',text:'{"plan":null}'}]}]};
 assert.equal((await call({plan,text:'hello',history:[],meals:[]})).status,422);
});
