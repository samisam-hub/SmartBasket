import { t } from '../services/i18n';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { ProductImage } from './ProductImage';
import { colors, radii, spacing, typography, ui } from '../lib/theme';

/** One line of a shopping list: what to buy, how much, and whether it is already in the trolley.
 *  The tick is its own target, the rest of the line opens what is known about the product. The
 *  picture stays on the right, where the basket has always shown it. */
export function BasketItemRow({ name, quantity, price, image, ticked, expanded, onTick, onToggle, flagged, children }: {
  name: string;
  quantity: string;
  price: string | null;
  image: { uri: string | null; width: number | null; height: number | null };
  ticked: boolean;
  expanded: boolean;
  onTick: () => void;
  onToggle: () => void;
  /** Something about this product is unverified, so the line says so rather than hiding it. */
  flagged?: boolean;
  children?: ReactNode;
}) {
  return <View style={[styles.row, ticked && styles.rowTicked]}>
    <View style={styles.line}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ticked }}
        accessibilityLabel={`${name}, ${ticked ? t('row.inTrolley') : t('row.toBuy')}`}
        onPress={onTick} style={({ pressed }) => [styles.tickTarget, pressed && { opacity: 0.6 }]}>
        <View style={[styles.tick, ticked && styles.tickOn]}>
          {ticked && <Feather name="check" size={18} color={colors.onPrimary} />}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
        accessibilityLabel={`${name}, ${quantity}${price ? `, ${price}` : ''}`}
        accessibilityHint={t('itemRow.toggle')}
        onPress={onToggle} style={({ pressed }) => [styles.body, pressed && { opacity: 0.7 }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={2} style={[styles.name, ticked && styles.nameTicked]}>{name}</Text>
          <Text numberOfLines={1} style={ui.small}>{price ? `${quantity} · ${price}` : quantity}</Text>
        </View>
        {flagged && <Feather name="alert-triangle" size={16} color={colors.warning} />}
        <View style={styles.thumb}>
          <ProductImage uri={image.uri} width={image.width} height={image.height} name={name} />
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
      </Pressable>
    </View>
    {expanded && <View style={styles.details}>{children}</View>}
  </View>;
}
const styles = {
  row: { backgroundColor: colors.surface, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border },
  rowTicked: { backgroundColor: colors.pale },
  line: { flexDirection: 'row' as const, alignItems: 'center' as const },
  tickTarget: { width: 52, minHeight: 64, alignItems: 'center' as const, justifyContent: 'center' as const },
  tick: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surface },
  tickOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  body: { flex: 1, minWidth: 0, flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: spacing.sm, paddingRight: spacing.md, paddingVertical: spacing.sm, minHeight: 64 },
  name: { ...typography.body, fontWeight: '600' as const, color: colors.ink },
  nameTicked: { color: colors.muted, textDecorationLine: 'line-through' as const },
  thumb: { width: 48, height: 48, borderRadius: radii.medium, overflow: 'hidden' as const,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.pale },
  details: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
};
