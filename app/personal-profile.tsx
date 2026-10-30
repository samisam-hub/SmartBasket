import { germanLabel } from '../lib/german';
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
const names=["Über dich","Ziele","Ernährungsweise","Allergien und Unverträglichkeiten","Prüfen"];
export default function PersonalProfileScreen(){const {draft:p,store,step,ready,error}=useProfile();const [busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null);
 const e=validateProfile(p),update=store.update;
 if(!ready)return <Screen><Text>Dein Profil wird geladen …</Text></Screen>;
 const next=()=>{const keys=[['displayName','sex','age','heightCm','weightKg'],['primaryNutritionGoal','activityLevel','defaultDailyCalories','defaultProteinTargetGrams'],['dietaryPreferences'],['allergens','intolerances']][step]??[];if(keys.some(k=>e[k])){setMessage("Prüfe die markierten Felder.");return;}setMessage(null);update({},Math.min(4,step+1));};
 return <Screen top={false} bottom><ScreenHeader eyebrow={`PERSÖNLICHE VORGABEN · ${step+1} VON 5`} title={names[step]} subtitle="Diese Vorgaben werden für neue Pläne übernommen. Änderungen in Plänen überschreiben dein Profil nicht." /><ErrorMessage message={message??error} />
 {step===0&&<><TextInput label="Anzeigename (freiwillig)" value={p.displayName} onChangeText={displayName=>update({displayName})} error={e.displayName} />
 <Text style={ui.small}>Die Angabe des Geschlechts ist freiwillig. In diesem Profil wird sie derzeit nicht zur Zielberechnung verwendet.</Text>
 {sexes.map(s=><SelectionChip key={s} label={germanLabel(s)} selected={p.sex===s} onPress={()=>update({sex:s})} />)}
 <OptionalNumber label="Alter (freiwillig)" value={p.age} onChange={age=>update({age})} error={e.age} />
 <OptionalNumber label="Körpergröße in cm (freiwillig)" hint="Freiwillige Angaben für künftige Ernährungsvorgaben. Hier wird noch keine körperbasierte Formel verwendet." value={p.heightCm} onChange={heightCm=>update({heightCm})} error={e.heightCm} />
 <OptionalNumber label="Gewicht in kg (freiwillig)" value={p.weightKg} onChange={weightKg=>update({weightKg})} error={e.weightKg} />
 <SecondaryButton label="Freiwillige Körperangaben überspringen" onPress={()=>{update({heightCm:null,weightKg:null},1);}} /></>}
 {step===1&&<>{[...goals,'improve_habits' as const].map(g=><SelectionChip key={g} label={g==='improve_habits'?"Essgewohnheiten verbessern":labels[g]} selected={p.primaryNutritionGoal===g} onPress={()=>update({primaryNutritionGoal:g})} />)}
 <Text style={ui.subheading}>Aktivitätsniveau (freiwillig)</Text>{activities.map(a=><SelectionChip key={a} label={germanLabel(a)} selected={p.activityLevel===a} onPress={()=>update({activityLevel:a})} />)}
 <OptionalNumber label="Täglicher Kalorienrichtwert (freiwillig)" value={p.defaultDailyCalories} error={e.defaultDailyCalories} onChange={defaultDailyCalories=>update({defaultDailyCalories})} hint="Leer lassen, um das Ziel aus deinen Planeinstellungen zu verwenden. Körperangaben legen diesen Wert nicht automatisch fest." />
 {(['automatic','manual'] as const).map(m=><SelectionChip key={m} label={`Eiweißziel: ${germanLabel(m)}`} selected={p.proteinMode===m} onPress={()=>update({proteinMode:m})} />)}
 <Text style={ui.small}>Das automatische Eiweißziel berechnet sich aus einem zielabhängigen Anteil deines Kalorienziels, geteilt durch 4 kcal/g. Eigene Zielwerte bleiben erhalten.</Text>
 {p.proteinMode==='manual'&&<OptionalNumber label="Eiweißrichtwert in g/Tag" value={p.defaultProteinTargetGrams} error={e.defaultProteinTargetGrams} onChange={defaultProteinTargetGrams=>update({defaultProteinTargetGrams})} />}</>}
 {step===2&&<DietFields value={p.dietaryPreferences} onChange={dietaryPreferences=>update({dietaryPreferences})} />}
 {step===3&&<AllergyFields value={p.allergens} intolerances={p.intolerances} onChange={allergens=>update({allergens})} onIntolerances={intolerances=>update({intolerances})} />}
 {step===4&&<>{[`${p.displayName||"Gast"} · ${p.sex ? germanLabel(p.sex) : "Geschlecht nicht angegeben"} · ${p.age??"Alter nicht angegeben"}`,`Größe: ${p.heightCm??"nicht festgelegt"} cm · Gewicht: ${p.weightKg??"nicht festgelegt"} kg`,`${(p.primaryNutritionGoal === "improve_habits" ? germanLabel(p.primaryNutritionGoal) : labels[p.primaryNutritionGoal])} · ${p.activityLevel ? germanLabel(p.activityLevel) : "Aktivität nicht festgelegt"}`,`${p.defaultDailyCalories??"Planziel"} kcal · ${germanLabel(p.proteinMode)} Eiweiß ${p.proteinMode==='manual'?p.defaultProteinTargetGrams+' g':''}`,p.dietaryPreferences.map(d=>labels[d]).join(', '),[...p.allergens,...p.intolerances].map(germanLabel).join(', ')||"Keine Allergien oder Unverträglichkeiten"].map((s,i)=><SectionCard key={i} title={s} />)}
 {names.slice(0,4).map((n,i)=><SecondaryButton key={n} label={`Bearbeiten ${n}`} onPress={()=>update({},i)} />)}
 <PrimaryButton label="Profil speichern" loading={busy} onPress={()=>{setBusy(true);void store.save().then(()=>router.dismissTo('/profile')).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));}} /></>}
 {step<4&&<PrimaryButton label="Weiter" onPress={next} />}{step>0&&<SecondaryButton label="Zurück" onPress={()=>update({},step-1)} />}
 <SecondaryButton label="Fortschritt speichern und schließen" onPress={()=>{void store.flush().then(()=>router.dismissTo('/profile')).catch(e=>setMessage(e.message));}} /></Screen>;
}
