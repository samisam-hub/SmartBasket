import { contentName } from '../services/i18n/content';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { mealImageSource } from '../lib/meal-images';
import type { Meal } from '../types/meal';

export function MealImage({ meal, compact = false, banner = false }:
  { meal: Meal; compact?: boolean; /** Full width and letterboxed, the way a card leads with its picture. */ banner?: boolean }) {
  const source = mealImageSource(meal);
  const [failedSource, setFailedSource] = useState<typeof source>(null);
  if (!source || failedSource === source) return null;
  return <View style={banner
    ? { width: '100%', gap: 4 }
    : { width: compact ? 160 : 200, maxWidth: '100%', alignSelf: 'center', gap: 4 }}>
    <View style={{ width: '100%', aspectRatio: banner ? 16 / 9 : 1,
      borderRadius: banner ? 0 : 16, overflow: 'hidden' }}>
      <Image source={source} accessibilityLabel={contentName(meal.name)}
        resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }}
        onError={() => setFailedSource(source)} />
    </View>
  </View>;
}
