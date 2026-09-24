import { canonicalIngredientKey, ingredientMappings, legacyIngredientKeys } from './ingredient-mappings';
import type { IngredientDefinition, Meal } from '../types/meal';
import type { Allergen, Diet } from '../types/preferences';
import { quantityTolerances } from '../services/meals/config';
// Explicit development estimates for raw/as-sold ingredients, not branded-product facts.
// Rice, pasta and lentils are dry weights; eggs are edible mass; canned beans are drained.
const plant: Diet[] = ['vegan', 'vegetarian', 'pescatarian', 'lactose_free', 'gluten_free'];
const animal: Diet[] = ['lactose_free', 'gluten_free'];
// Diabetes-friendly is a shopping preference, never medical advice. Ingredients above the UK FSA
// front-of-pack high-sugar threshold (22.5 g sugars per 100 g, 11.25 per 100 ml) are left untagged,
// and a meal keeps the tag only inside the carbohydrate portions common in carbohydrate counting.
const highSugarIngredients = new Set(['dark_chocolate', 'teriyaki']);
const diabetesCarbsPerServing: Record<Meal['mealType'], number> = { breakfast: 75, lunch: 75, dinner: 75, snack: 30 };
const taggable: Diet[] = [...plant, 'diabetes'];
function ingredient(key: string, name: string, group: IngredientDefinition['group'], categories: IngredientDefinition['categories'],
  aliases: string[], values: number[], diets: Diet[] = plant, allergens: Allergen[] = [], exclude: string[] = []): IngredientDefinition {
  const [calories, protein, carbohydrates, fat] = values;
  key=canonicalIngredientKey(key); const config=ingredientMappings[key];
  if (!highSugarIngredients.has(key)) diets = [...diets, 'diabetes'];
  aliases=config?.aliases??aliases; categories=config?.allowedCategories??categories; exclude=config?.blockedKeywords??exclude;
  return { key, name, group, categories, aliases, exclude, unit: 'g', nutritionPer100: { calories, protein, carbohydrates, fat }, diets, allergens };
}
export const ingredients: Record<string, IngredientDefinition> = Object.fromEntries([
  ingredient('chicken_ham', 'Chicken ham (cooked slices)', 'protein', ['meat'], ['chicken ham','hähnchenschinken'], [110,20,2,2.4], animal),
  ingredient('smoked_salmon', 'Smoked salmon', 'protein', ['fish'], ['smoked salmon','räucherlachs'], [180,22,0,10], [...animal,'pescatarian'], ['fish']),
  ingredient('beef_steak', 'Beef steak (raw)', 'protein', ['meat'], ['beef steak','rump steak','rindersteak'], [190,22,0,11], animal),
  ingredient('mushrooms', 'Button mushrooms', 'vegetables', ['vegetables','other'], ['mushrooms','champignons'], [22,3,3,0.3]),
  ingredient('chanterelles', 'Chanterelle mushrooms', 'vegetables', ['vegetables','other'], ['chanterelles','pfifferlinge'], [32,1.5,5,0.5]),
  ingredient('onion', 'Onion', 'vegetables', ['vegetables'], ['onion','zwiebeln'], [40,1,9,0.1]),
  { ...ingredient('soy_cream', 'Soy cooking cream', 'precise', ['dairy-alternatives','other'], ['soya cuisine','soy cooking cream','soja cuisine'], [150,2,3,14], plant, ['soy']), unit:'ml' as const },
  ingredient('parsley', 'Fresh parsley', 'precise', ['vegetables','other'], ['parsley','petersilie'], [36,3,6,0.8]),
  ingredient('dill', 'Fresh dill', 'precise', ['vegetables','other'], ['dill'], [43,3.5,7,1]),
  ingredient('pepper', 'Black pepper', 'precise', ['other'], ['black pepper','schwarzer pfeffer'], [251,10,64,3]),
  ingredient('dark_chocolate', 'Dairy-free dark chocolate', 'precise', ['snacks'], ['dark chocolate','zartbitterschokolade'], [600,7,35,48], plant),
  ingredient('noodles', 'Wheat noodles / spaghetti (dry)', 'staples', ['pasta'], ['spaghetti'], [350,12,70,2], plant.filter(d=>d!=='gluten_free'), ['wheat']),
  // Development reference per 100 ml: https://www.kikkoman.eu/products/detail/kikkoman-teriyaki-marinade
  { ...ingredient('teriyaki', 'Teriyaki marinade', 'precise', ['other'], ['teriyaki marinade'], [100,6,12,0], plant.filter(d=>d!=='gluten_free'), ['soy','wheat']), unit: 'ml' as const },
  ingredient('chicken', 'Chicken breast (raw)', 'protein', ['meat'], ['chicken breast', 'hähnchenbrust', 'haehnchenbrust'], [120,23,0,3], animal, [], ['breaded','nugget','cooked','smoked']),
  ingredient('turkey', 'Turkey breast (raw)', 'protein', ['meat'], ['turkey breast','putenbrust'], [114,24,0,1.5], animal, [], ['smoked','sliced','cooked']),
  ingredient('salmon', 'Salmon fillet (raw)', 'protein', ['fish'], ['salmon fillet','lachsfilet'], [208,20,0,13], [...animal,'pescatarian'], ['fish'], ['smoked','geräuchert','sauce']),
  ingredient('tuna', 'Tuna in water (drained)', 'protein', ['fish'], ['tuna in water','tuna in spring water','thunfisch im eigenen saft'], [116,26,0,1], [...animal,'pescatarian'], ['fish']),
  ingredient('tofu', 'Plain tofu', 'protein', ['legumes','dairy-alternatives','other'], ['tofu'], [144,16,2,8], plant, ['soy'], ['smoked','marinated','dessert','silken']),
  ingredient('eggs', 'Eggs (edible mass)', 'precise', ['eggs'], ['eggs','eier'], [143,13,1,10], [...animal,'vegetarian','pescatarian'], ['eggs']),
  ingredient('oats', 'Rolled oats (dry)', 'staples', ['breakfast','grains'], ['rolled oats','oat flakes','haferflocken'], [370,13,60,7], plant.filter(d=>d!=='gluten_free'), ['wheat'], ['granola','bar','muesli']),
  ingredient('rice', 'Rice (dry)', 'staples', ['grains'], ['rice','reis'], [360,7,79,1], plant, [], ['cooked','microwave','pudding','drink','cake','flour','risotto','ready']),
  ingredient('pasta', 'Pasta (dry)', 'staples', ['pasta'], ['pasta','spaghetti','penne','fusilli'], [350,12,70,2], plant.filter(d=>d!=='gluten_free'), ['wheat'], ['sauce','ready','cooked','filled','lasagn','tortell','ravioli']),
  ingredient('potatoes', 'Potatoes', 'staples', ['potatoes','vegetables'], ['potatoes','kartoffeln'], [77,2,17,0.1], plant, [], ['chips','crisps','fries','mashed','salad','salat','fried']),
  ingredient('lentils', 'Lentils (dry)', 'protein', ['legumes'], ['lentils','linsen'], [350,25,60,1.5], plant, [], ['cooked','canned','soup','sauce','ready']),
  ingredient('chickpeas', 'Chickpeas (drained)', 'protein', ['legumes'], ['chickpeas','kichererbsen'], [139,7,20,3], plant, [], ['flour','roasted','snack','hummus']),
  ingredient('broccoli', 'Broccoli', 'vegetables', ['vegetables'], ['broccoli','brokkoli'], [34,3,5,0.4], plant, [], ['sauce','soup','gratin']),
  ingredient('spinach', 'Spinach', 'vegetables', ['vegetables'], ['spinach','spinat'], [23,3,2,0.4], plant, [], ['cream','rahm','sauce']),
  ingredient('tomatoes', 'Chopped tomatoes', 'vegetables', ['vegetables'], ['chopped tomatoes','diced tomatoes','gehackte tomaten'], [22,1,4,0.2]),
  ingredient('cherry_tomatoes', 'Fresh cherry tomatoes', 'vegetables', ['vegetables'], ['cherry tomatoes','cherrytomaten'], [18,0.9,3.9,0.2]),
  ingredient('sourdough_bread', 'Sourdough bread', 'staples', ['bread'], ['sourdough bread','sauerteigbrot'], [250,9,48,1.5], plant.filter(d=>d!=='gluten_free'), ['wheat']),
  ingredient('carrots', 'Carrots', 'vegetables', ['vegetables'], ['carrots','karotten','möhren'], [41,1,9,0.2], plant, [], ['juice','cake','soup']),
  ingredient('berries', 'Berries', 'fruit', ['fruit'], ['blueberries','blaubeeren','mixed berries','beerenmischung','strawberries','erdbeeren'], [50,1,11,0.4], plant, [], ['dried','jam','syrup','confiture','getrocknet']),
  ingredient('banana', 'Banana', 'fruit', ['fruit'], ['banana','bananen'], [89,1,23,0.3], plant, [], ['chips','dried','juice','puree','powder']),
  ingredient('apple', 'Apple', 'fruit', ['fruit'], ['apples','äpfel'], [52,0.3,14,0.2], plant, [], ['dried','sauce','juice','chips']),
  ingredient('bread', 'Wholemeal bread', 'staples', ['bread'], ['wholemeal bread','whole wheat bread','vollkornbrot'], [240,10,40,4], plant.filter(d=>d!=='gluten_free'), ['wheat'], ['sweet','raisins']),
  ingredient('yogurt', 'Plain Greek yogurt', 'protein', ['dairy'], ['greek yogurt','greek yoghurt','griechischer joghurt'], [73,10,4,2], ['vegetarian','pescatarian','gluten_free'], ['milk']),
  ingredient('cottage', 'Cottage cheese', 'protein', ['dairy'], ['cottage cheese','hüttenkäse'], [98,12,3,4], ['vegetarian','pescatarian','gluten_free'], ['milk']),
  ingredient('oil', 'Olive oil', 'oil', ['other'], ['olive oil','olivenöl'], [884,0,0,100]),
].map(i=>[i.key,i]));
// Non-enumerable aliases keep saved Phase 3B meal snapshots readable.
for(const [old,key] of Object.entries(legacyIngredientKeys))Object.defineProperty(ingredients,old,{value:ingredients[key],enumerable:false});
function meal(id: string, name: string, mealType: Meal['mealType'], amounts: [string,number][]): Meal {
  // Season savory meals; sweet breakfasts and snacks keep their original ingredients.
  if (mealType !== 'snack' && !['oat-berries','yogurt-fruit','overnight-oats','cottage-bowl'].includes(id)) {
    amounts = [...amounts, [id==='salmon-egg-toast'?'dill':'parsley',3], ['pepper',0.2]];
  }
  const totals = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
  for (const [key,q] of amounts) for (const field of Object.keys(totals) as (keyof typeof totals)[]) totals[field] += ingredients[key].nutritionPer100[field]*q/100;
  return { id, name, mealType, servings: 1, caloriesPerServing: totals.calories, proteinPerServing: totals.protein,
    carbohydratesPerServing: totals.carbohydrates, fatPerServing: totals.fat,
    dietaryTags: taggable.filter(d=>amounts.every(([key])=>ingredients[key].diets.includes(d)) &&
      (d!=='diabetes' || totals.carbohydrates<=diabetesCarbsPerServing[mealType])),
    allergens: [...new Set(amounts.flatMap(([key])=>ingredients[key].allergens))],
    ingredients: amounts.map(([key,quantity])=>{const i=ingredients[key], [min,max]=quantityTolerances[i.group];
      return { ingredientKey:i.key, ingredientName:i.name, quantity, unit:i.unit, flexible:min!==0||max!==0,
        minAdjustmentPercent:min, maxAdjustmentPercent:max, category:i.group };}),
    nutritionSource:'curated-development-estimate', createdAt:'2026-09-06T00:00:00Z',updatedAt:'2026-09-06T00:00:00Z' };
}
export const meals: Meal[] = [
  meal('oat-berries','Oatmeal with berries','breakfast',[['oats',70],['berries',150],['banana',100]]),
  meal('chicken-ham-toast','Egg and chicken-ham toast','breakfast',[['eggs',100],['bread',60],['chicken_ham',50]]),
  meal('salmon-egg-toast','Smoked salmon and soft egg toast','breakfast',[['smoked_salmon',60],['eggs',100],['bread',60]]),
  meal('sunny-side-toast','Sunny-side-up eggs on sourdough with cherry tomatoes and greens','breakfast',[['eggs',100],['sourdough_bread',70],['cherry_tomatoes',100],['spinach',30],['oil',5]]),
  meal('yogurt-fruit','Yogurt fruit breakfast','breakfast',[['yogurt',250],['oats',50],['berries',120]]),
  meal('overnight-oats','Overnight oats with banana (water-based)','breakfast',[['oats',80],['banana',120],['berries',100]]),
  meal('scrambled-eggs','Scrambled eggs with vegetables','breakfast',[['eggs',180],['spinach',100],['potatoes',180],['oil',5]]),
  meal('cottage-bowl','Cottage-cheese apple bowl','breakfast',[['cottage',220],['apple',150],['oats',50]]),
  meal('tofu-breakfast','Tofu potato scramble','breakfast',[['tofu',200],['potatoes',180],['spinach',100],['oil',5]]),
  meal('lentil-breakfast','Savory lentil breakfast bowl','breakfast',[['lentils',80],['tomatoes',150],['spinach',100],['oil',5]]),
  meal('chicken-potato','Chicken potato bowl','lunch',[['chicken',180],['potatoes',300],['broccoli',150],['oil',10]]),
  meal('salmon-rice','Salmon rice bowl','dinner',[['salmon',150],['rice',75],['broccoli',180],['oil',5]]),
  meal('lentil-pasta','Lentil pasta bowl','lunch',[['lentils',60],['pasta',65],['tomatoes',200],['oil',5]]),
  meal('tofu-teriyaki-noodles','Tofu teriyaki noodles','dinner',[['tofu',200],['noodles',70],['broccoli',150],['carrots',100],['oil',5],['teriyaki',15]]),
  meal('chickpea-salad','Chickpea potato salad','lunch',[['chickpeas',220],['potatoes',150],['tomatoes',150],['oil',10]]),
  meal('turkey-pasta','Turkey pasta','dinner',[['turkey',180],['pasta',80],['tomatoes',180],['oil',10]]),
  meal('tuna-potato','Tuna potato salad','lunch',[['tuna',150],['potatoes',300],['carrots',150],['oil',10]]),
  meal('chicken-rice','Rice with chicken and vegetables','dinner',[['chicken',180],['rice',80],['broccoli',150],['oil',8]]),
  meal('lentil-curry','Simple lentil curry bowl','dinner',[['lentils',90],['rice',50],['tomatoes',150],['spinach',100],['oil',8]]),
  meal('tuna-pasta','Pasta with tomato and tuna','dinner',[['tuna',150],['pasta',85],['tomatoes',180],['oil',8]]),
  meal('vegan-protein','Vegan protein bowl','lunch',[['tofu',180],['lentils',60],['broccoli',150],['oil',5]]),
  meal('chicken-lentils','Chicken lentil bowl','lunch',[['chicken',150],['lentils',65],['carrots',150],['oil',8]]),
  meal('salmon-potato','Salmon with potatoes and spinach','dinner',[['salmon',150],['potatoes',280],['spinach',150],['oil',5]]),
  meal('eggs-rice','Egg and vegetable rice','lunch',[['eggs',150],['rice',80],['carrots',150],['oil',5]]),
  meal('chickpea-rice','Chickpea rice bowl','dinner',[['chickpeas',200],['rice',65],['spinach',150],['oil',8]]),
  meal('tofu-pasta','Tofu tomato pasta','lunch',[['tofu',180],['pasta',75],['tomatoes',180],['oil',5]]),
  meal('steak-greens','Steak with potatoes and spinach','dinner',[['beef_steak',160],['potatoes',220],['spinach',100],['oil',8]]),
  meal('chicken-stroganoff','Chicken Stroganoff with noodles','dinner',[['chicken',180],['noodles',65],['mushrooms',100],['onion',40],['soy_cream',70],['oil',5]]),
  meal('steak-chanterelles','Steak with chanterelle sauce and potatoes','dinner',[['beef_steak',150],['potatoes',200],['chanterelles',100],['onion',30],['soy_cream',50],['oil',5]]),
  meal('snack-apple-berries','Apple and berry snack','snack',[['apple',150],['berries',80]]),
  meal('snack-yogurt','Yogurt and berry snack','snack',[['yogurt',150],['berries',60]]),
  meal('snack-banana-chocolate','Banana and dark chocolate','snack',[['banana',60],['dark_chocolate',10]]),
];
