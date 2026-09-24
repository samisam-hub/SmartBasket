# Voice-assisted basket planning

Home → Plan by voice → start conversation → speak → automatic reply → microphone reopens → answer clarifications → choose meals → existing meal review and product matching.

Uses Expo Audio recordings (maximum 45 seconds), OpenAI `gpt-4o-mini-transcribe`, structured Responses with `gpt-4.1-mini`, and device text-to-speech. The transcript is optional and read-only; there is no per-turn send/confirmation step. Manual planning remains available. Only signed-in, confirmed, non-anonymous accounts may call the backend. Defaults come from the personal profile; new people need explicit targets. Supported periods remain 3/5/7/14 days. Total budget is not multiplied by household size. Known restrictions are retained. Preferences are not updated by the assistant. Compatible requested meal IDs seed normal meal review; checkout is never performed by the agent.

## Backend activation

Project: `oepajinqjkcqqyddpgne`, function: `basket-voice`.
In Supabase → Edge Functions → Secrets add `OPENAI_API_KEY`. Create a dedicated SmartBasket key in the existing OpenAI account/project; do not reuse the other app's secret in source code. Configure an API usage budget. Never use an `EXPO_PUBLIC_` variable for this key.

Deploy the entrypoint with `services/voice/contract.ts` preserving relative paths. The function verifies the bearer token against Supabase Auth itself. Gateway JWT verification is disabled to support current asymmetric signing keys; there is no unauthenticated paid inference path.

The function returns a clear 503 when the key is missing. No recordings or transcripts are written to Supabase or application logs. Mobile recordings are deleted after transcription/discard; web blob URLs are revoked. OpenAI's API data handling still applies. Only the plan details the user confirms enter the existing local basket flow and its normal persistence. Requests time out and leaving the screen cancels the client request.

## Verification and limits

Unit coverage: supported/unsupported periods, per-person targets, budget, malformed response, restriction preservation, meal compatibility, and handoff into ordinary review. Before release test actual microphone grant/denial, 45-second stop, app backgrounding, lost network, German/English speech, and physical Android audio. Native dependencies require a new APK; an existing APK cannot acquire them through browser refresh.

The ten-requests-per-minute limiter is per Edge Function instance and is only a pilot safeguard, not a distributed spending cap. Add persistent rate limiting before a broad public launch. This is a hands-free chained conversation, not the OpenAI Realtime API: the microphone closes during processing and playback, then reopens. Tap the speaking circle to interrupt a reply. Silence detection uses 300 ms of voiced samples above -42 dB and a 1.6-second pause; short noise bursts are ignored. No speech for 15 seconds pauses the session without an API call. Each recording is bounded to 45 seconds and a session to ten minutes. Pause, navigation, backgrounding, and hidden browser tabs abort the loop and release microphone resources. The web implementation uses one MediaRecorder/Web Audio stream; native uses Expo Audio metering. Device speech playback failures pause the conversation instead of recording the assistant itself. The agent cannot guarantee availability of arbitrary dishes or support unknown exclusions; it must ask for an alternative or manual review.

References: https://docs.expo.dev/versions/v54.0.0/sdk/audio/ , https://docs.expo.dev/versions/v54.0.0/sdk/speech/ , https://developers.openai.com/api/docs/guides/speech-to-text , https://developers.openai.com/api/docs/guides/structured-outputs , https://supabase.com/docs/guides/functions/secrets .

Conversation tests cover automatic multi-turn processing, silence, long utterances, duplicate starts, interrupt, cancellation during transcription, permission denial, network errors, and cleanup. Physical-device microphone/speaker behavior still needs a real-device check.
