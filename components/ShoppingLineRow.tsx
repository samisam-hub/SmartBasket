import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { editableQuantity, quantityFromInput, type Quantity, type UnitSystem } from '../services/units';
import { colors, radii, spacing, typography } from '../lib/theme';
import { formatMoney, t } from '../services/i18n';

/** One line of the shopping list, read like a row of a spreadsheet: what to buy, how much, what
 *  it costs, and the tick at the end, where a thumb reaches it and where ticking one off does not
 *  shift the names. The amount is a field, not a label — a household knows better than the plan
 *  whether it wants a kilo of potatoes this week, and correcting it here beats cooking around it.
 *  A line the household typed itself has no amount to compute with and keeps its own note. */
export function ShoppingLineRow({ name, quantity, note, price, system, ticked, onTick, onAmount, onRemove }: {
  name: string;
  /** Missing on a line the household typed: it said what it wanted, not how the app measures it. */
  quantity?: Quantity;
  note?: string | null;
  /** About what this costs at usual supermarket prices; absent when nothing priced it. */
  price?: number | null;
  system: UnitSystem;
  ticked: boolean;
  onTick: () => void;
  /** Takes the corrected amount in grams or millilitres, whatever units it was typed in. */
  onAmount?: (amount: number) => void;
  onRemove?: () => void;
}) {
  const field = quantity ? editableQuantity(quantity, system) : null;
  const [typed, setTyped] = useState(field ? String(field.value) : '');
  // An amount changed elsewhere — a fresh list, a correction undone — is shown; typing is not
  // interrupted, so the field only follows while it is not being edited.
  const shown = useRef(field?.value);
  const editing = useRef(false);
  useEffect(() => {
    if (editing.current || !field || Object.is(field.value, shown.current)) return;
    shown.current = field.value;
    setTyped(String(field.value));
  }, [field]);
  const commit = () => {
    editing.current = false;
    if (!field || !quantity || !onAmount) return;
    const value = Number(typed.trim().replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) { setTyped(String(field.value)); return; }
    shown.current = value;
    onAmount(quantityFromInput(value, quantity.unit, system));
  };
  return <View style={[styles.row, ticked && styles.done]}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ticked }} accessibilityLabel={name}
      onPress={onTick} style={styles.nameCell}>
      <Text numberOfLines={1} style={[styles.name, ticked && styles.nameDone]}>{name}</Text>
    </Pressable>
    {/* A line somebody typed has no amount to compute with, so what they wrote stands where the
      * amount stands on every other line: one row, same columns. */}
    {!field && <Text numberOfLines={1} style={[styles.own, ticked && styles.nameDone]}>{note?.trim() ?? ''}</Text>}
    {field && <View style={styles.amountCell}>
      <TextInput value={typed} onChangeText={setTyped} onFocus={() => { editing.current = true; }}
        onBlur={commit} onSubmitEditing={commit} keyboardType="decimal-pad" maxLength={6}
        editable={!!onAmount} selectTextOnFocus accessibilityLabel={t('row.amountOf', { name })}
        style={[styles.amount, ticked && styles.nameDone]} />
      <Text style={styles.unit}>{field.label}</Text>
    </View>}
    <Text numberOfLines={1} style={[styles.price, ticked && styles.nameDone]}>
      {typeof price === 'number' ? formatMoney(price) : '—'}
    </Text>
    {onRemove && <Pressable accessibilityRole="button" accessibilityLabel={t('row.remove', { name })}
      onPress={onRemove} style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}>
      <Feather name="x" size={16} color={colors.muted} />
    </Pressable>}
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ticked }}
      accessibilityLabel={t('row.state', { name, amount: field ? `, ${field.value} ${field.label}` : '',
        state: t(ticked ? 'row.inTrolley' : 'row.toBuy') })}
      onPress={onTick} style={({ pressed }) => [styles.tick, pressed && { opacity: 0.6 }]}>
      <View style={[styles.box, ticked && styles.boxOn]}>
        {ticked && <Feather name="check" size={16} color={colors.onPrimary} />}
      </View>
    </Pressable>
  </View>;
}
/** The empty row at the end of the list: the same shape as every line above it, so adding
 *  something reads as writing the next line rather than filling in a form. What goes where is
 *  said inside the fields; there is nothing else to look at. */
export function ShoppingDraftRow({ name, amount, onName, onAmount, onAdd }: {
  name: string;
  amount: string;
  onName: (text: string) => void;
  onAmount: (text: string) => void;
  onAdd: () => void;
}) {
  return <View style={[styles.row, styles.draft]}>
    <TextInput value={name} onChangeText={onName} onSubmitEditing={onAdd} returnKeyType="done"
      placeholder={t('basket.addWhat')} placeholderTextColor={colors.muted} maxLength={80}
      accessibilityLabel={t('basket.addWhat')} style={[styles.name, styles.nameCell, styles.field]} />
    <TextInput value={amount} onChangeText={onAmount} onSubmitEditing={onAdd} returnKeyType="done"
      placeholder={t('basket.addAmount')} placeholderTextColor={colors.muted} maxLength={40}
      accessibilityLabel={t('basket.addAmount')} style={[styles.amount, styles.draftAmount]} />
    <Pressable accessibilityRole="button" accessibilityLabel={t('basket.add')} onPress={onAdd}
      style={({ pressed }) => [styles.tick, pressed && { opacity: 0.6 }]}>
      <View style={[styles.box, styles.boxEmpty]}>
        <Feather name="plus" size={16} color={colors.primary} />
      </View>
    </Pressable>
  </View>;
}
const styles = {
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.surface,
    borderRadius: radii.medium, borderWidth: 1, borderColor: colors.border, minHeight: 48, gap: 4 },
  done: { backgroundColor: colors.pale },
  tick: { paddingLeft: spacing.xs, paddingRight: spacing.sm, paddingVertical: spacing.sm },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surface },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  nameCell: { flex: 1, minWidth: 0, paddingVertical: spacing.sm, paddingLeft: spacing.sm },
  name: { ...typography.body, fontWeight: '600' as const, color: colors.ink },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through' as const },
  amountCell: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, flexGrow: 0, flexShrink: 0 },
  amount: { ...typography.small, color: colors.ink, textAlign: 'right' as const, width: 52, flexGrow: 0,
    paddingVertical: 4, paddingHorizontal: 4, borderRadius: radii.small, borderWidth: 1, borderColor: colors.border },
  unit: { ...typography.small, color: colors.muted, width: 22 },
  price: { ...typography.small, color: colors.ink, textAlign: 'right' as const, width: 56 },
  remove: { width: 32, minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  own: { ...typography.small, color: colors.muted, textAlign: 'right' as const, width: 86 },
  draft: { borderStyle: 'dashed' as const },
  boxEmpty: { borderColor: colors.border, opacity: 0.6 },
  field: { paddingVertical: 4, paddingRight: 4, paddingLeft: spacing.sm },
  draftAmount: { width: 96, textAlign: 'left' as const, borderWidth: 0 },
};
