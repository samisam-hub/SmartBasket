import { useEffect } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { HouseholdList } from '@/components/HouseholdList';
import { IntroArt } from '@/components/IntroArt';
import { NumberInput } from '@/components/NumberInput';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SectionCard, SelectionChip, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { ui, spacing } from '@/lib/theme';

/** The household as it stands: everybody on it, the chance to add one more, and — only once
 *  somebody is on it — the weekly budget, which belongs to the household rather than a person. */
export default function HouseholdSetupScreen() {
  const { draft, ready, saving, store } = usePreferences();
  const people = draft.participants ?? [];
  // Nobody yet means there is nothing to show: go straight to adding the first person.
  useEffect(() => {
    if (ready && !people.length) router.replace('/household-setup/person');
  }, [ready, people.length]);
  if (ready && !people.length) return <Screen><Text style={ui.body}>Setting up…</Text></Screen>;
  if (!ready) return <Screen><Text style={ui.body}>Loading…</Text></Screen>;
  const budget = draft.budgetEnabled && draft.weeklyBudgetEur !== null;
  return <Screen bottom>
    <ScreenHeader eyebrow="YOUR HOUSEHOLD" title="Who eats along"
      subtitle="Portions and amounts follow the people at the table. You can change any of this later." />
    <HouseholdList people={people}
      onOpen={id => router.push({ pathname: '/household-setup/person', params: { id } })}
      onAdd={() => router.push('/household-setup/person')} />
    <SectionCard title="Budget for a week">
      <View style={{ alignItems: 'center', paddingBottom: spacing.sm }}><IntroArt kind="goals" size={96} /></View>
      <Text style={ui.small}>
        What you want to spend on groceries in a week. The list stays inside it where it can, and
        says so plainly where it cannot.
      </Text>
      <View style={ui.wrap}>
        <SelectionChip label="Keep an eye on it" selected={draft.budgetEnabled}
          onPress={() => store.update({ budgetEnabled: true })} />
        <SelectionChip label="No budget limit" selected={!draft.budgetEnabled}
          onPress={() => store.update({ budgetEnabled: false, weeklyBudgetEur: null })} />
      </View>
      {draft.budgetEnabled && <NumberInput label="Weekly budget (€)" value={draft.weeklyBudgetEur}
        hint="Roughly is fine. You can change it whenever."
        onChange={weeklyBudgetEur => store.update({ weeklyBudgetEur })} />}
    </SectionCard>
    <ErrorMessage message={store.getSnapshot().localError} />
    <PrimaryButton label="Next: pick meals you like" disabled={saving || (draft.budgetEnabled && !budget)}
      onPress={() => router.replace('/meal-preferences')} />
    {draft.budgetEnabled && !budget &&
      <Text style={ui.small}>Enter a weekly budget, or choose “No budget limit”.</Text>}
    <TextButton label="Back to the introduction" onPress={() => router.replace('/intro')} />
  </Screen>;
}
