import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { PersonForm } from '@/components/PersonForm';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SecondaryButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { householdValues } from '@/services/preference-domain';
import { newParticipant } from '@/services/profile-domain';
import type { PlanParticipant } from '@/types/profile';
import { ui } from '@/lib/theme';
import { t } from '@/services/i18n';

/** One person, one page. Saving returns to the household, where the next one can be added. */
export default function PersonScreen() {
  const { id, returnTo } = useLocalSearchParams<{ id?: string; returnTo?: string }>();
  // Added from the household screen in the profile? Then that is where saving returns to.
  const back = returnTo === 'household' ? '/household' as const : '/household-setup' as const;
  const { draft, ready, store } = usePreferences();
  const people = draft.participants ?? [];
  const existing = id ? people.find(person => person.id === id) ?? null : null;
  const [person, setPerson] = useState<PlanParticipant>(() => existing ?? {
    ...newParticipant('adult', `person-${Date.now()}`, people.length ? '' : t('person.you'), draft.primaryGoal),
    isCurrentUser: !people.length,
  });
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!person.name.trim()) { setError(t('person.needsName')); return; }
    const next = existing
      ? people.map(other => other.id === person.id ? person : other)
      : [...people, person];
    store.update({ participants: next, ...householdValues(next) });
    router.replace(back);
  };
  const remove = () => {
    const next = people.filter(other => other.id !== person.id);
    store.update(next.length ? { participants: next, ...householdValues(next) } : { participants: undefined });
    router.replace(back);
  };
  return <Screen bottom>
    <ScreenHeader eyebrow={t(existing ? 'person.editEyebrow' : 'person.addEyebrow')}
      title={existing ? person.name.trim() || t('fields.thisPerson') : t(people.length ? 'person.whoElse' : 'person.startWithYou')} />
    <ErrorMessage message={error} />
    <PersonForm person={person} goal={draft.primaryGoal}
      onChange={next => { setPerson(next); setError(null); }} />
    <PrimaryButton label={t(existing ? 'person.saveChanges' : 'person.saveContinue')} disabled={!ready} onPress={save} />
    {existing && !existing.isCurrentUser &&
      <SecondaryButton label={t('fields.remove')} onPress={remove} />}
    <SecondaryButton label={t('person.cancel')} onPress={() => router.replace(back)} />
    <Text style={ui.small}>{t('person.local')}</Text>
  </Screen>;
}
