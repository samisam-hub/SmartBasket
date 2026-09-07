import {useEffect,useState} from 'react';
import {Platform,Text} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {Screen,ScreenHeader,TextInput,PrimaryButton,SecondaryButton,ErrorMessage} from '../components/ui';
import {useAuth} from '../context/AuthContext';
import {emailError,passwordError} from '../services/auth-service';
import {ui} from '../lib/theme';
const accountRedirect=(mode:string)=>`${Platform.OS==='web'&&typeof window!=='undefined'?`${window.location.origin}/`:'smartbasket://'}auth/callback?mode=${encodeURIComponent(mode)}`;
export default function AccountScreen(){const params=useLocalSearchParams<{mode?:string}>();const {service,session}=useAuth();
 const [mode,setMode]=useState(params.mode??'create'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(params.mode)setMode(params.mode);},[params.mode]);
 const run=async()=>{if(!service)return;setBusy(true);setError(null);setMessage(null);try{
  if(mode==='create'){await service.register(email,accountRedirect('register'));setMode('verify');setMessage('Check your email. Open the verification link, or enter the code below. Then choose a password. Your guest identity and data stay together.');}
  else if(mode==='verify'||mode==='recovery-code'){await service.verify(email,token,mode==='verify'?'email_change':'recovery');setMode('password');setToken('');}
  else if(mode==='password'){await service.setPassword(password);setPassword('');router.dismissTo('/personal-profile');}
  else if(mode==='forgot'){await service.reset(email,accountRedirect('recovery'));setMode('recovery-code');setMessage('If this address is eligible, a reset email has been sent. Open its link or enter its code.');}
  else {await service.signIn(email,password);setPassword('');router.dismissTo('/profile');}
 }catch(e){setError(e instanceof Error?e.message:'Account request failed. Please retry.');}finally{setBusy(false);}};
 return <Screen top={false} bottom><ScreenHeader eyebrow="YOUR ACCOUNT" title={mode==='create'?'Create account':mode==='signin'?'Sign in':mode==='forgot'?'Reset password':mode==='password'?'Set password':'Verify your email'} />
 <Text style={ui.small}>Guest use remains available. Creating an account links your existing guest data. Signing into a different existing account opens its data; it does not merge guest records.</Text>
 <ErrorMessage message={error} />{message&&<Text style={ui.body}>{message}</Text>}
 {!service&&<Text>Account services are unavailable offline or without Supabase configuration.</Text>}
 {mode!=='password'&&<TextInput label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} error={email?emailError(email)??undefined:undefined} />}
 {(mode==='signin'||mode==='password')&&<TextInput label="Password" secureTextEntry autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChangeText={setPassword} error={mode==='password'&&password?passwordError(password)??undefined:undefined} />}
 {(mode==='verify'||mode==='recovery-code')&&<TextInput label="Email verification code" value={token} keyboardType="number-pad" onChangeText={setToken} />}
 <PrimaryButton label={mode==='create'?'Send verification email':mode==='signin'?'Sign in':mode==='forgot'?'Send reset email':mode==='password'?'Save password':'Verify code'} loading={busy} disabled={!service} onPress={()=>{void run();}} />
 {session?.user.email&&!session.user.is_anonymous&&mode==='create'&&<SecondaryButton label="Set password for verified account" onPress={()=>setMode('password')} />}
 <SecondaryButton label="Sign in instead" onPress={()=>{setMode('signin');setError(null);}} />
 <SecondaryButton label="Forgot password" onPress={()=>{setMode('forgot');setError(null);}} />
 <SecondaryButton label="Continue using SmartBasket" onPress={()=>router.dismissTo('/profile')} />
 </Screen>;
}
