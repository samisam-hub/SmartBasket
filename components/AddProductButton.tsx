import { useState } from 'react';
import { View, Text } from 'react-native';
import type { Product } from '../types/product';
import { useActiveBasket } from '../context/ActiveBasketContext';
import { SecondaryButton } from './ui';
import { ui } from '../lib/theme';
export function AddProductButton({ product }: { product: Product }) {
  const { active, add, busy } = useActiveBasket();
  const [message, setMessage] = useState<string | null>(null);
  return <View style={{ gap: 4 }}>
    <SecondaryButton label="+ Add to basket" disabled={!active || busy} onPress={() => {
      setMessage(null); void add(product).then(setMessage).catch(e => setMessage(e.message));
    }} />
    {!active && <Text style={ui.caption}>Open a basket first to add products.</Text>}
    {message && <Text accessibilityLiveRegion="polite" style={ui.caption}>{message}</Text>}
  </View>;
}
