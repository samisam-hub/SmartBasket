import {emptyProfile,type PersonalProfile} from '../types/profile';
import {validateProfile} from './profile-domain';
import type {LocalStorage} from './preference-store';
export class ProfileStore {
 private state={ready:false,draft:structuredClone(emptyProfile),saved:null as PersonalProfile|null,step:0,pending:false,error:null as string|null};
 private listeners=new Set<()=>void>();private writes=Promise.resolve();private revision=0;private readable=true;
 constructor(private storage:LocalStorage,private key:string,private remote:{load():Promise<PersonalProfile|null>;save(p:PersonalProfile):Promise<PersonalProfile>}|null){}
 getSnapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private publish(p:Partial<typeof this.state>){this.state={...this.state,...p};this.listeners.forEach(f=>f());}
 private persist(value=this.state){if(!this.readable)return Promise.reject(Error('Stored profile could not be read; it has not been overwritten.'));const json=JSON.stringify(value);this.writes=this.writes.catch(()=>{}).then(()=>this.storage.setItem(this.key,json));return this.writes;}
 flush=()=>this.persist();
 initialize=async()=>{try{const raw=await this.storage.getItem(this.key);if(raw){const p=JSON.parse(raw);if(!p.draft||typeof p.draft.displayName!=='string'||!Array.isArray(p.draft.dietaryPreferences)||!Array.isArray(p.draft.allergens)||!Array.isArray(p.draft.intolerances)||p.saved&&Object.keys(validateProfile(p.saved)).length||!Number.isInteger(p.step)||p.step<0||p.step>4||typeof p.pending!=='boolean')throw Error();this.publish({draft:p.draft,saved:p.saved,step:p.step,pending:p.pending});}}catch{this.readable=false;this.publish({error:'Stored profile could not be read; it has not been overwritten.'});}
  this.publish({ready:true});if(!this.remote||!this.readable)return;const revision=this.revision;
  try{const p=await this.remote.load();if(p&&!this.state.pending&&revision===this.revision){this.publish({saved:p,draft:p,step:0});await this.persist();}}catch{this.publish({error:'Personal profile is available locally. Cloud load failed.'});}
 };
 update=(patch:Partial<PersonalProfile>,step=this.state.step)=>{this.revision++;this.publish({draft:{...this.state.draft,...patch},step,pending:true});void this.persist().catch(e=>this.publish({error:e.message}));};
 save=async()=>{if(Object.keys(validateProfile(this.state.draft)).length)throw Error('Check the highlighted fields.');const p={...this.state.draft,onboardingCompleted:true};const revision=++this.revision;const next={...this.state,draft:p,saved:p,pending:true,error:null};await this.persist(next);
  if(revision===this.revision)this.publish(next);else {this.publish({saved:p});await this.persist();}
  if(this.remote){try{const saved=await this.remote.save(p);if(revision===this.revision){this.publish({saved,draft:saved,pending:false});await this.persist();}}catch{this.publish({error:'Saved on this device. Cloud sync failed; retry Save profile.'});}}
 };
}
