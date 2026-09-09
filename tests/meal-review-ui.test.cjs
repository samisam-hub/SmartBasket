const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const ts=require('typescript'),React=require('react'),{create,act}=require('react-test-renderer');
require('./register.cjs');
const {prefs}=require('./basket-fixtures.cjs');const {generateMealPlan}=require('../services/meals/planner.ts');
global.IS_REACT_ACT_ENVIRONMENT=true;
const original=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='react-native')return {Text:'Text',View:'View',Image:'Image'};
 if(request==='./ui'&&parent.filename.endsWith('MealPlanReview.tsx'))return Object.fromEntries(['PrimaryButton','SecondaryButton','SectionCard'].map(n=>[n,p=>React.createElement(n,p,p.children)]));
 if(request==='../lib/theme')return {ui:{}};
 return original.call(this,request,parent,isMain);
};
require.extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const {MealPlanReview}=require('../components/MealPlanReview.tsx');
const {MealImage}=require('../components/MealImage.tsx');
const {meals}=require('../data/meals.ts');
test('failed meal image collapses without removing meal text or breaking another image',async()=>{
 let renderer;const oats=meals.find(m=>m.id==='oat-berries'),salmon=meals.find(m=>m.id==='salmon-rice');
 await act(()=>{renderer=create(React.createElement(MealImage,{meal:oats}));});
 await act(()=>renderer.root.findByType('Image').props.onError());
 assert.equal(renderer.toJSON(),null);
 await act(()=>renderer.update(React.createElement(MealImage,{meal:salmon})));
 assert.equal(renderer.root.findByType('Image').props.accessibilityLabel,salmon.name);
 await act(()=>renderer.unmount());
});
test('meal review displays twelve slots, changes a compatible meal and explicitly confirms',async()=>{
 const p=prefs({planningDays:3,dietaryPreferences:['vegan']});let plan=generateMealPlan(p),confirmed=0,renderer;
 const render=()=>React.createElement(MealPlanReview,{plan,preferences:p,onChange:next=>{plan=next;renderer.update(render());},onConfirm:()=>confirmed++});
 await act(()=>{renderer=create(render());});assert.equal(confirmed,0);assert.equal(renderer.root.findAllByType('SectionCard').length,13);
 const before=plan.items[0].meal.id;await act(()=>renderer.root.findAllByType('SecondaryButton').find(b=>b.props.label==='Replace meal').props.onPress());
 const alternative=renderer.root.findAllByType('SecondaryButton').find(b=>b.props.label.includes('kcal'));assert.ok(alternative);
 await act(()=>alternative.props.onPress());assert.notEqual(plan.items[0].meal.id,before);assert.ok(plan.items[0].meal.dietaryTags.includes('vegan'));
 await act(()=>renderer.root.findByType('PrimaryButton').props.onPress());assert.equal(confirmed,1);await act(()=>renderer.unmount());
});
