import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { useActiveBasket } from '@/context/ActiveBasketContext';
import { LatestBasket } from '@/components/LatestBasket';
import { WastePrevention } from '@/components/WastePrevention';
import { PrimaryButton, SecondaryButton, Screen, SectionCard, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useProfile } from '@/context/ProfileContext';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { preferenceChips } from '@/services/preference-domain';
import { colors, ui } from '@/lib/theme';

export default function HomeScreen() {
  const { saved, editing } = usePreferences();
  const { saved: profile } = useProfile();
  const flow = useBasketFlow();
  const { active } = useActiveBasket();
  const openCart = () => active ? router.push({ pathname: '/basket-setup', params: { savedId: active.id } }) : router.navigate('/basket');
  const name = profile?.displayName.trim();
  const details = saved ? preferenceChips(saved).slice(2).filter(label => !label.includes('budget')) : [];
  return <Screen compact>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
      <Text accessibilityRole="header" style={[ui.heading, { flex: 1, fontWeight: '800', fontSize: 22 }]}>Smart<Text style={{ color: colors.primary }}>Basket</Text></Text>
      <Text style={[ui.small, { color: colors.ink, flexShrink: 1 }]} numberOfLines={1}>{name ? `Hi ${name}` : 'Welcome'}</Text>
      <Pressable onPress={openCart} accessibilityRole="button" accessibilityLabel="Open your basket" style={{ padding: 10 }}><Feather name="shopping-bag" size={26} color={colors.ink} /></Pressable>
    </View>
    <WastePrevention />
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1 }}><PrimaryButton label="Plan my next meal" disabled={flow.disabled} onPress={flow.create} /></View>
      <View style={{ flex: 1 }}><SecondaryButton label="View recent shops" onPress={()=>router.push({ pathname: '/pantry', params: { view: 'history' } })} /></View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Plan by voice" onPress={() => router.push('/voice-plan')}
      style={({pressed}) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.pale, opacity: pressed ? .75 : 1 })}>
      <Feather name="mic" size={24} color={colors.primary} />
      <View style={{flex: 1}}><Text style={[ui.small, {fontWeight: '700', color: colors.ink}]}>Plan by voice</Text><Text style={ui.caption}>Tell us what you fancy</Text></View>
      <Feather name="chevron-right" size={20} color={colors.primary} />
    </Pressable>
    <LatestBasket />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {[
        { title: 'Your pantry', subtitle: 'Use what you already have', route: '/pantry' as const, photo: 8 },
        { title: 'Browse products', subtitle: 'Find what you need', route: '/products' as const, photo: 1 },
      ].map(tile => <Pressable key={tile.title} onPress={()=>router.push(tile.route)} accessibilityRole="button" accessibilityLabel={tile.title}
        style={({pressed})=>[ui.card,{ flex: 1, minWidth: 0, padding: 12, gap: 6, borderRadius: 14, opacity: pressed ? .75 : 1 }]}>
        <Text style={[ui.small,{fontWeight:'700',color:colors.ink}]}>{tile.title}</Text>
        <Text style={ui.caption}>{tile.subtitle}</Text>
        <View accessible={false} style={{ width: 72, height: 72, overflow: 'hidden', alignSelf: 'flex-end', borderRadius: 10 }}>
          <Image source={require('../../assets/categories/grocery-categories.png')} resizeMode="stretch" style={{position:'absolute',width:288,height:288,left:-(tile.photo%4)*72,top:-Math.floor(tile.photo/4)*72}} />
        </View>
      </Pressable>)}
    </View>
    {saved && <SectionCard compact>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={ui.subheading}>Your preferences</Text>
          <Text style={ui.small}>{details.join(' · ')}</Text>
        </View>
        <TextButton label={editing ? 'Resume edits' : 'Edit'} disabled={flow.disabled} onPress={() => flow.edit()} />
      </View>
    </SectionCard>}
  </Screen>;
}
