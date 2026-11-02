import Feather from '@expo/vector-icons/Feather';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { useActiveBasket } from '@/context/ActiveBasketContext';
import { LatestBasket } from '@/components/LatestBasket';
import { WastePrevention } from '@/components/WastePrevention';
import { ErrorMessage, PrimaryButton, SecondaryButton, Screen, SectionCard, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useProfile } from '@/context/ProfileContext';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { WeekCalendar, currentWeekStart } from '@/components/WeekCalendar';
import { preferenceChips } from '@/services/preference-domain';
import { colors, ui } from '@/lib/theme';

export default function HomeScreen() {
  const [copyError, setCopyError] = useState<string | null>(null);
  const { saved, editing } = usePreferences();
  const week = useWeekPlan();
  useFocusEffect(useCallback(() => {
    if (saved && week.ready) week.store.open(currentWeekStart(), saved);
  }, [saved, week.ready, week.store]));
  const { saved: profile } = useProfile();
  const flow = useBasketFlow();
  const { active } = useActiveBasket();
  const openCart = () => active ? router.push({ pathname: '/basket-setup', params: { savedId: active.id } }) : router.navigate('/basket');
  const name = profile?.displayName.trim();
  const details = saved ? preferenceChips(saved).slice(2).filter(label => !label.includes("Budget")) : [];
  return <Screen compact>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
      <Text accessibilityRole="header" style={[ui.heading, { flex: 1, fontWeight: '800', fontSize: 22 }]}>Smart<Text style={{ color: colors.primary }}>Basket</Text></Text>
      <Text style={[ui.small, { color: colors.ink, flexShrink: 1 }]} numberOfLines={1}>{name ? `Hallo ${name}` : "Willkommen"}</Text>
      <Pressable onPress={openCart} accessibilityRole="button" accessibilityLabel="Deinen Warenkorb öffnen" style={{ padding: 10 }}><Feather name="shopping-bag" size={26} color={colors.ink} /></Pressable>
    </View>
    <WastePrevention />
    <ErrorMessage message={week.error} />
    <ErrorMessage message={copyError} />
    {saved ? <WeekCalendar plan={week.plan} weekStart={week.plan?.weekStart ?? currentWeekStart()}
      busy={flow.disabled || !week.ready}
      onWeek={weekStart => week.store.open(weekStart, saved)}
      onCopyPrevious={week.store.canCopyPreviousWeek(week.plan?.weekStart ?? currentWeekStart(), saved)
        ? () => { try { week.store.copyPreviousWeek(week.plan?.weekStart ?? currentWeekStart(), saved); setCopyError(null); }
          catch (e) { setCopyError(e instanceof Error ? e.message : "Die Vorwoche konnte nicht übernommen werden."); } } : undefined}
      onBasket={() => router.push({ pathname: '/basket-setup', params: { week: '1' } })} />
      : <PrimaryButton label="Deine Einstellungen festlegen" disabled={flow.disabled} onPress={flow.create} />}
    <SecondaryButton label="Letzte Einkäufe ansehen" onPress={()=>router.push({ pathname: '/pantry', params: { view: 'history' } })} />
    <Pressable accessibilityRole="button" accessibilityLabel="Per Sprache planen" onPress={() => router.push('/voice-plan')}
      style={({pressed}) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.pale, opacity: pressed ? .75 : 1 })}>
      <Feather name="mic" size={24} color={colors.primary} />
      <View style={{flex: 1}}><Text style={[ui.small, {fontWeight: '700', color: colors.ink}]}>Per Sprache planen</Text><Text style={ui.caption}>Sag uns, worauf du Lust hast</Text></View>
      <Feather name="chevron-right" size={20} color={colors.primary} />
    </Pressable>
    <LatestBasket />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {[
        { title: "Deine Vorräte", subtitle: "Nutze, was du schon hast", route: '/pantry' as const, photo: 8 },
        { title: "Produkte entdecken", subtitle: "Finde, was du brauchst", route: '/products' as const, photo: 1 },
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
          <Text style={ui.subheading}>Deine Einstellungen</Text>
          <Text style={ui.small}>{details.join(' · ')}</Text>
        </View>
        <TextButton label={editing ? "Bearbeitung fortsetzen" : "Bearbeiten"} disabled={flow.disabled} onPress={() => flow.edit()} />
      </View>
    </SectionCard>}
  </Screen>;
}
