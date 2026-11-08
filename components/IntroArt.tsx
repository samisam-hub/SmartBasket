import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { colors, radii } from '../lib/theme';

/** Explanatory artwork without photographs.
 *
 *  The app carries no vector library (react-native-svg is not a dependency), so these are built
 *  from the icon set, which is vector itself, on a tinted disc. That keeps them crisp at any size
 *  and adds nothing to the bundle. They illustrate, they do not decorate: each one shows the thing
 *  the screen beside it is talking about. */
export type IntroArtKind = 'plan' | 'goals' | 'list' | 'household' | 'swipe' | 'calendar';
const art: Record<IntroArtKind, { icon: React.ComponentProps<typeof Feather>['name']; badge: React.ComponentProps<typeof Feather>['name'] }> = {
  plan: { icon: 'book-open', badge: 'check' },
  goals: { icon: 'target', badge: 'heart' },
  list: { icon: 'shopping-cart', badge: 'check' },
  household: { icon: 'users', badge: 'plus' },
  swipe: { icon: 'layers', badge: 'thumbs-up' },
  calendar: { icon: 'calendar', badge: 'check' },
};
export function IntroArt({ kind, size = 132 }: { kind: IntroArtKind; size?: number }) {
  const { icon, badge } = art[kind];
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size, borderRadius: radii.pill, backgroundColor: colors.pale,
      alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
    <Feather name={icon} size={size * 0.42} color={colors.primary} />
    <View style={{ position: 'absolute', right: size * 0.1, bottom: size * 0.1,
      width: size * 0.3, height: size * 0.3, borderRadius: radii.pill, backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background }}>
      <Feather name={badge} size={size * 0.16} color={colors.onPrimary} />
    </View>
  </View>;
}
