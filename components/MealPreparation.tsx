import { Text, View } from 'react-native';
import type { Meal } from '../types/meal';
import { ui } from '../lib/theme';

export function MealPreparation({ meal }: { meal: Meal }) {
  if (!meal.preparation) return null;
  const time = meal.preparation;
  return <View style={{ gap: 4 }}>
    <Text style={ui.small}>Ca. {time.totalMinutes} Min. gesamt · {time.activeMinutes} Min. aktiv für {time.referenceServings} Basisportionen</Text>
    <Text style={ui.small}>{time.note}</Text>
    <Text style={ui.small}>Ca. {Math.round(meal.caloriesPerServing)} kcal · {Math.round(meal.proteinPerServing)} g Eiweiß · {Math.round(meal.carbohydratesPerServing)} g Kohlenhydrate · {Math.round(meal.fatPerServing)} g Fett pro Basisportion. Mengen werden an den Kalorienbedarf angepasst; Zeiten sind Schätzwerte.</Text>
  </View>;
}
