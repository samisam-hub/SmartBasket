import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { formatQuantity, type Quantity, type UnitSystem } from '../services/units';
import { colors, radii, spacing, typography, ui } from '../lib/theme';

/** One line of the shopping list. The tick is the whole point of the row, so it gets the biggest
 *  target; a line the household added itself can also be taken off again. */
export function ShoppingLineRow({ name, quantity, note, system, ticked, onTick, onRemove }: {
  name: string;
  /** Missing on a line the household typed: it said what it wanted, not how the app measures it. */
  quantity?: Quantity;
  note?: string | null;
  system: UnitSystem;
  ticked: boolean;
  onTick: () => void;
  onRemove?: () => void;
}) {
  const amount = quantity ? formatQuantity(quantity, system) : note?.trim() || null;
  return <View style={[styles.row, ticked && styles.done]}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ticked }}
      accessibilityLabel={`${name}${amount ? `, ${amount}` : ''}, ${ticked ? 'in the trolley' : 'still to buy'}`}
      onPress={onTick} style={({ pressed }) => [styles.target, pressed && { opacity: 0.6 }]}>
      <View style={[styles.box, ticked && styles.boxOn]}>
        {ticked && <Feather name="check" size={18} color={colors.onPrimary} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={2} style={[styles.name, ticked && styles.nameDone]}>{name}</Text>
        {amount && <Text numberOfLines={1} style={ui.small}>{amount}</Text>}
      </View>
    </Pressable>
    {onRemove && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name}`}
      onPress={onRemove} style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}>
      <Feather name="x" size={18} color={colors.muted} />
    </Pressable>}
  </View>;
}
const styles = {
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.surface,
    borderRadius: radii.large, borderWidth: 1, borderColor: colors.border },
  done: { backgroundColor: colors.pale },
  target: { flex: 1, minWidth: 0, flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: spacing.md, paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: spacing.md, minHeight: 60 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surface },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  name: { ...typography.body, fontWeight: '600' as const, color: colors.ink },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through' as const },
  remove: { width: 44, minHeight: 60, alignItems: 'center' as const, justifyContent: 'center' as const },
};
