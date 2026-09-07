import {createContext,useContext,useEffect,useMemo,useState,type PropsWithChildren} from 'react';
import type {Session} from '@supabase/supabase-js';
import {getSupabaseClient} from '../lib/supabase';
import {authService} from '../services/auth-service';
const Context=createContext<{session:Session|null;ready:boolean;error:string|null;service:ReturnType<typeof authService>|null}>({session:null,ready:false,error:null,service:null});
export function AuthProvider({children}:PropsWithChildren){
 const client=getSupabaseClient(),service=useMemo(()=>client?authService(client):null,[client]);
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{let active=true;if(!client||!service){setReady(true);return;}
  const bootstrap=async()=>{try{await service.ensureGuest();const r=await client.auth.getSession();if(r.error)throw r.error;if(active){setSession(r.data.session);setError(null);}}catch{if(active)setError('Offline guest mode. Account services require a connection.');}finally{if(active)setReady(true);}};
  const {data}=client.auth.onAuthStateChange((event,next)=>{if(!active)return;setSession(next);
   if(event==='SIGNED_OUT'){service.clearRegistration();setReady(false);setTimeout(()=>{if(active)void bootstrap();},0);}
  });void bootstrap();return()=>{active=false;data.subscription.unsubscribe();};
 },[client,service]);
 return <Context.Provider value={{session,ready,error,service}}>{children}</Context.Provider>;
}
export const useAuth=()=>useContext(Context);
