import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton, Screen, ScreenHeader, SectionCard, SelectionChip, ErrorMessage, SecondaryButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { currentWeekStart } from '@/components/WeekCalendar';
import { activeSlotLabels, slotLabels } from '@/services/preference-domain';
import { addDays, dayOf, planDateLabel, plannedDates, weekDates } from '@/services/meals/weekPlan';
import { mealSlots, type MealSlot } from '@/types/meal';
import { ui } from '@/lib/theme';

/** Screen 2: pick the days of this week, gaps included. Nothing has to be consecutive. */
export default function PlanWeekScreen() {
  const [copyError, setCopyError] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [routineSlot, setRoutineSlot] = useState<MealSlot>('lunch');
  const { saved } = usePreferences();
  const { plan, ready, error, attendanceRules, store } = useWeekPlan();
  const weekStart = plan?.weekStart ?? currentWeekStart();
  if (!saved) return <Screen><Text style={ui.body}>Lege zuerst deine Einstellungen fest und wähle danach deine Tage.</Text>
    <SecondaryButton label="Einstellungen festlegen" onPress={() => router.push('/onboarding/welcome')} /></Screen>;
  if (!ready) return <Screen><Text style={ui.body}>Deine Woche wird geladen …</Text></Screen>;
  const planned = plan ? plannedDates(plan) : [];
  const selectedPerson = saved.participants?.some(person => person.id === personId)
    ? personId : saved.participants?.[0]?.id;
  const open = (date: string) => {
    try {
      if (!plan) store.open(weekStart, saved);
      store.toggleDay(date, saved);
      setCopyError(null);
    } catch (e) { setCopyError(e instanceof Error ? e.message : "Dieser Tag konnte nicht geändert werden."); }
  };
  return <Screen bottom>
    <ScreenHeader title="An welchen Tagen möchtest du kochen?" subtitle={`${planDateLabel(weekStart)} – ${planDateLabel(addDays(weekStart, 6))}. Wähle beliebig viele Tage; dazwischen können Tage frei bleiben.`} />
    <ErrorMessage message={copyError ?? error} />
    {store.canCopyPreviousWeek(weekStart, saved) && <SectionCard>
      <SecondaryButton label="Plan der Vorwoche übernehmen" onPress={() => {
        try { store.copyPreviousWeek(weekStart, saved); setCopyError(null); }
        catch (e) { setCopyError(e instanceof Error ? e.message : "Die Vorwoche konnte nicht übernommen werden."); }
      }} />
      <Text style={ui.small}>Tage, Mahlzeiten und Anwesenheit werden als bearbeitbarer Entwurf für diese Woche übernommen.</Text>
    </SectionCard>}
    <SectionCard>
      <View style={ui.wrap}>
        {weekDates(weekStart).map(date => <SelectionChip key={date} label={planDateLabel(date)}
          selected={!!plan && !!dayOf(plan, date)} onPress={() => open(date)} />)}
      </View>
      <Text style={ui.small}>Jeder ausgewählte Tag beginnt mit {activeSlotLabels(saved).join(', ').toLowerCase()}. Einzelne Mahlzeiten kannst du am jeweiligen Tag abwählen.</Text>
    </SectionCard>
    {!!saved.participants?.length && <SectionCard title="Regelmäßig auswärts essen">
      <Text style={ui.small}>Lege regelmäßige Mahlzeiten in Schule oder Arbeit fest. Neue Tage und Mahlzeiten übernehmen diese Vorgabe; einzelne Tage bleiben anpassbar.</Text>
      <Text style={ui.subheading}>Wer?</Text>
      <View style={ui.wrap}>{saved.participants.map(person => <SelectionChip key={person.id}
        label={person.name || 'Person'} selected={selectedPerson === person.id}
        onPress={() => setPersonId(person.id)} />)}</View>
      <Text style={ui.subheading}>Welche Mahlzeit?</Text>
      <View style={ui.wrap}>{mealSlots.map(slot => <SelectionChip key={slot} label={slotLabels[slot]}
        selected={routineSlot === slot} onPress={() => setRoutineSlot(slot)} />)}</View>
      <Text style={ui.subheading}>An welchen Tagen?</Text>
      <View style={ui.wrap}>{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label, weekday) =>
        <SelectionChip key={label} label={label}
          selected={attendanceRules.some(rule => rule.personId === selectedPerson && rule.slot === routineSlot && rule.weekday === weekday)}
          onPress={() => { try { store.toggleAttendanceRule({ personId: selectedPerson!, slot: routineSlot, weekday }, saved);
            setCopyError(null); } catch (e) { setCopyError(e instanceof Error ? e.message : "Die regelmäßige Abwesenheit konnte nicht gespeichert werden."); } }} />)}</View>
      <Text style={ui.small}>An ausgewählten Tagen isst diese Person diese Mahlzeit üblicherweise auswärts. Bereits gewählte Mahlzeiten bleiben unverändert.</Text>
    </SectionCard>}
    {planned.length > 0 && <SectionCard title="Deine Woche">
      {planned.map(date => <Text key={date} style={ui.small}>{planDateLabel(date)}: {dayOf(plan!, date)!.slots.join(', ')}</Text>)}
    </SectionCard>}
    {!!planned.length && <PrimaryButton label="Einkaufsliste erstellen"
      onPress={() => router.push({ pathname: '/basket-setup', params: { week: '1' } })} />}
    <SecondaryButton label={planned.length ? 'Weiter: Was mögt ihr?' : "Mindestens einen Tag auswählen"} disabled={!planned.length}
      onPress={() => router.push('/plan/taste')} />
  </Screen>;
}
