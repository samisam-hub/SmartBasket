import { germanAuthError } from '../../lib/german';
import {useEffect,useRef,useState} from 'react';
import {Text,Platform} from 'react-native';
import * as Linking from 'expo-linking';
import {router,useLocalSearchParams} from 'expo-router';
import {getSupabaseClient} from '../../lib/supabase';
import {Screen,ErrorMessage,SecondaryButton} from '../../components/ui';
import {useAuth} from '../../context/AuthContext';
export default function AuthCallback(){const {service}=useAuth();const params=useLocalSearchParams<{code?:string;error?:string;mode?:string}>(),started=useRef(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(started.current)return;started.current=true;void(async()=>{
  const raw=Platform.OS==='web'&&typeof window!=='undefined'?window.location.href:params.code?`smartbasket://auth/callback?code=${encodeURIComponent(params.code)}`:await Linking.getInitialURL();if(!raw)throw Error("Kein Bestätigungslink gefunden.");
  const u=new URL(raw),hash=new URLSearchParams(u.hash.slice(1)),client=getSupabaseClient();if(!client)throw Error("Verbinde dich mit SmartBasket, um deine E-Mail-Adresse zu bestätigen.");
  if(u.searchParams.get('error')||hash.get('error'))throw Error("Dieser Bestätigungslink ist ungültig oder abgelaufen. Fordere eine neue E-Mail an.");
  const code=u.searchParams.get('code');
  if(code){const r=await client.auth.exchangeCodeForSession(code);if(r.error)throw germanAuthError(r.error);}
  else if(hash.get('access_token')&&hash.get('refresh_token')){const r=await client.auth.setSession({access_token:hash.get('access_token')!,refresh_token:hash.get('refresh_token')!});if(r.error)throw germanAuthError(r.error);}
  else throw Error("Öffne die neueste Bestätigungs-E-Mail auf diesem Gerät oder gib den Code auf der Kontoseite ein.");
  if((params.mode??u.searchParams.get('mode'))==='register'&&await service?.completeRegistration())router.replace('/personal-profile');
  else router.replace({pathname:'/account',params:{mode:'password'}});
 })().catch(e=>setError(e.message));},[params.code,params.mode,service]);
 return <Screen><Text>Dein Konto wird bestätigt …</Text><ErrorMessage message={error} />{error&&<SecondaryButton label="Zurück zum Konto" onPress={()=>router.replace('/account')} />}</Screen>;
}
