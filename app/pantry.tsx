import { formatDate, formatDateTime, formatMoney, t } from '@/services/i18n';
import { basketDisplayName } from '../services/basket/naming';
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Screen, ScreenHeader, SecondaryButton, SectionCard } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { loadPantry, removePantryLot } from '@/services/pantry';
import type { PantryLot, Purchase } from '@/types/pantry';
import { ui } from '@/lib/theme';
export default function PantryScreen(){
 const {view}=useLocalSearchParams<{view?:string}>(),historyOnly=view==='history';
 const {session}=useAuth(),owner=session?.user.id??null;
 const [lots,setLots]=useState<PantryLot[]>([]),[history,setHistory]=useState<Purchase[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[remove,setRemove]=useState<string|null>(null);
 useEffect(()=>{let alive=true;setBusy(true);void loadPantry(owner).then(j=>{if(alive){setLots(j.state.lots);setHistory(j.purchases);setError('');}}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setBusy(false);});return()=>{alive=false;};},[owner,retry]);
 return <Screen><ScreenHeader title={historyOnly?t('pantryScreen.purchases'):t('pantryScreen.stock')} eyebrow={t('pantryScreen.eyebrow')} />
 {historyOnly&&error&&<Text accessibilityRole="alert" style={ui.body}>{error}</Text>}
 {historyOnly&&<SecondaryButton label={busy?t('pantryScreen.loading'):t('pantryScreen.reloadPurchases')} disabled={busy} onPress={()=>setRetry(n=>n+1)} />}
 {!historyOnly&&<>
 <Text style={ui.body}>{t('pantryScreen.availableLater')}</Text>
 <Text style={ui.small}>{t('pantryScreen.reservedNote')}</Text>
 {error&&<Text accessibilityRole="alert" style={ui.body}>{error}</Text>}
 <SecondaryButton label={busy?t('pantryScreen.loading'):t('pantryScreen.reloadStock')} disabled={busy} onPress={()=>setRetry(n=>n+1)} />
 {!busy&&!lots.length&&<Text style={ui.body}>{t('pantryScreen.noStock')}</Text>}
 {lots.map(l=><SectionCard key={l.id}><Text style={ui.body}>{l.product.name}</Text><Text style={ui.small}>{Math.round(l.quantity)} {l.unit}  · gekauft am {formatDate(l.purchasedAt)}</Text>
 {remove===l.id?<><Text style={ui.small}>Diesen Restbestand entfernen?</Text><SecondaryButton label={t('pantryScreen.confirmUse')} disabled={busy} onPress={()=>{setBusy(true);void removePantryLot(owner,l.id).then(()=>{setRemove(null);setRetry(n=>n+1);}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}} /><SecondaryButton label="Abbrechen" onPress={()=>setRemove(null)} /></>:<SecondaryButton label="Verbraucht / entsorgt" onPress={()=>setRemove(l.id)} />}</SectionCard>)}
 </>}
 {!historyOnly&&<Text style={ui.title}>Einkaufsverlauf</Text>}
 {!busy&&!error&&!history.length&&<Text style={ui.body}>{t('pantryScreen.noPurchases')}</Text>}
 {history.map(p=><SectionCard key={p.basketId}><Text style={ui.body}>{basketDisplayName(p.basket)}</Text><Text style={ui.small}>{formatDateTime(p.purchasedAt)} · {p.basket.result.items.reduce((n,i)=>n+i.packageCount,0)}  Packungen · geschätzt {p.basket.result.estimatedTotalPrice===null?t('pantryScreen.priceIncomplete'):`${formatMoney(p.basket.result.estimatedTotalPrice)}`}</Text>{p.basket.result.items.map(i=><Text key={i.product.id} style={ui.small}>{i.product.name} · {i.packageCount} × {i.packageAmount} {i.quantityUnit}</Text>)}</SectionCard>)}
 </Screen>;
}
