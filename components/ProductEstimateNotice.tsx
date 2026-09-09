import { Text } from 'react-native';
import type { Product } from '../types/product';
import { ui } from '../lib/theme';
export function ProductEstimateNotice({ product }: { product: Product }) {
  const fields = product.labels.filter(label => label.startsWith('smartbasket:demo:')).map(label => label.slice('smartbasket:demo:'.length));
  if (!fields.length) return null;
  const nutrition = fields.some(field => field.endsWith('100g'));
  const quantity = fields.includes('package_size');
  return <Text style={ui.caption}>Demo estimate: {[nutrition ? 'some nutrition values' : '', quantity ? 'package size' : ''].filter(Boolean).join(' and ')}. Not verified manufacturer data.</Text>;
}
