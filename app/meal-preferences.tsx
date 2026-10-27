import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { MealImage } from '@/components/MealImage';
import { ChoiceButton, ErrorMessage, PrimaryButton, ProgressIndicator, Screen, ScreenHeader, SectionCard, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { likedMeals, preferenceDeck } from '@/services/meals/preference-deck';
import { spacing, ui } from '@/lib/theme';

/** Say what you like, one meal at a time. Nothing here is a commitment: it nudges suggestions
 *  later, and skipping everything is a valid answer. Finishing saves the setup, which is the
 *  point where the household becomes a plan the app can work with. */
export default function MealPreferencesScreen() {
  const { draft, ready, saving, store } = usePreferences();
  const deck = useMemo(() => preferenceDeck(draft), [draft]);
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>(draft.preferredMealIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const current = deck[index];
  const finish = async () => {
    store.update({ preferredMealIds: likedMeals(liked) });
    const ok = await store.save();
    if (!ok) { setError('Your setup could not be saved on this device. Nothing is lost — try again.'); return; }
    router.replace('/plan/week');
  };
  const answer = (keep: boolean) => {
    if (keep && current) setLiked(list => [...list, current.id]);
    if (index + 1 >= deck.length) { void finish(); return; }
    setIndex(step => step + 1);
  };
  if (!ready) return <Screen><Text style={ui.body}>Loading…</Text></Screen>;
  if (!deck.length) return <Screen bottom>
    <ScreenHeader title="No meals to show" subtitle="Nothing in our recipes fits every restriction in this household yet." />
    <PrimaryButton label="Carry on to the calendar" loading={saving} onPress={() => { void finish(); }} />
    <TextButton label="Back to the household" onPress={() => router.replace('/household-setup')} />
  </Screen>;
  return <Screen bottom>
    <ProgressIndicator current={index + 1} total={deck.length} />
    <ScreenHeader eyebrow="WHAT DO YOU LIKE?" title="Swipe through a few meals"
      subtitle="This only nudges what gets suggested later. Skip as many as you like — you can plan anything regardless." />
    <ErrorMessage message={error} />
    <SectionCard>
      <Text style={ui.subheading}>{current.name}</Text>
      <MealImage meal={current} banner />
      <Text style={ui.small}>
        {current.mealType} · {Math.round(current.caloriesPerServing)} kcal a portion ·{' '}
        {current.ingredients.length} ingredients
      </Text>
    </SectionCard>
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl }}>
      <ChoiceButton icon="x" tone="next" caption="Not for us" label="Skip this meal"
        disabled={saving} onPress={() => answer(false)} />
      <ChoiceButton icon="heart" tone="take" caption="Like" label="Like this meal"
        disabled={saving} onPress={() => answer(true)} />
    </View>
    <TextButton label="Skip all of this" disabled={saving} onPress={() => { void finish(); }} />
  </Screen>;
}
