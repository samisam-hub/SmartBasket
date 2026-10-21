import { useState } from 'react';
import { Platform, Share, Text } from 'react-native';
import type { SavedBasket } from '../types/basket';
import { shoppingListText, shoppingRows } from '../services/basket/shopping-list';
import { basketDisplayName } from '../services/basket/naming';
import { SecondaryButton } from './ui';
import { ui } from '../lib/theme';

/** Sharing remains available without rendering a second shopping list. */
export function ShareBasket({ basket }: { basket: SavedBasket }) {
  const [copy, setCopy] = useState(false), [sharing, setSharing] = useState(false);
  const text = shoppingListText(basketDisplayName(basket), shoppingRows(basket.result).filter(row => !row.missing), {});
  const share = async () => {
    setSharing(true); setCopy(false);
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: 'Basket', text });
        else setCopy(true);
      } else await Share.share({ title: 'Basket', message: text });
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) setCopy(true);
    } finally { setSharing(false); }
  };
  return <>
    <SecondaryButton label="Share basket" disabled={sharing || !basket.result.items.length} onPress={() => { void share(); }} />
    {copy && <><Text style={ui.small}>Select and copy your selected products:</Text><Text selectable style={ui.body}>{text}</Text></>}
  </>;
}
