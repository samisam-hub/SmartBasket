import {BrandLogo} from '../components/BrandAssets';
import {useEffect,useRef,useState} from 'react';
import {Platform,Text} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {Screen,ScreenHeader,TextInput,PrimaryButton,SecondaryButton,ErrorMessage} from '../components/ui';
import {useAuth} from '../context/AuthContext';
import {emailError,passwordError} from '../services/auth-service';
import {ui} from '../lib/theme';
import {t} from '../services/i18n';
const accountRedirect=(mode:string)=>`${Platform.OS==='web'&&typeof window!=='undefined'?`${window.location.origin}/`:'smartbasket://'}auth/callback?mode=${encodeURIComponent(mode)}`;
export default function AccountScreen(){
 const params=useLocalSearchParams<{mode?:string}>(),{service,session}=useAuth();
 const [mode,setMode]=useState(params.mode??'create'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState(''),[showCode,setShowCode]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
 const running=useRef(false);
 useEffect(()=>{if(params.mode)setMode(params.mode);},[params.mode]);
 const changeMode=(next:string)=>{service?.clearRegistration();setPassword('');setToken('');setShowCode(false);setMessage(null);setError(null);setMode(next);};
 const run=async()=>{
  if(!service||running.current)return;running.current=true;setBusy(true);setError(null);
  try{
   if(mode==='create'){
    await service.beginRegistration(email,password,accountRedirect('register'));setPassword('');setMode('verify');
    setMessage(t('account.checkInbox'));
   }else if(mode==='verify'){
    if(showCode)await service.verify(email,token,'email_change');
    if(await service.completeRegistration()){setToken('');router.dismissTo('/personal-profile');}
    else {setMode('password');setMessage(t('account.confirmedNow'));}
   }else if(mode==='password'){
    await service.setPassword(password);service.clearRegistration();setPassword('');router.dismissTo('/personal-profile');
   }else if(mode==='forgot'){
    await service.reset(email,accountRedirect('recovery'));setMode('recovery-code');setMessage(t('account.resetSent'));
   }else if(mode==='recovery-code'){
    await service.verify(email,token,'recovery');setMode('password');setToken('');
   }else {await service.signIn(email,password);setPassword('');router.dismissTo('/profile');}
  }catch(e){setError(e instanceof Error?e.message:t('account.failed'));}
  finally{running.current=false;setBusy(false);}
 };
 const waiting=mode==='verify'||mode==='recovery-code';
 return <Screen top={false} bottom><BrandLogo />
  <ScreenHeader eyebrow={t('account.eyebrow')} title={t(mode==='create'?'account.createTitle':mode==='signin'?'account.signInTitle':mode==='forgot'?'account.forgotTitle':mode==='password'?'account.passwordTitle':'account.verifyTitle')} />
  <Text style={ui.small}>{t(mode==='create'?'account.createHint':mode==='signin'?'account.signInHint':'account.keepHint')}</Text>
  <ErrorMessage message={error} />{message&&<Text style={ui.body}>{message}</Text>}
  {!service&&<Text>{t('account.noService')}</Text>}
  {mode!=='password'&&<TextInput label={t('account.email')} editable={!busy&&!waiting} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} error={email?emailError(email)??undefined:undefined} />}
  {(mode==='create'||mode==='signin'||mode==='password')&&<TextInput label={t('account.password')} editable={!busy} secureTextEntry autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChangeText={setPassword} error={mode!=='signin'&&password?passwordError(password)??undefined:undefined} />}
  {waiting&&showCode&&<TextInput label={t('account.code')} editable={!busy} value={token} keyboardType="number-pad" onChangeText={setToken} />}
  {(mode!=='recovery-code'||showCode)&&<PrimaryButton label={t(mode==='create'?'account.createAction':mode==='signin'?'account.signInAction':mode==='forgot'?'account.sendReset':mode==='password'?'account.savePassword':showCode?'account.confirmEmail':'account.confirmed')} loading={busy} disabled={!service} onPress={()=>{void run();}} />}
  {mode==='verify'&&<SecondaryButton label={t('account.resend')} disabled={busy||!service} onPress={()=>{void (async()=>{
    setBusy(true);setError(null);
    try{const to=await service!.resendConfirmation(accountRedirect('register'));setMessage(t('account.resentTo',{email:to}));}
    catch(e){setError(e instanceof Error?e.message:t('account.resendFailed'));}
    finally{setBusy(false);}
  })();}} />}
  {waiting&&!showCode&&<SecondaryButton label={t('account.haveCode')} disabled={busy} onPress={()=>setShowCode(true)} />}
  {session?.user.email&&!session.user.is_anonymous&&mode==='create'&&<SecondaryButton label={t('account.finishPassword')} disabled={busy} onPress={()=>changeMode('password')} />}
  {mode!=='signin'&&<SecondaryButton label={t('account.haveAccount')} disabled={busy} onPress={()=>changeMode('signin')} />}
  {mode==='signin'&&<><SecondaryButton label={t('account.createAction')} disabled={busy} onPress={()=>changeMode('create')} /><SecondaryButton label={t('account.forgot')} disabled={busy} onPress={()=>changeMode('forgot')} /></>}
  <SecondaryButton label={t('account.asGuest')} disabled={busy} onPress={()=>{service?.clearRegistration();setPassword('');router.replace('/intro');}} />
 </Screen>;
}
