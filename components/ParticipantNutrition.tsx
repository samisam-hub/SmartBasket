import { t } from '../services/i18n';
import { Text, View } from 'react-native';
import type { AnyMealPlan } from '../types/meal';
import { splitNutrition } from '../services/meals/portions';
import { plannedDayCount } from '../services/meals/weekPlan';
import { ui } from '../lib/theme';

export function ParticipantNutrition({ plan, nutrition, daily = false, participantIds }: {
  plan: AnyMealPlan; nutrition: { calories: number; protein: number }; daily?: boolean;
  /** Who this nutrition is for; absent means the whole household. */
  participantIds?: string[];
}) {
  const days = Math.max(1, plannedDayCount(plan));
  return <View style={{ gap: 8 }}>
    {daily && <Text style={ui.subheading}>{t('nutrition.dailyAverage', { days: t('nutrition.days', { count: days }) })}</Text>}
    {splitNutrition(plan, nutrition, daily ? days : 1, participantIds).map(p => <View key={p.id}>
      <Text style={ui.body}><Text style={{ fontWeight: '700' }}>{p.name}</Text>{t('nutrition.personLine', { calories: Math.round(p.calories), protein: Math.round(p.protein), perDay: daily ? t('nutrition.perDay') : '' })}</Text>
      {daily && <Text style={ui.small}>{t('nutrition.targets', { calories: p.calorieTarget === null ? '—' : Math.round(p.calorieTarget), protein: p.proteinTarget === null ? '—' : Math.round(p.proteinTarget) })}</Text>}
    </View>)}
  </View>;
}
