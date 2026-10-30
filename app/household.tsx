import { formatMoney, t, term } from '@/services/i18n';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Text , View } from 'react-native';
import { AvatarPicker } from '@/components/Avatar';
import { HouseholdList } from '@/components/HouseholdList';
import { PersistenceStatus } from '@/components/PersistenceStatus';
import { DetailRow, ErrorMessage, IconButton, PrimaryButton, Screen, SecondaryButton, SectionCard, TextInput } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { spacing, ui } from '@/lib/theme';

/** The household on a screen of its own: who eats along, and the two settings that decide what a
 *  week costs and aims for. People are edited one at a time on their own page, the same page the
 *  setup uses, so there is never a second way to say the same thing. */
export default function HouseholdScreen() {
  const { saved, draft, ready, saving, store } = usePreferences();
  const flow = useBasketFlow();
  const people = draft.participants ?? [];
  const openPerson = (id?: string) =>
    router.push({ pathname: '/household-setup/person', params: { returnTo: 'household', ...(id ? { id } : {}) } });
  // Edits here are settings, not an onboarding answer, so they are kept without a Save button.
  // The delay waits out a name being typed instead of saving after every letter.
  const settled = JSON.stringify([draft.participants ?? null, draft.householdName ?? null, draft.householdAvatarUri ?? null]);
  const stored = JSON.stringify([saved?.participants ?? null, saved?.householdName ?? null, saved?.householdAvatarUri ?? null]);
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
    <View style={ui.row}>
      <IconButton icon="chevron-left" label={t('fields.back')} onPress={() => router.back()} />
      <Text accessibilityRole="header" style={[ui.title, { flex: 1 }]}>{t('householdScreen.title')}</Text>
    </View>
    <SectionCard compact title={t('household.identity')}>
      <AvatarPicker name={draft.householdName ?? ''} id="household" uri={draft.householdAvatarUri}
        onChange={householdAvatarUri => store.update({ householdAvatarUri })} />
      <TextInput label={t('household.name')} value={draft.householdName ?? ''} maxLength={80}
        placeholder={t('household.namePlaceholder')}
        onChangeText={householdName => store.update({ householdName })} />
    </SectionCard>
    <HouseholdList people={people} onOpen={openPerson} onAdd={() => openPerson()} />
    <Text style={[ui.small, { marginTop: -spacing.sm }]}>{t('fields.hint')}</Text>
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
