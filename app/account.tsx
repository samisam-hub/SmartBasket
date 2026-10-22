import {BrandLogo} from '../components/BrandAssets';
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
    setMessage("Prüfe dein Postfach und bestätige deine E-Mail-Adresse. Lass diese Seite geöffnet und kehre zurück, um dein Konto fertig einzurichten. Deine gespeicherten SmartBasket-Daten bleiben erhalten.");
   }else if(mode==='verify'){
    if(showCode)await service.verify(email,token,'email_change');
    if(await service.completeRegistration()){setToken('');router.dismissTo('/personal-profile');}
    else {setMode('password');setMessage("E-Mail-Adresse bestätigt. Gib dein gewähltes Passwort erneut ein, um abzuschließen. Passwörter werden beim Schließen oder Neuladen der App nicht gespeichert.");}
   }else if(mode==='password'){
    await service.setPassword(password);service.clearRegistration();setPassword('');router.dismissTo('/personal-profile');
   }else if(mode==='forgot'){
    await service.reset(email,accountRedirect('recovery'));setMode('recovery-code');setMessage("Falls für diese Adresse möglich, wurde eine E-Mail zum Zurücksetzen gesendet. Öffne den Link, um ein neues Passwort festzulegen.");
   }else if(mode==='recovery-code'){
    await service.verify(email,token,'recovery');setMode('password');setToken('');
   }else {await service.signIn(email,password);setPassword('');router.dismissTo('/profile');}
  }catch(e){setError(e instanceof Error?e.message:"Die Kontoanfrage ist fehlgeschlagen. Bitte versuche es erneut.");}
  finally{running.current=false;setBusy(false);}
 };
 const waiting=mode==='verify'||mode==='recovery-code';
 return <Screen top={false} bottom><BrandLogo />
  <ScreenHeader eyebrow="DEIN KONTO" title={mode==='create'?"Konto erstellen":mode==='signin'?"Anmelden":mode==='forgot'?"Passwort zurücksetzen":mode==='password'?"Passwort festlegen":"Prüfe dein E-Mail-Postfach"} />
  <Text style={ui.small}>{mode==='create'?"Wähle deine E-Mail-Adresse und dein Passwort. Wir senden eine Bestätigungs-E-Mail. Deine Gast-Einstellungen und gespeicherten Warenkörbe bleiben mit deinem Konto erhalten.":mode==='signin'?"Willkommen zurück. Melde dich mit E-Mail-Adresse und Passwort an.":"Deine SmartBasket-Daten bleiben mit deinem Konto verbunden."}</Text>
  <ErrorMessage message={error} />{message&&<Text style={ui.body}>{message}</Text>}
  {!service&&<Text>Kontofunktionen benötigen eine Internetverbindung und eine eingerichtete Cloud-Verbindung.</Text>}
  {mode!=='password'&&<TextInput label="E-Mail-Adresse" editable={!busy&&!waiting} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} error={email?emailError(email)??undefined:undefined} />}
  {(mode==='create'||mode==='signin'||mode==='password')&&<TextInput label="Passwort" editable={!busy} secureTextEntry autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChangeText={setPassword} error={mode!=='signin'&&password?passwordError(password)??undefined:undefined} />}
  {waiting&&showCode&&<TextInput label="E-Mail-Bestätigungscode" editable={!busy} value={token} keyboardType="number-pad" onChangeText={setToken} />}
  {(mode!=='recovery-code'||showCode)&&<PrimaryButton label={mode==='create'?"Konto erstellen":mode==='signin'?"Anmelden":mode==='forgot'?"E-Mail zum Zurücksetzen senden":mode==='password'?"Passwort speichern":showCode?"E-Mail-Adresse bestätigen":"Ich habe meine E-Mail-Adresse bestätigt"} loading={busy} disabled={!service} onPress={()=>{void run();}} />}
  {waiting&&!showCode&&<SecondaryButton label="Meine E-Mail enthält einen Code" disabled={busy} onPress={()=>setShowCode(true)} />}
  {session?.user.email&&!session.user.is_anonymous&&mode==='create'&&<SecondaryButton label="Passwortvergabe abschließen" disabled={busy} onPress={()=>changeMode('password')} />}
  {mode!=='signin'&&<SecondaryButton label="Schon ein Konto? Anmelden" disabled={busy} onPress={()=>changeMode('signin')} />}
  {mode==='signin'&&<><SecondaryButton label="Konto erstellen" disabled={busy} onPress={()=>changeMode('create')} /><SecondaryButton label="Passwort vergessen?" disabled={busy} onPress={()=>changeMode('forgot')} /></>}
  <SecondaryButton label="Als Gast fortfahren" disabled={busy} onPress={()=>{service?.clearRegistration();setPassword('');router.dismissTo('/profile');}} />
 </Screen>;
}
