const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const React=require('react'),{create,act}=require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT=true;
let state={session:null,ready:false},mounts=0;
function Stack(){const [route]=React.useState('basket');React.useEffect(()=>{mounts++;},[]);return React.createElement('route',{name:route});}Stack.Screen=function Screen(){return null;};
const pass=p=>p.children,original=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='react-native')return {View:pass};
 if(request==='@/context/ActiveBasketContext')return {ActiveBasketProvider:pass};
 if(request==='@/components/ActiveBasketShortcut')return {ActiveBasketShortcut:()=>null};
 if(request==='@/components/ScreenNavigation')return {ScreenNavigation:()=>null};
 if(request==='expo-router')return {Stack};
 if(request==='expo-status-bar')return {StatusBar:()=>null};
 if(request==='react-native-safe-area-context')return {SafeAreaProvider:pass};
 if(request==='@/context/AuthContext')return {AuthProvider:pass,useAuth:()=>state};
 if(request==='@/context/PreferencesContext')return {PreferencesProvider:pass};
 if(request==='@/context/ProfileContext')return {ProfileProvider:pass};
 if(request==='@/lib/theme')return {colors:{}};
 return original.call(this,request,parent,isMain);
};
require.extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const Root=require('../app/_layout.tsx').default;
test('root keeps current route mounted through session restore, refresh and guest upgrade; resets on owner change',async()=>{
 let r;await act(()=>{r=create(React.createElement(Root));});assert.equal(mounts,1);
 for(const session of [{user:{id:'a',is_anonymous:true}},{user:{id:'a',is_anonymous:true}},{user:{id:'a',is_anonymous:false}}]){state={session,ready:true};await act(()=>r.update(React.createElement(Root)));assert.equal(mounts,1);assert.equal(r.root.findByType('route').props.name,'basket');}
 state={session:null,ready:false};await act(()=>r.update(React.createElement(Root)));assert.equal(mounts,2);
 state={session:{user:{id:'b',is_anonymous:true}},ready:true};await act(()=>r.update(React.createElement(Root)));assert.equal(mounts,3);
 await act(()=>r.unmount());
});

