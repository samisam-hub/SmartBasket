import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as Speech from 'expo-speech';
import { deleteAsync } from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, SectionCard, ScreenHeader, TextInput, PrimaryButton, SecondaryButton, ErrorMessage } from '../components/ui';
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

export default function VoicePlanScreen() {
  const { session } = useAuth(), { saved } = usePreferences(), profile = useProfile();
  const originals = useRef<PlanParticipant[]>([]);
  const [plan, setPlan] = useState<VoicePlan | null>(null);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [text, setText] = useState(''), [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [unresolved, setUnresolved] = useState<string | null>('Tell me what you would like to plan.');
  const [language, setLanguage] = useState<'en' | 'de'>('en'), [speak, setSpeak] = useState(true);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY), state = useAudioRecorderState(recorder);
  const request = useRef<AbortController | null>(null), lock = useRef(false), focused = useRef(true);
  const recording = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const discard = useCallback(async () => {
    if (!recorder.uri) return;
    if (Platform.OS === 'web') URL.revokeObjectURL(recorder.uri);
    else await deleteAsync(recorder.uri, { idempotent: true }).catch(() => {});
  }, [recorder]);
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
    focused.current = true;
    setBusy(lock.current);
    const stop = () => {
      clearTimer(); request.current?.abort(); void Speech.stop();
      if (recording.current) { recording.current = false; void recorder.stop().catch(() => {}).finally(async () => { await discard(); await setAudioModeAsync({ allowsRecording: false }).catch(() => {}); }); }
    };
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') stop(); });
    return () => { focused.current = false; stop(); subscription.remove(); };
  }, [recorder, discard]));
  const work = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 55000);
    try { await action(controller.signal); }
    catch (e) { if (focused.current) setError(controller.signal.aborted ? 'Request stopped. Please retry or continue manually.' : e instanceof Error ? e.message : 'Please try again.'); }
    finally { clearTimeout(timeout); lock.current = false; if (focused.current) setBusy(false); }
  };
  const stopRecording = async () => {
    if (!recording.current) return;
    recording.current = false; clearTimer();
    await work(async signal => {
      await recorder.stop(); await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw Error('Recording unavailable. Please try again.');
      try { const transcript = await transcribe(uri, signal); if (focused.current && !signal.aborted) setText(transcript); }
      finally { await discard(); }
    });
  };
  const startRecording = () => { void work(async signal => {
    await Speech.stop();
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) throw Error('Microphone access is off. Enable it in settings, or type your wishes below.');
    if (!focused.current || signal.aborted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    if (!focused.current || signal.aborted) { await recorder.stop(); return; }
    recorder.record(); recording.current = true;
    timer.current = setTimeout(() => { void stopRecording(); }, 45000);
  }); };
  const send = () => { if (!plan || !text.trim()) return; void work(async signal => {
    await Speech.stop();
    const available = saved ? meals.filter(m => compatibleMeal(m, saved)) : meals;
    const result = await askPlanner(text.trim(), plan, messages, available.map(m => ({ id: m.id, name: m.name })), signal);
    if (!focused.current || signal.aborted) return;
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
    setMessages(previous => [...previous.slice(-10), { role: 'user', content: text.trim() }, { role: 'assistant', content: answer }]); setText('');
    if (speak) Speech.speak(answer, { language: result.language === 'de' ? 'de-DE' : 'en-GB' });
  }); };
  const handoff = () => { if (!saved || !plan || unresolved || text.trim()) return; void work(async () => {
    const input = confirmedVoicePlan(plan, saved, originals.current);
    const owner = session?.user.id ?? 'local';
    await AsyncStorage.setItem(`smartbasket.active-plan.v1:${owner}`, JSON.stringify(input));
    await AsyncStorage.setItem(`smartbasket.plan-draft.v1:${owner}`, JSON.stringify({ people: input.participants, days: input.planningDays, budget: input.weeklyBudgetEur, budgetEnabled: input.budgetEnabled }));
    await Speech.stop(); if (focused.current) router.replace({ pathname: '/basket-setup', params: { participants: '1' } });
  }); };
  const manual = () => router.replace(saved ? '/plan-setup' : '/onboarding/welcome');
  const signedIn = !!session && !session.user.is_anonymous;
  return <Screen top={false} bottom compact>
    <ScreenHeader eyebrow="LET’S PLAN" title="Tell me your basket wishes" subtitle="Days, people, budget and meals you fancy. We’ll work out the details together." />
    {!saved ? <SectionCard><Text style={ui.body}>Set up your preferences first so your dietary needs are included.</Text><PrimaryButton label="Set preferences" onPress={manual} /></SectionCard> : !signedIn ? <SectionCard><Text style={ui.body}>Sign in to use the voice assistant.</Text><PrimaryButton label="Sign in" onPress={() => router.push('/account')} /></SectionCard> : <>
      <SectionCard>
        <Text style={ui.small}>For example: “Five days for me and my partner, €90 in total. I’d like salmon for dinner.”</Text>
        <Text style={ui.caption}>Your recording and planning wishes are sent to OpenAI for processing. Your saved restrictions stay in place.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={state.isRecording ? 'Stop recording' : 'Start recording'} disabled={busy || !plan}
          onPress={state.isRecording ? () => { void stopRecording(); } : startRecording}
          style={{ alignSelf: 'center', padding: 24, borderRadius: 50, backgroundColor: state.isRecording ? colors.error : colors.primary, opacity: busy ? .5 : 1 }}>
          <Feather name={state.isRecording ? 'square' : 'mic'} size={32} color="white" />
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={[ui.small, { textAlign: 'center' }]}>{state.isRecording ? `Listening · ${Math.floor(state.durationMillis / 1000)}s / 45s` : busy ? 'One moment…' : 'Tap to speak, then tap to stop'}</Text>
        <SecondaryButton label={speak ? 'Spoken replies: on' : 'Spoken replies: off'} onPress={() => { setSpeak(!speak); void Speech.stop(); }} />
      </SectionCard>
      {messages.map((m, i) => <View key={i} style={[ui.card, { padding: 14, backgroundColor: m.role === 'assistant' ? colors.pale : colors.surface }]}><Text style={ui.eyebrow}>{m.role === 'assistant' ? 'SMARTBASKET' : 'YOU'}</Text><Text selectable style={ui.body}>{m.content}</Text></View>)}
      <SectionCard>
        <TextInput label="Check your words, or type a reply" value={text} onChangeText={setText} multiline maxLength={2000} editable={!busy && !state.isRecording} placeholder="What would you like in your basket?" />
        <PrimaryButton label="Send wishes" disabled={!text.trim() || busy || state.isRecording || !plan} onPress={send} />
      </SectionCard>
      {plan && <SectionCard title="Your plan so far">
        <Text style={ui.body}>{plan.days ?? '—'} days · {plan.people.length} {plan.people.length === 1 ? 'person' : 'people'} · {plan.budgetEnabled ? `€${plan.budget ?? '—'} total budget` : 'No budget limit'}</Text>
        {plan.people.map((p, i) => <View key={i}><Text style={[ui.body, { fontWeight: '700' }]}>{p.name || `Person ${i + 1}`}</Text><Text style={ui.small}>{p.calories ?? '—'} kcal · {p.protein ?? '—'} g protein / day</Text><Text style={ui.small}>{p.diets.filter(d => d !== 'none').map(d => labels[d]).join(' · ')}{p.allergens.length ? ` · Avoid: ${p.allergens.map(a => labels[a]).join(', ')}` : ''}</Text></View>)}
        {!!plan.preferredMealIds.length && <Text style={ui.small}>Meal wishes: {plan.preferredMealIds.map(id => meals.find(m => m.id === id)?.name).filter(Boolean).join(', ')}</Text>}
        {unresolved && <Text style={ui.small}>{unresolved}</Text>}
        <PrimaryButton label={language === 'de' ? 'Bestätigen & Gerichte auswählen' : 'Confirm & choose meals'} disabled={!!unresolved || !!text.trim() || !messages.length || busy || state.isRecording} onPress={handoff} />
      </SectionCard>}
    </>}
    <ErrorMessage message={error} />
    <SecondaryButton label="Continue with manual planning" disabled={busy || state.isRecording} onPress={manual} />
  </Screen>;
}
