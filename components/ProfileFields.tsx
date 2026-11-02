import {View,Text} from 'react-native';
import {SelectionChip,TextInput} from './ui';
import {allergens,diets,labels,type Allergen,type Diet} from '../types/preferences';
import {toggleDiet} from '../services/preference-domain';
import type {PersonalProfile} from '../types/profile';
import {ui} from '../lib/theme';
import {useEffect,useRef,useState} from 'react';
export function OptionalNumber({label,value,onChange,error,hint}:{label:string;value:number|null;onChange:(n:number|null)=>void;error?:string;hint?:string}){
 const [text,setText]=useState(value===null?'':String(value).replace(".", ",")),last=useRef(value);
 useEffect(()=>{if(!Object.is(value,last.current)){setText(value===null?'':String(value).replace(".", ","));last.current=value;}},[value]);
 return <TextInput label={label} value={text} keyboardType="decimal-pad" error={error} hint={hint} onChangeText={s=>{setText(s);const n=s.trim()===''?null:Number(s.replace(',','.'));last.current=n;onChange(n);}} />;
}
export function DietFields({value,onChange}:{value:Diet[];onChange:(v:Diet[])=>void}){return <View style={ui.stack}>{diets.map(d=><SelectionChip key={d} label={labels[d]} selected={value.includes(d)} onPress={()=>onChange(toggleDiet(value,d))} />)}
 {value.includes('diabetes')&&<Text style={ui.small}>Diabetesbewusst schließt Produkte mit hohem angegebenem Zuckergehalt aus (über 22,5 g je 100 g bzw. 11,25 g je 100 ml) und berücksichtigt übliche Kohlenhydratportionen. Produkte ohne Zuckerangabe werden ausgeschlossen. Dies ist eine Einkaufspräferenz, keine medizinische Beratung.</Text>}</View>;}
export function AllergyFields({value,intolerances,onChange,onIntolerances}:{value:Allergen[];intolerances:PersonalProfile['intolerances'];onChange:(a:Allergen[])=>void;onIntolerances:(a:PersonalProfile['intolerances'])=>void}){
 return <View style={ui.stack}><SelectionChip label="Keine" selected={!value.length&&!intolerances.length} onPress={()=>{onChange([]);onIntolerances([]);}} />
 {allergens.map(a=><SelectionChip key={a} label={labels[a]} selected={value.includes(a)} onPress={()=>onChange(value.includes(a)?value.filter(x=>x!==a):[...value,a])} />)}
 <Text style={ui.subheading}>Unverträglichkeiten</Text>{(['lactose','gluten'] as const).map(a=><SelectionChip key={a} label={a==='lactose'?"Laktose":'Gluten'} selected={intolerances.includes(a)} onPress={()=>onIntolerances(intolerances.includes(a)?intolerances.filter(x=>x!==a):[...intolerances,a])} />)}
 <Text style={ui.small}>Milchallergie und Laktoseintoleranz sind unterschiedlich. Ausgewählte Allergien werden streng berücksichtigt. Bei Glutenunverträglichkeit wird Gluten ausgeschlossen. Prüfe immer die Verpackungsangaben.</Text></View>;
}
