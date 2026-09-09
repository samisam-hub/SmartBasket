import type { Product } from './product';
import type { SavedBasket } from './basket';
export interface PantryLot {
  id: string; product: Product; ingredientKey: string | null; quantity: number; unit: 'g' | 'ml';
  purchasedAt: string; basketId: string;
}
export interface PantryUse { lotId: string; ingredientKey: string; name: string; quantity: number; unit: 'g' | 'ml' }
export interface Purchase { basketId: string; purchasedAt: string; basket: SavedBasket }
export interface PantryState { version: number; lots: PantryLot[] }
