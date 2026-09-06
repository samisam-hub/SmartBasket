import { useState } from 'react';
import { Text, View } from 'react-native';
import { PrimaryButton, SecondaryButton, SectionCard } from './ui';
import { ui } from '../lib/theme';
import type { MealPlan } from '../types/meal';
import type { UserPreferences } from '../types/preferences';
import { mealNutrition, planNutrition, replacementMeals, replaceMeal } from '../services/meals/planner';
export function MealPlanReview({plan,preferences,onChange,onConfirm}: {plan:MealPlan;preferences:UserPreferences;onChange:(plan:MealPlan)=>void;onConfirm:()=>void}) {
  const [replacing,setReplacing]=useState<string|null>(null),n=planNutrition(plan);
  return <>
    <SectionCard title="Review your meals">
      <Text style={ui.body}>{Math.round(n.calories)} kcal · {Math.round(n.protein)} g protein across {plan.planningDays} days</Text>
      <Text style={ui.small}>Targets: {Math.round(plan.targetCalories)} kcal · {Math.round(plan.targetProtein)} g protein. Quantities include everyone in your household.</Text>
      <Text style={ui.small}>Review and replace meals before matching grocery packages. Nutrition is a curated development estimate; catalog availability is checked after confirmation.</Text>
    </SectionCard>
    {plan.items.map(item=>{const nutrition=mealNutrition(item),options=replacementMeals(plan,item.id,preferences);return <SectionCard key={item.id} title={`Day ${item.dayIndex+1} · ${item.mealSlot}`}>
      <Text style={ui.heading}>{item.meal.name}</Text>
      <Text style={ui.body}>{item.servings} servings · {Math.round(nutrition.calories)} kcal · {Math.round(nutrition.protein)} g protein</Text>
      <Text style={ui.small}>{item.meal.ingredients.map(i=>`${Math.round(i.quantity*item.servings/item.meal.servings)} ${i.unit} ${i.ingredientName}`).join(' · ')}</Text>
      <SecondaryButton label={replacing===item.id?'Close replacements':'Replace meal'} disabled={!options.length} onPress={()=>setReplacing(replacing===item.id?null:item.id)} />
      {replacing===item.id&&<View style={ui.stack}>{options.map(meal=><SecondaryButton key={meal.id} label={`${meal.name} · ${Math.round(meal.caloriesPerServing*item.servings)} kcal`} onPress={()=>{onChange(replaceMeal(plan,item.id,meal.id,preferences));setReplacing(null);}} />)}</View>}
    </SectionCard>;})}
    {plan.warnings.map(w=><Text key={w.code} style={ui.small}>{w.message}</Text>)}
    {!plan.items.length&&<Text style={ui.body}>No compatible meals are available. Edit preferences or try again when more curated meals are available.</Text>}
    <PrimaryButton label="Confirm meal plan & match packages" disabled={!plan.items.length} onPress={onConfirm} />
  </>;
}
