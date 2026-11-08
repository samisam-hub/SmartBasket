import { t } from '../i18n';
import * as Speech from 'expo-speech';
export function speakReply(text: string, language: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { resolve(); return; }
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return; finished = true;
      clearTimeout(timeout); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => { void Speech.stop(); finish(); };
    const timeout = setTimeout(() => { void Speech.stop(); finish(Error(t('voice.audioEnded'))); }, 120000);
    signal.addEventListener('abort', abort, { once: true });
    try { Speech.speak(text, { language: language === 'de' ? 'de-DE' : 'en-GB', onDone: () => finish(), onStopped: () => finish(), onError: () => finish(Error(t('voice.noSpokenAnswers'))) }); }
    catch { finish(Error(t('voice.noSpokenAnswersRetry'))); }
  });
}
