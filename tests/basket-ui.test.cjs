const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript'),React=require('react'),{create,act}=require('react-test-renderer');
const {prefs,catalog}=require('./basket-fixtures.cjs');
const {generateBasket}=require('../services/basket/basketGenerator.ts');
const {newSavedBasket}=require('../services/basket/persistence.ts');
global.IS_REACT_ACT_ENVIRONMENT=true;
let params={},generated=0,saveCalls=0,resolveSave,load=async()=>catalog;
// The calendar's week arrives already decided; confirm() is what the screen asks it for.
let weekConfirmations=0,weekPlan=null;
const weekStore={initialize:async()=>{},confirm:()=>{weekConfirmations++;if(!weekPlan)throw Error('Plan at least one meal before creating a basket.');return weekPlan;}};
const saved=newSavedBasket(generateBasket(prefs(),catalog),prefs(),prefs().userId);
const preferenceState={ready:true,saved:prefs()};
const components=Object.fromEntries(['EmptyState','PrimaryButton','Screen','ScreenHeader','SecondaryButton'].map(name=>[name,props=>React.createElement(name,props,props.children)]));
const remember=()=>{};
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='@react-native-async-storage/async-storage')return {__esModule:true,default:{getItem:async()=>null,setItem:async()=>{}}};
  if(request==='@/context/ActiveBasketContext')return {useActiveBasket:()=>({active:null,remember,clear:()=>{}})};
  if(request==='@/services/pantry')return {loadPantry:async()=>({state:{version:0,lots:[]},purchases:[]})};
  if(request==='react-native')return {ActivityIndicator:'Spinner',Text:'Text'};
  if(request==='expo-router')return {router:{dismissTo:()=>{}},useLocalSearchParams:()=>params};
  if(request==='@/components/ui')return components;
  if(request==='@/components/MealPlanReview')return {MealPlanReview:props=>React.createElement('MealReview',props)};
  if(request==='@/services/meals/planner')return {generateMealPlan:(...args)=>{generated++;return require('../services/meals/planner.ts').generateMealPlan(...args);}};
  if(request==='@/services/meals/basket')return {basketFromMealPlan:(plan,p)=>({...generateBasket(p,catalog),engineVersion:'2',mealPlan:plan})};
  if(request==='@/components/BasketResult')return {BasketResult:props=>React.createElement('Result',props)};
  if(request==='@/components/ShoppingList')return {ShoppingList:props=>React.createElement('ShoppingList',props)};
  if(request==='@/components/BasketExtras')return {BasketExtras:props=>React.createElement('Extras',props)};
  if(request==='@/context/PreferencesContext')return {usePreferences:()=>preferenceState};
  if(request==='@/context/WeekPlanContext')return {useWeekPlan:()=>({plan:weekPlan,ready:true,error:null,store:weekStore})};
  if(request==='@/hooks/useBasketFlow')return {useBasketFlow:()=>({edit:()=>{},disabled:false})};
  if(request==='@/lib/supabase')return {getSupabaseClient:()=>({})};
  if(request==='@/lib/theme')return {colors:{},ui:{}};
  if(request==='@/services/basket/catalog')return {loadBasketCatalog:(...args)=>load(...args)};
  if(request==='@/services/basket/basketGenerator')return {generateBasket:(...args)=>{generated++;return generateBasket(...args);}};
  if(request==='@/services/baskets')return {basketOwner:async()=>prefs().userId,basketPersistence:()=>({list:async()=>({baskets:[saved],warning:null}),save:async b=>{saveCalls++;await new Promise(resolve=>{resolveSave=resolve;});return {basket:{...b,syncStatus:'synced',cloudId:'id'},warning:null};}})};
  if(request.startsWith('@/'))request=path.resolve(path.dirname(require.resolve('../package.json')),request.slice(2));
  return originalLoad.call(this,request,parent,isMain);
};
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(module,filename)=>{
  const result=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
  module._compile(result.outputText,filename);
};
const Screen=require('../app/basket-setup.tsx').default;
const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,15));});
test('actual screen requires meal confirmation, saves once on double tap, reopens a snapshot and aborts abandoned generation',async()=>{
  let renderer;
  await act(()=>{renderer=create(React.createElement(Screen));});await flush();
  assert.equal(generated,1);assert.equal(renderer.root.findAllByType('Result').length,0);
  assert.equal(renderer.root.findAllByType('MealReview').length,1);
  await act(()=>renderer.root.findByType('MealReview').props.onConfirm());
  assert.equal(renderer.root.findAllByType('Result').length,1);
  assert.equal(renderer.root.findByType('Screen').props.bottom,true);assert.equal(renderer.root.findByType('Screen').props.top,false);
  const saveButton=renderer.root.findAllByType('PrimaryButton').find(b=>b.props.label==='Save meal plan & basket');
  await act(async()=>{saveButton.props.onPress();saveButton.props.onPress();await Promise.resolve();});
  assert.equal(saveCalls,1);
  await act(async()=>{resolveSave();await Promise.resolve();});await flush();
  assert.ok(renderer.root.findAllByType('PrimaryButton').some(b=>b.props.label==='Basket saved'&&b.props.disabled));
  params={savedId:saved.id};await act(()=>renderer.update(React.createElement(Screen)));await flush();
  assert.equal(generated,1);assert.deepEqual(renderer.root.findByType('Result').props.result,saved.result);
  await act(()=>renderer.unmount());
  params={};let resolveLoad;let signal;
  load=async(_client,s)=>{signal=s;return new Promise(resolve=>{resolveLoad=resolve;});};
  await act(()=>{renderer=create(React.createElement(Screen));});await flush();
  await act(()=>renderer.unmount());assert.equal(signal.aborted,true);
  await act(async()=>{resolveLoad(catalog);await Promise.resolve();});await flush();assert.equal(generated,1);
});

test('a week from the calendar goes straight to a basket, and an empty one says why',async()=>{
  let renderer;
  load=async()=>catalog;
  const generatedBefore=generated;
  params={week:'1'};weekPlan=null;
  await act(()=>{renderer=create(React.createElement(Screen));});await flush();
  // Nothing planned: the screen reports it instead of generating an automatic plan.
  assert.equal(weekConfirmations,1);
  assert.equal(renderer.root.findAllByType('Result').length,0);
  assert.equal(renderer.root.findAllByType('MealReview').length,0,'the calendar is the review');
  await act(()=>renderer.unmount());
  const plan={version:'2',weekStart:'2026-10-05',status:'confirmed',householdSize:prefs().householdSize,
    targetCalories:12000,targetProtein:600,warnings:[],days:[{date:'2026-10-05',slots:['dinner']}],
    items:[{id:'2026-10-05-dinner',date:'2026-10-05',mealSlot:'dinner',servings:1,
      meal:{id:'m1',name:'Fixture meal',ingredients:[],dietaryTags:[],allergens:[]}}]};
  weekPlan=plan;
  await act(()=>{renderer=create(React.createElement(Screen));});await flush();
  assert.equal(renderer.root.findAllByType('MealReview').length,0);
  const result=renderer.root.findByType('Result').props.result;
  assert.equal(result.mealPlan,plan,'the confirmed week is what the basket was built from');
  assert.equal(generated,generatedBefore,'no automatic plan is generated for a calendar week');
  // Extras are offered on the basket and land in it as shopping-only items.
  const extras=renderer.root.findByType('Extras');
  const {product:fixture,catalog:fixtures}=require('./basket-fixtures.cjs');
  const newProduct=fixture(99,{name:'Washing-up liquid',category:'other'});
  await act(()=>extras.props.onAdd(newProduct));
  const items=()=>renderer.root.findByType('Result').props.result.items;
  const added=items().find(item=>item.product.id===newProduct.id);
  assert.ok(added?.isExtra,'a product outside the plan is marked as an extra');
  assert.equal(added.plannedConsumptionQuantity,0,'extras add no portions to the plan');
  // A product the plan already buys gets another package instead of more planned portions.
  const planned=items().find(item=>!item.isExtra&&item.product.id===fixtures[0].id);
  if(planned){
    const before=planned.packageCount;
    await act(()=>extras.props.onAdd(fixtures[0]));
    const after=items().find(item=>item.product.id===fixtures[0].id);
    assert.equal(after.packageCount,before+1);
    assert.equal(after.extraPackageCount,1);
  }
  await act(()=>renderer.unmount());
  params={};
});
