import { t, term } from '@/services/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, SectionCard, ScreenHeader, PrimaryButton, SecondaryButton, ErrorMessage } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useProfile } from '../context/ProfileContext';
import { profileParticipant } from '../services/profile-domain';
import { nutritionTargets } from '../services/basket/nutritionTargets';
import { compatibleMeal } from '../services/meals/planner';
import { meals } from '../data/meals';
import type { PlanParticipant } from '../types/profile';
import { colors, ui } from '../lib/theme';
import { askPlanner, transcribe, type VoiceInputLanguage, type VoiceMessage } from '../services/voice/client';
import { clarification, type VoicePlan } from '../services/voice/contract';
import { confirmedVoicePlan, voiceDefaults, voiceParticipants } from '../services/voice/plan';
import { useConversationRecorder } from '../hooks/useConversationRecorder';
import { VoiceConversation, type ConversationPhase } from '../services/voice/conversation';
import { speakReply } from '../services/voice/speech';

export default function VoicePlanScreen() {
  const { session } = useAuth(), { saved } = usePreferences(), profile = useProfile();
  const originals = useRef<PlanParticipant[]>([]);
  const [plan, setPlan] = useState<VoicePlan | null>(null);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [unresolved, setUnresolved] = useState<string | null>(t('voice.prompt'));
  const [inputLanguage, setInputLanguage] = useState<VoiceInputLanguage>('de');
  const [phase, setPhase] = useState<ConversationPhase>('idle');
  const [showTranscript, setShowTranscript] = useState(false);
  const focused = useRef(true), saving = useRef(false);
  const recorder = useConversationRecorder();
  const replyRef = useRef<(text: string, signal: AbortSignal) => Promise<{text: string; language: string}>>(async () => { throw Error(t('voice.loadingSettings')); });
  const conversation = useMemo(() => new VoiceConversation({
    recorder, transcribe: (uri, signal) => transcribe(uri, signal, inputLanguage), speak: speakReply,
    reply: (text, signal) => replyRef.current(text, signal),
    phase: value => { if (focused.current) setPhase(value); },
    error: value => { if (focused.current) setError(value); },
  }), [recorder, inputLanguage]);
  useEffect(() => {
    if (plan || !saved || !profile.ready) return;
    const first: PlanParticipant = profile.saved ? profileParticipant(profile.saved, saved) : {
      id: 'current-user', name: "Du", age: null, sex: null, dailyCalories: saved.dailyCalories,
      proteinTarget: Math.round(nutritionTargets(saved).dailyProteinTarget), dietaryPreferences: saved.dietaryPreferences,
      allergens: saved.allergens, intolerances: [], isCurrentUser: true,
    };
    originals.current = [first];
    setPlan(voiceDefaults(originals.current, saved));
  }, [plan, saved, profile.ready, profile.saved]);
  useFocusEffect(useCallback(() => {
    focused.current = true; setPhase('idle');
    const stop = () => { void conversation.pause(); };
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') stop(); });
    const hide = () => { if (document.hidden) stop(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', hide);
    return () => {
      focused.current = false; stop(); subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', hide);
    };
  }, [conversation]));
  replyRef.current = async (text, signal) => {
    if (!plan) throw Error(t('voice.retrySettings'));
    const available = saved ? meals.filter(m => compatibleMeal(m, saved)) : meals;
    const result = await askPlanner(text.trim(), plan, messages, available.map(m => ({ id: m.id, name: m.name })), signal);
    if (!focused.current || signal.aborted) throw Error(t('voice.ended'));
    const protectedPeople = voiceParticipants(result.plan, originals.current);
    const safePlan: VoicePlan = { ...result.plan, people: protectedPeople.map(p => ({ name: p.name, calories: p.dailyCalories, protein: p.proteinTarget, diets: p.dietaryPreferences, allergens: p.allergens })) };
    let question = clarification(safePlan, result.language) ?? result.unresolved;
    if (!question && saved) {
      try { confirmedVoicePlan(safePlan, saved, originals.current); }
      catch {
        question = result.language === 'de' ? t('voice.wishConflictDe') : t('voice.wishConflict');
      }
    }
    const answer = question || result.reply;
    setPlan(safePlan); setUnresolved(question);
    setMessages(previous => [...previous.slice(-10), { role: 'user', content: text.trim() }, { role: 'assistant', content: answer }]);
    return { text: answer, language: result.language };
  };
  const handoff = () => { if (!saved || !plan || unresolved || saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    void (async () => {
      await conversation.pause();
      if (!focused.current) return;
      const input = confirmedVoicePlan(plan, saved, originals.current);
      const owner = session?.user.id ?? 'local';
      await AsyncStorage.setItem(`smartbasket.active-plan.v1:${owner}`, JSON.stringify(input));
      await AsyncStorage.setItem(`smartbasket.plan-draft.v1:${owner}`, JSON.stringify({ people: input.participants, days: input.planningDays, budget: input.weeklyBudgetEur, budgetEnabled: input.budgetEnabled }));
      if (focused.current) router.replace({ pathname: '/basket-setup', params: { participants: '1' } });
    })().catch(e => { if (focused.current) setError(e instanceof Error ? e.message : t('voice.saveFailed')); })
      .finally(() => { saving.current = false; if (focused.current) setBusy(false); });
  };
  const manual = () => { void conversation.pause().then(() => { if (focused.current) router.replace(saved ? '/plan-setup' : '/onboarding/welcome'); }); };
  const status = { idle: t('voice.start'), starting: t('voice.connecting'), listening: t('voice.listening'), thinking: t('voice.thinking'), speaking: t('voice.speaking'), stopping: t('voice.pausing') }[phase];
  const active = phase !== 'idle';
  const signedIn = !!session && !session.user.is_anonymous;
  return <Screen top={false} bottom compact>
    <ScreenHeader eyebrow="GEMEINSAM PLANEN" title={t('voice.title')} subtitle={t('voice.subtitle')} />
    {!saved ? <SectionCard><Text style={ui.body}>{t('voice.needsSettings')}</Text><PrimaryButton label={t('voice.setSettings')} onPress={manual} /></SectionCard> : !signedIn ? <SectionCard><Text style={ui.body}>Melde dich an, um den Sprachassistenten zu nutzen.</Text><PrimaryButton label="Anmelden" onPress={() => router.push('/account')} /></SectionCard> : <>
      <SectionCard>
        <Text style={[ui.subheading, { textAlign: 'center' }]}>Dein SmartBasket-Sprachassistent</Text>
        <Text style={[ui.small, { textAlign: 'center' }]}>{t('voice.howItWorks')}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          {(['de', 'en'] as const).map(code => <Pressable key={code} accessibilityRole="button" accessibilityLabel={t('voice.language', { language: code === 'de' ? t('voice.german') : t('voice.english') })} disabled={active || busy} onPress={() => setInputLanguage(code)} style={{ borderRadius: 16, borderWidth: 1, borderColor: inputLanguage === code ? colors.primary : colors.border, backgroundColor: inputLanguage === code ? colors.pale : colors.surface, paddingVertical: 6, paddingHorizontal: 14 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{code === 'de' ? t('voice.german') : t('voice.english')}</Text></Pressable>)}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={phase === 'speaking' ? t('voice.interrupt') : active ? t('voice.pause') : t('voice.start')} disabled={busy || !plan || phase === 'stopping'}
          onPress={() => { if (phase === 'speaking') conversation.interrupt(); else if (active) void conversation.pause(); else void conversation.start(); }}
          style={{ alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: 144, height: 144, marginVertical: 16, borderRadius: 72, borderWidth: 10, borderColor: colors.pale, backgroundColor: active ? colors.primary : colors.ink, opacity: busy ? .5 : 1 }}>
          <Feather name={phase === 'speaking' ? 'volume-2' : active ? 'pause' : 'mic'} size={44} color="white" />
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={[ui.subheading, { textAlign: 'center' }]}>{status}</Text>
        {phase === 'speaking' && <Text style={[ui.small, { textAlign: 'center' }]}>Tippe auf den Kreis, um zu unterbrechen und zu sprechen.</Text>}
        {phase === 'listening' && <SecondaryButton label={t('voice.done')} onPress={() => conversation.sendNow()} />}
        {active && <SecondaryButton label={t('voice.pause')} onPress={() => { void conversation.pause(); }} />}
        {!active && !messages.length && <Text style={ui.small}>{t('voice.example')}</Text>}
        {!!messages.length && <Text style={ui.body}>{messages[messages.length - 1].content}</Text>}
        <Text style={ui.caption}>{t('voice.privacy')}</Text>
      </SectionCard>
      {!!messages.length && <SecondaryButton label={showTranscript ? t('voice.hide') : t('voice.show')} onPress={() => setShowTranscript(!showTranscript)} />}
      {showTranscript && messages.map((m, i) => <View key={i} style={[ui.card, { padding: 14, backgroundColor: m.role === 'assistant' ? colors.pale : colors.surface }]}><Text style={ui.eyebrow}>{m.role === 'assistant' ? 'SMARTBASKET' : "DU"}</Text><Text selectable style={ui.body}>{m.content}</Text></View>)}
      {plan && <SectionCard title={t('voice.planSoFar')}>
        <Text style={ui.body}>{plan.days ?? '—'}  Tage · {plan.people.length} {plan.people.length === 1 ? 'Person' : "Personen"} · {plan.budgetEnabled ? `€${plan.budget ?? '—'} Gesamtbudget` : "Kein Budgetlimit"}</Text>
        {plan.people.map((p, i) => <View key={i}><Text style={[ui.body, { fontWeight: '700' }]}>{p.name || t('voice.person', { number: i + 1 })}</Text><Text style={ui.small}>{t('voice.proteinPerDay', { calories: p.calories ?? '—', protein: p.protein ?? '—' })}</Text><Text style={ui.small}>{p.diets.filter(d => d !== 'none').map(d => term(d)).join(' · ')}{p.allergens.length ? t('voice.avoid', { allergens: p.allergens.map(a => term(a)).join(', ') }) : ''}</Text></View>)}
        {!!plan.preferredMealIds.length && <Text style={ui.small}>Essenswünsche: {plan.preferredMealIds.map(id => meals.find(m => m.id === id)?.name).filter(Boolean).join(', ')}</Text>}
        {unresolved && <Text style={ui.small}>{unresolved}</Text>}
        <PrimaryButton label={t('voice.confirm')} disabled={!!unresolved || !messages.length || busy || phase === 'thinking' || phase === 'starting' || phase === 'stopping'} onPress={handoff} />
      </SectionCard>}
    </>}
    <ErrorMessage message={error} />
    <SecondaryButton label={t('voice.manual')} disabled={busy} onPress={manual} />
  </Screen>;
}
