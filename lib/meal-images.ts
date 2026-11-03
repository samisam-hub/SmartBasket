import type { ImageSourcePropType } from 'react-native';
import type { Meal } from '../types/meal';
import { mealOptionImages } from './meal-option-images';

/** Approved AI serving illustrations, bundled for offline use; never product photos. */
const images: Record<string, { source: ImageSourcePropType; ingredients: string[] }> = {
  'sunny-side-toast': { source: require('../assets/meals/sunny-side-toast.jpg'), ingredients: ['eggs', 'sourdough_bread', 'cherry_tomatoes', 'spinach', 'olive_oil'] },
  'oat-berries': { source: require('../assets/meals/oat-berries.jpg'), ingredients: ['oats', 'berries', 'banana'] },
  'salmon-rice': { source: require('../assets/meals/salmon-rice.jpg'), ingredients: ['salmon', 'rice', 'broccoli', 'olive_oil'] },
  'tofu-teriyaki-noodles': { source: require('../assets/meals/tofu-teriyaki-noodles.jpg'), ingredients: ['tofu', 'noodles', 'broccoli', 'carrots', 'olive_oil', 'teriyaki'] },
  "eggs-toast": { source: require("../assets/meals/eggs-toast.jpg"), ingredients: ["eggs","wholemeal_bread","chopped_tomatoes"] },
  "yogurt-fruit": { source: require("../assets/meals/yogurt-fruit.jpg"), ingredients: ["yogurt","oats","berries"] },
  "overnight-oats": { source: require("../assets/meals/overnight-oats.jpg"), ingredients: ["oats","banana","berries"] },
  "scrambled-eggs": { source: require("../assets/meals/scrambled-eggs.jpg"), ingredients: ["eggs","spinach","potatoes","olive_oil"] },
  "cottage-bowl": { source: require("../assets/meals/cottage-bowl.jpg"), ingredients: ["cottage","apple","oats"] },
  "tofu-breakfast": { source: require("../assets/meals/tofu-breakfast.jpg"), ingredients: ["tofu","potatoes","spinach","olive_oil"] },
  "lentil-breakfast": { source: require("../assets/meals/lentil-breakfast.jpg"), ingredients: ["lentils","chopped_tomatoes","spinach","olive_oil"] },
  "chicken-potato": { source: require("../assets/meals/chicken-potato.jpg"), ingredients: ["chicken_breast","potatoes","broccoli","olive_oil"] },
  'cottage-carrot-bread': { source: require('../assets/meals/cottage-carrot-bread.jpg'), ingredients: ['wholemeal_bread','cottage','carrots'] },
  'chicken-ham-lunchbox': { source: require('../assets/meals/chicken-ham-lunchbox.jpg'), ingredients: ['wholemeal_bread','chicken_ham','apple','carrots'] },
  "lentil-pasta": { source: require("../assets/meals/lentil-pasta.jpg"), ingredients: ["lentils","pasta","chopped_tomatoes","olive_oil"] },
  "chickpea-salad": { source: require("../assets/meals/chickpea-salad.jpg"), ingredients: ["chickpeas","potatoes","chopped_tomatoes","olive_oil"] },
  "turkey-pasta": { source: require("../assets/meals/turkey-pasta.jpg"), ingredients: ["turkey","pasta","chopped_tomatoes","olive_oil"] },
  "tuna-potato": { source: require("../assets/meals/tuna-potato.jpg"), ingredients: ["tuna","potatoes","carrots","olive_oil"] },
  "chicken-rice": { source: require("../assets/meals/chicken-rice.jpg"), ingredients: ["chicken_breast","rice","broccoli","olive_oil"] },
  "lentil-curry": { source: require("../assets/meals/lentil-curry.jpg"), ingredients: ["lentils","rice","chopped_tomatoes","spinach","olive_oil"] },
  "tuna-pasta": { source: require("../assets/meals/tuna-pasta.jpg"), ingredients: ["tuna","pasta","chopped_tomatoes","olive_oil"] },
  "vegan-protein": { source: require("../assets/meals/vegan-protein.jpg"), ingredients: ["tofu","lentils","broccoli","olive_oil"] },
  "chicken-lentils": { source: require("../assets/meals/chicken-lentils.jpg"), ingredients: ["chicken_breast","lentils","carrots","olive_oil"] },
  "salmon-potato": { source: require("../assets/meals/salmon-potato.jpg"), ingredients: ["salmon","potatoes","spinach","olive_oil"] },
  "eggs-rice": { source: require("../assets/meals/eggs-rice.jpg"), ingredients: ["eggs","rice","carrots","olive_oil"] },
  "chickpea-rice": { source: require("../assets/meals/chickpea-rice.jpg"), ingredients: ["chickpeas","rice","spinach","olive_oil"] },
  "tofu-pasta": { source: require("../assets/meals/tofu-pasta.jpg"), ingredients: ["tofu","pasta","chopped_tomatoes","olive_oil"] },
  "chicken-ham-toast": { source: require("../assets/meals/chicken-ham-toast.jpg"), ingredients: ["eggs","wholemeal_bread","chicken_ham"] },
  "salmon-egg-toast": { source: require("../assets/meals/salmon-egg-toast.jpg"), ingredients: ["smoked_salmon","eggs","wholemeal_bread"] },
  "steak-greens": { source: require("../assets/meals/steak-greens.jpg"), ingredients: ["beef_steak","potatoes","spinach","olive_oil"] },
  "chicken-stroganoff": { source: require("../assets/meals/chicken-stroganoff.jpg"), ingredients: ["chicken_breast","noodles","mushrooms","onion","soy_cream","olive_oil"] },
  "steak-chanterelles": { source: require("../assets/meals/steak-chanterelles.jpg"), ingredients: ["beef_steak","potatoes","chanterelles","onion","soy_cream","olive_oil"] },
  "snack-apple-berries": { source: require("../assets/meals/snack-apple-berries.jpg"), ingredients: ["apple","berries"] },
  "snack-yogurt": { source: require("../assets/meals/snack-yogurt.jpg"), ingredients: ["yogurt","berries"] },
  "snack-banana-chocolate": { source: require("../assets/meals/snack-banana-chocolate.jpg"), ingredients: ["banana","dark_chocolate"] },
};

export function mealImageSource(meal: Meal): ImageSourcePropType | null {
  if (meal.nutritionSource === 'unrecorded') return mealOptionImages[meal.id.split(':')[1] as keyof typeof mealOptionImages] ?? null;
  const image = images[meal.id];
  // Saved snapshots can predate a recipe revision. Do not illustrate different ingredients.
  const core = meal.ingredients.filter(i=>!['parsley','dill','pepper'].includes(i.ingredientKey));
  if (!image || core.length !== image.ingredients.length ||
      !image.ingredients.every(key => core.some(i => i.ingredientKey === key))) return null;
  return image.source;
}
