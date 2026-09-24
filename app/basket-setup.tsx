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

import type { MealPlan } from '@/types/meal';

import type { Product } from '@/types/product';

import { newSavedBasket } from '@/services/basket/persistence';

import { basketOwner, basketPersistence } from '@/services/baskets';

import type { SavedBasket } from '@/types/basket';

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {UserPreferences} from '@/types/preferences';

import {participantPreferences} from '@/services/profile-domain';

import {isSaved} from '@/services/preference-domain';

import { removeBasketProduct } from '@/services/basket/edit';

import { useActiveBasket } from '@/context/ActiveBasketContext';

import { addBasketProduct } from '@/services/basket/add-product';
import { addBasketReplacement, replaceBasketProduct } from '@/services/basket/replacements';

export default function BasketSetupScreen() {

  const { active, remember, clear } = useActiveBasket();

  const pantry = useRef<PantryLot[]>([]);

  const [checkoutReview,setCheckoutReview]=useState(false);

  const activeRef = useRef(active); activeRef.current = active;

  const { saved:basePreferences, ready } = usePreferences(), flow = useBasketFlow();

  const [planPreferences,setPlanPreferences]=useState<UserPreferences|null>(null);

  const saved=planPreferences??basePreferences;

  const { savedId,participants,edit } = useLocalSearchParams<{ savedId?: string;participants?:string;edit?:string }>();

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

          if (!found) throw Error('This saved basket is unavailable for the current session.');

          next = found;

          // Keep the catalog available while editing a saved basket so each
          // purchased item can be swapped without regenerating the plan.
          try { catalog.current = await loadBasketCatalog(getSupabaseClient(), controller.signal); ownerRef.current = owner; }
          catch { catalog.current = []; }

          if (!controller.signal.aborted) { originalBasket.current = found; setEditingBasket(edit === '1' && !found.result.purchasedAt); }

          if (!controller.signal.aborted) { setNotice(response.warning); setSavedOnce(response.baskets.some(b => b.id === found.id && JSON.stringify(b.result) === JSON.stringify(found.result))); }

        } else {

          if (!basePreferences?.onboardingCompleted) throw Error('Complete your preferences before generating a basket.');

          let input=basePreferences;

          if(participants==='1'){

            const raw=await AsyncStorage.getItem(`smartbasket.active-plan.v1:${owner??'local'}`);

            if(!raw)throw Error('Review your plan participants first.');

            const stored=JSON.parse(raw);

            if(!isSaved(stored)||!stored.participants||stored.userId!==basePreferences.userId)throw Error('Plan inputs are invalid or belong to another account.');

            input=participantPreferences(stored,stored.participants);

          }

          if(!controller.signal.aborted)setPlanPreferences(input);

          let products: Product[] = [];

          try { products = await loadBasketCatalog(getSupabaseClient(), controller.signal); }

          catch { if (!controller.signal.aborted) setNotice('Catalog unavailable. You can review meals; package matching will report missing ingredients.'); }

          await new Promise(resolve => setTimeout(resolve, 0));

          if (controller.signal.aborted) return;

          catalog.current=products;ownerRef.current=owner;

          setPlan(generateMealPlan(input,products));

        }

        if (!controller.signal.aborted) setBasket(next);

      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Basket could not be loaded.'); }

      finally { if (!controller.signal.aborted) setBusy(false); }

    })();

    return () => controller.abort();

  }, [ready, basePreferences, savedId, retry,participants,edit]);

  const confirmPlan=()=>{

    if(!plan||!saved)return;

    try { const confirmed:MealPlan={...plan,status:'confirmed'};

      setBasket(newSavedBasket(basketFromMealPlan(confirmed,saved,catalog.current,pantry.current),saved,ownerRef.current));setPlan(confirmed);setError(null);

    } catch(e){setError(e instanceof Error?e.message:'Could not match packages.');}

  };

  const save = async () => {

    if (!basket || saveLock.current) return;

    const token = generation.current;

    saveLock.current = true; setSaving(true); setError(null);

    try {

      const owner = await basketOwner(saved?.userId ?? null);

      if (owner !== basket.ownerId) throw Error('Session changed. Generate a new basket before saving.');

      const response = await basketPersistence().save(basket);

      if (mounted.current && token === generation.current) { setBasket(response.basket); originalBasket.current = response.basket; setEditingBasket(false); setNotice(response.warning ?? 'Saved to this device and your SmartBasket session.'); setSavedOnce(true); }

    } catch (e) { if (mounted.current && token === generation.current) setError(e instanceof Error ? e.message : 'Basket save failed. Retry.'); }

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

      for (const extra of basket.result.items.filter(i => i.isExtra || i.extraPackageCount)) {

        const product = products.find(p => p.id === extra.product.id) ?? extra.product;

        for (let count = 0; count < (extra.isExtra ? extra.packageCount : extra.extraPackageCount ?? 0); count++) result = addBasketProduct(result, product);

      }

      if (mounted.current && token === generation.current) {

        originalBasket.current = originalBasket.current ?? basket;

        setBasket({ ...basket, result, syncStatus: 'local' }); setEditingBasket(true); setSavedOnce(false);

        setNotice('Products refreshed. Review the shopping list and save your changes.');

      }

    } catch (e) { if (mounted.current && token === generation.current) setError(e instanceof Error ? e.message : 'Refresh failed. Your basket is unchanged.'); }

    finally { saveLock.current = false; if (mounted.current) setSaving(false); }

  };

  return <Screen top={false} bottom>

    <ScreenHeader eyebrow="YOUR GROCERIES" title={savedId ? 'Saved basket' : basket ? 'Your meal-based basket' : 'Your meal plan'} />

    {busy && <><ActivityIndicator color={colors.primary} /><Text style={ui.body}>Loading products and checking your constraints…</Text></>}

    {error && <Text style={ui.small} accessibilityRole="alert">{error}</Text>}

    {!busy && !basket && !plan && <EmptyState illustration="dataError" title="Basket not available" description="Your saved preferences and catalog are unchanged.">

      <PrimaryButton label="Retry" onPress={() => setRetry(n => n + 1)} />

      <SecondaryButton label="Edit preferences" onPress={() => flow.edit()} disabled={flow.disabled} />

    </EmptyState>}

    {!busy && !basket && plan && saved && <>

      {notice && <Text style={ui.small}>{notice}</Text>}

      <MealPlanReview plan={plan} preferences={saved} onChange={setPlan} onConfirm={confirmPlan} />

      <SecondaryButton label="Edit preferences" onPress={() => flow.edit()} disabled={flow.disabled} />

    </>}

    {basket && <>

      <Text style={ui.small}>{basket.preferences.planningDays} days · {basket.preferences.householdSize} people · {basket.preferences.dailyCalories} kcal per person per day</Text>

      {savedId && !editingBasket && !basket.result.purchasedAt && <SecondaryButton label="Edit basket" disabled={saving} onPress={() => { originalBasket.current = basket; setEditingBasket(true); }} />}

      {editingBasket && !basket.result.purchasedAt && <>

        {basket.result.mealPlan && <SecondaryButton label="Refresh products from catalog" disabled={saving} onPress={() => { void refreshProducts(); }} />}

        <PrimaryButton label="Save changes" loading={saving} onPress={() => { void save(); }} />

        <SecondaryButton label="Cancel changes" disabled={saving} onPress={() => { setBasket(originalBasket.current); setEditingBasket(false); setSavedOnce(true); setError(null); }} />

      </>}

      {basket.result.purchasedAt && <Text style={ui.body}>Purchased · {new Date(basket.result.purchasedAt).toLocaleDateString('en-GB')}</Text>}

      <SecondaryButton label="Pantry & purchase history" onPress={()=>router.push('/pantry')} />

      <BasketResult result={basket.result} catalog={catalog.current} preferences={basket.preferences}
        onReplaceProduct={editingBasket && !saving ? (currentId, product) => {
          try { setBasket({ ...basket, result: replaceBasketProduct(basket.result, currentId, product), syncStatus: 'local' }); setSavedOnce(false); setNotice('Product replaced. Save the basket to keep this choice.'); }
          catch (e) { setError(e instanceof Error ? e.message : 'Could not replace product.'); }
        } : undefined}
        onAddReplacement={editingBasket && !saving ? (requirement, product) => {
          try { setBasket({ ...basket, result: addBasketReplacement(basket.result, requirement, product), syncStatus: 'local' }); setSavedOnce(false); setNotice('Category replacement added. Save the basket to keep this choice.'); }
          catch (e) { setError(e instanceof Error ? e.message : 'Could not add replacement.'); }
        } : undefined}
        onRemoveProduct={editingBasket && !saving ? id => {

        try { setBasket({ ...basket, result: removeBasketProduct(basket.result, id), syncStatus: 'local' }); setSavedOnce(false); setNotice(null); }

        catch (e) { setError(e instanceof Error ? e.message : 'Could not remove product.'); }

      } : undefined} />

      {!savedId && plan && !basket.result.purchasedAt && <SecondaryButton label="Back to meal review" disabled={saving} onPress={()=>{setBasket(null);setSavedOnce(false);setPlan({...plan,status:'review'});setNotice(null);}} />}

      {notice && <Text style={ui.small} accessibilityLiveRegion="polite">{notice}</Text>}

      {!basket.result.purchasedAt && <>

        <PrimaryButton label="Checkout" disabled={saving} onPress={()=>setCheckoutReview(true)} />

        {checkoutReview && <>

          <Text style={ui.body}>Confirm that you bought {basket.result.items.reduce((n,i)=>n+i.packageCount,0)} packages. Estimated cost: {basket.result.estimatedTotalPrice===null?'incomplete':`€${basket.result.estimatedTotalPrice.toFixed(2)}`}. No payment is taken.</Text>

          <Text style={ui.small}>Planned quantities will be reserved for these meals. Remaining quantities become available for future plans. Extras remain available until you remove them from your pantry. Check quantities and suitability before confirming.</Text>

          {basket.result.status!=='generated' && <Text style={ui.small}>This basket has incomplete meal coverage. Checkout records only the products in this basket.</Text>}

          <PrimaryButton label="Confirm purchased" loading={saving} onPress={()=>{if(saveLock.current)return;saveLock.current=true;setSaving(true);void checkoutBasket(basket).then(b=>{setBasket(b);clear(b.id);setEditingBasket(false);setSavedOnce(true);setCheckoutReview(false);setNotice('Purchase recorded. Your available leftovers are in Pantry.');}).catch(e=>setError(e.message)).finally(()=>{saveLock.current=false;setSaving(false);});}} />

          <SecondaryButton label="Cancel checkout" disabled={saving} onPress={()=>setCheckoutReview(false)} />

        </>}

      </>}

      {!basket.result.purchasedAt && (!!basket.result.items.length || !!basket.result.mealPlan?.items.length) && <PrimaryButton label={savedOnce ? basket.syncStatus === 'synced' ? 'Basket saved' : 'Retry cloud save' : basket.result.engineVersion==='2' ? 'Save meal plan & basket' : 'Save basket'}

        disabled={savedOnce && (basket.syncStatus === 'synced' || !basket.ownerId)} loading={saving} onPress={() => { void save(); }} />}

      <SecondaryButton label="View saved baskets" disabled={saving} onPress={() => router.dismissTo('/basket')} />

      <SecondaryButton label="Edit preferences" disabled={flow.disabled || saving} onPress={() => flow.edit()} />

    </>}

  </Screen>;

}
