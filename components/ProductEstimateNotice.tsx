import { t } from '../services/i18n';
import { Text } from 'react-native';
import type { Product } from '../types/product';
import { ui } from '../lib/theme';
export function ProductEstimateNotice({ product }: { product: Product }) {
  const fields = product.labels.filter(label => label.startsWith('smartbasket:demo:')).map(label => label.slice('smartbasket:demo:'.length));
  if (!fields.length) return null;
  const nutrition = fields.some(field => field.endsWith('100g'));
  const quantity = fields.includes('package_size');
  return <Text style={ui.caption}>{t('estimate.demo', { parts: [nutrition ? t('estimate.someNutrition') : '', quantity ? t('estimate.packageSize') : ''].filter(Boolean).join(t('estimate.and')) })}</Text>;
}
