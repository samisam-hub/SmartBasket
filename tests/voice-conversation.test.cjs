require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {TurnDetector,VoiceConversation}=require('../services/voice/conversation.ts');
test('turn detection tolerates pauses, ignores noise bursts and bounds idle recordings',()=>{
 const d=new TurnDetector();
 for(let t=100;t<=1000;t+=100)assert.equal(d.sample(t,-25),null);
 for(let t=1100;t<2200;t+=100)assert.equal(d.sample(t,-80),null);
 assert.equal(d.sample(2200,-25),null);
 for(let t=2300;t<3800;t+=100)assert.equal(d.sample(t,-80),null);
 assert.equal(d.sample(3800,-80),'send');
 const noise=new TurnDetector();noise.sample(100,-20);
 assert.equal(noise.sample(15000,-80),'empty');
 const missing=new TurnDetector();assert.equal(missing.sample(15000,undefined),'empty');
 const long=new TurnDetector();for(let t=100;t<45000;t+=100)long.sample(t,-20);
 assert.equal(long.sample(45000,-20),'send');
});
function fixture(overrides={}){
 let clock=0,started=0,live=false,origin=0;const events=[];
 const recorder={
  start:async()=>{started++;live=true;origin=clock;events.push('record');},
  stop:async()=>{if(!live)return null;live=false;events.push('stop');return `clip-${started}`;},
  discard:async uri=>events.push(`discard:${uri}`),level:()=>clock-origin<600?-20:-90,isRecording:()=>live,
 };
 const ports={recorder,now:()=>clock,wait:async(ms,signal)=>{if(signal.aborted)throw Error('Stopped');clock+=ms;},
  transcribe:async uri=>{events.push(`transcribe:${uri}`);return `wish-${started}`;},
  reply:async text=>{events.push(`reply:${text}`);return {text:'Which days?',language:'en'};},
  speak:async()=>{assert.equal(live,false);events.push('speak');},
  phase:p=>events.push(p),error:e=>{if(e)events.push(`error:${e}`);},...overrides};
 return {ports,events,get starts(){return started;},get live(){return live;}};
}
test('one start sends speech directly, replies and listens again without text confirmation',async()=>{
 const f=fixture();let session;
 const original=f.ports.speak;f.ports.speak=async(...args)=>{await original(...args);if(f.starts===2)void session.pause();};
 session=new VoiceConversation(f.ports);await session.start();
 assert.equal(f.starts,2);assert.equal(f.live,false);
 assert.deepEqual(f.events.filter(x=>x.startsWith('reply:')),['reply:wish-1','reply:wish-2']);
 assert.equal(f.events.filter(x=>x==='speak').length,2);assert.ok(f.events.includes('discard:clip-2'));
});
test('pause during transcription aborts and discards without reply or microphone restart',async()=>{
 const f=fixture();let session;
 f.ports.transcribe=async()=>{void session.pause();return 'late text';};
 session=new VoiceConversation(f.ports);await session.start();
 assert.equal(f.starts,1);assert.equal(f.live,false);assert.ok(!f.events.some(x=>x.startsWith('reply:')));
 assert.ok(f.events.includes('discard:clip-1'));
});
test('interrupting a spoken reply opens the next listening turn; pausing cancels it',async()=>{
 const f=fixture();let session,speechSignal;
 f.ports.speak=async(text,language,signal)=>{speechSignal=signal;session.interrupt();};
 const start=f.ports.recorder.start;f.ports.recorder.start=async signal=>{await start(signal);if(f.starts===2)void session.pause();};
 session=new VoiceConversation(f.ports);await session.start();
 assert.equal(speechSignal.aborted,true);assert.equal(f.starts,2);assert.equal(f.live,false);
});
test('permission denial and network failures stop cleanly and can be retried',async()=>{
 const f=fixture();let attempts=0;
 const start=f.ports.recorder.start;f.ports.recorder.start=async signal=>{if(!attempts++)throw Error('Microphone denied');await start(signal);};
 f.ports.transcribe=async()=>{throw Error('Offline');};
 const session=new VoiceConversation(f.ports);await session.start();await session.start();
 assert.ok(f.events.includes('error:Microphone denied'));assert.ok(f.events.includes('error:Offline'));
 assert.equal(f.live,false);assert.ok(f.events.includes('discard:clip-1'));assert.equal(f.events.at(-1),'idle');
});
test('silence is never sent for transcription and repeated start does not overlap',async()=>{
 const f=fixture();f.ports.recorder.level=()=>-90;
 const session=new VoiceConversation(f.ports);await Promise.all([session.start(),session.start()]);
 assert.equal(f.starts,1);assert.equal(f.live,false);assert.ok(!f.events.some(x=>x.startsWith('transcribe:')));
});
