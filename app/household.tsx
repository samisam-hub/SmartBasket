import { formatMoney, t, term } from '@/services/i18n';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { HouseholdFields } from '@/components/HouseholdFields';
import { PersistenceStatus } from '@/components/PersistenceStatus';
import { DetailRow, ErrorMessage, PrimaryButton, Screen, SecondaryButton, SectionCard } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { householdValues } from '@/services/preference-domain';
import type { PlanParticipant } from '@/types/profile';
import { ui } from '@/lib/theme';

/** The household on a screen of its own: who eats along, and the two settings that decide what a
 *  week costs and aims for. Both of those are edited where they were always edited, so there is
 *  never a second copy of the same answer. */
export default function HouseholdScreen() {
  const { saved, draft, ready, saving, store } = usePreferences();
  const flow = useBasketFlow();
  const people = draft.participants ?? [];
  const setPeople = (next: PlanParticipant[]) =>
    store.update(next.length ? { participants: next, ...householdValues(next) } : { participants: undefined });
  // Edits here are settings, not an onboarding answer, so they are kept without a Save button.
  // The delay waits out a name being typed instead of saving after every letter.
  const settled = JSON.stringify(draft.participants ?? null);
  const stored = JSON.stringify(saved?.participants ?? null);
  useEffect(() => {
    if (!saved?.onboardingCompleted || saving || settled === stored) return;
    const timer = setTimeout(() => { void store.save(); }, 600);
    return () => clearTimeout(timer);
  }, [saved?.onboardingCompleted, saving, settled, stored, store]);

  if (ready && !saved?.onboardingCompleted) return <Screen bottom>
    <SectionCard title={t('householdScreen.needsSetup')}>
      <Text style={ui.body}>{t('householdScreen.needsSetupBody')}</Text>
      <PrimaryButton label={t('householdScreen.setPreferences')} disabled={flow.disabled} onPress={() => flow.edit()} />
      <SecondaryButton label={t('householdScreen.back')} onPress={() => router.back()} />
    </SectionCard>
  </Screen>;
  return <Screen bottom>
    <HouseholdFields title={t('householdScreen.title')} onBack={() => router.back()} people={people}
      goal={draft.primaryGoal} onChange={setPeople} />
    <ErrorMessage message={store.getSnapshot().localError} />
    <Text style={ui.eyebrow}>{t('householdScreen.goals')}</Text>
    <DetailRow icon="target" title={t('householdScreen.aim')} value={term(draft.primaryGoal)}
      onPress={() => flow.edit('goals')} />
    <DetailRow icon="bar-chart-2" title={t('householdScreen.budget')}
      value={draft.budgetEnabled && draft.weeklyBudgetEur !== null
        ? t('householdScreen.budgetAbout', { amount: formatMoney(draft.weeklyBudgetEur) })
        : t('householdScreen.noBudget')}
      onPress={() => flow.edit('budget')} />
    <PersistenceStatus />
  </Screen>;
}
