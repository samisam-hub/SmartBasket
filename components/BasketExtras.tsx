import { formatEuro } from '../lib/german';
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { BasketGenerationResult } from '../types/basket';
import type { Product } from '../types/product';
import type { UserPreferences } from '../types/preferences';
import { addableProducts, stapleSuggestions } from '../services/basket/extras';
import { SearchInput, SectionCard, TextButton } from './ui';
import { ui } from '../lib/theme';

const label = (product: Product) =>
  `${product.name}${product.brand ? ` · ${product.brand}` : ''}${product.priceEstimate === null ? '' : ` · Ca. ${formatEuro(product.priceEstimate)}`}`;

/** Anything the household wants on top of the plan. Extras are bought, never cooked into a meal:
 *  they add no portions and no nutrition to the plan. */
export function BasketExtras({ result, catalog, preferences, onAdd }: {
  result: BasketGenerationResult;
  catalog: Product[];
  preferences?: UserPreferences;
  onAdd: (product: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = addableProducts(catalog, query);
  const staples = preferences ? stapleSuggestions(catalog, preferences, result) : [];
  return <SectionCard title="Weitere Produkte hinzufügen">
    <SearchInput value={query} onChangeText={setQuery} />
    {query.trim().length >= 2 && !matches.length && <Text style={ui.small}>

      Im Katalog gibt es dafür kein passendes Produkt mit verwendbarer Packungsgröße.
    </Text>}
    {matches.map(product => <TextButton key={product.id} label={label(product)} onPress={() => onAdd(product)} />)}
    {!!staples.length && <>
      <Text style={ui.subheading}>Immer dabei</Text>
      <View style={{ gap: 4 }}>
        {staples.map(staple => <TextButton key={staple.key} label={label(staple.product)} onPress={() => onAdd(staple.product)} />)}
      </View>
      <Text style={ui.small}>Vorerst eine feste Liste. Deine regelmäßig gekauften Produkte werden noch nicht automatisch erkannt.</Text>
    </>}
    <Text style={ui.small}>Extras ergänzen nur deinen Einkauf. Sie verändern weder Mahlzeitenportionen noch geplante Nährwerte.</Text>
  </SectionCard>;
}
