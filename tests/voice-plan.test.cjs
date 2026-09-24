require('./register.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {clarification,isVoiceReply}=require('../services/voice/contract.ts');
const {voiceDefaults,confirmedVoicePlan}=require('../services/voice/plan.ts');
const {defaultDraft}=require('../types/preferences.ts');
const {generateMealPlan}=require('../services/meals/planner.ts');
const {meals}=require('../data/meals.ts');
const {fullCatalog}=require('./meal-fixtures.cjs');
const base={...defaultDraft,id:null,userId:null,onboardingCompleted:true,createdAt:'2026-09-10',updatedAt:'2026-09-10'};
const person={id:'me',name:'Sam',age:null,sex:null,isCurrentUser:true,dailyCalories:1500,proteinTarget:100,dietaryPreferences:['none'],allergens:[],intolerances:[]};
const valid=()=>({...voiceDefaults([person],base),days:3});
test('voice asks about unsupported days instead of silently rounding',()=>{
 for(const days of [null,0,2,4,15,30,3.5]) assert.match(clarification({...valid(),days},'de'),/3, 5, 7 oder 14/);
 for(const days of [3,5,7,14]) assert.equal(clarification({...valid(),days},'en'),null);
});
test('voice asks for individual targets and rejects invalid budgets and household sizes',()=>{
 const p=valid();p.people.push({...p.people[0],name:'Partner',calories:null,protein:null});
 assert.match(clarification(p,'en'),/Partner.*calorie/);
 p.people[1].calories=2100;assert.match(clarification(p,'en'),/Partner.*protein/);
 p.people[1].protein=140;assert.equal(clarification(p,'en'),null);
 assert.match(clarification({...p,budget:0},'en'),/budget/);
 assert.match(clarification({...p,people:Array(11).fill(p.people[0])},'en'),/1 and 10/);
});
test('voice handoff preserves restrictions, separate targets, total budget and saved profile',()=>{
 const original={...person,allergens:['milk'],intolerances:['lactose']};const before=JSON.stringify(base);
 const p=valid();p.people.push({...p.people[0],name:'Max',calories:2100,protein:140});p.budget=90;
 const input=confirmedVoicePlan(p,base,[original]);
 assert.equal(input.householdSize,2);assert.equal(input.weeklyBudgetEur,90);assert.equal(input.planningDays,3);
 assert.deepEqual(input.participants.map(p=>p.proteinTarget),[100,140]);assert.deepEqual(input.allergens,['milk']);
 assert.ok(input.dietaryPreferences.includes('lactose_free'));assert.equal(JSON.stringify(base),before);
 assert.equal(input.participants[0].id,'me');
});
test('voice rejects malformed output and invalid handoff',()=>{
 assert.equal(isVoiceReply({reply:'Ready',language:'en',unresolved:null,plan:valid()}),true);
 assert.equal(isVoiceReply({reply:'Ready',language:'en',unresolved:null,plan:{...valid(),people:[{name:'x'}]}}),false);
 assert.throws(()=>confirmedVoicePlan({...valid(),days:30},base,[person]));
 assert.throws(()=>confirmedVoicePlan({...valid(),preferredMealIds:['invented']},base,[person]));
});
test('spoken meal wish enters the ordinary review and cannot bypass allergies',()=>{
 const meal=meals.find(m=>m.mealType==='breakfast'&&m.allergens.includes('eggs'));
 assert.ok(meal);
 const p={...valid(),preferredMealIds:[meal.id]};
 const input=confirmedVoicePlan(p,base,[person]);
 const plan=generateMealPlan(input,fullCatalog);
 assert.equal(plan.status,'review');assert.ok(plan.items.some(i=>i.meal.id===meal.id));
 assert.throws(()=>confirmedVoicePlan(p,base,[{...person,allergens:['eggs']}]),/dietary/);
});
