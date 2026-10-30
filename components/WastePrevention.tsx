import { formatMoney, t } from '../services/i18n';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { hasSavedWork } from '../services/saved-work';
import { loadPantry } from '../services/pantry';
import { shoppingImpact } from '../services/waste-prevention';
import { SectionCard } from './ui';
import { colors, ui } from '../lib/theme';

export function WastePrevention() {
  const { session, ready } = useAuth();
  const { saved } = usePreferences();
  const owner = session?.user.id ?? null;
  const [result, setResult] = useState<{ owner: string | null; value: ReturnType<typeof shoppingImpact> } | null>(null);
  const [error, setError] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!hasSavedWork(saved)) { setResult(null); setError(false); return; }
    let active = true;
    setResult(null); setError(false);
    if (ready) void loadPantry(owner).then(({ purchases }) => {
      if (active) setResult({ owner, value: shoppingImpact(purchases) });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [owner, ready, saved]));
  const impact = result?.owner === owner ? result.value : null;
  return <SectionCard title={t('waste.title')} compact pale>
    {error ? <Text style={ui.small}>{t('waste.overviewFailed')}</Text> : !impact ? <Text style={ui.small}>{t('waste.overviewLoading')}</Text> : !impact.shops ? <Text style={ui.body}>{t('waste.firstShop')}</Text> : <>
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'stretch' }}>
        {[
          { amount: String(impact.days), label: t('waste.daysWith', { count: impact.days }), icon: 'sun' as const, display: t('waste.daysShortUse', { count: impact.days }) },
          { amount: String(impact.shops), label: t('waste.shopsDone', { count: impact.shops }), icon: 'shopping-bag' as const, display: t('waste.shopsShort', { count: impact.shops }) },
          { amount: impact.calorieTargetsMet === null ? '—' : `${impact.calorieTargetsMet}%`, label: t('waste.calorieTargets'), icon: 'target' as const, display: t('waste.calorieTargets'), detail: t('waste.calorieTargetsNote') },
          { amount: impact.proteinTargetsMet === null ? '—' : `${impact.proteinTargetsMet}%`, label: t('waste.proteinAverage'), icon: 'bar-chart-2' as const, display: t('waste.proteinShort'), detail: t('waste.proteinNote') },
          { amount: `~${formatMoney(impact.euros)}`, label: t('waste.pantryReused', { partly: impact.unpriced ? t('waste.partial') : '' }), icon: 'refresh-cw' as const, display: t(impact.unpriced ? 'waste.pantryShortPartly' : 'waste.pantryShortUsed') },
          { amount: impact.savedBudgetPercent === null ? '—' : `${impact.savedBudgetPercent}%`, label: t('waste.savedBudget'), display: t('waste.savedBudget'), icon: 'percent' as const, detail: t('waste.savedBudgetNote') },
        ].map(stat => <View key={stat.label} accessible accessibilityLabel={`${stat.amount} ${stat.label}. ${stat.detail ?? ''}`} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 4 }}>
          {stat.icon === 'percent'
            ? <MaterialCommunityIcons name="piggy-bank-outline" size={23} color={colors.primary} />
            : stat.icon === 'target'
              ? <Ionicons name="flame-outline" size={23} color={colors.primary} />
              : stat.icon === 'bar-chart-2'
                ? <MaterialCommunityIcons name="arm-flex-outline" size={23} color={colors.primary} />
                : <Feather name={stat.icon} size={23} color={colors.primary} />}
          <Text style={[ui.heading, { fontSize: 18, lineHeight: 26, textAlign: 'center', width: '100%' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{stat.amount}</Text>
          <Text style={[ui.caption, { fontSize: 11, lineHeight: 15, textAlign: 'center' }]}>{stat.display}</Text>
        </View>)}
      </View>
    </>}
  </SectionCard>;
}
