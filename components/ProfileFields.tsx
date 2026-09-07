import {View,Text} from 'react-native';
import {SelectionChip,TextInput} from './ui';
import {allergens,diets,labels,type Allergen,type Diet} from '../types/preferences';
import {toggleDiet} from '../services/preference-domain';
import type {PersonalProfile} from '../types/profile';
import {ui} from '../lib/theme';
import {useEffect,useRef,useState} from 'react';
export function OptionalNumber({label,value,onChange,error,hint}:{label:string;value:number|null;onChange:(n:number|null)=>void;error?:string;hint?:string}){
 const [text,setText]=useState(value===null?'':String(value)),last=useRef(value);
 useEffect(()=>{if(!Object.is(value,last.current)){setText(value===null?'':String(value));last.current=value;}},[value]);
 return <TextInput label={label} value={text} keyboardType="decimal-pad" error={error} hint={hint} onChangeText={s=>{setText(s);const n=s.trim()===''?null:Number(s.replace(',','.'));last.current=n;onChange(n);}} />;
}
export function DietFields({value,onChange}:{value:Diet[];onChange:(v:Diet[])=>void}){return <View style={ui.stack}>{diets.map(d=><SelectionChip key={d} label={labels[d]} selected={value.includes(d)} onPress={()=>onChange(toggleDiet(value,d))} />)}</View>;}
export function AllergyFields({value,intolerances,onChange,onIntolerances}:{value:Allergen[];intolerances:PersonalProfile['intolerances'];onChange:(a:Allergen[])=>void;onIntolerances:(a:PersonalProfile['intolerances'])=>void}){
 return <View style={ui.stack}><SelectionChip label="None" selected={!value.length&&!intolerances.length} onPress={()=>{onChange([]);onIntolerances([]);}} />
 {allergens.map(a=><SelectionChip key={a} label={labels[a]} selected={value.includes(a)} onPress={()=>onChange(value.includes(a)?value.filter(x=>x!==a):[...value,a])} />)}
 <Text style={ui.subheading}>Intolerances</Text>{(['lactose','gluten'] as const).map(a=><SelectionChip key={a} label={a==='lactose'?'Lactose':'Gluten'} selected={intolerances.includes(a)} onPress={()=>onIntolerances(intolerances.includes(a)?intolerances.filter(x=>x!==a):[...intolerances,a])} />)}
 <Text style={ui.small}>Milk allergy and lactose intolerance are different. Selected allergies remain strict. Gluten intolerance uses strict gluten avoidance. Always check product labels.</Text></View>;
}
