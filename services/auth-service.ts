import { t } from './i18n';
import { authError } from '../services/i18n';
import type { SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const emailError=(email:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())&&email.length<=254?null:t('auth.invalidEmail');
export const passwordError=(password:string)=>password.length>=8&&password.length<=128?null:t('auth.passwordLength');
export function authService(client:SupabaseClient){
 let guest:Promise<unknown>|null=null;
 let pending:{owner:string;email:string;password:string}|null=null;
 const ensureGuest=async()=>{const {data,error}=await client.auth.getSession();if(error)throw authError(error);if(data.session)return data.session;
  guest??=client.auth.signInAnonymously().then(r=>{if(r.error)throw authError(r.error);return r.data.session;}).finally(()=>{guest=null;});return guest;};
 return {ensureGuest,
  clearRegistration(){pending=null;},
  async beginRegistration(email:string,password:string,redirectTo:string){
   pending=null;
   if(emailError(email))throw Error(emailError(email)!);
   if(passwordError(password))throw Error(passwordError(password)!);
   await ensureGuest();const {data,error}=await client.auth.getSession();if(error)throw authError(error);
   if(!data.session?.user.is_anonymous)throw Error(t('auth.alreadyAccount'));
   const owner=data.session.user.id;
   const r=await client.auth.updateUser({email:email.trim()},{emailRedirectTo:redirectTo});if(r.error)throw authError(r.error);
   // Memory only: never serialize credentials into drafts, URLs or browser storage.
   pending={owner,email:email.trim().toLowerCase(),password};
  },
  /** The confirmation mail again, for the one that never arrived. Only while a registration is
   *  actually waiting: without one there is no address to send to, and a button that silently
   *  does nothing is worse than one that says why. */
  async resendConfirmation(redirectTo:string){
   if(!pending)throw Error(t('auth.startRegistration'));
   const {data,error}=await client.auth.getSession();if(error)throw error;
   if(data.session?.user.id!==pending.owner)throw Error(t('auth.accountChangedRestart'));
   const r=await client.auth.updateUser({email:pending.email},{emailRedirectTo:redirectTo});if(r.error)throw r.error;
   return pending.email;
  },
  pendingEmail(){return pending?.email??null;},
  async completeRegistration(){
   if(!pending)return false;
   const attempt=pending;
   const {data,error}=await client.auth.getUser();if(error)throw authError(error);
   if(data.user?.id!==attempt.owner){pending=null;throw Error(t('auth.accountChangedRestartDe'));}
   if(data.user.is_anonymous||!data.user.email_confirmed_at||data.user.email?.toLowerCase()!==attempt.email)throw Error(t('auth.confirmFirst'));
   const r=await client.auth.updateUser({password:attempt.password});if(r.error)throw authError(r.error);
   pending=null;return true;
  },
  async register(email:string,redirectTo:string){if(emailError(email))throw Error(emailError(email)!);await ensureGuest();
   const {data}=await client.auth.getSession();if(!data.session?.user.is_anonymous)throw Error(t('auth.sessionHasAccount'));
   // Verify email first, then set a password. Identity and all owner foreign keys stay unchanged.
   const r=await client.auth.updateUser({email:email.trim()},{emailRedirectTo:redirectTo});if(r.error)throw authError(r.error);return r.data.user;},
  async verify(email:string,token:string,type:'email_change'|'recovery'){if(emailError(email)||!/^\d{6,10}$/.test(token.trim()))throw Error(t('auth.needEmailAndCode'));const r=await client.auth.verifyOtp({email:email.trim(),token:token.trim(),type});if(r.error)throw authError(r.error);return r.data;},
  async setPassword(password:string){if(passwordError(password))throw Error(passwordError(password)!);const r=await client.auth.updateUser({password});if(r.error)throw authError(r.error);},
   async signIn(email:string,password:string){pending=null;if(emailError(email)||!password)throw Error(t('auth.needEmailAndPassword'));const r=await client.auth.signInWithPassword({email:email.trim(),password});if(r.error)throw authError(r.error);return r.data;},
   async reset(email:string,redirectTo:string){if(emailError(email))throw Error(emailError(email)!);const r=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo});if(r.error)throw authError(r.error);},
   async deleteAccount(){
    const {data,error}=await client.auth.getSession();
    if(error)throw authError(error);
    if(!data.session||data.session.user.is_anonymous)throw Error(t('auth.signInBeforeDelete'));
    const result=await client.functions.invoke('delete-account',{body:{}});
    if(result.error)throw authError(result.error);
    pending=null;
    const keys=await AsyncStorage.getAllKeys();
    const appKeys=keys.filter(key=>key.startsWith('smartbasket.')||key.startsWith('smartbasket-auth:'));
    if(appKeys.length)await AsyncStorage.multiRemove(appKeys);
    const signedOut=await client.auth.signOut({scope:'local'});
    if(signedOut.error)throw authError(signedOut.error);
   },
   async signOut(){pending=null;const r=await client.auth.signOut({scope:'local'});if(r.error)throw authError(r.error);},
 };
}
