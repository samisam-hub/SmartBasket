import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Text, View } from 'react-native';
import type { Meal } from '../types/meal';
import type { MealSuggestion } from '../services/meals/planner';
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
export function MealSwipeCards({ suggestions, exhausted, onTake, onNext, onMore, busy }: {
  suggestions: MealSuggestion[];
  /** No compatible meal is left to show, so only the honest ways out remain. */
  exhausted: boolean;
  onTake: (suggestion: MealSuggestion) => void;
  onNext: () => void;
  onMore: () => void;
  busy?: boolean;
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
  }), [width, current?.meal.id, busy]);
  if (!current) return <SectionCard title={exhausted ? 'No more meals fit this slot' : 'Nothing to show'}>
    <Text style={ui.body}>{exhausted
      ? 'Every compatible meal for this slot has been shown. Rather than repeating one, pick one of these:'
      : 'No suggestion is available right now.'}</Text>
  </SectionCard>;
  return <View style={{ gap: spacing.md }} onLayout={event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== width) setWidth(next);
  }}>
    <Animated.View accessible accessibilityRole="button"
      accessibilityLabel={`${current.meal.name}. Swipe right to take it, left for the next one.`}
      {...(busy ? {} : responder.panHandlers)}
      style={[ui.card, { gap: spacing.sm, transform: [{ translateX: offset }] }]}>
      <Text style={ui.eyebrow}>{suggestions.length > 1 ? `1 of ${suggestions.length}` : 'Last one for now'}</Text>
      <Text style={ui.subheading}>{current.meal.name}</Text>
      <MealImage meal={current.meal} />
      <Text style={ui.small}>{mealLine(current.meal)}</Text>
    </Animated.View>
    <PrimaryButton label="Take this one" disabled={busy} onPress={() => decide('take')} />
    <SecondaryButton label="Show the next one" disabled={busy || suggestions.length < 2} onPress={() => decide('next')} />
    <TextButton label="Show two others" disabled={busy} onPress={onMore} />
  </View>;
}
const mealLine = (meal: Meal) =>
  `${meal.ingredients.length} ingredients · ${meal.dietaryTags.length ? meal.dietaryTags.join(', ') : 'no dietary tags'}`;
