import { useMemo } from 'react';
import type { ConversationRecorder } from '../services/voice/conversation';
/** One stream supplies both recording and silence detection. Never connect mic to speakers. */
export function useConversationRecorder(): ConversationRecorder {
  return useMemo(() => {
    let stream: MediaStream | null = null, context: AudioContext | null = null, analyser: AnalyserNode | null = null;
    let recorder: MediaRecorder | null = null, ended: Promise<string> | null = null;
    const release = async () => {
      stream?.getTracks().forEach(track => track.stop()); stream = null;
      if (context) await context.close().catch(() => {}); context = null; analyser = null;
    };
    return {
      async start(signal: AbortSignal) {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw Error('Voice is unavailable in this browser. Please use a supported browser over HTTPS or localhost.');
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
          if (signal.aborted) { await release(); return; }
          context = new AudioContext(); await context.resume();
          analyser = context.createAnalyser(); analyser.fftSize = 2048;
          context.createMediaStreamSource(stream).connect(analyser);
          const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
          if (!mime) throw Error('This browser cannot record a supported audio format.');
          recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 });
          const chunks: Blob[] = [];
          recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
          ended = new Promise(resolve => { recorder!.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: mime }))); });
          // A failed recording is discarded by the controller, not submitted as speech.
          recorder.onerror = () => { if (recorder?.state !== 'inactive') recorder?.stop(); };
          if (signal.aborted) { recorder = null; ended = null; await release(); return; }
          recorder.start();
        } catch (e) { recorder = null; ended = null; await release(); throw e; }
      },
      async stop() {
        if (!recorder) { await release(); return null; }
        const current = recorder, result = ended; recorder = null; ended = null;
        try { if (current.state !== 'inactive') current.stop(); return await result; } finally { await release(); }
      },
      async discard(uri: string) { URL.revokeObjectURL(uri); },
      level() {
        if (!analyser) return undefined;
        const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
        const power = samples.reduce((sum, value) => sum + value * value, 0) / samples.length;
        return 10 * Math.log10(Math.max(power, 1e-10));
      },
      isRecording: () => recorder?.state === 'recording' && !!stream?.getAudioTracks().some(track => track.readyState === 'live'),
    };
  }, []);
}
