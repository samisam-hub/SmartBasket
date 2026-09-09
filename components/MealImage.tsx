import { useState } from 'react';
import { Image, View } from 'react-native';
import { mealImageSource } from '../lib/meal-images';
import type { Meal } from '../types/meal';

export function MealImage({ meal, compact = false }: { meal: Meal; compact?: boolean }) {
  const source = mealImageSource(meal);
  const [failedSource, setFailedSource] = useState<typeof source>(null);
  if (!source || failedSource === source) return null;
  return <View style={{ width: compact ? 160 : 200, maxWidth: '100%', alignSelf: 'center', gap: 4 }}>
    <View style={{ width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden' }}>
      <Image source={source} accessibilityLabel={meal.name}
        resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }}
        onError={() => setFailedSource(source)} />
    </View>
  </View>;
}
