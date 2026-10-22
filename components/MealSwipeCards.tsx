import { germanSavedName } from '../lib/legacy-display';
import { germanLabel } from '../lib/german';
import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Text, View } from 'react-native';
import type { Meal } from '../types/meal';
import type { MealSuggestion } from '../services/meals/planner';
import { MealPreparation } from './MealPreparation';
import { MealImage } from './MealImage';
import { PrimaryButton, SecondaryButton, SectionCard, TextButton } from './ui';
import { spacing, ui } from '../lib/theme';

/** A swipe counts once it is clearly sideways and past a quarter of the card. */
export const SWIPE_FRACTION = 0.25;
export function swipeAction(dx: number, dy: number, width: number): 'take' | 'next' | 'none' {
  const distance = Math.max(64, width * SWIPE_FRACTION);
  if (Math.abs(dx) < distance || Math.abs(dy) > Math.abs(dx)) return 'none';
  return dx > 0 ? 'take' : 'next';
}

/** Screen 4: one card at a time. Right takes it and the meal is done; left shows the next card.
 *  Tapping does exactly the same, so nobody has to swipe. */
export function MealSwipeCards({ suggestions, exhausted, onTake, onNext, onMore, busy, mode = 'choice' }: {
  suggestions: MealSuggestion[];
  /** No compatible meal is left to show, so only the honest ways out remain. */
  exhausted: boolean;
  onTake: (suggestion: MealSuggestion) => void;
  onNext: () => void;
  onMore: () => void;
  busy?: boolean;
  mode?: 'choice' | 'taste';
}) {
  const [width, setWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const current = suggestions[0] as MealSuggestion | undefined;
  const decide = (action: ReturnType<typeof swipeAction>) => {
    offset.setValue(0);
    if (action === 'take' && current) onTake(current);
    else if (action === 'next') onNext();
  };
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_event, gesture) => offset.setValue(gesture.dx),
    onPanResponderRelease: (_event, gesture) => decide(swipeAction(gesture.dx, gesture.dy, width)),
    onPanResponderTerminate: () => offset.setValue(0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [width, current?.meal.id, busy, mode]);
  if (!current) return <SectionCard title={exhausted ? "Keine weiteren passenden Gerichte" : "Keine Vorschläge verfügbar"}>
    <Text style={ui.body}>{exhausted
      ? "Alle passenden Gerichte für diese Mahlzeit wurden angezeigt. Wähle eine dieser Möglichkeiten:"
      : "Momentan ist kein Vorschlag verfügbar."}</Text>
  </SectionCard>;
  return <View style={{ gap: spacing.md }} onLayout={event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== width) setWidth(next);
  }}>
    <Animated.View accessible accessibilityRole="button"
      accessibilityLabel={`${germanSavedName(current.meal.name)}. ${mode === 'taste' ? 'Rechts: mögen. Links: nicht mögen.' : "Wische nach rechts zum Auswählen, nach links für den nächsten Vorschlag."}`}
      {...(busy ? {} : responder.panHandlers)}
      style={[ui.card, { gap: spacing.sm, transform: [{ translateX: offset }] }]}>
      <Text style={ui.eyebrow}>{mode === 'taste' ? 'GESCHMACK' : suggestions.length > 1 ? `1 von ${suggestions.length}` : "Vorerst letzter Vorschlag"}</Text>
      <Text style={ui.subheading}>{germanSavedName(current.meal.name)}</Text>
      <MealImage meal={current.meal} />
      <MealPreparation meal={current.meal} />
      <Text style={ui.small}>{mealLine(current.meal)}</Text>
    </Animated.View>
    <PrimaryButton label={mode === 'taste' ? 'Mögen wir' : "Dieses Gericht wählen"} disabled={busy} onPress={() => decide('take')} />
    <SecondaryButton label={mode === 'taste' ? 'Mögen wir nicht' : "Nächsten Vorschlag zeigen"} disabled={busy || (mode !== 'taste' && suggestions.length < 2)} onPress={() => decide('next')} />
    {mode !== 'taste' && <TextButton label="Zwei andere zeigen" disabled={busy} onPress={onMore} />}
  </View>;
}
const mealLine = (meal: Meal) =>
  `${meal.ingredients.length} Zutaten · ${meal.dietaryTags.length ? meal.dietaryTags.map(germanLabel).join(', ') : "keine Ernährungsangaben"}`;
