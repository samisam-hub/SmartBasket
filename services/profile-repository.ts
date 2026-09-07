import type {SupabaseClient} from '@supabase/supabase-js';
import type {PersonalProfile} from '../types/profile';
import {validateProfile} from './profile-domain';
export const profileColumns={displayName:'display_name',sex:'sex',age:'age',heightCm:'height_cm',weightKg:'weight_kg',primaryNutritionGoal:'primary_nutrition_goal',activityLevel:'activity_level',defaultDailyCalories:'default_daily_calories',proteinMode:'protein_mode',defaultProteinTargetGrams:'default_protein_target_grams',dietaryPreferences:'dietary_preferences',allergens:'allergens',intolerances:'intolerances',onboardingCompleted:'onboarding_completed'};
export function profileFromRow(r:Record<string,unknown>):PersonalProfile {
 const p={id:r.id,...Object.fromEntries(Object.entries(profileColumns).map(([key,col])=>[key,r[col]]))} as PersonalProfile;
 if(typeof p.id!=='string'||typeof p.onboardingCompleted!=='boolean'||Object.keys(validateProfile(p)).length)throw Error('Invalid personal profile.');return p;
}
export function profileToRow(p:PersonalProfile,id:string){if(Object.keys(validateProfile(p)).length)throw Error('Check your personal profile.');return {id,...Object.fromEntries(Object.entries(profileColumns).map(([key,col])=>[col,p[key as keyof typeof profileColumns]]))};}
export function profileRepository(client:SupabaseClient,id:string){
 const check=async()=>{const r=await client.auth.getSession();if(r.error||r.data.session?.user.id!==id)throw Error('Account changed. Reopen your profile.');};
 return {async load(){await check();const r=await client.from('profiles').select('*').eq('id',id).maybeSingle();if(r.error)throw r.error;return r.data?profileFromRow(r.data):null;},
 async save(p:PersonalProfile){await check();const r=await client.from('profiles').upsert(profileToRow(p,id)).select('*').single();if(r.error)throw r.error;await check();return profileFromRow(r.data);}};
}
