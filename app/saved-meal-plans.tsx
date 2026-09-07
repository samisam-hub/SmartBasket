import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {router} from 'expo-router';
import {useAuth} from '../context/AuthContext';
import {basketPersistence} from '../services/baskets';
import type {SavedBasket} from '../types/basket';
import {Screen,ScreenHeader,SectionCard,SecondaryButton,ErrorMessage} from '../components/ui';
export default function SavedMealPlans(){const {session}=useAuth();const [plans,setPlans]=useState<SavedBasket[]>([]),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;void basketPersistence().list(session?.user.id??null).then(r=>{if(active){setPlans(r.baskets.filter(b=>b.result.mealPlan));setError(r.warning);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[session?.user.id]);
 return <Screen top={false} bottom><ScreenHeader eyebrow="SAVED FOR YOU" title="Saved meal plans" /><ErrorMessage message={error}/>{loading?<Text>Loading saved plans…</Text>:!plans.length?<Text>No saved meal plans yet. Save a meal plan and basket to keep its snapshot.</Text>:plans.map(p=><SectionCard key={p.id} title={p.name}><Text>{p.preferences.planningDays} days · {p.preferences.householdSize} people</Text><SecondaryButton label="Open meal plan & basket" onPress={()=>router.push({pathname:'/basket-setup',params:{savedId:p.id}})} /></SectionCard>)}</Screen>;
}
