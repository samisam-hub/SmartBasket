import { formatNumber, modeLabel, readyCategoryLabel, t, term } from '../services/i18n';
import { contentName } from '../services/i18n/content';
import { useState } from 'react';
import { MealImage } from './MealImage';
import { ParticipantNutrition } from './ParticipantNutrition';
import { Image, Text, View } from 'react-native';
import { PrimaryButton, SecondaryButton, SectionCard } from './ui';
import { ui } from '../lib/theme';
import { mealModes, type MealMode, type MealPlan } from '../types/meal';
import { isCook, mealNutritionKnown, readyCategories, replaceMealChoice } from '../services/meals/choices';
import { mealOptionImages } from '../lib/meal-option-images';
import type { UserPreferences } from '../types/preferences';
import { mealNutrition, planNutrition, replacementMeals, replaceMeal } from '../services/meals/planner';
export function MealPlanReview({plan,preferences,onChange,onConfirm}: {plan:MealPlan;preferences:UserPreferences;onChange:(plan:MealPlan)=>void;onConfirm:()=>void}) {
  const [replacing,setReplacing]=useState<string|null>(null),n=planNutrition(plan);
  const [mode, setMode] = useState<MealMode | null>(null);
  const close = () => { setReplacing(null); setMode(null); };
  return <>
    <SectionCard title={t('review.title')}>
      <ParticipantNutrition plan={plan} nutrition={n} daily />
      {plan.items.some(i=>!mealNutritionKnown(i)) && <Text style={ui.small}>{t('review.recordedOnly')}</Text>}
      <Text style={ui.small}>{t('review.swapNote')}</Text>
      <Text style={ui.small}>{t('review.intro')}</Text>
    </SectionCard>
    {plan.items.map(item=>{const nutrition=mealNutrition(item),options=replacementMeals(plan,item.id,preferences);return <SectionCard key={item.id} title={`Tag ${item.dayIndex+1} · ${term(item.mealSlot)}`}>
      <Text style={ui.heading}>{contentName(item.meal.name)}</Text>
      <MealImage meal={item.meal} />
      {mealNutritionKnown(item) ? <ParticipantNutrition plan={plan} nutrition={nutrition} /> : <Text style={ui.small}>Nährwerte unbekannt · {item.mealMode === 'eat_out' ? t('review.noItems') : t('review.afterConfirm')}</Text>}
      {isCook(item) && <>
        <Text style={ui.small}>Zutaten für alle · {formatNumber(item.servings, 2)}  Rezeptportionen</Text>
        <Text style={ui.small}>{item.meal.ingredients.map(i=>`${formatNumber((i.quantity*item.servings/item.meal.servings), 1)} ${i.unit} ${contentName(i.ingredientName)}`).join(' · ')}</Text>
      </>}
      <SecondaryButton label={replacing===item.id?t('review.closeAlternatives'):t('review.swapMeal')} onPress={()=>{setMode(null);setReplacing(replacing===item.id?null:item.id);}} />
      {replacing===item.id&&<View style={ui.stack}>
        {mode === null ? mealModes.map(choice => <View key={choice} style={[ui.card, {padding:12,gap:8}]}>
          {mealOptionImages[choice] && <Image source={mealOptionImages[choice]} accessibilityLabel={modeLabel(choice)} resizeMode="cover" style={{width:120,height:100,borderRadius:12,alignSelf:'center'}} />}
          <SecondaryButton label={modeLabel(choice)} onPress={()=>{
            if(choice==='eat_out'){onChange(replaceMealChoice(plan,item.id,choice));close();}else setMode(choice);
          }} />
        </View>) : <>
          <SecondaryButton label={t('review.backToChoices')} onPress={()=>setMode(null)} />
          <Text style={ui.subheading}>{modeLabel(mode)}</Text>
          {mode === 'cook' ? <>
            {options.length === 0 && <Text style={ui.small}>{t('review.noMoreCooked')}</Text>}
            {options.map(meal=><SecondaryButton key={meal.id} label={`${contentName(meal.name)} · ${Math.round(meal.caloriesPerServing)} kcal / Portion`} onPress={()=>{onChange(replaceMeal(plan,item.id,meal.id,preferences));close();}} />)}
          </> : <>
            <Text style={ui.small}>{t('review.pickCategory')}</Text>
            {!readyCategories(mode,item.mealSlot).length && <Text style={ui.small}>Diese Fertiggerichtkategorien sind für Mittag- und Abendessen vorgesehen. Für {term(item.mealSlot)} wähle ein Kochgericht oder auswärts essen.</Text>}
            {readyCategories(mode,item.mealSlot).map(category=><SecondaryButton key={category} label={readyCategoryLabel(category)} onPress={()=>{onChange(replaceMealChoice(plan,item.id,mode as 'ready_to_eat'|'heat_and_eat',category));close();}} />)}
          </>}
        </>}
      </View>}
    </SectionCard>;})}
    {plan.warnings.map(w=><Text key={w.code} style={ui.small}>{w.message}</Text>)}
    {!plan.items.length&&<Text style={ui.body}>{t('review.noneAvailable')}</Text>}
    <PrimaryButton label={t('review.confirm')} disabled={!plan.items.length} onPress={onConfirm} />
  </>;
}
