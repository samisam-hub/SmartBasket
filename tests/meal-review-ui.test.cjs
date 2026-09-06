const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const ts=require('typescript'),React=require('react'),{create,act}=require('react-test-renderer');
require('./register.cjs');
const {prefs}=require('./basket-fixtures.cjs');const {generateMealPlan}=require('../services/meals/planner.ts');
global.IS_REACT_ACT_ENVIRONMENT=true;
const original=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='react-native')return {Text:'Text',View:'View'};
 if(request==='./ui'&&parent.filename.endsWith('MealPlanReview.tsx'))return Object.fromEntries(['PrimaryButton','SecondaryButton','SectionCard'].map(n=>[n,p=>React.createElement(n,p,p.children)]));
 if(request==='../lib/theme')return {ui:{}};
 return original.call(this,request,parent,isMain);
};
require.extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const {MealPlanReview}=require('../components/MealPlanReview.tsx');
test('meal review displays nine slots, changes a compatible meal and explicitly confirms',async()=>{
 const p=prefs({planningDays:3,dietaryPreferences:['vegan']});let plan=generateMealPlan(p),confirmed=0,renderer;
 const render=()=>React.createElement(MealPlanReview,{plan,preferences:p,onChange:next=>{plan=next;renderer.update(render());},onConfirm:()=>confirmed++});
 await act(()=>{renderer=create(render());});assert.equal(confirmed,0);assert.equal(renderer.root.findAllByType('SectionCard').length,10);
 const before=plan.items[0].meal.id;await act(()=>renderer.root.findAllByType('SecondaryButton').find(b=>b.props.label==='Replace meal').props.onPress());
 const alternative=renderer.root.findAllByType('SecondaryButton').find(b=>b.props.label.includes('kcal'));assert.ok(alternative);
 await act(()=>alternative.props.onPress());assert.notEqual(plan.items[0].meal.id,before);assert.ok(plan.items[0].meal.dietaryTags.includes('vegan'));
 await act(()=>renderer.root.findByType('PrimaryButton').props.onPress());assert.equal(confirmed,1);await act(()=>renderer.unmount());
});
