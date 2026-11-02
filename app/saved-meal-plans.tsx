import { basketDayCount, basketDisplayName } from '../services/basket/naming';
import {StateIllustration} from '../components/BrandAssets';
import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {router} from 'expo-router';
import {useAuth} from '../context/AuthContext';
import {basketPersistence} from '../services/baskets';
import type {SavedBasket} from '../types/basket';
import {Screen,ScreenHeader,SectionCard,SecondaryButton,ErrorMessage} from '../components/ui';
export default function SavedMealPlans(){const {session}=useAuth();const [plans,setPlans]=useState<SavedBasket[]>([]),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;void basketPersistence().list(session?.user.id??null).then(r=>{if(active){setPlans(r.baskets.filter(b=>b.result.mealPlan));setError(r.warning);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[session?.user.id]);
 return <Screen top={false} bottom><ScreenHeader eyebrow="FÜR DICH GESPEICHERT" title="Gespeicherte Speisepläne" /><ErrorMessage message={error}/>{loading?<Text>Gespeicherte Pläne werden geladen …</Text>:!plans.length?<><StateIllustration kind="emptyBasket" /><Text>Noch keine gespeicherten Speisepläne. Speichere einen Speiseplan mit Warenkorb, um ihn später wieder aufzurufen.</Text></>:plans.map(p=><SectionCard key={p.id} title={basketDisplayName(p)}><Text>{basketDayCount(p.result, p.preferences)}  Tage · {p.preferences.householdSize}  Personen</Text><SecondaryButton label="Speiseplan und Warenkorb öffnen" onPress={()=>router.push({pathname:'/basket-setup',params:{savedId:p.id}})} /></SectionCard>)}</Screen>;
}
