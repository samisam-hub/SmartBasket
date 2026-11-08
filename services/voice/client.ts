import { t } from '../i18n';
import { Platform } from 'react-native';
import { getSupabaseClient } from '../../lib/supabase';
import { isVoiceReply, type VoicePlan } from './contract';
export interface VoiceMessage { role: 'user' | 'assistant'; content: string }
async function invoke(body: FormData | object, signal: AbortSignal) {
  const client = getSupabaseClient();
  if (!client) throw Error(t('voice.needsConnection'));
  const { data: { session } } = await client.auth.getSession();
  if (!session || session.user.is_anonymous) throw Error(t('voice.needsAccount'));
  // Use a longer, abortable timeout than ordinary small catalog queries.
  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()}/functions/v1/basket-voice`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, apikey: (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
    body: body instanceof FormData ? body : JSON.stringify(body), signal,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Error(t('voice.unavailable'));
  return result;
}
export type VoiceInputLanguage = 'en' | 'de';
export async function transcribe(uri: string, signal: AbortSignal, language: VoiceInputLanguage = 'de') {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri, { signal })).blob();
    form.append('audio', blob, blob.type.includes('mp4') ? 'wish.m4a' : 'wish.webm');
  } else {
    form.append('audio', { uri, name: 'wish.m4a', type: 'audio/mp4' } as unknown as Blob);
  }
  form.append('language', language);
  const result = await invoke(form, signal);
  if (typeof result?.text !== 'string' || !result.text.trim() || result.text.length > 2000) throw Error(t('voice.notUnderstood'));
  return result.text as string;
}
export async function askPlanner(text: string, plan: VoicePlan, history: VoiceMessage[], meals: { id: string; name: string }[], signal: AbortSignal) {
  const result = await invoke({ text, plan, history: history.slice(-12), meals }, signal);
  if (!isVoiceReply(result)) throw Error(t('voice.incompleteAnswer'));
  return result;
}
