import { formatDate, t } from '@/services/i18n';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SavedBasketPreview } from '@/components/SavedBasketPreview';
import { useActiveBasket } from '@/context/ActiveBasketContext';
import { EmptyState, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard, TextInput, ErrorMessage } from '@/components/ui';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { usePreferences } from '@/context/PreferencesContext';
import { basketOwner, basketPersistence } from '@/services/baskets';
import { hasSavedWork } from '@/services/saved-work';
import { colors, ui } from '@/lib/theme';
import type { SavedBasket } from '@/types/basket';
export default function SavedListsScreen() {
  const { clear } = useActiveBasket();
  const flow = useBasketFlow(), { saved, ready } = usePreferences();
  const [baskets, setBaskets] = useState<SavedBasket[]>([]), [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null), [retry, setRetry] = useState(0);
  const [action,setAction]=useState<{id:string;kind:'rename'|'delete'}|null>(null),[name,setName]=useState(''),[busy,setBusy]=useState(false),[actionError,setActionError]=useState<string|null>(null);
  const manage=async(b:SavedBasket)=>{
    if(!action||busy)return;setBusy(true);setActionError(null);
    try{const owner=await basketOwner(saved?.userId??null);if(owner!==b.ownerId)throw Error(t('lists.accountChanged'));
      const response=action.kind==='rename'?await basketPersistence().rename(owner,b.id,name):await basketPersistence().remove(owner,b.id);
      clear(b.id);
      setWarning(response.warning);setAction(null);setRetry(n=>n+1);
    }catch(e){setActionError(e instanceof Error?e.message:t('lists.changeFailed'));}finally{setBusy(false);}
  };
  useFocusEffect(useCallback(() => {
    if (!ready) return;
    if (!hasSavedWork(saved)) { setBaskets([]); setWarning(null); setLoading(false); return; }
    void retry; // Explicit reload token in addition to focus/session changes.
    let active = true; setLoading(true); setBaskets([]);
    void (async () => {
      try {
        const owner = await basketOwner(saved?.userId ?? null);
        const response = await basketPersistence().list(owner);
        if (active) { setBaskets(response.baskets); setWarning(response.warning); }
      } catch (e) { if (active) setWarning(e instanceof Error ? e.message : t('lists.loadFailed')); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [ready, saved, retry]));
  return <Screen>
    <ScreenHeader eyebrow={t('lists.eyebrow')} title={t('lists.title')} />
    <PrimaryButton label={t('lists.create')} onPress={flow.create} disabled={flow.disabled} />
    <SecondaryButton label={t('lists.pantry')} onPress={()=>router.push('/pantry')} />
    {loading && <ActivityIndicator color={colors.primary} />}
    {warning && <><Text style={ui.small}>{warning}</Text><SecondaryButton label={t('lists.reload')} onPress={() => setRetry(n => n + 1)} /></>}
    {!loading && !baskets.length && <EmptyState illustration="emptyBasket" title={t('lists.emptyTitle')} description={t('lists.emptyBody')} />}
    {baskets.map(b => {
      const open = () => router.push({ pathname: '/basket-setup', params: { savedId: b.id } });
      return <SectionCard key={b.id}>
      <SavedBasketPreview basket={b} onOpen={open} />
      {b.result.purchasedAt ? <Text style={ui.small}>{t('lists.purchased', { date: formatDate(b.result.purchasedAt) })}</Text> : <SecondaryButton label={t('lists.edit')} disabled={busy} onPress={() => router.push({ pathname: '/basket-setup', params: { savedId: b.id, edit: '1' } })} />}
      {action?.id===b.id?<>
        {action.kind==='rename'?<TextInput label={t('lists.nameField')} value={name} onChangeText={setName} maxLength={120} editable={!busy} />:<Text style={ui.body}>{t('lists.deleteBody', { name: b.name })}</Text>}
        <ErrorMessage message={actionError} />
        <PrimaryButton label={t(action.kind==='rename'?'lists.saveName':'lists.deleteForGood')} loading={busy} onPress={()=>{void manage(b);}} />
        <SecondaryButton label={t('lists.cancel')} disabled={busy} onPress={()=>{setAction(null);setActionError(null);}} />
      </>:<View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><SecondaryButton label={t('lists.rename')} disabled={busy} onPress={()=>{setName(b.name);setActionError(null);setAction({id:b.id,kind:'rename'});}} /></View>
        <View style={{ flex: 1 }}><SecondaryButton label={t('lists.delete')} disabled={busy} onPress={()=>{setActionError(null);setAction({id:b.id,kind:'delete'});}} /></View>
      </View>}
    </SectionCard>;})}
  </Screen>;
}
