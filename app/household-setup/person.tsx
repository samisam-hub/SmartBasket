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

/** One person, one page. Saving returns to the household, where the next one can be added. */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { draft, ready, store } = usePreferences();
  const people = draft.participants ?? [];
  const existing = id ? people.find(person => person.id === id) ?? null : null;
  const [person, setPerson] = useState<PlanParticipant>(() => existing ?? {
    ...newParticipant('adult', `person-${Date.now()}`, people.length ? '' : 'You', draft.primaryGoal),
    isCurrentUser: !people.length,
  });
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!person.name.trim()) { setError('Give this person a name, so the plan can say who eats what.'); return; }
    const next = existing
      ? people.map(other => other.id === person.id ? person : other)
      : [...people, person];
    store.update({ participants: next, ...householdValues(next) });
    router.replace('/household-setup');
  };
  const remove = () => {
    const next = people.filter(other => other.id !== person.id);
    store.update(next.length ? { participants: next, ...householdValues(next) } : { participants: undefined });
    router.replace('/household-setup');
  };
  return <Screen bottom>
    <ScreenHeader eyebrow={existing ? 'EDIT' : 'ADD SOMEBODY'}
      title={existing ? person.name.trim() || 'This person' : people.length ? 'Who else eats along?' : 'Start with you'}
      subtitle="Everything about this person on one page. The weekly budget comes later, once the household is complete." />
    <ErrorMessage message={error} />
    <PersonForm person={person} goal={draft.primaryGoal}
      onChange={next => { setPerson(next); setError(null); }} />
    <PrimaryButton label={existing ? 'Save changes' : 'Save and continue'} disabled={!ready} onPress={save} />
    {existing && !existing.isCurrentUser &&
      <SecondaryButton label="Remove this person" onPress={remove} />}
    <SecondaryButton label="Cancel" onPress={() => router.replace('/household-setup')} />
    <Text style={ui.small}>Nothing is sent anywhere. Your household stays on this device until you create an account.</Text>
  </Screen>;
}
