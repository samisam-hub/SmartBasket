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
 return <Screen><ScreenHeader title={historyOnly?'Your recent shops':'Your pantry'} eyebrow="PURCHASES & LEFTOVERS" />
 {historyOnly&&error&&<Text accessibilityRole="alert" style={ui.body}>{error}</Text>}
 {historyOnly&&<SecondaryButton label={busy?'Loading…':'Reload shops'} disabled={busy} onPress={()=>setRetry(n=>n+1)} />}
 {!historyOnly&&<>
 <Text style={ui.body}>Available for future meals</Text>
 <Text style={ui.small}>Quantities reserved for purchased meal plans are excluded. Before planning again, remove anything eaten, discarded or no longer suitable. Expiry and freshness are not tracked automatically.</Text>
 {error&&<Text accessibilityRole="alert" style={ui.body}>{error}</Text>}
 <SecondaryButton label={busy?'Loading…':'Reload pantry'} disabled={busy} onPress={()=>setRetry(n=>n+1)} />
 {!busy&&!lots.length&&<Text style={ui.body}>No available leftovers yet.</Text>}
 {lots.map(l=><SectionCard key={l.id}><Text style={ui.body}>{l.product.name}</Text><Text style={ui.small}>{Math.round(l.quantity)} {l.unit} · purchased {new Date(l.purchasedAt).toLocaleDateString('en-GB')}</Text>
 {remove===l.id?<><Text style={ui.small}>Remove this remaining stock?</Text><SecondaryButton label="Confirm used / discarded" disabled={busy} onPress={()=>{setBusy(true);void removePantryLot(owner,l.id).then(()=>{setRemove(null);setRetry(n=>n+1);}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}} /><SecondaryButton label="Cancel" onPress={()=>setRemove(null)} /></>:<SecondaryButton label="Used / discarded" onPress={()=>setRemove(l.id)} />}</SectionCard>)}
 </>}
 {!historyOnly&&<Text style={ui.title}>Purchase history</Text>}
 {!busy&&!error&&!history.length&&<Text style={ui.body}>No completed shops yet.</Text>}
 {history.map(p=><SectionCard key={p.basketId}><Text style={ui.body}>{p.basket.name}</Text><Text style={ui.small}>{new Date(p.purchasedAt).toLocaleString('en-GB')} · {p.basket.result.items.reduce((n,i)=>n+i.packageCount,0)} packages · estimated {p.basket.result.estimatedTotalPrice===null?'price incomplete':`€${p.basket.result.estimatedTotalPrice.toFixed(2)}`}</Text>{p.basket.result.items.map(i=><Text key={i.product.id} style={ui.small}>{i.product.name} · {i.packageCount} × {i.packageAmount} {i.quantityUnit}</Text>)}</SectionCard>)}
 </Screen>;
}
