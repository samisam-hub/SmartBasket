import type { ImageSourcePropType } from 'react-native';
import type { MealMode } from '../types/meal';
export const mealOptionImages: Partial<Record<MealMode, ImageSourcePropType>> = {
  ready_to_eat: require('../assets/meal-options/ready-to-eat-v1.webp'),
  heat_and_eat: require('../assets/meal-options/heat-and-eat-v1.webp'),
  eat_out: require('../assets/meal-options/eat-out-v1.webp'),
};
/** Where the food sits in the picture, as a fraction from its top edge. It only matters when a
 *  card shows a strip rather than the whole picture: the plates in the cooked dishes are centred,
 *  but the evening out is a scene with a table in its lower half, and a strip cut from the middle
 *  of it is chairs. */
export const mealOptionFocus: Partial<Record<MealMode, number>> = { eat_out: 0.62 };
