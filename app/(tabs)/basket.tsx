import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { EmptyState, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard, TextInput, ErrorMessage } from '@/components/ui';
import { basketPrice } from '@/components/BasketResult';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { usePreferences } from '@/context/PreferencesContext';
import { basketOwner, basketPersistence } from '@/services/baskets';
import { colors, ui } from '@/lib/theme';
import type { SavedBasket } from '@/types/basket';
export default function BasketScreen() {
  const flow = useBasketFlow(), { saved, ready } = usePreferences();
  const [baskets, setBaskets] = useState<SavedBasket[]>([]), [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null), [retry, setRetry] = useState(0);
  const [action,setAction]=useState<{id:string;kind:'rename'|'delete'}|null>(null),[name,setName]=useState(''),[busy,setBusy]=useState(false),[actionError,setActionError]=useState<string|null>(null);
  const manage=async(b:SavedBasket)=>{
    if(!action||busy)return;setBusy(true);setActionError(null);
    try{const owner=await basketOwner(saved?.userId??null);if(owner!==b.ownerId)throw Error('Account changed. Reload your baskets.');
      const response=action.kind==='rename'?await basketPersistence().rename(owner,b.id,name):await basketPersistence().remove(owner,b.id);
      setWarning(response.warning);setAction(null);setRetry(n=>n+1);
    }catch(e){setActionError(e instanceof Error?e.message:'Change could not be saved.');}finally{setBusy(false);}
  };
  useFocusEffect(useCallback(() => {
    if (!ready) return;
    void retry; // Explicit reload token in addition to focus/session changes.
    let active = true; setLoading(true); setBaskets([]);
    void (async () => {
      try {
        const owner = await basketOwner(saved?.userId ?? null);
        const response = await basketPersistence().list(owner);
        if (active) { setBaskets(response.baskets); setWarning(response.warning); }
      } catch (e) { if (active) setWarning(e instanceof Error ? e.message : 'Saved baskets could not be loaded.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [ready, saved?.userId, retry]));
  return <Screen>
    <ScreenHeader eyebrow="YOUR GOALS. YOUR GROCERIES." title="Your baskets" />
    <PrimaryButton label="Create my basket" onPress={flow.create} disabled={flow.disabled} />
    {loading && <ActivityIndicator color={colors.primary} />}
    {warning && <><Text style={ui.small}>{warning}</Text><SecondaryButton label="Reload saved baskets" onPress={() => setRetry(n => n + 1)} /></>}
    {!loading && !baskets.length && <EmptyState illustration="emptyBasket" title="No saved baskets yet." description="Generate a basket from your preferences, then save it here." />}
    {baskets.map(b => <SectionCard key={b.id} title={b.name}>
      <Text style={ui.small}>{new Date(b.createdAt).toLocaleDateString()} · {b.result.items.length} products · {b.syncStatus === 'synced' ? 'Synced' : 'On this device'}</Text>
      <Text style={ui.body}>{basketPrice(b.result.estimatedTotalPrice)}</Text>
      <SecondaryButton label="Open basket" onPress={() => router.push({ pathname: '/basket-setup', params: { savedId: b.id } })} />
      {action?.id===b.id?<>
        {action.kind==='rename'?<TextInput label="Basket name" value={name} onChangeText={setName} maxLength={120} editable={!busy} />:<Text style={ui.body}>Delete “{b.name}”? Its saved meal plan will also be removed. This cannot be undone.</Text>}
        <ErrorMessage message={actionError} />
        <PrimaryButton label={action.kind==='rename'?'Save name':'Delete permanently'} loading={busy} onPress={()=>{void manage(b);}} />
        <SecondaryButton label="Cancel" disabled={busy} onPress={()=>{setAction(null);setActionError(null);}} />
      </>:<>
        <SecondaryButton label="Rename basket" disabled={busy} onPress={()=>{setName(b.name);setActionError(null);setAction({id:b.id,kind:'rename'});}} />
        <SecondaryButton label="Delete basket" disabled={busy} onPress={()=>{setActionError(null);setAction({id:b.id,kind:'delete'});}} />
      </>}
    </SectionCard>)}
    <SecondaryButton label="Browse products" onPress={() => router.navigate('/products')} />
  </Screen>;
}
