import {createContext,useContext,useEffect,useMemo,useSyncExternalStore,type PropsWithChildren} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSupabaseClient} from '../lib/supabase';
import {useAuth} from './AuthContext';
import {ProfileStore} from '../services/profile-store';
import {profileRepository} from '../services/profile-repository';
import {migrateOwnedCache} from '../services/scope-migration';
const Context=createContext<ProfileStore|null>(null);
export function ProfileProvider({children}:PropsWithChildren){const {session}=useAuth();const owner=session?.user.id??'local';
 const store=useMemo(()=>new ProfileStore(AsyncStorage,`smartbasket.personal-profile.v1:${owner}`,owner!=='local'&&getSupabaseClient()?profileRepository(getSupabaseClient()!,owner):null),[owner]);
 useEffect(()=>{void(async()=>{if(owner!=='local')await migrateOwnedCache(AsyncStorage,'smartbasket.personal-profile.v1:local',`smartbasket.personal-profile.v1:${owner}`,owner,!!session?.user.is_anonymous,'id');await store.initialize();})().catch(()=>{void store.initialize();});},[store,owner,session?.user.is_anonymous]);return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useProfile(){const store=useContext(Context);if(!store)throw Error('ProfileProvider missing');return {...useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot),store};}

