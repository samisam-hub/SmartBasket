require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const React=require('react'),{create,act}=require('react-test-renderer');
const {prefs,catalog}=require('./basket-fixtures.cjs');
const {generateBasket}=require('../services/basket/basketGenerator.ts');
const {toggleBasketProduct}=require('../services/basket/edit.ts');
global.IS_REACT_ACT_ENVIRONMENT=true;
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
const stub=name=>function Stub(props){return React.createElement(name,props,props.children);};
const shared=[];
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='react-native')return {Pressable:'Pressable',Text:'Text',View:'View',Platform:{OS:'android'},Share:{share:async value=>{shared.push(value);}}};
 if(request==='expo-router')return {router:{push:()=>{}}};
 if(request==='@expo/vector-icons/Feather')return {default:stub('Icon')};
 if(parent?.filename.endsWith('/components/BasketResult.tsx') || parent?.filename.endsWith('/components/ShareBasket.tsx')){
  if(request==='../lib/theme')return {colors:{},spacing:{},ui:{}};
  if(request==='./ui')return {SecondaryButton:stub('SecondaryButton'),Chips:stub('Chips'),SectionCard:stub('SectionCard'),TextButton:stub('TextButton')};
  if(request.startsWith('./')){const name=request.slice(2);return {[name]:stub(name)};}
 }
 return originalLoad.call(this,request,parent,isMain);
};
const {BasketResult}=require('../components/BasketResult.tsx');
const {ShareBasket}=require('../components/ShareBasket.tsx');
Module._load=originalLoad;
test('product image rows remain visible with reversible accessible checkboxes',async()=>{
 const initial=generateBasket(prefs(),catalog);let result=initial,screen;
 const render=()=>React.createElement(BasketResult,{result,onToggleProduct:id=>{result=toggleBasketProduct(result,id);screen.update(render());}});
 await act(()=>{screen=create(render());});
 const boxes=()=>screen.root.findAllByType('Pressable').filter(n=>n.props.accessibilityRole==='checkbox');
 assert.equal(boxes().length,initial.items.length);assert.equal(boxes()[0].props.accessibilityState.checked,true);
 const id=initial.items[0].product.id;
 await act(()=>boxes()[0].props.onPress());
 assert.equal(screen.root.findAllByType('ProductImage').length,initial.items.length);
 const unchecked=boxes().find(n=>n.props.accessibilityState.checked===false);assert.ok(unchecked);
 assert.ok(!result.items.some(i=>i.product.id===id));
 await act(()=>unchecked.props.onPress());
 assert.ok(boxes().every(n=>n.props.accessibilityState.checked));assert.equal(result.items.length,initial.items.length);
 await act(()=>screen.unmount());
});

test('sharing includes selected products without reviving unchecked rows',async()=>{
 const {newSavedBasket}=require('../services/basket/persistence.ts');
 const original=generateBasket(prefs(),catalog),item=original.items[0];
 const result=toggleBasketProduct(original,item.product.id);let screen;
 await act(()=>{screen=create(React.createElement(ShareBasket,{basket:newSavedBasket(result,prefs(),null)}));});
 await act(async()=>{screen.root.findByType('SecondaryButton').props.onPress();});
 assert.equal(shared.length,1);
 assert.ok(!shared[0].message.includes(item.product.name));
 assert.ok(shared[0].message.includes(result.items[0].product.name));
 await act(()=>screen.unmount());
});
