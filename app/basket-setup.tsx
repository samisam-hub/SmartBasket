import { formatDate, formatMoney, t } from '@/services/i18n';
import { loadPantry, checkoutBasket } from '@/services/pantry';

import type { PantryLot } from '@/types/pantry';

import { useEffect, useRef, useState } from 'react';

import { router, useLocalSearchParams } from 'expo-router';

import { ActivityIndicator, Text } from 'react-native';

import { EmptyState, PrimaryButton, Screen, ScreenHeader, SecondaryButton } from '@/components/ui';

import { BasketResult } from '@/components/BasketResult';

import { usePreferences } from '@/context/PreferencesContext';

import { useBasketFlow } from '@/hooks/useBasketFlow';

import { getSupabaseClient } from '@/lib/supabase';

import { colors, ui } from '@/lib/theme';

import { loadBasketCatalog } from '@/services/basket/catalog';

import { generateMealPlan } from '@/services/meals/planner';

import { basketFromMealPlan } from '@/services/meals/basket';

import { MealPlanReview } from '@/components/MealPlanReview';

import type { AnyMealPlan, MealPlan } from '@/types/meal';

import type { Product } from '@/types/product';

import { basketDayCount } from '@/services/basket/naming';
import { newSavedBasket } from '@/services/basket/persistence';

import { basketOwner, basketPersistence } from '@/services/baskets';

import type { SavedBasket } from '@/types/basket';

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {UserPreferences} from '@/types/preferences';

import {participantPreferences} from '@/services/profile-domain';

import {isSaved} from '@/services/preference-domain';

import { removeBasketProduct, toggleBasketProduct } from '@/services/basket/edit';

import { useActiveBasket } from '@/context/ActiveBasketContext';
import { useWeekPlan } from '@/context/WeekPlanContext';

import { addBasketProduct } from '@/services/basket/add-product';
import { BasketExtras } from '@/components/BasketExtras';
import { ShareBasket } from '@/components/ShareBasket';
import { addBasketReplacement, replaceBasketProduct } from '@/services/basket/replacements';

export default function BasketSetupScreen() {

  const { active, remember, clear, discard, busy: activeBusy } = useActiveBasket();

  const pantry = useRef<PantryLot[]>([]);

  const [deleteReview, setDeleteReview] = useState(false);

  const [checkoutReview,setCheckoutReview]=useState(false);

  const activeRef = useRef(active); activeRef.current = active;

  const { saved:basePreferences, ready } = usePreferences(), flow = useBasketFlow();

  const [planPreferences,setPlanPreferences]=useState<UserPreferences|null>(null);

  const saved=planPreferences??basePreferences;

  const { savedId,participants,edit,week } = useLocalSearchParams<{ savedId?: string;participants?:string;edit?:string;week?:string }>();

  const weekPlan = useWeekPlan();

  const [editingBasket, setEditingBasket] = useState(false);

  const originalBasket = useRef<SavedBasket | null>(null);

  const [basket, setBasket] = useState<SavedBasket | null>(null), [busy, setBusy] = useState(true);
  useEffect(() => { if (basket) remember(basket); }, [basket, remember]);

  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);

  const [saving, setSaving] = useState(false), [savedOnce, setSavedOnce] = useState(false), [retry, setRetry] = useState(0);

  const saveLock = useRef(false), mounted = useRef(true);

  const generation = useRef(0);

  const [plan,setPlan]=useState<MealPlan|null>(null);

  const catalog=useRef<Product[]>([]),ownerRef=useRef<string|null>(null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {

    if (!ready) return;

    generation.current++;

    const controller = new AbortController();

    setBusy(true); setError(null); setNotice(null); setBasket(null); setPlan(null); setSavedOnce(false);

    void (async () => {

      try {

        const owner = await basketOwner(basePreferences?.userId ?? null);

        let next: SavedBasket | null = null;

        try { pantry.current=(await loadPantry(owner)).state.lots; } catch { pantry.current=[]; }

        if (savedId) {

          const response = await basketPersistence().list(owner);

          const cached = activeRef.current;

          const remoteFound=response.baskets.find(b => b.id === savedId);

          const found = remoteFound?.result.purchasedAt ? remoteFound : cached?.id === savedId && cached.ownerId === owner ? cached : response.baskets.find(b => b.id === savedId);

          if (!found) throw Error(t('setup.basket.unavailableSession'));

          next = found;

          // Keep the catalog available while editing a saved basket so each
          // purchased item can be swapped without regenerating the plan.
          try { catalog.current = await loadBasketCatalog(getSupabaseClient(), controller.signal); ownerRef.current = owner; }
          catch { catalog.current = []; }

          if (!controller.signal.aborted) { originalBasket.current = found; setEditingBasket(edit === '1' && !found.result.purchasedAt); }

          if (!controller.signal.aborted) { setNotice(response.warning); setSavedOnce(response.baskets.some(b => b.id === found.id && JSON.stringify(b.result) === JSON.stringify(found.result))); }

        } else {

          if (!basePreferences?.onboardingCompleted) throw Error(t('setup.basket.completeSettings'));

          let input=basePreferences;

          if(participants==='1'){

            const raw=await AsyncStorage.getItem(`smartbasket.active-plan.v1:${owner??'local'}`);

            if(!raw)throw Error(t('setup.basket.checkPeople'));

            const stored=JSON.parse(raw);

            if(!isSaved(stored)||!stored.participants||stored.userId!==basePreferences.userId)throw Error(t('setup.basket.invalidPlan'));

            input=participantPreferences(stored,stored.participants);

          }

          if(!controller.signal.aborted)setPlanPreferences(input);

          let products: Product[] = [];

          try { products = await loadBasketCatalog(getSupabaseClient(), controller.signal); }

          catch { if (!controller.signal.aborted) setNotice(t('setup.basket.catalogMissing')); }

          await new Promise(resolve => setTimeout(resolve, 0));

          if (controller.signal.aborted) return;

          catalog.current=products;ownerRef.current=owner;

          // The calendar is the review: its week arrives decided, so it goes straight to a basket.
          if (week === '1') {

            await weekPlan.store.initialize();

            const confirmed = weekPlan.store.confirm(input);

            next = newSavedBasket(basketFromMealPlan(confirmed, input, products, pantry.current), input, owner);

          } else setPlan(generateMealPlan(input,products));

        }

        if (!controller.signal.aborted) setBasket(next);

      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t('setup.basket.loadFailed')); }

      finally { if (!controller.signal.aborted) setBusy(false); }

    })();

    return () => controller.abort();

  }, [ready, basePreferences, savedId, retry,participants,edit,week,weekPlan.store]);

  const confirmPlan=()=>{

    if(!plan||!saved)return;

    try { const confirmed:AnyMealPlan={...plan,status:'confirmed'};

      setBasket(newSavedBasket(basketFromMealPlan(confirmed,saved,catalog.current,pantry.current),saved,ownerRef.current));setPlan(confirmed);setError(null);

    } catch(e){setError(e instanceof Error?e.message:t('setup.basket.packagesFailed'));}

  };

  const save = async () => {

    if (!basket || saveLock.current) return;

    const token = generation.current;

    saveLock.current = true; setSaving(true); setError(null);

    try {

      const owner = await basketOwner(saved?.userId ?? null);

      if (owner !== basket.ownerId) throw Error(t('setup.basket.sessionChanged'));

      const response = await basketPersistence().save(basket);

      if (mounted.current && token === generation.current) { setBasket(response.basket); originalBasket.current = response.basket; setEditingBasket(false); setNotice(response.warning ?? t('setup.basket.savedBoth')); setSavedOnce(true); }

    } catch (e) { if (mounted.current && token === generation.current) setError(e instanceof Error ? e.message : t('setup.basket.saveFailed')); }

    finally { saveLock.current = false; if (mounted.current) setSaving(false); }

  };

  const refreshProducts = async () => {

    if (!basket?.result.mealPlan || saving || saveLock.current) return;

    const token = generation.current;

    saveLock.current = true; setSaving(true); setError(null);

    try {

      const products = await loadBasketCatalog(getSupabaseClient());

      pantry.current=(await loadPantry(basket.ownerId)).state.lots;

      const removedIds = basket.result.removedProductIds ?? [];

      const removedKeys = basket.result.removedIngredientKeys ?? [];

      let result = basketFromMealPlan(basket.result.mealPlan, basket.preferences, products.filter(p => !removedIds.includes(p.id)),pantry.current);

      for (const item of [...result.items]) if (item.ingredientKey && removedKeys.includes(item.ingredientKey)) result = removeBasketProduct(result, item.product.id);

      result.removedProductIds = [...new Set([...removedIds, ...(result.removedProductIds ?? [])])];

      result.removedIngredientKeys = removedKeys;
      result.excludedItems = basket.result.excludedItems;

      for (const extra of basket.result.items.filter(i => i.isExtra || i.extraPackageCount)) {

        const product = products.find(p => p.id === extra.product.id) ?? extra.product;

        for (let count = 0; count < (extra.isExtra ? extra.packageCount : extra.extraPackageCount ?? 0); count++) result = addBasketProduct(result, product);

      }

      if (mounted.current && token === generation.current) {

        originalBasket.current = originalBasket.current ?? basket;

        setBasket({ ...basket, result, syncStatus: 'local' }); setEditingBasket(true); setSavedOnce(false);

        setNotice(t('setup.basket.refreshed'));

      }

    } catch (e) { if (mounted.current && token === generation.current) setError(e instanceof Error ? e.message : t('setup.basket.refreshFailed')); }

    finally { saveLock.current = false; if (mounted.current) setSaving(false); }

  };

  return <Screen top={false} bottom>

    <ScreenHeader eyebrow={t('setup.basket.eyebrow')} title={savedId ? t('setup.basket.savedTitle') : basket ? t('setup.basket.title') : t('setup.basket.planTitle')} />

    {busy && <><ActivityIndicator color={colors.primary} /><Text style={ui.body}>{t('setup.basket.loading')}</Text></>}

    {error && <Text style={ui.small} accessibilityRole="alert">{error}</Text>}

    {!busy && !basket && !plan && <EmptyState illustration="dataError" title={t('setup.basket.unavailable')} description={t('setup.basket.unchanged')}>

      <PrimaryButton label={t('setup.basket.retry')} onPress={() => setRetry(n => n + 1)} />

      <SecondaryButton label={t('setup.basket.editSettings')} onPress={() => flow.edit()} disabled={flow.disabled} />

    </EmptyState>}

    {!busy && !basket && plan && saved && <>

      {notice && <Text style={ui.small}>{notice}</Text>}

      <MealPlanReview plan={plan} preferences={saved} onChange={setPlan} onConfirm={confirmPlan} />

      <SecondaryButton label={t('setup.basket.editSettings')} onPress={() => flow.edit()} disabled={flow.disabled} />

    </>}

    {basket && <>

      <Text style={ui.small}>{t('setup.basket.summary', { days: basketDayCount(basket.result, basket.preferences), people: basket.preferences.householdSize, calories: basket.preferences.dailyCalories })}</Text>

      {savedId && !editingBasket && !basket.result.purchasedAt && <SecondaryButton label={t('setup.basket.edit')} disabled={saving} onPress={() => { originalBasket.current = basket; setEditingBasket(true); }} />}

      {editingBasket && !basket.result.purchasedAt && <>

        {basket.result.mealPlan && <SecondaryButton label={t('setup.basket.refresh')} disabled={saving} onPress={() => { void refreshProducts(); }} />}

        <PrimaryButton label={t('setup.basket.saveChanges')} loading={saving} onPress={() => { void save(); }} />

        <SecondaryButton label={t('setup.basket.discardChanges')} disabled={saving} onPress={() => { setBasket(originalBasket.current); setEditingBasket(false); setSavedOnce(true); setError(null); }} />

      </>}

      {basket.result.purchasedAt && <Text style={ui.body}>{t('setup.basket.purchased', { date: formatDate(basket.result.purchasedAt) })}</Text>}

      <SecondaryButton label={t('setup.basket.pantry')} onPress={()=>router.push('/pantry')} />

      <BasketResult result={basket.result} catalog={catalog.current} preferences={basket.preferences}
        onReplaceProduct={!saving && !basket.result.purchasedAt ? (currentId, product) => {
          try { setBasket({ ...basket, result: replaceBasketProduct(basket.result, currentId, product), syncStatus: 'local' }); setSavedOnce(false); setNotice(t('setup.basket.replaced')); }
          catch (e) { setError(e instanceof Error ? e.message : t('setup.basket.replaceFailed')); }
        } : undefined}
        onAddReplacement={!saving && !basket.result.purchasedAt ? (requirement, product) => {
          try { setBasket({ ...basket, result: addBasketReplacement(basket.result, requirement, product), syncStatus: 'local' }); setSavedOnce(false); setNotice(t('setup.basket.alternativeAdded')); }
          catch (e) { setError(e instanceof Error ? e.message : t('setup.basket.alternativeFailed')); }
        } : undefined}
        onToggleProduct={!basket.result.purchasedAt && !saving ? id => {

        try { setBasket({ ...basket, result: toggleBasketProduct(basket.result, id), syncStatus: 'local' }); setSavedOnce(false); setNotice(null); }

        catch (e) { setError(e instanceof Error ? e.message : t('setup.basket.toggleFailed')); }

      } : undefined} />

      {!basket.result.purchasedAt && <BasketExtras result={basket.result} catalog={catalog.current} preferences={basket.preferences}
        onAdd={product => {
          try { setBasket({ ...basket, result: addBasketProduct(basket.result, product), syncStatus: 'local' }); setSavedOnce(false); setNotice(t('setup.basket.added', { product: product.name })); }
          catch (e) { setError(e instanceof Error ? e.message : t('setup.basket.addFailed')); }
        }} />}
      {!savedId && plan && !basket.result.purchasedAt && <SecondaryButton label={t('setup.basket.backToMeals')} disabled={saving} onPress={()=>{setBasket(null);setSavedOnce(false);setPlan({...plan,status:'review'});setNotice(null);}} />}

      {notice && <Text style={ui.small} accessibilityLiveRegion="polite">{notice}</Text>}

      {!basket.result.purchasedAt && <>

        <PrimaryButton label={t('setup.basket.checkout')} disabled={saving} onPress={()=>setCheckoutReview(true)} />

        {checkoutReview && <>

          <Text style={ui.body}>{t('setup.basket.confirmBody', { packages: basket.result.items.reduce((n,i)=>n+i.packageCount,0), price: basket.result.estimatedTotalPrice===null?t('setup.basket.incomplete'):formatMoney(basket.result.estimatedTotalPrice) })}</Text>

          <Text style={ui.small}>{t('setup.basket.checkoutNote')}</Text>

          {basket.result.status!=='generated' && <Text style={ui.small}>{t('setup.basket.partialCover')}</Text>}

          <PrimaryButton label={t('setup.basket.confirmCheckout')} loading={saving} onPress={()=>{if(saveLock.current)return;saveLock.current=true;setSaving(true);void checkoutBasket(basket).then(b=>{setBasket(b);clear(b.id);setEditingBasket(false);setSavedOnce(true);setCheckoutReview(false);setNotice(t('setup.basket.checkedOut'));}).catch(e=>setError(e.message)).finally(()=>{saveLock.current=false;setSaving(false);});}} />

          <SecondaryButton label={t('setup.basket.cancelCheckout')} disabled={saving} onPress={()=>setCheckoutReview(false)} />

        </>}

      </>}

      {!basket.result.purchasedAt && (!!basket.result.items.length || !!basket.result.mealPlan?.items.length) && <PrimaryButton label={savedOnce ? basket.syncStatus === 'synced' ? t('setup.basket.saved') : t('setup.basket.saveCloudAgain') : basket.result.engineVersion==='2' ? t('setup.basket.savePlanAndBasket') : t('setup.basket.save')}

        disabled={savedOnce && (basket.syncStatus === 'synced' || !basket.ownerId)} loading={saving} onPress={() => { void save(); }} />}

      {!basket.result.purchasedAt && <>
        <SecondaryButton label={t('setup.basket.delete')} disabled={saving || activeBusy} onPress={() => setDeleteReview(true)} />
        {deleteReview && <>
          <Text style={ui.body}>{t('setup.basket.deleteBody')}</Text>
          <PrimaryButton label={t('setup.basket.deleteForGood')} disabled={saving || activeBusy} onPress={() => {
            if (saveLock.current) return;
            saveLock.current = true; setSaving(true); setError(null);
            void basketOwner(basket.ownerId).then(owner => {
              if (owner !== basket.ownerId) throw Error(t('setup.basket.accountChanged'));
              return discard(basket);
            }).then(() => { generation.current++; setBasket(null); router.dismissTo('/basket'); })
              .catch(e => setError(e instanceof Error ? e.message : t('setup.basket.deleteFailed')))
              .finally(() => { saveLock.current = false; if (mounted.current) setSaving(false); });
          }} />
          <SecondaryButton label={t('setup.basket.keep')} disabled={saving} onPress={() => setDeleteReview(false)} />
        </>}
      </>}

      <ShareBasket key={basket.id} basket={basket} />

      <SecondaryButton label={t('setup.basket.viewSaved')} disabled={saving} onPress={() => router.dismissTo('/basket')} />

      <SecondaryButton label={t('setup.basket.editSettings')} disabled={flow.disabled || saving} onPress={() => flow.edit()} />

    </>}

  </Screen>;

}
