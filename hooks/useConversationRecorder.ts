import { useMemo } from 'react';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { deleteAsync } from 'expo-file-system/legacy';
import type { ConversationRecorder } from '../services/voice/conversation';
export function useConversationRecorder(): ConversationRecorder {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  return useMemo(() => {
    let prepared = false;
    return {
      async start(signal: AbortSignal) {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) throw Error('Allow microphone access in settings to start a voice conversation.');
        if (signal.aborted) return;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        try { await recorder.prepareToRecordAsync(); prepared = true; if (!signal.aborted) recorder.record(); }
        catch (e) { await setAudioModeAsync({ allowsRecording: false }); throw e; }
      },
      async stop() {
        if (!prepared) return null;
        prepared = false;
        try { await recorder.stop(); return recorder.uri; }
        finally { await setAudioModeAsync({ allowsRecording: false }); }
      },
      async discard(uri: string) { await deleteAsync(uri, { idempotent: true }).catch(() => {}); },
      level: () => recorder.getStatus().metering,
      isRecording: () => recorder.getStatus().isRecording,
    };
  }, [recorder]);
}
