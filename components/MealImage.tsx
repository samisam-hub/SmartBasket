import { contentName } from '../services/i18n/content';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { mealImageSource } from '../lib/meal-images';
import type { Meal } from '../types/meal';

export function MealImage({ meal, compact = false, banner = false, thumb = false }:
  { meal: Meal; compact?: boolean;
    /** Full width and letterboxed, the way a card leads with its picture. */ banner?: boolean;
    /** A small square beside the text, for a list of meals that has to stay short. */ thumb?: boolean }) {
  const source = mealImageSource(meal);
  const [failedSource, setFailedSource] = useState<typeof source>(null);
  if (!source || failedSource === source) return null;
  return <View style={banner
    ? { width: '100%', gap: 4 }
    : thumb
      ? { width: 96, flexGrow: 0, flexShrink: 0 }
      : { width: compact ? 160 : 200, maxWidth: '100%', alignSelf: 'center', gap: 4 }}>
    <View style={{ width: '100%', aspectRatio: banner ? 16 / 9 : 1,
      borderRadius: banner ? 0 : thumb ? 12 : 16, overflow: 'hidden' }}>
      <Image source={source} accessibilityLabel={contentName(meal.name)}
        resizeMode="cover" resizeMethod="resize" style={{ position: 'absolute', width: '100%', height: '100%' }}
        onError={() => setFailedSource(source)} />
    </View>
  </View>;
}
