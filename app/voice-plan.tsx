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
import { labels } from '../types/preferences';
import type { PlanParticipant } from '../types/profile';
import { colors, ui } from '../lib/theme';
import { askPlanner, transcribe, type VoiceMessage } from '../services/voice/client';
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
  const [busy, setBusy] = useState(false), [unresolved, setUnresolved] = useState<string | null>('Tell me what you would like to plan.');
  const [language, setLanguage] = useState<'en' | 'de'>('en');
  const [phase, setPhase] = useState<ConversationPhase>('idle');
  const [showTranscript, setShowTranscript] = useState(false);
  const focused = useRef(true), saving = useRef(false);
  const recorder = useConversationRecorder();
  const replyRef = useRef<(text: string, signal: AbortSignal) => Promise<{text: string; language: string}>>(async () => { throw Error('Preferences are loading.'); });
  const conversation = useMemo(() => new VoiceConversation({
    recorder, transcribe, speak: speakReply,
    reply: (text, signal) => replyRef.current(text, signal),
    phase: value => { if (focused.current) setPhase(value); },
    error: value => { if (focused.current) setError(value); },
  }), [recorder]);
  useEffect(() => {
    if (plan || !saved || !profile.ready) return;
    const first: PlanParticipant = profile.saved ? profileParticipant(profile.saved, saved) : {
      id: 'current-user', name: 'You', age: null, sex: null, dailyCalories: saved.dailyCalories,
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
    if (!plan) throw Error('Preferences are loading. Please try again.');
    const available = saved ? meals.filter(m => compatibleMeal(m, saved)) : meals;
    const result = await askPlanner(text.trim(), plan, messages, available.map(m => ({ id: m.id, name: m.name })), signal);
    if (!focused.current || signal.aborted) throw Error('Conversation stopped.');
    const protectedPeople = voiceParticipants(result.plan, originals.current);
    const safePlan: VoicePlan = { ...result.plan, people: protectedPeople.map(p => ({ name: p.name, calories: p.dailyCalories, protein: p.proteinTarget, diets: p.dietaryPreferences, allergens: p.allergens })) };
    let question = clarification(safePlan, result.language) ?? result.unresolved;
    if (!question && saved) {
      try { confirmedVoicePlan(safePlan, saved, originals.current); }
      catch {
        question = result.language === 'de' ? 'Ein Gerichtswunsch passt nicht zu euren Ernährungseinstellungen. Welches andere Gericht möchtest du, oder sollen wir ohne diesen Wunsch fortfahren?' : 'A meal wish conflicts with your dietary settings. Would you like a different meal, or should we continue without that wish?';
      }
    }
    const answer = question || result.reply;
    setPlan(safePlan); setLanguage(result.language); setUnresolved(question);
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
    })().catch(e => { if (focused.current) setError(e instanceof Error ? e.message : 'Plan could not be saved.'); })
      .finally(() => { saving.current = false; if (focused.current) setBusy(false); });
  };
  const manual = () => { void conversation.pause().then(() => { if (focused.current) router.replace(saved ? '/plan-setup' : '/onboarding/welcome'); }); };
  const status = { idle: 'Start a conversation', starting: 'Connecting microphone…', listening: 'Listening to you…', thinking: 'Thinking…', speaking: 'SmartBasket is speaking', stopping: 'Pausing…' }[phase];
  const active = phase !== 'idle';
  const signedIn = !!session && !session.user.is_anonymous;
  return <Screen top={false} bottom compact>
    <ScreenHeader eyebrow="LET’S PLAN" title="Tell me your basket wishes" subtitle="Days, people, budget and meals you fancy. We’ll work out the details together." />
    {!saved ? <SectionCard><Text style={ui.body}>Set up your preferences first so your dietary needs are included.</Text><PrimaryButton label="Set preferences" onPress={manual} /></SectionCard> : !signedIn ? <SectionCard><Text style={ui.body}>Sign in to use the voice assistant.</Text><PrimaryButton label="Sign in" onPress={() => router.push('/account')} /></SectionCard> : <>
      <SectionCard>
        <Text style={[ui.subheading, { textAlign: 'center' }]}>Your SmartBasket voice assistant</Text>
        <Text style={[ui.small, { textAlign: 'center' }]}>Start once and speak naturally. I’ll answer after a short pause and listen again. No typing or sending needed.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={phase === 'speaking' ? 'Interrupt and speak' : active ? 'Pause conversation' : 'Start conversation'} disabled={busy || !plan || phase === 'stopping'}
          onPress={() => { if (phase === 'speaking') conversation.interrupt(); else if (active) void conversation.pause(); else void conversation.start(); }}
          style={{ alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: 144, height: 144, marginVertical: 16, borderRadius: 72, borderWidth: 10, borderColor: colors.pale, backgroundColor: active ? colors.primary : colors.ink, opacity: busy ? .5 : 1 }}>
          <Feather name={phase === 'speaking' ? 'volume-2' : active ? 'pause' : 'mic'} size={44} color="white" />
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={[ui.subheading, { textAlign: 'center' }]}>{status}</Text>
        {phase === 'speaking' && <Text style={[ui.small, { textAlign: 'center' }]}>Tap the circle to interrupt and speak.</Text>}
        {phase === 'listening' && <SecondaryButton label="I’m done speaking" onPress={() => conversation.sendNow()} />}
        {active && <SecondaryButton label="Pause conversation" onPress={() => { void conversation.pause(); }} />}
        {!active && !messages.length && <Text style={ui.small}>Try: “Five days for me and my partner, €90 in total. I’d like salmon for dinner.”</Text>}
        {!!messages.length && <Text style={ui.body}>{messages[messages.length - 1].content}</Text>}
        <Text style={ui.caption}>Audio and planning wishes are processed by OpenAI. The microphone pauses while SmartBasket replies and turns off when you leave this screen.</Text>
      </SectionCard>
      {!!messages.length && <SecondaryButton label={showTranscript ? 'Hide conversation' : 'Show conversation'} onPress={() => setShowTranscript(!showTranscript)} />}
      {showTranscript && messages.map((m, i) => <View key={i} style={[ui.card, { padding: 14, backgroundColor: m.role === 'assistant' ? colors.pale : colors.surface }]}><Text style={ui.eyebrow}>{m.role === 'assistant' ? 'SMARTBASKET' : 'YOU'}</Text><Text selectable style={ui.body}>{m.content}</Text></View>)}
      {plan && <SectionCard title="Your plan so far">
        <Text style={ui.body}>{plan.days ?? '—'} days · {plan.people.length} {plan.people.length === 1 ? 'person' : 'people'} · {plan.budgetEnabled ? `€${plan.budget ?? '—'} total budget` : 'No budget limit'}</Text>
        {plan.people.map((p, i) => <View key={i}><Text style={[ui.body, { fontWeight: '700' }]}>{p.name || `Person ${i + 1}`}</Text><Text style={ui.small}>{p.calories ?? '—'} kcal · {p.protein ?? '—'} g protein / day</Text><Text style={ui.small}>{p.diets.filter(d => d !== 'none').map(d => labels[d]).join(' · ')}{p.allergens.length ? ` · Avoid: ${p.allergens.map(a => labels[a]).join(', ')}` : ''}</Text></View>)}
        {!!plan.preferredMealIds.length && <Text style={ui.small}>Meal wishes: {plan.preferredMealIds.map(id => meals.find(m => m.id === id)?.name).filter(Boolean).join(', ')}</Text>}
        {unresolved && <Text style={ui.small}>{unresolved}</Text>}
        <PrimaryButton label={language === 'de' ? 'Bestätigen & Gerichte auswählen' : 'Confirm & choose meals'} disabled={!!unresolved || !messages.length || busy || phase === 'thinking' || phase === 'starting' || phase === 'stopping'} onPress={handoff} />
      </SectionCard>}
    </>}
    <ErrorMessage message={error} />
    <SecondaryButton label="Continue with manual planning" disabled={busy} onPress={manual} />
  </Screen>;
}
