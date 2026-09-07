import {Text} from 'react-native';
import {router} from 'expo-router';
import {useState} from 'react';
import {useProfile} from '../context/ProfileContext';
import {Screen,ScreenHeader,TextInput,SelectionChip,PrimaryButton,SecondaryButton,ErrorMessage,SectionCard} from '../components/ui';
import {OptionalNumber,DietFields,AllergyFields} from '../components/ProfileFields';
import {activities,sexes} from '../types/profile';
import {goals,labels} from '../types/preferences';
import {validateProfile} from '../services/profile-domain';
import {ui} from '../lib/theme';
const names=['About you','Goals','Diet','Allergies & intolerances','Review'];
export default function PersonalProfileScreen(){const {draft:p,store,step,ready,error}=useProfile();const [busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null);
 const e=validateProfile(p),update=store.update;
 if(!ready)return <Screen><Text>Loading your profile…</Text></Screen>;
 const next=()=>{const keys=[['displayName','sex','age','heightCm','weightKg'],['primaryNutritionGoal','activityLevel','defaultDailyCalories','defaultProteinTargetGrams'],['dietaryPreferences'],['allergens','intolerances']][step]??[];if(keys.some(k=>e[k])){setMessage('Check the highlighted fields.');return;}setMessage(null);update({},Math.min(4,step+1));};
 return <Screen top={false} bottom><ScreenHeader eyebrow={`PERSONAL DEFAULTS · ${step+1} OF 5`} title={names[step]} subtitle="These defaults prefill new plans. Plan changes do not overwrite this profile." /><ErrorMessage message={message??error} />
 {step===0&&<><TextInput label="Display name (optional)" value={p.displayName} onChangeText={displayName=>update({displayName})} error={e.displayName} />
 <Text style={ui.small}>Sex is optional and may help future nutrition calculations. It is not used to calculate targets in this version.</Text>
 {sexes.map(s=><SelectionChip key={s} label={s==='prefer_not_to_say'?'Prefer not to say':s[0].toUpperCase()+s.slice(1)} selected={p.sex===s} onPress={()=>update({sex:s})} />)}
 <OptionalNumber label="Age (optional)" value={p.age} onChange={age=>update({age})} error={e.age} />
 <OptionalNumber label="Height in cm (optional)" hint="Optional personal context for future nutrition defaults; no body-based formula is used yet." value={p.heightCm} onChange={heightCm=>update({heightCm})} error={e.heightCm} />
 <OptionalNumber label="Weight in kg (optional)" value={p.weightKg} onChange={weightKg=>update({weightKg})} error={e.weightKg} />
 <SecondaryButton label="Skip optional body details" onPress={()=>{update({heightCm:null,weightKg:null},1);}} /></>}
 {step===1&&<>{[...goals,'improve_habits' as const].map(g=><SelectionChip key={g} label={g==='improve_habits'?'Improve eating habits':labels[g]} selected={p.primaryNutritionGoal===g} onPress={()=>update({primaryNutritionGoal:g})} />)}
 <Text style={ui.subheading}>Activity level (optional)</Text>{activities.map(a=><SelectionChip key={a} label={a.replace('_',' ')} selected={p.activityLevel===a} onPress={()=>update({activityLevel:a})} />)}
 <OptionalNumber label="Default daily calories (optional)" value={p.defaultDailyCalories} error={e.defaultDailyCalories} onChange={defaultDailyCalories=>update({defaultDailyCalories})} hint="Leave blank to use your plan setup target. Body data does not set this automatically." />
 {(['automatic','manual'] as const).map(m=><SelectionChip key={m} label={`${m} protein`} selected={p.proteinMode===m} onPress={()=>update({proteinMode:m})} />)}
 <Text style={ui.small}>Automatic protein uses the existing goal-based percentage of your calorie target, divided by 4 kcal/g. Explicit manual targets are preserved.</Text>
 {p.proteinMode==='manual'&&<OptionalNumber label="Default protein grams/day" value={p.defaultProteinTargetGrams} error={e.defaultProteinTargetGrams} onChange={defaultProteinTargetGrams=>update({defaultProteinTargetGrams})} />}</>}
 {step===2&&<DietFields value={p.dietaryPreferences} onChange={dietaryPreferences=>update({dietaryPreferences})} />}
 {step===3&&<AllergyFields value={p.allergens} intolerances={p.intolerances} onChange={allergens=>update({allergens})} onIntolerances={intolerances=>update({intolerances})} />}
 {step===4&&<>{[`${p.displayName||'Guest'} · ${p.sex??'Sex not specified'} · ${p.age??'Age not specified'}`,`Height: ${p.heightCm??'not set'} cm · Weight: ${p.weightKg??'not set'} kg`,`${p.primaryNutritionGoal} · ${p.activityLevel??'Activity not set'}`,`${p.defaultDailyCalories??'Plan target'} kcal · ${p.proteinMode} protein ${p.proteinMode==='manual'?p.defaultProteinTargetGrams+' g':''}`,p.dietaryPreferences.map(d=>labels[d]).join(', '),[...p.allergens,...p.intolerances].join(', ')||'No allergies or intolerances'].map((s,i)=><SectionCard key={i} title={s} />)}
 {names.slice(0,4).map((n,i)=><SecondaryButton key={n} label={`Edit ${n}`} onPress={()=>update({},i)} />)}
 <PrimaryButton label="Save profile" loading={busy} onPress={()=>{setBusy(true);void store.save().then(()=>router.dismissTo('/profile')).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));}} /></>}
 {step<4&&<PrimaryButton label="Continue" onPress={next} />}{step>0&&<SecondaryButton label="Back" onPress={()=>update({},step-1)} />}
 <SecondaryButton label="Save progress & exit" onPress={()=>{void store.flush().then(()=>router.dismissTo('/profile')).catch(e=>setMessage(e.message));}} /></Screen>;
}
