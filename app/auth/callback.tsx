import {useEffect,useRef,useState} from 'react';
import {Text,Platform} from 'react-native';
import * as Linking from 'expo-linking';
import {router,useLocalSearchParams} from 'expo-router';
import {getSupabaseClient} from '../../lib/supabase';
import {Screen,ErrorMessage,SecondaryButton} from '../../components/ui';
import {useAuth} from '../../context/AuthContext';
export default function AuthCallback(){const {service}=useAuth();const params=useLocalSearchParams<{code?:string;error?:string;mode?:string}>(),started=useRef(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(started.current)return;started.current=true;void(async()=>{
  const raw=Platform.OS==='web'&&typeof window!=='undefined'?window.location.href:params.code?`smartbasket://auth/callback?code=${encodeURIComponent(params.code)}`:await Linking.getInitialURL();if(!raw)throw Error('No verification link found.');
  const u=new URL(raw),hash=new URLSearchParams(u.hash.slice(1)),client=getSupabaseClient();if(!client)throw Error('Connect to SmartBasket to verify your email.');
  if(u.searchParams.get('error')||hash.get('error'))throw Error('This verification link is invalid or expired. Request a new email.');
  const code=u.searchParams.get('code');
  if(code){const r=await client.auth.exchangeCodeForSession(code);if(r.error)throw r.error;}
  else if(hash.get('access_token')&&hash.get('refresh_token')){const r=await client.auth.setSession({access_token:hash.get('access_token')!,refresh_token:hash.get('refresh_token')!});if(r.error)throw r.error;}
  else throw Error('Open the latest verification email on this device, or enter its code on the account screen.');
  if((params.mode??u.searchParams.get('mode'))==='register'&&await service?.completeRegistration())router.replace('/personal-profile');
  else router.replace({pathname:'/account',params:{mode:'password'}});
 })().catch(e=>setError(e.message));},[params.code,params.mode,service]);
 return <Screen><Text>Verifying your account…</Text><ErrorMessage message={error} />{error&&<SecondaryButton label="Return to account" onPress={()=>router.replace('/account')} />}</Screen>;
}
