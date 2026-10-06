import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Text, View } from 'react-native';
import type { Meal } from '../types/meal';
import type { MealSuggestion } from '../services/meals/planner';
import { MealImage } from './MealImage';
import { ChoiceButton, SectionCard, TextButton } from './ui';
import { colors, radii, spacing, ui } from '../lib/theme';

/** A swipe counts once it is clearly sideways and past a quarter of the card. */
export const SWIPE_FRACTION = 0.25;
export function swipeAction(dx: number, dy: number, width: number): 'take' | 'next' | 'none' {
  const distance = Math.max(64, width * SWIPE_FRACTION);
  if (Math.abs(dx) < distance || Math.abs(dy) > Math.abs(dx)) return 'none';
  return dx > 0 ? 'take' : 'next';
}
/** Long enough to read as the card leaving, short enough that nobody waits for it. A decision is
 *  only passed on once the card is gone, so what you see and what was recorded never disagree. */
const FLY_MS = 170;
const ENTER_MS = 130;
/** Rotation and stamps are interpolated over this span when the real width is not known yet. */
const SPAN = 320;

/** Screen 4: one card at a time. Right takes it and the meal is done; left shows the next card.
 *  The two round buttons do exactly the same and move the card the same way, so a tap is as
 *  legible as a swipe: in both cases the card visibly leaves in the direction of the decision. */
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
  const entry = useRef(new Animated.Value(1)).current;
  const flying = useRef(false);
  const current = suggestions[0] as MealSuggestion | undefined;
  const upcoming = suggestions[1] as MealSuggestion | undefined;
  const span = width || SPAN;
  const threshold = Math.max(64, span * SWIPE_FRACTION);
  // A new card drops onto the stack instead of appearing out of nowhere. Keyed on the meal, not on
  // the suggestion object, so a re-render of the same card does not replay the animation.
  const currentId = current?.meal.id;
  useEffect(() => {
    if (!currentId) return;
    offset.setValue(0);
    flying.current = false;
    entry.setValue(0);
    Animated.timing(entry, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [currentId, entry, offset]);
  const decide = (action: ReturnType<typeof swipeAction>) => {
    if (action === 'none') {
      Animated.spring(offset, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }).start();
      return;
    }
    if (flying.current || busy) return;
    flying.current = true;
    const taken = action === 'take' ? current : undefined;
    Animated.timing(offset, { toValue: (action === 'take' ? 1.4 : -1.4) * span, duration: FLY_MS,
      easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      flying.current = false;
      offset.setValue(0);
      if (taken) onTake(taken); else if (action === 'next') onNext();
    });
  };
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_event, gesture) => offset.setValue(gesture.dx),
    onPanResponderRelease: (_event, gesture) => decide(swipeAction(gesture.dx, gesture.dy, width)),
    onPanResponderTerminate: () => decide('none'),
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
    <View style={{ position: 'relative' }}>
      {/* The next card sits under this one, so the deck looks like a deck and its picture is
          already loaded when it comes to the front. It is not animated and takes no touches. */}
      {upcoming && <View pointerEvents="none" accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants" style={[ui.card, styles.behind]}>
        <Text style={ui.eyebrow}>Next up</Text>
        <Text style={ui.subheading}>{upcoming.meal.name}</Text>
        <MealImage meal={upcoming.meal} />
      </View>}
      <Animated.View testID="meal-card" accessible accessibilityRole="button"
        accessibilityLabel={`${current.meal.name}. Swipe right to take it, left for the next one.`}
        {...(busy ? {} : responder.panHandlers)}
        style={[ui.card, { gap: spacing.sm, transform: [
          { translateX: offset },
          { scale: entry.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          { rotate: offset.interpolate({ inputRange: [-span, 0, span], outputRange: ['-7deg', '0deg', '7deg'] }) },
        ] }]}>
        {/* The decision is named while the card is still in hand, in its own colour. */}
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampTake,
          { opacity: offset.interpolate({ inputRange: [0, threshold], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <Text style={styles.stampTakeText}>TAKE</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampNext,
          { opacity: offset.interpolate({ inputRange: [-threshold, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
          <Text style={styles.stampNextText}>NEXT</Text>
        </Animated.View>
        <Text style={ui.eyebrow}>{suggestions.length > 1 ? `1 of ${suggestions.length}` : 'Last one for now'}</Text>
        <Text style={ui.subheading}>{current.meal.name}</Text>
        <MealImage meal={current.meal} />
        <Text style={ui.small}>{mealLine(current.meal)}</Text>
      </Animated.View>
    </View>
    <View style={styles.buttons}>
      <ChoiceButton icon="x" tone="next" caption="Next" label="Show the next one"
        disabled={busy || suggestions.length < 2} onPress={() => decide('next')} />
      <ChoiceButton icon="check" tone="take" caption="Take" label="Take this one"
        disabled={busy} onPress={() => decide('take')} />
    </View>
    <TextButton label="Show two others" disabled={busy} onPress={onMore} />
  </View>;
}
const styles = {
  behind: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    gap: spacing.sm, opacity: 0.45, transform: [{ scale: 0.97 }, { translateY: 8 }] },
  buttons: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: spacing.xxl },
  stamp: { position: 'absolute' as const, top: spacing.md, zIndex: 1,
    borderWidth: 2, borderRadius: radii.small, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  stampTake: { left: spacing.md, borderColor: colors.successText, transform: [{ rotate: '-12deg' }] },
  stampNext: { right: spacing.md, borderColor: colors.muted, transform: [{ rotate: '12deg' }] },
  stampTakeText: { color: colors.successText, fontWeight: '800' as const, fontSize: 16, letterSpacing: 1 },
  stampNextText: { color: colors.muted, fontWeight: '800' as const, fontSize: 16, letterSpacing: 1 },
};
const mealLine = (meal: Meal) =>
  `${meal.ingredients.length} ingredients · ${meal.dietaryTags.length ? meal.dietaryTags.join(', ') : 'no dietary tags'}`;
