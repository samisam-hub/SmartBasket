import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { editableQuantity, formatQuantity, quantityFromInput, type Quantity, type UnitSystem } from '../services/units';
import { colors, radii, spacing, typography } from '../lib/theme';
import { formatMoney, t } from '../services/i18n';

/** One line while the list is still being worked through: what to buy, how much, what it costs,
 *  and a round minus outside the card to take it out again — because the first thing a household
 *  does with a generated list is strike out what is already in the cupboard. There is no tick
 *  here: nothing is being bought yet. The amount is a field, not a label, because a household
 *  knows better than the plan whether it wants a kilo of potatoes this week.
 *  A line the household typed itself has no amount to compute with and keeps its own note. */
export function ShoppingLineRow({ name, quantity, tin, note, price, system, onAmount, onRemove }: {
  name: string;
  /** Missing on a line the household typed: it said what it wanted, not how the app measures it. */
  quantity?: Quantity;
  /** How much is in one tin, when this is sold only by the tin: then it is counted in tins. */
  tin?: number | null;
  note?: string | null;
  /** About what this costs at usual supermarket prices; absent when nothing priced it. */
  price?: number | null;
  system: UnitSystem;
  /** Takes the corrected amount in grams or millilitres, whatever units it was typed in. */
  onAmount?: (amount: number) => void;
  onRemove?: () => void;
}) {
  const field = quantity ? editableQuantity(quantity, system, tin) : null;
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
    onAmount(quantityFromInput(value, quantity.unit, system, tin));
  };
  return <View style={styles.line}>
    <View style={styles.row}>
      <Text numberOfLines={1} style={[styles.name, styles.nameCell]}>{name}</Text>
      {/* A line somebody typed has no amount to compute with, so what they wrote stands where the
        * amount stands on every other line: one row, same columns. */}
      {!field && <Text numberOfLines={1} style={styles.own}>{note?.trim() ?? ''}</Text>}
      {field && <View style={styles.amountCell}>
        <TextInput value={typed} onChangeText={setTyped} onFocus={() => { editing.current = true; }}
          onBlur={commit} onSubmitEditing={commit} keyboardType="decimal-pad" maxLength={6}
          editable={!!onAmount} selectTextOnFocus accessibilityLabel={t('row.amountOf', { name })}
          style={styles.amount} />
        <Text numberOfLines={1} style={styles.unit}>{field.label}</Text>
      </View>}
      <Text numberOfLines={1} style={[styles.price, styles.priceEdge]}>
        {typeof price === 'number' ? formatMoney(price) : '—'}
      </Text>
    </View>
    {onRemove && <Pressable accessibilityRole="button" accessibilityLabel={t('row.remove', { name })}
      onPress={onRemove} style={({ pressed }) => [styles.minusCell, pressed && { opacity: 0.6 }]}>
      <View style={styles.minus}><Feather name="minus" size={16} color={colors.primary} /></View>
    </Pressable>}
  </View>;
}
/** One line of a list that is being shopped: the same columns, read-only, with the tick at the
 *  end where a thumb reaches it and where ticking one off does not shift the names. Lines sit in
 *  one card under their shelf heading, so twice as many fit on a screen as while editing. */
export function ShoppingLineTicked({ name, quantity, tin, note, price, system, ticked, onTick }: {
  name: string;
  quantity?: Quantity;
  tin?: number | null;
  note?: string | null;
  price?: number | null;
  system: UnitSystem;
  ticked: boolean;
  onTick: () => void;
}) {
  const amount = quantity ? formatQuantity(quantity, system, tin) : note?.trim() ?? '';
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ticked }} aria-checked={ticked}
    accessibilityLabel={t('row.state', { name, amount: amount ? `, ${amount}` : '',
      state: t(ticked ? 'row.inTrolley' : 'row.toBuy') })}
    onPress={onTick} style={({ pressed }) => [styles.compact, pressed && { opacity: 0.6 }]}>
    <Text numberOfLines={1} style={[styles.compactName, ticked && styles.nameDone]}>{name}</Text>
    <Text numberOfLines={1} style={[styles.compactAmount, ticked && styles.nameDone]}>{amount}</Text>
    <Text numberOfLines={1} style={[styles.compactPrice, ticked && styles.nameDone]}>
      {typeof price === 'number' ? formatMoney(price) : '—'}
    </Text>
    <View style={[styles.box, ticked && styles.boxOn]}>
      {ticked && <Feather name="check" size={14} color={colors.onPrimary} />}
    </View>
  </Pressable>;
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
  return <View style={styles.line}>
    <View style={[styles.row, styles.draft]}>
      <TextInput value={name} onChangeText={onName} onSubmitEditing={onAdd} returnKeyType="done"
        placeholder={t('basket.addWhat')} placeholderTextColor={colors.muted} maxLength={80}
        accessibilityLabel={t('basket.addWhat')} style={[styles.name, styles.nameCell, styles.field]} />
      <TextInput value={amount} onChangeText={onAmount} onSubmitEditing={onAdd} returnKeyType="done"
        placeholder={t('basket.addAmount')} placeholderTextColor={colors.muted} maxLength={40}
        accessibilityLabel={t('basket.addAmount')} style={[styles.amount, styles.draftAmount]} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('basket.add')} onPress={onAdd}
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.6 }]}>
        <View style={[styles.minus, styles.addBox]}><Feather name="plus" size={16} color={colors.primary} /></View>
      </Pressable>
    </View>
    {/* The minus column stays empty here, so the dashed row lines up with the ones above it. */}
    <View style={styles.minusCell} />
  </View>;
}
const styles = {
  line: { flexDirection: 'row' as const, alignItems: 'center' as const },
  row: { flex: 1, minWidth: 0, flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: colors.surface, borderRadius: radii.medium, borderWidth: 1,
    borderColor: colors.border, minHeight: 48, gap: 4 },
  nameCell: { flex: 1, minWidth: 0, paddingVertical: spacing.sm, paddingLeft: spacing.sm },
  name: { ...typography.body, fontWeight: '600' as const, color: colors.ink },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through' as const },
  amountCell: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, flexGrow: 0, flexShrink: 0 },
  amount: { ...typography.small, color: colors.ink, textAlign: 'right' as const, width: 52, flexGrow: 0,
    paddingVertical: 4, paddingHorizontal: 4, borderRadius: radii.small, borderWidth: 1, borderColor: colors.border },
  unit: { ...typography.small, color: colors.muted, width: 34 },
  price: { ...typography.small, color: colors.ink, textAlign: 'right' as const, width: 54 },
  priceEdge: { paddingRight: spacing.sm },
  own: { ...typography.small, color: colors.muted, textAlign: 'right' as const, width: 86 },
  minusCell: { width: 36, minHeight: 48, alignItems: 'center' as const, justifyContent: 'center' as const },
  minus: { width: 26, height: 26, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
  add: { paddingLeft: spacing.xs, paddingRight: spacing.sm, paddingVertical: spacing.sm },
  addBox: { borderStyle: 'dashed' as const },
  draft: { borderStyle: 'dashed' as const },
  field: { paddingVertical: 4, paddingRight: 4, paddingLeft: spacing.sm },
  draftAmount: { width: 96, textAlign: 'left' as const, borderWidth: 0 },
  // The shopping view: rows inside one card, divided by a line rather than boxed one by one.
  compact: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg - 2, borderTopWidth: 1, borderTopColor: colors.border },
  compactName: { ...typography.body, fontWeight: '600' as const, color: colors.ink, flex: 1, minWidth: 0 },
  compactAmount: { ...typography.small, color: colors.muted, textAlign: 'right' as const },
  compactPrice: { ...typography.small, color: colors.muted, textAlign: 'right' as const, width: 54 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surface },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
};
