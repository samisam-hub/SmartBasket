import { formatEuro } from '../lib/german';
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

          if (!found) throw Error("Dieser gespeicherte Warenkorb ist für die aktuelle Sitzung nicht verfügbar.");

          next = found;

          // Keep the catalog available while editing a saved basket so each
          // purchased item can be swapped without regenerating the plan.
          try { catalog.current = await loadBasketCatalog(getSupabaseClient(), controller.signal); ownerRef.current = owner; }
          catch { catalog.current = []; }

          if (!controller.signal.aborted) { originalBasket.current = found; setEditingBasket(edit === '1' && !found.result.purchasedAt); }

          if (!controller.signal.aborted) { setNotice(response.warning); setSavedOnce(response.baskets.some(b => b.id === found.id && JSON.stringify(b.result) === JSON.stringify(found.result))); }

        } else {

          if (!basePreferences?.onboardingCompleted) throw Error("Vervollständige deine Einstellungen, bevor du einen Warenkorb erstellst.");

          let input=basePreferences;

          if(participants==='1'){

            const raw=await AsyncStorage.getItem(`smartbasket.active-plan.v1:${owner??'local'}`);

            if(!raw)throw Error("Prüfe zuerst die Personen in deinem Plan.");

            const stored=JSON.parse(raw);

            if(!isSaved(stored)||!stored.participants||stored.userId!==basePreferences.userId)throw Error("Die Planangaben sind ungültig oder gehören zu einem anderen Konto.");

            input=participantPreferences(stored,stored.participants);

          }

          if(!controller.signal.aborted)setPlanPreferences(input);

          let products: Product[] = [];

          try { products = await loadBasketCatalog(getSupabaseClient(), controller.signal); }

          catch { if (!controller.signal.aborted) setNotice("Der Katalog ist nicht verfügbar. Du kannst Mahlzeiten prüfen; fehlende Zutaten werden bei der Produktzuordnung angezeigt."); }

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

      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Der Warenkorb konnte nicht geladen werden."); }

      finally { if (!controller.signal.aborted) setBusy(false); }

    })();

    return () => controller.abort();

  }, [ready, basePreferences, savedId, retry,participants,edit,week,weekPlan.store]);

  const confirmPlan=()=>{

    if(!plan||!saved)return;

    try { const confirmed:AnyMealPlan={...plan,status:'confirmed'};

      setBasket(newSavedBasket(basketFromMealPlan(confirmed,saved,catalog.current,pantry.current),saved,ownerRef.current));setPlan(confirmed);setError(null);

    } catch(e){setError(e instanceof Error?e.message:"Die Packungen konnten nicht zugeordnet werden.");}

  };

  const save = async () => {

    if (!basket || saveLock.current) return;

    const token = generation.current;

    saveLock.current = true; setSaving(true); setError(null);

    try {

      const owner = await basketOwner(saved?.userId ?? null);

      if (owner !== basket.ownerId) throw Error("Die Sitzung hat sich geändert. Erstelle vor dem Speichern einen neuen Warenkorb.");

      const response = await basketPersistence().save(basket);

      if (mounted.current && token === generation.current) { setBasket(response.basket); originalBasket.current = response.basket; setEditingBasket(false); setNotice(response.warning ?? "Auf diesem Gerät und in deinem SmartBasket-Konto gespeichert."); setSavedOnce(true); }

    } catch (e) { if (mounted.current && token === generation.current) setError(e instanceof Error ? e.message : "Der Warenkorb konnte nicht gespeichert werden. Versuche es erneut."); }

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

        setNotice("Produkte aktualisiert. Prüfe deinen Warenkorb und speichere die Änderungen.");

      }

    } catch (e) { if (mounted.current && token === generation.current) setError(e instanceof Error ? e.message : "Die Aktualisierung ist fehlgeschlagen. Dein Warenkorb ist unverändert."); }

    finally { saveLock.current = false; if (mounted.current) setSaving(false); }

  };

  return <Screen top={false} bottom>

    <ScreenHeader eyebrow="DEIN EINKAUF" title={savedId ? "Gespeicherter Warenkorb" : basket ? "Dein Warenkorb zum Speiseplan" : "Dein Speiseplan"} />

    {busy && <><ActivityIndicator color={colors.primary} /><Text style={ui.body}>Produkte werden geladen und deine Anforderungen geprüft …</Text></>}

    {error && <Text style={ui.small} accessibilityRole="alert">{error}</Text>}

    {!busy && !basket && !plan && <EmptyState illustration="dataError" title="Warenkorb nicht verfügbar" description="Deine gespeicherten Einstellungen und der Katalog sind unverändert.">

      <PrimaryButton label="Erneut versuchen" onPress={() => setRetry(n => n + 1)} />

      <SecondaryButton label="Einstellungen bearbeiten" onPress={() => flow.edit()} disabled={flow.disabled} />

    </EmptyState>}

    {!busy && !basket && plan && saved && <>

      {notice && <Text style={ui.small}>{notice}</Text>}

      <MealPlanReview plan={plan} preferences={saved} onChange={setPlan} onConfirm={confirmPlan} />

      <SecondaryButton label="Einstellungen bearbeiten" onPress={() => flow.edit()} disabled={flow.disabled} />

    </>}

    {basket && <>

      <Text style={ui.small}>{basketDayCount(basket.result, basket.preferences)}  Tage · {basket.preferences.householdSize}  Personen · {basket.preferences.dailyCalories}  kcal pro Person und Tag</Text>

      {savedId && !editingBasket && !basket.result.purchasedAt && <SecondaryButton label="Warenkorb bearbeiten" disabled={saving} onPress={() => { originalBasket.current = basket; setEditingBasket(true); }} />}

      {editingBasket && !basket.result.purchasedAt && <>

        {basket.result.mealPlan && <SecondaryButton label="Produkte aus dem Katalog aktualisieren" disabled={saving} onPress={() => { void refreshProducts(); }} />}

        <PrimaryButton label="Änderungen speichern" loading={saving} onPress={() => { void save(); }} />

        <SecondaryButton label="Änderungen verwerfen" disabled={saving} onPress={() => { setBasket(originalBasket.current); setEditingBasket(false); setSavedOnce(true); setError(null); }} />

      </>}

      {basket.result.purchasedAt && <Text style={ui.body}>Gekauft · {new Date(basket.result.purchasedAt).toLocaleDateString('de-DE')}</Text>}

      <SecondaryButton label="Vorräte und Einkaufsverlauf" onPress={()=>router.push('/pantry')} />

      <BasketResult result={basket.result} catalog={catalog.current} preferences={basket.preferences}
        onReplaceProduct={!saving && !basket.result.purchasedAt ? (currentId, product) => {
          try { setBasket({ ...basket, result: replaceBasketProduct(basket.result, currentId, product), syncStatus: 'local' }); setSavedOnce(false); setNotice("Produkt ausgetauscht. Speichere den Warenkorb, um die Auswahl zu behalten."); }
          catch (e) { setError(e instanceof Error ? e.message : "Das Produkt konnte nicht ausgetauscht werden."); }
        } : undefined}
        onAddReplacement={!saving && !basket.result.purchasedAt ? (requirement, product) => {
          try { setBasket({ ...basket, result: addBasketReplacement(basket.result, requirement, product), syncStatus: 'local' }); setSavedOnce(false); setNotice("Alternative hinzugefügt. Speichere den Warenkorb, um die Auswahl zu behalten."); }
          catch (e) { setError(e instanceof Error ? e.message : "Die Alternative konnte nicht hinzugefügt werden."); }
        } : undefined}
        onToggleProduct={!basket.result.purchasedAt && !saving ? id => {

        try { setBasket({ ...basket, result: toggleBasketProduct(basket.result, id), syncStatus: 'local' }); setSavedOnce(false); setNotice(null); }

        catch (e) { setError(e instanceof Error ? e.message : "Die Produktauswahl konnte nicht aktualisiert werden."); }

      } : undefined} />

      {!basket.result.purchasedAt && <BasketExtras result={basket.result} catalog={catalog.current} preferences={basket.preferences}
        onAdd={product => {
          try { setBasket({ ...basket, result: addBasketProduct(basket.result, product), syncStatus: 'local' }); setSavedOnce(false); setNotice(`${product.name} hinzugefügt. Speichere den Warenkorb, um das Produkt zu behalten.`); }
          catch (e) { setError(e instanceof Error ? e.message : "Das Produkt konnte nicht hinzugefügt werden."); }
        }} />}
      {!savedId && plan && !basket.result.purchasedAt && <SecondaryButton label="Zurück zur Mahlzeitenübersicht" disabled={saving} onPress={()=>{setBasket(null);setSavedOnce(false);setPlan({...plan,status:'review'});setNotice(null);}} />}

      {notice && <Text style={ui.small} accessibilityLiveRegion="polite">{notice}</Text>}

      {!basket.result.purchasedAt && <>

        <PrimaryButton label="Einkauf abschließen" disabled={saving} onPress={()=>setCheckoutReview(true)} />

        {checkoutReview && <>

          <Text style={ui.body}>Bestätige, dass du {basket.result.items.reduce((n,i)=>n+i.packageCount,0)}  Packungen gekauft hast. Geschätzte Kosten: {basket.result.estimatedTotalPrice===null?'unvollständig':`${formatEuro(basket.result.estimatedTotalPrice)}`}. Es wird keine Zahlung ausgelöst.</Text>

          <Text style={ui.small}>Geplante Mengen werden für diese Mahlzeiten reserviert. Restmengen stehen künftigen Plänen zur Verfügung. Extras bleiben verfügbar, bis du sie aus deinen Vorräten entfernst. Prüfe Mengen und Eignung vor der Bestätigung.</Text>

          {basket.result.status!=='generated' && <Text style={ui.small}>Dieser Warenkorb deckt die Mahlzeiten nicht vollständig ab. Beim Abschließen werden nur die enthaltenen Produkte erfasst.</Text>}

          <PrimaryButton label="Einkauf bestätigen" loading={saving} onPress={()=>{if(saveLock.current)return;saveLock.current=true;setSaving(true);void checkoutBasket(basket).then(b=>{setBasket(b);clear(b.id);setEditingBasket(false);setSavedOnce(true);setCheckoutReview(false);setNotice("Einkauf erfasst. Deine verfügbaren Restmengen findest du unter Vorräte.");}).catch(e=>setError(e.message)).finally(()=>{saveLock.current=false;setSaving(false);});}} />

          <SecondaryButton label="Abschließen abbrechen" disabled={saving} onPress={()=>setCheckoutReview(false)} />

        </>}

      </>}

      {!basket.result.purchasedAt && (!!basket.result.items.length || !!basket.result.mealPlan?.items.length) && <PrimaryButton label={savedOnce ? basket.syncStatus === 'synced' ? "Warenkorb gespeichert" : "Erneut in der Cloud speichern" : basket.result.engineVersion==='2' ? "Speiseplan und Warenkorb speichern" : "Warenkorb speichern"}

        disabled={savedOnce && (basket.syncStatus === 'synced' || !basket.ownerId)} loading={saving} onPress={() => { void save(); }} />}

      {!basket.result.purchasedAt && <>
        <SecondaryButton label="Warenkorb löschen" disabled={saving || activeBusy} onPress={() => setDeleteReview(true)} />
        {deleteReview && <>
          <Text style={ui.body}>Diesen angefangenen Warenkorb löschen? Dein Wochenplan bleibt erhalten.</Text>
          <PrimaryButton label="Warenkorb endgültig löschen" disabled={saving || activeBusy} onPress={() => {
            if (saveLock.current) return;
            saveLock.current = true; setSaving(true); setError(null);
            void basketOwner(basket.ownerId).then(owner => {
              if (owner !== basket.ownerId) throw Error("Dein Konto hat sich geändert. Öffne den Warenkorb erneut, bevor du ihn löschst.");
              return discard(basket);
            }).then(() => { generation.current++; setBasket(null); router.dismissTo('/basket'); })
              .catch(e => setError(e instanceof Error ? e.message : "Der Warenkorb konnte nicht gelöscht werden."))
              .finally(() => { saveLock.current = false; if (mounted.current) setSaving(false); });
          }} />
          <SecondaryButton label="Warenkorb behalten" disabled={saving} onPress={() => setDeleteReview(false)} />
        </>}
      </>}

      <ShareBasket key={basket.id} basket={basket} />

      <SecondaryButton label="Gespeicherte Warenkörbe ansehen" disabled={saving} onPress={() => router.dismissTo('/basket')} />

      <SecondaryButton label="Einstellungen bearbeiten" disabled={flow.disabled || saving} onPress={() => flow.edit()} />

    </>}

  </Screen>;

}
