import { authError, t } from '@/services/i18n';
import {useEffect,useRef,useState} from 'react';
import {Text,Platform} from 'react-native';
import * as Linking from 'expo-linking';
import {router,useLocalSearchParams} from 'expo-router';
import {getSupabaseClient} from '../../lib/supabase';
import {Screen,ErrorMessage,SecondaryButton} from '../../components/ui';
import {useAuth} from '../../context/AuthContext';
export default function AuthCallback(){const {service}=useAuth();const params=useLocalSearchParams<{code?:string;error?:string;mode?:string}>(),started=useRef(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(started.current)return;started.current=true;void(async()=>{
  const raw=Platform.OS==='web'&&typeof window!=='undefined'?window.location.href:params.code?`smartbasket://auth/callback?code=${encodeURIComponent(params.code)}`:await Linking.getInitialURL();if(!raw)throw Error(t('callback.noLink'));
  const u=new URL(raw),hash=new URLSearchParams(u.hash.slice(1)),client=getSupabaseClient();if(!client)throw Error(t('callback.noClient'));
  if(u.searchParams.get('error')||hash.get('error'))throw Error(t('callback.expired'));
  const code=u.searchParams.get('code');
  if(code){const r=await client.auth.exchangeCodeForSession(code);if(r.error)throw authError(r.error);}
  else if(hash.get('access_token')&&hash.get('refresh_token')){const r=await client.auth.setSession({access_token:hash.get('access_token')!,refresh_token:hash.get('refresh_token')!});if(r.error)throw authError(r.error);}
  else throw Error(t('callback.openLatest'));
  if((params.mode??u.searchParams.get('mode'))==='register'&&await service?.completeRegistration())router.replace('/personal-profile');
  else router.replace({pathname:'/account',params:{mode:'password'}});
 })().catch(e=>setError(e.message));},[params.code,params.mode,service]);
 return <Screen><Text>{t('callback.working')}</Text><ErrorMessage message={error} />{error&&<SecondaryButton label={t('callback.back')} onPress={()=>router.replace('/account')} />}</Screen>;
}
