require('./register.cjs');
const { products } = require('../data/products.ts');
const { defaultDraft } = require('../types/preferences.ts');
const prefs = (patch = {}) => ({ ...defaultDraft, dailyCalories: 1700, id: null, userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', onboardingCompleted: true, createdAt: '2026-09-06', updatedAt: '2026-09-06', ...patch });
const product = (i, patch = {}) => ({ ...products[0], id: `00000000-0000-0000-0000-${String(i).padStart(12,'0')}`, name: `Fixture ${i}`, source: 'manual', category: 'grains',
  packageSize: 500, packageUnit: 'g', nutritionBasis: '100g', caloriesPer100g: 350, proteinPer100g: 10, carbohydratesPer100g: 65, fatPer100g: 5,
  fiberPer100g: 4, sugarsPer100g: 2, saltPer100g: 0.1, vegetarian: true, vegan: true, lactoseFree: true, glutenFree: true,
  allergens: [], mayContainAllergens: [], ingredientsText: 'Fixture ingredients', allergenInfoAvailable: true, labels: [], priceEstimate: 2, priceKind: 'estimate', ...patch });
const catalog = [
  product(1, { name: 'Oats', category: 'breakfast', caloriesPer100g: 370, proteinPer100g: 13, carbohydratesPer100g: 60, fatPer100g: 7 }),
  product(2, { name: 'Brown rice', priceEstimate: 1.5 }),
  product(3, { name: 'Bananas', category: 'fruit', packageSize: 1000, caloriesPer100g: 89, proteinPer100g: 1, carbohydratesPer100g: 23, fatPer100g: 0.3 }),
  product(4, { name: 'Broccoli', category: 'vegetables', packageSize: 500, caloriesPer100g: 34, proteinPer100g: 3, carbohydratesPer100g: 7, fatPer100g: 0.4, priceEstimate: 1.2 }),
  product(5, { name: 'Chicken', category: 'meat', caloriesPer100g: 120, proteinPer100g: 23, carbohydratesPer100g: 0, fatPer100g: 3, vegan: false, vegetarian: false, priceEstimate: 4 }),
  product(6, { name: 'Tofu', category: 'legumes', packageSize: 400, caloriesPer100g: 150, proteinPer100g: 16, carbohydratesPer100g: 3, fatPer100g: 9, allergens: ['soy'], priceEstimate: 2.5 }),
  product(7, { name: 'Yogurt', category: 'dairy', caloriesPer100g: 60, proteinPer100g: 8, carbohydratesPer100g: 4, fatPer100g: 2, vegan: false, lactoseFree: false, allergens: ['milk'] }),
  product(8, { name: 'Lentils', category: 'legumes', caloriesPer100g: 340, proteinPer100g: 24, carbohydratesPer100g: 52, fatPer100g: 2, priceEstimate: 1.8 }),
  product(9, { name: 'Bread', category: 'bread', caloriesPer100g: 240, proteinPer100g: 10, carbohydratesPer100g: 40, fatPer100g: 4 }),
  product(10, { name: 'Apples', category: 'fruit', packageSize: 1000, caloriesPer100g: 52, proteinPer100g: 0.3, carbohydratesPer100g: 14, fatPer100g: 0.2 }),
];
module.exports = { prefs, product, catalog };
