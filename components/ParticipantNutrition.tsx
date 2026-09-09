import { Text, View } from 'react-native';
import type { MealPlan } from '../types/meal';
import { splitNutrition } from '../services/meals/portions';
import { ui } from '../lib/theme';

export function ParticipantNutrition({ plan, nutrition, daily = false }: {
  plan: MealPlan; nutrition: { calories: number; protein: number }; daily?: boolean;
}) {
  return <View style={{ gap: 8 }}>
    {daily && <Text style={ui.subheading}>Daily averages · {plan.planningDays} days</Text>}
    {splitNutrition(plan, nutrition, daily ? plan.planningDays : 1).map(p => <View key={p.id}>
      <Text style={ui.body}><Text style={{ fontWeight: '700' }}>{p.name}</Text>{`: ${Math.round(p.calories)} kcal · ${Math.round(p.protein)} g protein${daily ? ' / day' : ''}`}</Text>
      {daily && <Text style={ui.small}>Daily targets: {p.calorieTarget === null ? '—' : Math.round(p.calorieTarget)} kcal · {p.proteinTarget === null ? '—' : Math.round(p.proteinTarget)} g protein</Text>}
    </View>)}
  </View>;
}
