import {createContext,useContext,useEffect,useMemo,useSyncExternalStore,type PropsWithChildren} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from './AuthContext';
import {WeekPlanStore} from '../services/week-plan-store';
const Context=createContext<WeekPlanStore|null>(null);
export const weekPlanKey=(owner:string)=>`smartbasket.week-plan.v1:${owner}`;
/** One planned week per identity. A draft is never copied between identities: signing in opens an
 *  empty week for that account and leaves the local one untouched. */
export function WeekPlanProvider({children}:PropsWithChildren){
 const {session}=useAuth();const owner=session?.user.id??'local';
 const store=useMemo(()=>new WeekPlanStore(AsyncStorage,weekPlanKey(owner)),[owner]);
 useEffect(()=>{void store.initialize();},[store]);
 return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useWeekPlan(){const store=useContext(Context);if(!store)throw Error('WeekPlanProvider missing');
 return {...useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot),store};}
