import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import Feather from '@expo/vector-icons/Feather';
import { Image, Pressable, Text, View } from 'react-native';
import { avatarTint, initials } from './HouseholdList';
import { TextButton } from './ui';
import { t } from '../services/i18n';
import { colors, radii, typography, ui } from '../lib/theme';

/** A picture is optional; until there is one, initials tell people apart just as well. */
export function Avatar({ name, id, uri, size = 56 }: { name: string; id: string; uri?: string | null; size?: number }) {
  const round = { width: size, height: size, borderRadius: radii.pill };
  if (uri) return <Image accessibilityIgnoresInvertColors source={{ uri }} style={[round, { resizeMode: 'cover' }]} />;
  return <View style={[round, styles.initials, { backgroundColor: avatarTint(id) }]}>
    <Text style={[styles.letters, { fontSize: Math.round(size / 2.6) }]}>{initials(name)}</Text>
  </View>;
}

/** Pictures are kept with the household rather than on the device's camera roll, so they travel
 *  with an account and survive a reinstall. That only works while they stay small: the picker is
 *  asked for a square, and anything still too large to carry is refused rather than half saved. */
const MAX_DATA_URI = 180_000;
export function AvatarPicker({ name, id, uri, onChange, size = 72 }: {
  name: string;
  id: string;
  uri?: string | null;
  onChange: (uri: string | null) => void;
  size?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError(t('avatar.needsPermission')); return; }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      const data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      if (data.length > MAX_DATA_URI) { setError(t('avatar.tooLarge')); return; }
      onChange(data);
    } catch { setError(t('avatar.failed')); }
    finally { setBusy(false); }
  };
  return <View style={ui.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={t(uri ? 'avatar.change' : 'avatar.add')}
      disabled={busy} onPress={() => { void choose(); }} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <Avatar name={name} id={id} uri={uri} size={size} />
      <View style={styles.badge}><Feather name={uri ? 'edit-2' : 'camera'} size={14} color={colors.onPrimary} /></View>
    </Pressable>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <TextButton label={t(uri ? 'avatar.change' : 'avatar.add')} disabled={busy} onPress={() => { void choose(); }} />
      {uri && <TextButton label={t('avatar.remove')} disabled={busy} onPress={() => { setError(null); onChange(null); }} />}
      {error && <Text style={ui.small}>{error}</Text>}
    </View>
  </View>;
}
const styles = {
  initials: { alignItems: 'center' as const, justifyContent: 'center' as const },
  letters: { ...typography.body, fontWeight: '700' as const, color: colors.primary },
  badge: { position: 'absolute' as const, right: -2, bottom: -2, width: 24, height: 24,
    borderRadius: radii.pill, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface,
    alignItems: 'center' as const, justifyContent: 'center' as const },
};
