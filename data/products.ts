import type { Product } from '../types/product';

// Fictional brands and illustrative EUR package prices, not retailer offers.
// Nutrition is per 100 g of the product, not per package or serving.
const base = {
  externalId: null, barcode: null, imageUrl: null, currency: 'EUR',
  allergens: [], labels: [], vegetarian: true, vegan: true, lactoseFree: true,
  source: 'mock',
} satisfies Partial<Product>;

export const products: readonly Product[] = [
  { ...base, id: 'oats', name: 'Wholegrain oats', brand: 'Morning Mill', category: 'Grains', imagePlaceholder: '🌾', packageLabel: '500 g', priceEstimate: 1.29, caloriesPer100g: 372, proteinPer100g: 13.5, carbohydratesPer100g: 58.7, fatPer100g: 7, allergens: ['gluten'], labels: ['Wholegrain', 'Vegan'] },
  { ...base, id: 'banana', name: 'Bananas', brand: 'Fresh Picks', category: 'Fruit', imagePlaceholder: '🍌', packageLabel: '1 kg', priceEstimate: 1.89, caloriesPer100g: 89, proteinPer100g: 1.1, carbohydratesPer100g: 22.8, fatPer100g: 0.3, labels: ['Vegan', 'Lactose-free'] },
  { ...base, id: 'broccoli', name: 'Broccoli', brand: 'Fresh Picks', category: 'Vegetables', imagePlaceholder: '🥦', packageLabel: '500 g', priceEstimate: 1.69, caloriesPer100g: 34, proteinPer100g: 2.8, carbohydratesPer100g: 6.6, fatPer100g: 0.4, labels: ['Vegan', 'Lactose-free'] },
  { ...base, id: 'chicken', name: 'Chicken breast', brand: 'Farm Table', category: 'Meat', imagePlaceholder: '🍗', packageLabel: '400 g', priceEstimate: 4.99, caloriesPer100g: 110, proteinPer100g: 23, carbohydratesPer100g: 0, fatPer100g: 1.2, vegetarian: false, vegan: false, labels: ['High protein', 'Lactose-free'] },
  { ...base, id: 'tofu', name: 'Natural tofu', brand: 'Green Kitchen', category: 'Plant protein', imagePlaceholder: '🧊', packageLabel: '200 g', priceEstimate: 1.79, caloriesPer100g: 144, proteinPer100g: 15.7, carbohydratesPer100g: 2.8, fatPer100g: 8.7, allergens: ['soy'], labels: ['High protein', 'Vegan'] },
  { ...base, id: 'rice', name: 'Brown rice', brand: 'Pantry & Co.', category: 'Grains', imagePlaceholder: '🍚', packageLabel: '1 kg', priceEstimate: 2.49, caloriesPer100g: 370, proteinPer100g: 7.9, carbohydratesPer100g: 77.2, fatPer100g: 2.9, labels: ['Wholegrain', 'Vegan'] },
  { ...base, id: 'eggs', name: 'Free-range eggs', brand: 'Farm Table', category: 'Eggs & dairy', imagePlaceholder: '🥚', packageLabel: '6 eggs', priceEstimate: 2.29, caloriesPer100g: 143, proteinPer100g: 12.6, carbohydratesPer100g: 0.7, fatPer100g: 9.5, allergens: ['eggs'], vegan: false, labels: ['High protein', 'Lactose-free'] },
  { ...base, id: 'yogurt', name: 'Lactose-free yogurt', brand: 'Daily Spoon', category: 'Eggs & dairy', imagePlaceholder: '🥛', packageLabel: '400 g', priceEstimate: 1.99, caloriesPer100g: 62, proteinPer100g: 4.5, carbohydratesPer100g: 5.2, fatPer100g: 2.5, allergens: ['milk'], vegan: false, labels: ['Lactose-free', 'Vegetarian'] },
  { ...base, id: 'lentils', name: 'Red lentils', brand: 'Pantry & Co.', category: 'Plant protein', imagePlaceholder: '🫘', packageLabel: '500 g', priceEstimate: 1.79, caloriesPer100g: 352, proteinPer100g: 24.6, carbohydratesPer100g: 63.4, fatPer100g: 1.1, labels: ['High protein', 'Vegan'] },
  { ...base, id: 'avocado', name: 'Avocado', brand: 'Fresh Picks', category: 'Fruit', imagePlaceholder: '🥑', packageLabel: '1 piece', priceEstimate: 1.19, caloriesPer100g: 160, proteinPer100g: 2, carbohydratesPer100g: 8.5, fatPer100g: 14.7, labels: ['Vegan', 'Lactose-free'] },
];
