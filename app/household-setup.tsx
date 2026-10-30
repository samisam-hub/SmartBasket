import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { HouseholdList } from '@/components/HouseholdList';
import { IntroArt } from '@/components/IntroArt';
import { NumberInput } from '@/components/NumberInput';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SectionCard, SelectionChip, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { ui, spacing } from '@/lib/theme';

/** Der Haushalt, wie er steht: alle Personen, die Möglichkeit, eine weitere hinzuzufügen, und —
 *  erst wenn jemand darauf steht — das Wochenbudget, das zum Haushalt gehört, nicht zu einer Person.
 *  Hier endet die Einrichtung: gespeichert wird, bevor es zu den Vorlieben weitergeht. */
export default function HouseholdSetupScreen() {
  const { draft, ready, saving, store } = usePreferences();
  const [error, setError] = useState<string | null>(null);
  const people = draft.participants ?? [];
  // Noch niemand da heißt: es gibt nichts zu zeigen. Dann gleich zur ersten Person.
  useEffect(() => {
    if (ready && !people.length) router.replace('/household-setup/person');
  }, [ready, people.length]);
  if (ready && !people.length) return <Screen><Text style={ui.body}>Wird eingerichtet…</Text></Screen>;
  if (!ready) return <Screen><Text style={ui.body}>Wird geladen…</Text></Screen>;
  const budget = draft.budgetEnabled && draft.weeklyBudgetEur !== null;
  const next = async () => {
    setError(null);
    const ok = await store.save();
    if (!ok) { setError('Die Einrichtung konnte auf diesem Gerät nicht gespeichert werden. Nichts ist verloren — versuche es erneut.'); return; }
    router.replace('/plan/taste');
  };
  return <Screen bottom>
    <ScreenHeader eyebrow="EUER HAUSHALT" title="Wer isst mit"
      subtitle="Portionen und Mengen richten sich nach den Personen am Tisch. Alles lässt sich später ändern." />
    <HouseholdList people={people}
      onOpen={id => router.push({ pathname: '/household-setup/person', params: { id } })}
      onAdd={() => router.push('/household-setup/person')} />
    <SectionCard title="Budget für eine Woche">
      <View style={{ alignItems: 'center', paddingBottom: spacing.sm }}><IntroArt kind="goals" size={96} /></View>
      <Text style={ui.small}>
        Was ihr in einer Woche für Lebensmittel ausgeben wollt. Die Liste bleibt darin, wo sie kann,
        und sagt klar, wo sie es nicht kann.
      </Text>
      <View style={ui.wrap}>
        <SelectionChip label="Budget im Blick behalten" selected={draft.budgetEnabled}
          onPress={() => store.update({ budgetEnabled: true })} />
        <SelectionChip label="Kein Budgetlimit" selected={!draft.budgetEnabled}
          onPress={() => store.update({ budgetEnabled: false, weeklyBudgetEur: null })} />
      </View>
      {draft.budgetEnabled && <NumberInput label="Wochenbudget (€)" value={draft.weeklyBudgetEur}
        hint="Ungefähr genügt. Ihr könnt es jederzeit ändern."
        onChange={weeklyBudgetEur => store.update({ weeklyBudgetEur })} />}
    </SectionCard>
    <ErrorMessage message={error ?? store.getSnapshot().localError} />
    <PrimaryButton label="Weiter: Gerichte bewerten" loading={saving}
      disabled={saving || (draft.budgetEnabled && !budget)} onPress={() => { void next(); }} />
    {draft.budgetEnabled && !budget &&
      <Text style={ui.small}>Gib ein Wochenbudget ein oder wähle „Kein Budgetlimit“.</Text>}
    <TextButton label="Zurück zur Einführung" onPress={() => router.replace('/intro')} />
  </Screen>;
}
