import {useEffect,useRef,useState} from 'react';
import {Platform,Text} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {Screen,ScreenHeader,TextInput,PrimaryButton,SecondaryButton,ErrorMessage} from '../components/ui';
import {useAuth} from '../context/AuthContext';
import {emailError,passwordError} from '../services/auth-service';
import {ui} from '../lib/theme';
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
    setMessage('Check your inbox and confirm your email. Keep this page open, then return here to finish creating your account. Your saved SmartBasket data stays with you.');
   }else if(mode==='verify'){
    if(showCode)await service.verify(email,token,'email_change');
    if(await service.completeRegistration()){setToken('');router.dismissTo('/personal-profile');}
    else {setMode('password');setMessage('Email confirmed. Re-enter your chosen password to finish. Passwords are not saved while the app is closed or reloaded.');}
   }else if(mode==='password'){
    await service.setPassword(password);service.clearRegistration();setPassword('');router.dismissTo('/personal-profile');
   }else if(mode==='forgot'){
    await service.reset(email,accountRedirect('recovery'));setMode('recovery-code');setMessage('If this address is eligible, a reset email has been sent. Open its link to choose a new password.');
   }else if(mode==='recovery-code'){
    await service.verify(email,token,'recovery');setMode('password');setToken('');
   }else {await service.signIn(email,password);setPassword('');router.dismissTo('/profile');}
  }catch(e){setError(e instanceof Error?e.message:'Account request failed. Please retry.');}
  finally{running.current=false;setBusy(false);}
 };
 const waiting=mode==='verify'||mode==='recovery-code';
 return <Screen top={false} bottom>
  <ScreenHeader eyebrow="YOUR ACCOUNT" title={mode==='create'?'Create account':mode==='signin'?'Sign in':mode==='forgot'?'Reset password':mode==='password'?'Set password':'Check your email'} />
  <Text style={ui.small}>{mode==='create'?'Choose your email and password. We’ll send one email to confirm it’s you. Your guest preferences and saved baskets stay with your account.':mode==='signin'?'Welcome back. Sign in with your email and password.':'Your SmartBasket data stays attached to your account.'}</Text>
  <ErrorMessage message={error} />{message&&<Text style={ui.body}>{message}</Text>}
  {!service&&<Text>Account services need a connection and Supabase configuration.</Text>}
  {mode!=='password'&&<TextInput label="Email" editable={!busy&&!waiting} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} error={email?emailError(email)??undefined:undefined} />}
  {(mode==='create'||mode==='signin'||mode==='password')&&<TextInput label="Password" editable={!busy} secureTextEntry autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChangeText={setPassword} error={mode!=='signin'&&password?passwordError(password)??undefined:undefined} />}
  {waiting&&showCode&&<TextInput label="Email verification code" editable={!busy} value={token} keyboardType="number-pad" onChangeText={setToken} />}
  {(mode!=='recovery-code'||showCode)&&<PrimaryButton label={mode==='create'?'Create account':mode==='signin'?'Sign in':mode==='forgot'?'Send reset email':mode==='password'?'Save password':showCode?'Confirm email':'I’ve confirmed my email'} loading={busy} disabled={!service} onPress={()=>{void run();}} />}
  {waiting&&!showCode&&<SecondaryButton label="My email contains a code" disabled={busy} onPress={()=>setShowCode(true)} />}
  {session?.user.email&&!session.user.is_anonymous&&mode==='create'&&<SecondaryButton label="Finish setting my password" disabled={busy} onPress={()=>changeMode('password')} />}
  {mode!=='signin'&&<SecondaryButton label="Already have an account? Sign in" disabled={busy} onPress={()=>changeMode('signin')} />}
  {mode==='signin'&&<><SecondaryButton label="Create account" disabled={busy} onPress={()=>changeMode('create')} /><SecondaryButton label="Forgot password?" disabled={busy} onPress={()=>changeMode('forgot')} /></>}
  <SecondaryButton label="Continue as guest" disabled={busy} onPress={()=>{service?.clearRegistration();setPassword('');router.dismissTo('/profile');}} />
 </Screen>;
}
