export type ConversationPhase = 'idle' | 'starting' | 'listening' | 'thinking' | 'speaking' | 'stopping';
export interface ConversationRecorder {
  start(signal: AbortSignal): Promise<void>;
  stop(): Promise<string | null>;
  discard(uri: string): Promise<void>;
  level(): number | undefined;
  isRecording(): boolean;
}
/** Noise bursts do not count as speech; natural pauses inside a sentence are allowed. */
export class TurnDetector {
  private voicedMs = 0;
  private lastVoice = 0;
  private lastSample = 0;
  sample(elapsed: number, db: number | undefined): 'send' | 'empty' | null {
    const delta = Math.min(200, Math.max(0, elapsed - this.lastSample)); this.lastSample = elapsed;
    if (db !== undefined && Number.isFinite(db) && db > -42) { this.voicedMs += delta; this.lastVoice = elapsed; }
    const heard = this.voicedMs >= 300;
    if (heard && elapsed - this.lastVoice >= 1600) return 'send';
    if (elapsed >= 45000) return heard ? 'send' : 'empty';
    if (!heard && elapsed >= 15000) return 'empty';
    return null;
  }
}
const delay = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new Error('Stopped')); return; }
  const abort = () => { clearTimeout(timer); reject(new Error('Stopped')); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  signal.addEventListener('abort', abort, { once: true });
});
interface ConversationPorts {
  recorder: ConversationRecorder;
  transcribe(uri: string, signal: AbortSignal): Promise<string>;
  reply(text: string, signal: AbortSignal): Promise<{ text: string; language: string }>;
  speak(text: string, language: string, signal: AbortSignal): Promise<void>;
  phase(phase: ConversationPhase): void;
  error(message: string | null): void;
  // Replaceable clock only for deterministic lifecycle tests.
  now?: () => number;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}
export class VoiceConversation {
  private controller: AbortController | null = null;
  private speech: AbortController | null = null;
  private task: Promise<void> | null = null;
  private finishTurn = false;
  constructor(private ports: ConversationPorts) {}
  start() {
    if (this.task) return this.task;
    this.controller = new AbortController(); this.ports.error(null);
    this.task = this.run(this.controller.signal).finally(() => { this.task = null; this.controller = null; this.ports.phase('idle'); });
    return this.task;
  }
  async pause() {
    if (!this.task) return;
    this.ports.phase('stopping'); this.controller?.abort(); this.speech?.abort();
    await this.task;
  }
  sendNow() { this.finishTurn = true; }
  interrupt() { this.speech?.abort(); }
  private async run(signal: AbortSignal) {
    const { recorder } = this.ports, now = this.ports.now ?? Date.now, wait = this.ports.wait ?? delay;
    const sessionStarted = now();
    try {
      while (!signal.aborted && now() - sessionStarted < 600000) {
        let uri: string | null = null;
        try {
          this.finishTurn = false;
          this.ports.phase('starting'); await recorder.start(signal);
          if (signal.aborted) break;
          this.ports.phase('listening');
          const started = now(), detector = new TurnDetector(); let decision: 'send' | 'empty' | null = null;
          while (!decision && !signal.aborted) {
            await wait(100, signal);
            if (!recorder.isRecording()) throw Error('Microphone disconnected. Please start the conversation again.');
            decision = this.finishTurn ? 'send' : detector.sample(now() - started, recorder.level());
          }
          uri = await recorder.stop();
          if (signal.aborted) break;
          if (decision === 'empty') { this.ports.error('No speech heard. The conversation is paused. Tap the microphone to try again.'); break; }
          if (!uri) throw Error('Recording unavailable. Please start the conversation again.');
          this.ports.phase('thinking');
          const processing = new AbortController();
          const abort = () => processing.abort(); signal.addEventListener('abort', abort, { once: true });
          const timeout = setTimeout(abort, 90000);
          let answer: { text: string; language: string };
          try {
            const text = await this.ports.transcribe(uri, processing.signal);
            if (processing.signal.aborted) throw Error('Request stopped. Please try again.');
            if (!text.trim()) throw Error('No clear speech heard. Please try again.');
            answer = await this.ports.reply(text, processing.signal);
            if (processing.signal.aborted) throw Error('Request stopped. Please try again.');
          } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
          await recorder.discard(uri); uri = null;
          if (signal.aborted) break;
          this.ports.phase('speaking'); this.speech = new AbortController();
          const stopSpeech = () => this.speech?.abort(); signal.addEventListener('abort', stopSpeech, { once: true });
          try { await this.ports.speak(answer.text, answer.language, this.speech.signal); }
          finally { signal.removeEventListener('abort', stopSpeech); this.speech = null; }
          // Let the speaker tail finish before reopening the microphone.
          await wait(350, signal);
        } finally {
          const pending = await recorder.stop().catch(() => null);
          if (uri) await recorder.discard(uri);
          if (pending && pending !== uri) await recorder.discard(pending);
        }
      }
    } catch (e) {
      if (!signal.aborted) this.ports.error(e instanceof Error ? e.message : 'Conversation paused. Please try again.');
    }
  }
}
