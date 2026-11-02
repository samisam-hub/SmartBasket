import type { ImageSourcePropType } from 'react-native';
import type { Meal } from '../types/meal';
import { mealOptionImages } from './meal-option-images';

/** Approved AI serving illustrations, bundled for offline use; never product photos. */
const images: Record<string, { source: ImageSourcePropType; ingredients: string[] }> = {
  'sunny-side-toast': { source: require('../assets/meals/sunny-side-toast.png'), ingredients: ['eggs', 'sourdough_bread', 'cherry_tomatoes', 'spinach', 'olive_oil'] },
  'oat-berries': { source: require('../assets/meals/oat-berries.png'), ingredients: ['oats', 'berries', 'banana'] },
  'salmon-rice': { source: require('../assets/meals/salmon-rice.png'), ingredients: ['salmon', 'rice', 'broccoli', 'olive_oil'] },
  'tofu-teriyaki-noodles': { source: require('../assets/meals/tofu-teriyaki-noodles.png'), ingredients: ['tofu', 'noodles', 'broccoli', 'carrots', 'olive_oil', 'teriyaki'] },
  'chicken-ham-lunchbox': { source: require('../assets/meals/chicken-ham-lunchbox.png'), ingredients: ['wholemeal_bread', 'chicken_ham', 'apple', 'carrots'] },
  'de-gemuseomelett-mit-brot': { source: require('../assets/meals/de-gemuseomelett-mit-brot.png'), ingredients: ['eggs', 'bell_pepper', 'fresh_tomato', 'olive_oil', 'wholemeal_bread'] },
  'de-hahnchen-mit-reis-und-gemuse': { source: require('../assets/meals/de-hahnchen-mit-reis-und-gemuse.png'), ingredients: ['chicken_breast', 'rice', 'broccoli', 'carrots', 'olive_oil'] },
  'de-ofenlachs-mit-kartoffeln-und-brokkoli': { source: require('../assets/meals/de-ofenlachs-mit-kartoffeln-und-brokkoli.png'), ingredients: ['salmon', 'potatoes', 'broccoli', 'olive_oil', 'lemon'] },
  'de-spiegelei-auf-brot': { source: require('../assets/meals/de-spiegelei-auf-brot.png'), ingredients: ['eggs', 'olive_oil', 'wholemeal_bread', 'fresh_tomato'] },
  'tofu-stirfry': { source: require('../assets/meals/tofu-stirfry.png'), ingredients: ['tofu', 'rice', 'broccoli', 'carrots', 'olive_oil'] },
  'borschtsch-rind-ohne-bohnen': { source: require('../assets/meals/borschtsch-rind-ohne-bohnen.png'), ingredients: ['beef_stew', 'beetroot', 'white_cabbage', 'potatoes', 'carrots', 'onion', 'tomato_paste', 'vinegar', 'sunflower_oil', 'garlic', 'sour_cream'] },
  'pirozhki-kartoffeln-pilze-gebraten': { source: require('../assets/meals/pirozhki-kartoffeln-pilze-gebraten.png'), ingredients: ['flour', 'dry_yeast', 'sugar', 'sunflower_oil', 'potatoes', 'mushrooms', 'onion'] },
  'pirozhki-kohl-karotten-gebraten': { source: require('../assets/meals/pirozhki-kohl-karotten-gebraten.png'), ingredients: ['flour', 'dry_yeast', 'sugar', 'sunflower_oil', 'white_cabbage', 'carrots', 'onion'] },
  'kotlety-kartoffelpueree-rahmsauce': { source: require('../assets/meals/kotlety-kartoffelpueree-rahmsauce.png'), ingredients: ['mince', 'bread_roll', 'milk', 'eggs', 'onion', 'potatoes', 'butter', 'cream', 'flour', 'sunflower_oil', 'broth'] },
  'af-qabeli-palau-lamm': { source: require('../assets/meals/af-qabeli-palau-lamm.png'), ingredients: ['lamb_stew', 'basmati_rice', 'carrots', 'raisins', 'onion', 'sunflower_oil', 'sugar', 'cumin', 'cardamom'] },
  'de-weihnachtsente-blaukraut-kartoffelknoedel': { source: require('../assets/meals/de-weihnachtsente-blaukraut-kartoffelknoedel.png'), ingredients: ['duck_breast', 'red_cabbage', 'apple', 'onion', 'butter', 'vinegar', 'sugar', 'cloves', 'bay_leaf', 'potatoes', 'potato_starch', 'eggs', 'carrots', 'tomato_paste', 'broth'] },
  'de-herbstliches-hirschgulasch': { source: require('../assets/meals/de-herbstliches-hirschgulasch.png'), ingredients: ['venison_stew', 'mushrooms', 'onion', 'carrots', 'tomato_paste', 'sunflower_oil', 'broth', 'cream', 'lingonberry_preserve', 'juniper', 'bay_leaf', 'red_wine'] },
  'de-kasebrot-mit-gurke': { source: require('../assets/meals/de-kasebrot-mit-gurke.png'), ingredients: ['wholemeal_bread', 'butter', 'cheese', 'cucumber'] },
  'de-hummusbrot-mit-gurke': { source: require('../assets/meals/de-hummusbrot-mit-gurke.png'), ingredients: ['wholemeal_bread', 'hummus', 'cucumber'] },
  'de-brotzeit-mit-aufschnitt-und-gewurzgurken': { source: require('../assets/meals/de-brotzeit-mit-aufschnitt-und-gewurzgurken.png'), ingredients: ['wholemeal_bread', 'butter', 'cold_cuts', 'pickles'] },
  'de-wurstbrot-lunchbox-mit-gurke-und-apfel': { source: require('../assets/meals/de-wurstbrot-lunchbox-mit-gurke-und-apfel.png'), ingredients: ['wholemeal_bread', 'butter', 'cold_cuts', 'cucumber', 'apple'] },
  "eggs-toast": { source: require("../assets/meals/eggs-toast.png"), ingredients: ["eggs","wholemeal_bread","chopped_tomatoes"] },
  "yogurt-fruit": { source: require("../assets/meals/yogurt-fruit.png"), ingredients: ["yogurt","oats","berries"] },
  "overnight-oats": { source: require("../assets/meals/overnight-oats.png"), ingredients: ["oats","banana","berries"] },
  "scrambled-eggs": { source: require("../assets/meals/scrambled-eggs.png"), ingredients: ["eggs","spinach","potatoes","olive_oil"] },
  "cottage-bowl": { source: require("../assets/meals/cottage-bowl.png"), ingredients: ["cottage","apple","oats"] },
  "tofu-breakfast": { source: require("../assets/meals/tofu-breakfast.png"), ingredients: ["tofu","potatoes","spinach","olive_oil"] },
  "lentil-breakfast": { source: require("../assets/meals/lentil-breakfast.png"), ingredients: ["lentils","chopped_tomatoes","spinach","olive_oil"] },
  "chicken-potato": { source: require("../assets/meals/chicken-potato.png"), ingredients: ["chicken_breast","potatoes","broccoli","olive_oil"] },
  'cottage-carrot-bread': { source: require('../assets/meals/cottage-carrot-bread.png'), ingredients: ['wholemeal_bread','cottage','carrots'] },
  "lentil-pasta": { source: require("../assets/meals/lentil-pasta.png"), ingredients: ["lentils","pasta","chopped_tomatoes","olive_oil"] },
  "chickpea-salad": { source: require("../assets/meals/chickpea-salad.png"), ingredients: ["chickpeas","potatoes","chopped_tomatoes","olive_oil"] },
  "turkey-pasta": { source: require("../assets/meals/turkey-pasta.png"), ingredients: ["turkey","pasta","chopped_tomatoes","olive_oil"] },
  "tuna-potato": { source: require("../assets/meals/tuna-potato.png"), ingredients: ["tuna","potatoes","carrots","olive_oil"] },
  "chicken-rice": { source: require("../assets/meals/chicken-rice.png"), ingredients: ["chicken_breast","rice","broccoli","olive_oil"] },
  "lentil-curry": { source: require("../assets/meals/lentil-curry.png"), ingredients: ["lentils","rice","chopped_tomatoes","spinach","olive_oil"] },
  "tuna-pasta": { source: require("../assets/meals/tuna-pasta.png"), ingredients: ["tuna","pasta","chopped_tomatoes","olive_oil"] },
  "vegan-protein": { source: require("../assets/meals/vegan-protein.png"), ingredients: ["tofu","lentils","broccoli","olive_oil"] },
  "chicken-lentils": { source: require("../assets/meals/chicken-lentils.png"), ingredients: ["chicken_breast","lentils","carrots","olive_oil"] },
  "salmon-potato": { source: require("../assets/meals/salmon-potato.png"), ingredients: ["salmon","potatoes","spinach","olive_oil"] },
  "eggs-rice": { source: require("../assets/meals/eggs-rice.png"), ingredients: ["eggs","rice","carrots","olive_oil"] },
  "chickpea-rice": { source: require("../assets/meals/chickpea-rice.png"), ingredients: ["chickpeas","rice","spinach","olive_oil"] },
  "tofu-pasta": { source: require("../assets/meals/tofu-pasta.png"), ingredients: ["tofu","pasta","chopped_tomatoes","olive_oil"] },
  "chicken-ham-toast": { source: require("../assets/meals/chicken-ham-toast.png"), ingredients: ["eggs","wholemeal_bread","chicken_ham"] },
  "salmon-egg-toast": { source: require("../assets/meals/salmon-egg-toast.png"), ingredients: ["smoked_salmon","eggs","wholemeal_bread"] },
  "steak-greens": { source: require("../assets/meals/steak-greens.png"), ingredients: ["beef_steak","potatoes","spinach","olive_oil"] },
  "chicken-stroganoff": { source: require("../assets/meals/chicken-stroganoff.png"), ingredients: ["chicken_breast","noodles","mushrooms","onion","soy_cream","olive_oil"] },
  "steak-chanterelles": { source: require("../assets/meals/steak-chanterelles.png"), ingredients: ["beef_steak","potatoes","chanterelles","onion","soy_cream","olive_oil"] },
  "snack-apple-berries": { source: require("../assets/meals/snack-apple-berries.png"), ingredients: ["apple","berries"] },
  "snack-yogurt": { source: require("../assets/meals/snack-yogurt.png"), ingredients: ["yogurt","berries"] },
  "snack-banana-chocolate": { source: require("../assets/meals/snack-banana-chocolate.png"), ingredients: ["banana","dark_chocolate"] },
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
