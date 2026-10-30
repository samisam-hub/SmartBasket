import { t, term } from '@/services/i18n';
import {Text} from 'react-native';
import {router} from 'expo-router';
import {useState} from 'react';
import {useProfile} from '../context/ProfileContext';
import {Screen,ScreenHeader,TextInput,SelectionChip,PrimaryButton,SecondaryButton,ErrorMessage,SectionCard} from '../components/ui';
import {OptionalNumber,DietFields,AllergyFields} from '../components/ProfileFields';
import {activities,sexes} from '../types/profile';
import { goals } from '../types/preferences';
import {validateProfile} from '../services/profile-domain';
import {ui} from '../lib/theme';
// Read per render, so switching language re-labels the steps instead of keeping the first locale.
const stepNames=()=>[t('profileSteps.about'),t('profileSteps.goals'),t('profileSteps.diet'),t('profileSteps.allergies'),t('profileSteps.review')];
export default function PersonalProfileScreen(){const {draft:p,store,step,ready,error}=useProfile();const [busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null);
 const e=validateProfile(p),update=store.update;
 if(!ready)return <Screen><Text>{t('personal.loading')}</Text></Screen>;
 const next=()=>{const keys=[['displayName','sex','age','heightCm','weightKg'],['primaryNutritionGoal','activityLevel','defaultDailyCalories','defaultProteinTargetGrams'],['dietaryPreferences'],['allergens','intolerances']][step]??[];if(keys.some(k=>e[k])){setMessage(t('personal.checkFields'));return;}setMessage(null);update({},Math.min(4,step+1));};
 return <Screen top={false} bottom><ScreenHeader eyebrow={t('personal.eyebrow', { step: step+1 })} title={stepNames()[step]} subtitle={t('personal.intro')} /><ErrorMessage message={message??error} />
 {step===0&&<><TextInput label="Anzeigename (freiwillig)" value={p.displayName} onChangeText={displayName=>update({displayName})} error={e.displayName} />
 <Text style={ui.small}>{t('personal.sexNote')}</Text>
 {sexes.map(s=><SelectionChip key={s} label={term(s)} selected={p.sex===s} onPress={()=>update({sex:s})} />)}
 <OptionalNumber label="Alter (freiwillig)" value={p.age} onChange={age=>update({age})} error={e.age} />
 <OptionalNumber label={t('personal.height')} hint={t('personal.bodyNote')} value={p.heightCm} onChange={heightCm=>update({heightCm})} error={e.heightCm} />
 <OptionalNumber label={t('personal.weight')} value={p.weightKg} onChange={weightKg=>update({weightKg})} error={e.weightKg} />
 <SecondaryButton label={t('personal.skipBody')} onPress={()=>{update({heightCm:null,weightKg:null},1);}} /></>}
 {step===1&&<>{[...goals,'improve_habits' as const].map(g=><SelectionChip key={g} label={g==='improve_habits'?"Essgewohnheiten verbessern":term(g)} selected={p.primaryNutritionGoal===g} onPress={()=>update({primaryNutritionGoal:g})} />)}
 <Text style={ui.subheading}>{t('personal.activity')}</Text>{activities.map(a=><SelectionChip key={a} label={term(a)} selected={p.activityLevel===a} onPress={()=>update({activityLevel:a})} />)}
 <OptionalNumber label={t('personal.calories')} value={p.defaultDailyCalories} error={e.defaultDailyCalories} onChange={defaultDailyCalories=>update({defaultDailyCalories})} hint={t('personal.caloriesNote')} />
 {(['automatic','manual'] as const).map(m=><SelectionChip key={m} label={t('personal.proteinMode', { mode: term(m) })} selected={p.proteinMode===m} onPress={()=>update({proteinMode:m})} />)}
 <Text style={ui.small}>{t('personal.autoProtein')}</Text>
 {p.proteinMode==='manual'&&<OptionalNumber label={t('personal.protein')} value={p.defaultProteinTargetGrams} error={e.defaultProteinTargetGrams} onChange={defaultProteinTargetGrams=>update({defaultProteinTargetGrams})} />}</>}
 {step===2&&<DietFields value={p.dietaryPreferences} onChange={dietaryPreferences=>update({dietaryPreferences})} />}
 {step===3&&<AllergyFields value={p.allergens} intolerances={p.intolerances} onChange={allergens=>update({allergens})} onIntolerances={intolerances=>update({intolerances})} />}
 {step===4&&<>{[t('personal.identity', { name: p.displayName||t('personal.guest'), sex: p.sex ? term(p.sex) : t('personal.noSex'), age: p.age??t('personal.noAge') }),
   t('personal.body', { height: p.heightCm??t('personal.notSet'), weight: p.weightKg??t('personal.notSet') }),
   t('personal.goalLine', { goal: term(p.primaryNutritionGoal), activity: p.activityLevel ? term(p.activityLevel) : t('personal.noActivity') }),
   t('personal.nutritionLine', { calories: p.defaultDailyCalories??t('personal.planTarget'), mode: term(p.proteinMode), grams: p.proteinMode==='manual'?`${p.defaultProteinTargetGrams} g`:'' }),p.dietaryPreferences.map(d=>term(d)).join(', '),[...p.allergens,...p.intolerances].map(term).join(', ')||t('personal.noAllergies')].map((s,i)=><SectionCard key={i} title={s} />)}
 {stepNames().slice(0,4).map((n,i)=><SecondaryButton key={n} label={t('personal.editSection', { section: n })} onPress={()=>update({},i)} />)}
 <PrimaryButton label={t('personal.save')} loading={busy} onPress={()=>{setBusy(true);void store.save().then(()=>router.dismissTo('/profile')).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));}} /></>}
 {step<4&&<PrimaryButton label={t('personal.next')} onPress={next} />}{step>0&&<SecondaryButton label={t('personal.back')} onPress={()=>update({},step-1)} />}
 <SecondaryButton label={t('personal.saveAndClose')} onPress={()=>{void store.flush().then(()=>router.dismissTo('/profile')).catch(e=>setMessage(e.message));}} /></Screen>;
}
