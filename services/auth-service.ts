import type { SupabaseClient } from '@supabase/supabase-js';
export const emailError=(email:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())&&email.length<=254?null:'Enter a valid email address.';
export const passwordError=(password:string)=>password.length>=8&&password.length<=128?null:'Use 8–128 characters.';
export function authService(client:SupabaseClient){
 let guest:Promise<unknown>|null=null;
 const ensureGuest=async()=>{const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session)return data.session;
  guest??=client.auth.signInAnonymously().then(r=>{if(r.error)throw r.error;return r.data.session;}).finally(()=>{guest=null;});return guest;};
 return {ensureGuest,
  async register(email:string,redirectTo:string){if(emailError(email))throw Error(emailError(email)!);await ensureGuest();
   const {data}=await client.auth.getSession();if(!data.session?.user.is_anonymous)throw Error('This session already has an account.');
   // Verify email first, then set a password. Identity and all owner foreign keys stay unchanged.
   const r=await client.auth.updateUser({email:email.trim()},{emailRedirectTo:redirectTo});if(r.error)throw r.error;return r.data.user;},
  async verify(email:string,token:string,type:'email_change'|'recovery'){if(emailError(email)||!/^\d{6,10}$/.test(token.trim()))throw Error('Enter the email and verification code.');const r=await client.auth.verifyOtp({email:email.trim(),token:token.trim(),type});if(r.error)throw r.error;return r.data;},
  async setPassword(password:string){if(passwordError(password))throw Error(passwordError(password)!);const r=await client.auth.updateUser({password});if(r.error)throw r.error;},
  async signIn(email:string,password:string){if(emailError(email)||!password)throw Error('Enter your email and password.');const r=await client.auth.signInWithPassword({email:email.trim(),password});if(r.error)throw r.error;return r.data;},
  async reset(email:string,redirectTo:string){if(emailError(email))throw Error(emailError(email)!);const r=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo});if(r.error)throw r.error;},
  async signOut(){const r=await client.auth.signOut({scope:'local'});if(r.error)throw r.error;},
 };
}
