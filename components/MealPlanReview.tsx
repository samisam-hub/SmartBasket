import { useState } from 'react';
import { MealImage } from './MealImage';
import { ParticipantNutrition } from './ParticipantNutrition';
import { Image, Text, View } from 'react-native';
import { PrimaryButton, SecondaryButton, SectionCard } from './ui';
import { ui } from '../lib/theme';
import type { MealMode, MealPlan } from '../types/meal';
import { isCook, mealNutritionKnown, modeLabels, readyCategories, readyCategoryLabels, replaceMealChoice } from '../services/meals/choices';
import { mealOptionImages } from '../lib/meal-option-images';
import type { UserPreferences } from '../types/preferences';
import { mealNutrition, planNutrition, replacementMeals, replaceMeal } from '../services/meals/planner';
export function MealPlanReview({plan,preferences,onChange,onConfirm}: {plan:MealPlan;preferences:UserPreferences;onChange:(plan:MealPlan)=>void;onConfirm:()=>void}) {
  const [replacing,setReplacing]=useState<string|null>(null),n=planNutrition(plan);
  const [mode, setMode] = useState<MealMode | null>(null);
  const close = () => { setReplacing(null); setMode(null); };
  return <>
    <SectionCard title="Review your meals">
      <ParticipantNutrition plan={plan} nutrition={n} daily />
      {plan.items.some(i=>!mealNutritionKnown(i)) && <Text style={ui.small}>Recorded nutrition only. Eating out and unmatched ready meals have unknown nutrition; their calories are not redistributed.</Text>}
      <Text style={ui.small}>Cooking replacements adjust portions on cooking-only days. Snacks count towards the daily target.</Text>
      <Text style={ui.small}>Review and replace meals before matching grocery packages. Nutrition is a curated development estimate; catalog availability is checked after confirmation.</Text>
    </SectionCard>
    {plan.items.map(item=>{const nutrition=mealNutrition(item),options=replacementMeals(plan,item.id,preferences);return <SectionCard key={item.id} title={`Day ${item.dayIndex+1} · ${item.mealSlot}`}>
      <Text style={ui.heading}>{item.meal.name}</Text>
      <MealImage meal={item.meal} />
      {mealNutritionKnown(item) ? <ParticipantNutrition plan={plan} nutrition={nutrition} /> : <Text style={ui.small}>Nutrition unknown · {item.mealMode === 'eat_out' ? 'No shopping items needed' : 'A catalog product will be matched after confirmation'}</Text>}
      {isCook(item) && <>
        <Text style={ui.small}>Ingredients for everyone · {Number(item.servings.toFixed(2))} recipe servings</Text>
        <Text style={ui.small}>{item.meal.ingredients.map(i=>`${Number((i.quantity*item.servings/item.meal.servings).toFixed(1))} ${i.unit} ${i.ingredientName}`).join(' · ')}</Text>
      </>}
      <SecondaryButton label={replacing===item.id?'Close replacements':'Replace meal'} onPress={()=>{setMode(null);setReplacing(replacing===item.id?null:item.id);}} />
      {replacing===item.id&&<View style={ui.stack}>
        {mode === null ? (Object.keys(modeLabels) as MealMode[]).map(choice => <View key={choice} style={[ui.card, {padding:12,gap:8}]}>
          {mealOptionImages[choice] && <Image source={mealOptionImages[choice]} accessibilityLabel={modeLabels[choice]} resizeMode="cover" style={{width:120,height:100,borderRadius:12,alignSelf:'center'}} />}
          <SecondaryButton label={modeLabels[choice]} onPress={()=>{
            if(choice==='eat_out'){onChange(replaceMealChoice(plan,item.id,choice));close();}else setMode(choice);
          }} />
        </View>) : <>
          <SecondaryButton label="Back to meal options" onPress={()=>setMode(null)} />
          <Text style={ui.subheading}>{modeLabels[mode]}</Text>
          {mode === 'cook' ? <>
            {options.length === 0 && <Text style={ui.small}>No other compatible cooking meals are available for this slot.</Text>}
            {options.map(meal=><SecondaryButton key={meal.id} label={`${meal.name} · ${Math.round(meal.caloriesPerServing)} kcal / serving`} onPress={()=>{onChange(replaceMeal(plan,item.id,meal.id,preferences));close();}} />)}
          </> : <>
            <Text style={ui.small}>Choose a meal category, not a product. We’ll check suitable catalog products after you confirm the plan.</Text>
            {!readyCategories(mode,item.mealSlot).length && <Text style={ui.small}>These ready-meal categories are for lunch and dinner. For {item.mealSlot}, choose a cooking alternative or eating out.</Text>}
            {readyCategories(mode,item.mealSlot).map(category=><SecondaryButton key={category} label={readyCategoryLabels[category]} onPress={()=>{onChange(replaceMealChoice(plan,item.id,mode as 'ready_to_eat'|'heat_and_eat',category));close();}} />)}
          </>}
        </>}
      </View>}
    </SectionCard>;})}
    {plan.warnings.map(w=><Text key={w.code} style={ui.small}>{w.message}</Text>)}
    {!plan.items.length&&<Text style={ui.body}>No compatible meals are available. Edit preferences or try again when more curated meals are available.</Text>}
    <PrimaryButton label="Confirm meal plan & match packages" disabled={!plan.items.length} onPress={onConfirm} />
  </>;
}
