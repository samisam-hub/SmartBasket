import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import type { WeekPlan } from '../types/meal';
import { itemsInSlot, planDateLabel, sortSlots } from '../services/meals/weekPlan';
import { contentName } from '../services/i18n/content';
import { slotLabel, t } from '../services/i18n';
import { colors, radii, spacing, typography, ui } from '../lib/theme';

/** The week as a filled calendar: one row per planned day, the meals of that day beside the date,
 *  and the whole row opens the day. Compact enough to see a week at once, which a card per meal
 *  never was. */
export function PlannedWeek({ plan, onOpenDay, busy }: {
  plan: WeekPlan;
  onOpenDay: (date: string) => void;
  busy?: boolean;
}) {
  return <View style={styles.grid}>
    {plan.days.map((day, index) => {
      const label = planDateLabel(day.date);
      return <Pressable key={day.date} accessibilityRole="button" disabled={busy}
        accessibilityLabel={t('planned.editDay', { day: label })}
        onPress={() => onOpenDay(day.date)}
        style={({ pressed }) => [styles.row, index > 0 && styles.divided, pressed && { backgroundColor: colors.pale }]}>
        <View style={styles.date}>
          <Text style={styles.dateText}>{label}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {sortSlots(day.slots).map(slot => {
            const dishes = itemsInSlot(plan, day.date, slot);
            return <Text key={slot} numberOfLines={1} style={ui.small}>
              <Text style={styles.slot}>{slotLabel(slot)}: </Text>
              {dishes.length
                ? dishes.map(item => contentName(item.meal.name)).join(' / ')
                : <Text style={styles.open}>{t('planned.stillOpen')}</Text>}
            </Text>;
          })}
        </View>
        <Feather name="chevron-right" size={20} color={colors.muted} />
      </Pressable>;
    })}
  </View>;
}
const styles = {
  grid: { backgroundColor: colors.surface, borderRadius: radii.large, borderWidth: 1,
    borderColor: colors.border, overflow: 'hidden' as const },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 64 },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  date: { width: 96 },
  dateText: { ...typography.small, fontWeight: '700' as const, color: colors.ink },
  slot: { fontWeight: '700' as const, color: colors.ink },
  open: { color: colors.primary },
};
