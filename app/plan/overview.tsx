import { slotLabel } from '@/services/i18n';
import { contentName } from '@/services/i18n/content';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard } from '@/components/ui';
import { itemsInSlot, planDateLabel } from '@/services/meals/weekPlan';
import { openPlanSlots } from '@/services/meals/validation';
import { ui } from '@/lib/theme';

export default function WeekOverviewScreen() {
  const { plan, ready, error } = useWeekPlan();
  if (!ready) return <Screen><Text>Wochenplan wird geladen…</Text></Screen>;
  if (!plan?.days.length) return <Screen><Text>Noch keine Woche geplant.</Text>
    <SecondaryButton label="Woche planen" onPress={() => router.replace('/plan/week')} /></Screen>;
  const open = openPlanSlots(plan).reduce((sum, day) => sum + day.slots.length, 0);
  return <Screen bottom>
    <ScreenHeader eyebrow="2 · WOCHENPLAN" title="Deine Woche" subtitle="Aus euren Vorlieben geplant. Prüft die Woche und ändert nur, was nicht passt." />
    <ErrorMessage message={error} />
    {open > 0 && <SectionCard title={`${open} Mahlzeiten noch offen`}>
      <Text style={ui.small}>Für diese Mahlzeiten ist kein weiterer passender Vorschlag verfügbar. Prüft eure Vorlieben oder wählt eine andere Möglichkeit wie auswärts essen. Abgelehnte Gerichte werden nicht stillschweigend eingesetzt.</Text>
    </SectionCard>}
    {plan.days.map(day => <SectionCard key={day.date} title={planDateLabel(day.date)}>
      {day.slots.map(slot => {
        const dishes = itemsInSlot(plan, day.date, slot);
        return <Text key={slot} style={ui.body}>{slotLabel(slot)}: {dishes.length ? dishes.map(item => contentName(item.meal.name)).join(' / ') : 'Noch offen'}</Text>;
      })}
      <SecondaryButton label={`${planDateLabel(day.date)} bearbeiten`} onPress={() => router.push({ pathname: '/plan/[date]', params: { date: day.date, returnTo: 'week' } })} />
    </SectionCard>)}
    <PrimaryButton label="Weiter zur Einkaufsliste" disabled={!plan.items.length || open > 0}
      onPress={() => router.push({ pathname: '/basket-setup', params: { week: '1' } })} />
    <SecondaryButton label="Vorlieben ändern / offene Mahlzeiten ergänzen" onPress={() => router.push('/plan/taste')} />
    <SecondaryButton label="Tage und Anwesenheit ändern" onPress={() => router.push('/plan/week')} />
  </Screen>;
}
