import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { HouseholdList } from '@/components/HouseholdList';
import { IntroArt } from '@/components/IntroArt';
import { NumberInput } from '@/components/NumberInput';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SectionCard, SelectionChip, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { ui, spacing } from '@/lib/theme';
import { t } from '@/services/i18n';

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
  if (ready && !people.length) return <Screen><Text style={ui.body}>{t('setup.settingUp')}</Text></Screen>;
  if (!ready) return <Screen><Text style={ui.body}>{t('setup.loading')}</Text></Screen>;
  const budget = draft.budgetEnabled && draft.weeklyBudgetEur !== null;
  const next = async () => {
    setError(null);
    const ok = await store.save();
    if (!ok) { setError(t('setup.saveFailed')); return; }
    router.replace('/plan/taste');
  };
  return <Screen bottom>
    <ScreenHeader eyebrow={t('setup.eyebrow')} title={t('setup.title')} subtitle={t('setup.subtitle')} />
    <HouseholdList people={people}
      onOpen={id => router.push({ pathname: '/household-setup/person', params: { id } })}
      onAdd={() => router.push('/household-setup/person')} />
    <SectionCard title={t('setup.budget')}>
      <View style={{ alignItems: 'center', paddingBottom: spacing.sm }}><IntroArt kind="goals" size={96} /></View>
      <Text style={ui.small}>{t('setup.budgetBody')}</Text>
      <View style={ui.wrap}>
        <SelectionChip label={t('setup.budgetOn')} selected={draft.budgetEnabled}
          onPress={() => store.update({ budgetEnabled: true })} />
        <SelectionChip label={t('setup.budgetOff')} selected={!draft.budgetEnabled}
          onPress={() => store.update({ budgetEnabled: false, weeklyBudgetEur: null })} />
      </View>
      {draft.budgetEnabled && <NumberInput label={t('setup.budgetField')} value={draft.weeklyBudgetEur}
        hint={t('setup.budgetHint')}
        onChange={weeklyBudgetEur => store.update({ weeklyBudgetEur })} />}
    </SectionCard>
    <ErrorMessage message={error ?? store.getSnapshot().localError} />
    <PrimaryButton label={t('setup.next')} loading={saving}
      disabled={saving || (draft.budgetEnabled && !budget)} onPress={() => { void next(); }} />
    {draft.budgetEnabled && !budget &&
      <Text style={ui.small}>{t('setup.budgetMissing')}</Text>}
    <TextButton label={t('setup.backToIntro')} onPress={() => router.replace('/intro')} />
  </Screen>;
}
