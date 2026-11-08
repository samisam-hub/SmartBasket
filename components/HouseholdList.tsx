import { formatNumber, kindLabel, t } from '../services/i18n';
import Feather from '@expo/vector-icons/Feather';
import { Avatar } from './Avatar';
import { Pressable, Text, View } from 'react-native';
import { PrimaryButton } from './ui';
import { participantKind } from '../services/profile-domain';
import type { PlanParticipant } from '../types/profile';
import { colors, radii, spacing, typography, ui } from '../lib/theme';

/** The most people a plan may have, the same ceiling the stored preferences enforce. */
export const maxHousehold = 10;

/** A mock-up can assume everybody has a photo; an app has to be given one. Until there is a
 *  picture to show, initials tell the people of a household apart just as well. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}
/** A stable tint per person, so a face in the list keeps its colour between visits. Three tones
 *  the brand already owns; primaryLight is left out because it holds the same value as secondary. */
const tints = [colors.secondary, colors.pale, colors.accent];
export function avatarTint(id: string): string {
  const sum = [...id].reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return tints[sum % tints.length];
}
/** One line of the household: who they are, what they eat, and that there is more behind it. */
export function PersonRow({ person, onPress }: { person: PlanParticipant; onPress: () => void }) {
  const kind = kindLabel(participantKind(person));
  const own = person.name.trim() || t('household.person');
  const name = person.isCurrentUser ? t('household.you', { name: own }) : own;
  const amount = person.dailyCalories ? t('household.calories', { amount: formatNumber(person.dailyCalories) }) : null;
  return <Pressable accessibilityRole="button" accessibilityLabel={t('household.edit', { name, kind })}
    onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <Avatar name={person.name} id={person.id} uri={person.avatarUri} size={56} />
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text numberOfLines={1} style={styles.name}>{name}</Text>
      <Text numberOfLines={1} style={ui.small}>{amount ? `${kind} · ${amount}` : kind}</Text>
    </View>
    <Feather name="chevron-right" size={22} color={colors.muted} />
  </Pressable>;
}
/** The household as a list of faces, with one way to add to it. */
export function HouseholdList({ people, onOpen, onAdd }: {
  people: PlanParticipant[];
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const full = people.length >= maxHousehold;
  return <View style={ui.stack}>
    <View style={styles.card}>
      {people.length ? people.map((person, index) => <View key={person.id}>
        {index > 0 && <View style={styles.divider} />}
        <PersonRow person={person} onPress={() => onOpen(person.id)} />
      </View>)
        : <Text style={[ui.small, { padding: spacing.lg }]}>{t('household.empty')}</Text>}
    </View>
    <PrimaryButton icon="users" label={t('household.add')} disabled={full} onPress={onAdd} />
    {full && <Text style={ui.small}>{t('household.full', { max: maxHousehold })}</Text>}
  </View>;
}
const styles = {
  card: { backgroundColor: colors.surface, borderRadius: radii.large, borderWidth: 1,
    borderColor: colors.border, overflow: 'hidden' as const },
  // The divider starts where the text does, so the faces read as one column.
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 56 + spacing.lg + spacing.md },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 72 },
  pressed: { backgroundColor: colors.pale },
  avatar: { width: 56, height: 56, borderRadius: radii.pill,
    alignItems: 'center' as const, justifyContent: 'center' as const },
  initials: { ...typography.body, fontWeight: '700' as const, color: colors.primary },
  name: { ...typography.h3, color: colors.ink },
};
