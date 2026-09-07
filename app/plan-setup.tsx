import {useEffect,useRef,useState} from 'react';
import {Text} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {router} from 'expo-router';
import {usePreferences} from '../context/PreferencesContext';
import {useProfile} from '../context/ProfileContext';
import {useAuth} from '../context/AuthContext';
import {Screen,ScreenHeader,SectionCard,TextInput,PrimaryButton,SecondaryButton,SelectionChip,ErrorMessage} from '../components/ui';
import {OptionalNumber,DietFields,AllergyFields} from '../components/ProfileFields';
import {profileParticipant,participantPreferences} from '../services/profile-domain';
import {nutritionTargets} from '../services/basket/nutritionTargets';
import {validatePreferences} from '../services/preference-domain';
import {sexes,type PlanParticipant} from '../types/profile';
import {ui} from '../lib/theme';
export default function PlanSetup(){const {saved}=usePreferences(),profile=useProfile(),{session}=useAuth();const owner=session?.user.id??'local';
 const [people,setPeople]=useState<PlanParticipant[]>([]),[index,setIndex]=useState(0),[days,setDays]=useState(saved?.planningDays??3),[budget,setBudget]=useState<number|null>(saved?.weeklyBudgetEur??70),[budgetEnabled,setBudgetEnabled]=useState(saved?.budgetEnabled??true),[ready,setReady]=useState(false),[error,setError]=useState<string|null>(null);const writes=useRef(Promise.resolve());
 const key=`smartbasket.plan-draft.v1:${owner}`;
 useEffect(()=>{if(ready||!saved||!profile.ready)return;let active=true;void(async()=>{
  const raw=await AsyncStorage.getItem(key);if(!active)return;
  if(raw){const v=JSON.parse(raw);if(!Array.isArray(v.people)||v.people.length<1||v.people.length>10||!v.people.every((p:PlanParticipant)=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.dietaryPreferences)&&Array.isArray(p.allergens)&&Array.isArray(p.intolerances))||![3,5,7,14].includes(v.days)||typeof v.budgetEnabled!=='boolean')throw Error('Stored plan draft is invalid.');setPeople(v.people);setDays(v.days);setBudget(v.budget);setBudgetEnabled(v.budgetEnabled);}
  else {const first=profile.saved?profileParticipant(profile.saved,saved):{id:'current-user',name:'You',age:null,sex:null,dailyCalories:saved.dailyCalories,proteinTarget:Math.round(nutritionTargets(saved).dailyProteinTarget),dietaryPreferences:[...saved.dietaryPreferences],allergens:[...saved.allergens],intolerances:[],isCurrentUser:true} as PlanParticipant;
   setPeople([first,...Array.from({length:saved.householdSize-1},(_,i)=>({id:`person-${i+2}`,name:`Person ${i+2}`,age:null,sex:null,dailyCalories:null,proteinTarget:null,dietaryPreferences:['none'],allergens:[],intolerances:[],isCurrentUser:false} as PlanParticipant))]);}
  setReady(true);
 })().catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[key,profile.ready,profile.saved,saved,ready]);
 useEffect(()=>{if(!ready)return;const data=JSON.stringify({people,days,budget,budgetEnabled});writes.current=writes.current.catch(()=>{}).then(()=>AsyncStorage.setItem(key,data));void writes.current.catch(()=>setError('Plan progress could not be saved. Retry before leaving.'));},[people,days,budget,budgetEnabled,ready,key]);
 if(!saved)return <Screen><Text>Complete the existing plan preferences first.</Text><SecondaryButton label="Set plan preferences" onPress={()=>router.push('/onboarding/welcome')} /></Screen>;
 const p=people[index],patch=(v:Partial<PlanParticipant>)=>setPeople(a=>a.map((x,i)=>i===index?{...x,...v}:x));
 return <Screen top={false} bottom><ScreenHeader eyebrow="THIS PLAN ONLY" title="Who are you shopping for?" subtitle="Personal defaults prefill you. Every person can have different targets and restrictions." /><ErrorMessage message={error} />
 <Text style={ui.small}>One shared menu uses all participant restrictions and sums their targets. No individual meal portions or child-specific target calculations are generated. Enter targets you have chosen for each person; this MVP supports 1,000–5,000 kcal per person.</Text>
 {ready&&<><SectionCard title="Plan period">{[3,5,7,14].map(n=><SelectionChip key={n} label={`${n} days`} selected={days===n} onPress={()=>setDays(n)} />)}<SelectionChip label="Use a budget" selected={budgetEnabled} onPress={()=>setBudgetEnabled(x=>!x)} />{budgetEnabled&&<OptionalNumber label="Total plan budget (€)" value={budget} onChange={setBudget} />}</SectionCard>
 {people.map((x,i)=><SecondaryButton key={x.id} label={`${i+1}. ${x.name||'Person'}${x.isCurrentUser?' (you)':''}`} onPress={()=>setIndex(i)} />)}
 {p&&<SectionCard title={`Person ${index+1} of ${people.length}`}><TextInput label="Name" value={p.name} onChangeText={name=>patch({name})} /><OptionalNumber label="Age (optional)" value={p.age} onChange={age=>patch({age})} />
 {sexes.map(s=><SelectionChip key={s} label={s.replaceAll('_',' ')} selected={p.sex===s} onPress={()=>patch({sex:s})} />)}
 <OptionalNumber label="Daily calories for this person" value={p.dailyCalories} onChange={dailyCalories=>patch({dailyCalories})} /><OptionalNumber label="Protein grams/day for this person" value={p.proteinTarget} onChange={proteinTarget=>patch({proteinTarget})} />
 <DietFields value={p.dietaryPreferences} onChange={dietaryPreferences=>patch({dietaryPreferences})} /><AllergyFields value={p.allergens} intolerances={p.intolerances} onChange={allergens=>patch({allergens})} onIntolerances={intolerances=>patch({intolerances})} />
 {p.isCurrentUser&&profile.saved&&<SecondaryButton label="Use my personal defaults" onPress={()=>patch(profileParticipant(profile.saved!,saved))} />}
 {!p.isCurrentUser&&<SecondaryButton label="Remove this person" onPress={()=>{setPeople(a=>a.filter((_,i)=>i!==index));setIndex(0);}} />}</SectionCard>}
 <SecondaryButton label="Add another person" disabled={people.length>=10} onPress={()=>{setPeople(a=>[...a,{id:`person-${Date.now()}`,name:'',age:null,sex:null,dailyCalories:null,proteinTarget:null,dietaryPreferences:['none'],allergens:[],intolerances:[],isCurrentUser:false}]);setIndex(people.length);}} />
 <PrimaryButton label="Review meals for this plan" onPress={()=>{void(async()=>{setError(null);const input=participantPreferences({...saved,planningDays:days,budgetEnabled,weeklyBudgetEur:budgetEnabled?budget:null},people);const errors=validatePreferences(input);if(Object.keys(errors).length)throw Error(Object.values(errors).join(' '));await writes.current;await AsyncStorage.setItem(`smartbasket.active-plan.v1:${owner}`,JSON.stringify(input));router.push({pathname:'/basket-setup',params:{participants:'1'}});})().catch(e=>setError(e.message));}} />
 </>}</Screen>;
}

