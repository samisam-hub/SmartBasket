import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { loadPantry } from '../services/pantry';
import { shoppingImpact } from '../services/waste-prevention';
import { SectionCard } from './ui';
import { colors, ui } from '../lib/theme';

export function WastePrevention() {
  const { session, ready } = useAuth();
  const owner = session?.user.id ?? null;
  const [result, setResult] = useState<{ owner: string | null; value: ReturnType<typeof shoppingImpact> } | null>(null);
  const [error, setError] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setResult(null); setError(false);
    if (ready) void loadPantry(owner).then(({ purchases }) => {
      if (active) setResult({ owner, value: shoppingImpact(purchases) });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [owner, ready]));
  const impact = result?.owner === owner ? result.value : null;
  return <SectionCard title="Your journey" compact pale>
    {error ? <Text style={ui.small}>Your summary could not be loaded.</Text> : !impact ? <Text style={ui.small}>Loading your summary…</Text> : !impact.shops ? <Text style={ui.body}>Your first shop starts here. Complete checkout to start tracking your impact.</Text> : <>
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'stretch' }}>
        {[
          { amount: String(impact.days), label: `${impact.days === 1 ? 'Day' : 'Days'} on SmartBasket`, icon: 'sun' as const, display: `${impact.days === 1 ? 'Day' : 'Days'}\nusing app` },
          { amount: String(impact.shops), label: `${impact.shops === 1 ? 'Shop' : 'Shops'} completed`, icon: 'shopping-bag' as const, display: `${impact.shops === 1 ? 'Shop' : 'Shops'}\ncompleted` },
          { amount: impact.calorieTargetsMet === null ? '—' : `${impact.calorieTargetsMet}%`, label: 'Calorie targets met', icon: 'target' as const, display: 'Calorie\ntargets met', detail: 'Confirmed plan days per person within 10% of their calorie target. Planned nutrition, not logged intake.' },
          { amount: impact.proteinTargetsMet === null ? '—' : `${impact.proteinTargetsMet}%`, label: 'Avg. protein coverage', icon: 'bar-chart-2' as const, display: 'Protein\ncoverage', detail: 'Average planned protein divided by each person’s daily protein target across confirmed plan days. Can exceed 100%. Planned nutrition, not logged intake.' },
          { amount: `~€${impact.euros.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, label: `Leftovers reused${impact.unpriced ? ' (partial)' : ''}`, icon: 'refresh-cw' as const, display: `Leftovers\n${impact.unpriced ? 'partial' : 'reused'}` },
          { amount: impact.savedBudgetPercent === null ? '—' : `${impact.savedBudgetPercent}%`, label: 'Saved budget', display: 'Saved\nbudget', icon: 'percent' as const, detail: 'Budget minus estimated cost, divided by budget across completed purchases with known complete prices. Negative means over budget.' },
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
