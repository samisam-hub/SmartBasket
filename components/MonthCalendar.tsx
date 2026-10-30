import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { addMonths, monthGrid, monthLabel, monthStartOf, planDate, weekdayShort } from '../services/meals/weekPlan';
import { t } from '../services/i18n';
import { colors, radii, spacing, typography, ui } from '../lib/theme';

/** A month, the way a calendar shows one: seven columns, Monday first, the days of the month in
 *  full and the days around it faint. Picking days happens here rather than on a row of chips,
 *  because a week is easier to judge when the month around it is visible. */
export function MonthCalendar({ month, onMonth, selected, onSelect, today = planDate(new Date()), disabled, marks }: {
  /** The first day of the month on screen. */
  month: string;
  onMonth: (month: string) => void;
  /** The days already chosen, as plan dates. */
  selected: string[];
  onSelect: (date: string) => void;
  today?: string;
  disabled?: boolean;
  /** A day that carries something already, shown with a dot. */
  marks?: string[];
}) {
  const days = monthGrid(month);
  const chosen = new Set(selected);
  const marked = new Set(marks ?? []);
  return <View style={{ gap: spacing.sm }}>
    <View style={ui.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('month.previous')} disabled={disabled}
        onPress={() => onMonth(addMonths(month, -1))} style={styles.arrow}>
        <Feather name="chevron-left" size={20} color={colors.primary} />
      </Pressable>
      <Text style={[ui.subheading, { flex: 1, textAlign: 'center' }]}>{monthLabel(month)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('month.next')} disabled={disabled}
        onPress={() => onMonth(addMonths(month, 1))} style={styles.arrow}>
        <Feather name="chevron-right" size={20} color={colors.primary} />
      </Pressable>
    </View>
    <View style={styles.week}>
      {weekdayShort().map(name => <Text key={name} style={[ui.caption, styles.weekday]}>{name}</Text>)}
    </View>
    <View style={styles.grid}>
      {days.map(date => {
        const inMonth = monthStartOf(date) === month;
        const picked = chosen.has(date);
        const past = date < today;
        const label = new Date(date).getUTCDate();
        return <Pressable key={date} accessibilityRole="checkbox" disabled={disabled || past}
          accessibilityState={{ checked: picked, disabled: disabled || past }}
          accessibilityLabel={t(past ? 'month.dayPast' : picked ? 'month.dayPlanned' : 'month.dayFree', { day: date })}
          onPress={() => onSelect(date)}
          style={({ pressed }) => [styles.day, picked && styles.dayOn,
            !picked && date === today && styles.dayToday, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.number, !inMonth && styles.outside, past && styles.past, picked && styles.numberOn]}>
            {label}
          </Text>
          <View style={[styles.dot, marked.has(date) && !picked && styles.dotOn,
            marked.has(date) && picked && styles.dotOnPicked]} />
        </Pressable>;
      })}
    </View>
  </View>;
}
const styles = {
  arrow: { padding: spacing.sm },
  week: { flexDirection: 'row' as const },
  weekday: { flex: 1, textAlign: 'center' as const, fontWeight: '700' as const },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
  day: { width: `${100 / 7}%` as const, aspectRatio: 1, alignItems: 'center' as const,
    justifyContent: 'center' as const, gap: 2, borderRadius: radii.medium },
  dayOn: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1, borderColor: colors.primary },
  number: { ...typography.body, color: colors.ink },
  numberOn: { color: colors.onPrimary, fontWeight: '700' as const },
  outside: { color: colors.border },
  past: { color: colors.muted, opacity: 0.45 },
  dot: { width: 5, height: 5, borderRadius: radii.pill, backgroundColor: 'transparent' as const },
  dotOn: { backgroundColor: colors.primary },
  dotOnPicked: { backgroundColor: colors.onPrimary },
};
