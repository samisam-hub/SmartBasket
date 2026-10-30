import { useCallback, useEffect, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { useActiveBasket } from '@/context/ActiveBasketContext';
import { LatestBasket } from '@/components/LatestBasket';
import { WastePrevention } from '@/components/WastePrevention';
import { ErrorMessage, FloatingButton, PrimaryButton, SecondaryButton, Screen, SectionCard, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { quickStart } from '@/services/quick-start';
import { useMerchantDemo } from '@/services/merchant-demo';
import { useProfile } from '@/context/ProfileContext';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { primeBasketCatalog } from '@/hooks/useBasketCatalog';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { dayOf } from '@/services/meals/weekPlan';
import { WeekCalendar, currentWeekStart, openingDate } from '@/components/WeekCalendar';
import { preferenceChips } from '@/services/preference-domain';
import { colors, ui } from '@/lib/theme';
import { t } from '@/services/i18n';

export default function HomeScreen() {
  const preferences = usePreferences();
  const { saved, editing, ready: preferencesReady } = preferences;
  const [copyError, setCopyError] = useState<string | null>(null);
  // Den Produktkatalog laden, waehrend die Woche noch gewaehlt wird; er gilt fuer den App-Lauf.
  useEffect(() => { primeBasketCatalog(); }, []);
  // Wer die App zum ersten Mal oeffnet, sieht den Einstieg und keinen leeren Plan. Wer mittendrin
  // ist, macht dort weiter, statt wieder von vorn zu beginnen.
  const firstVisit = preferencesReady && !saved && !editing;
  const week = useWeekPlan();
  useFocusEffect(useCallback(() => {
    if (saved && week.ready) week.store.open(currentWeekStart(), saved);
  }, [saved, week.ready, week.store]));
  const { saved: profile } = useProfile();
  const flow = useBasketFlow();
  const { active } = useActiveBasket();
  const { demo } = useMerchantDemo();
  const openCart = () => active ? router.push({ pathname: '/basket-setup', params: { savedId: active.id } }) : router.navigate('/basket');
  // Which day the week is showing. Null until the plan has loaded, so it can open on a real day.
  const weekStart = week.plan?.weekStart ?? currentWeekStart();
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? openingDate(week.plan, weekStart);
  // The one action the calendar is about: add another meal to the day on screen.
  const addMeal = () => router.push(week.plan && dayOf(week.plan, day)
    ? { pathname: '/plan/[date]', params: { date: day } }
    : '/plan/week');
  const name = profile?.displayName.trim();
  const details = saved ? preferenceChips(saved).slice(2).filter(label => !label.includes("Budget")) : [];
  if (firstVisit) return <Redirect href="/welcome" />;
  return <Screen compact floating={saved
    ? <FloatingButton icon="plus" label={t('home.addMeal')} disabled={flow.disabled || !week.ready}
      onPress={addMeal} />
    : undefined}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
      <Text accessibilityRole="header" style={[ui.heading, { flex: 1, fontWeight: '800', fontSize: 22 }]}>Smart<Text style={{ color: colors.primary }}>Basket</Text></Text>
      <Text style={[ui.small, { color: colors.ink, flexShrink: 1 }]} numberOfLines={1}>{name ? t('home.greeting', { name }) : t('home.welcome')}</Text>
      <Pressable onPress={openCart} accessibilityRole="button" accessibilityLabel={t('home.openBasket')} style={{ padding: 10 }}><Feather name="shopping-bag" size={26} color={colors.ink} /></Pressable>
    </View>
    <WastePrevention />
    <ErrorMessage message={week.error} />
    <ErrorMessage message={copyError} />
    {saved ? <WeekCalendar plan={week.plan} weekStart={weekStart}
      busy={flow.disabled || !week.ready}
      selected={day}
      onSelect={setPicked}
      onWeek={start => { setPicked(null); week.store.open(start, saved); }}
      onCopyPrevious={week.store.canCopyPreviousWeek(weekStart, saved)
        ? () => { try { week.store.copyPreviousWeek(weekStart, saved); setCopyError(null); }
          catch (e) { setCopyError(e instanceof Error ? e.message : t('home.copyFailed')); } } : undefined}
      onBasket={() => router.push({ pathname: '/basket-setup', params: { week: '1' } })} />
      : <SectionCard title={t('home.startTitle')}>
        <PrimaryButton label={t('home.setPreferences')} disabled={flow.disabled} onPress={flow.create} />
        <SecondaryButton label={t('home.sampleStart')} disabled={flow.disabled}
          onPress={() => { void quickStart(preferences.store); }} />
        <Text style={ui.small}>{t('home.sampleNote')}</Text>
      </SectionCard>}
    <SecondaryButton label={t('home.recentPurchases')} onPress={()=>router.push({ pathname: '/pantry', params: { view: 'history' } })} />
    <Pressable accessibilityRole="button" accessibilityLabel={t('home.voice')} onPress={() => router.push('/voice-plan')}
      style={({pressed}) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.pale, opacity: pressed ? .75 : 1 })}>
      <Feather name="mic" size={24} color={colors.primary} />
      <View style={{flex: 1}}><Text style={[ui.small, {fontWeight: '700', color: colors.ink}]}>{t('home.voice')}</Text><Text style={ui.caption}>{t('home.voiceHint')}</Text></View>
      <Feather name="chevron-right" size={20} color={colors.primary} />
    </Pressable>
    <LatestBasket />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {[
        { title: t('home.pantry'), subtitle: t('home.pantryHint'), route: '/pantry' as const, photo: 8 },
        // The catalogue is the merchant demo: no tile to it while the tab itself is hidden.
        ...(demo ? [{ title: t('home.discover'), subtitle: t('home.discoverHint'), route: '/products' as const, photo: 1 }] : []),
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
          <Text style={ui.subheading}>{t('home.yourSettings')}</Text>
          <Text style={ui.small}>{details.join(' · ')}</Text>
        </View>
        <TextButton label={t(editing ? 'home.resumeEdit' : 'home.edit')} disabled={flow.disabled} onPress={() => flow.edit()} />
      </View>
    </SectionCard>}
  </Screen>;
}
