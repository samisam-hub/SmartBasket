import type { ImageSourcePropType } from 'react-native';
import type { MealMode } from '../types/meal';
export const mealOptionImages: Partial<Record<MealMode, ImageSourcePropType>> = {
  ready_to_eat: require('../assets/meal-options/ready-to-eat-v1.png'),
  heat_and_eat: require('../assets/meal-options/heat-and-eat-v1.png'),
  eat_out: require('../assets/meal-options/eat-out-v1.png'),
};
