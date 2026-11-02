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
  return <SectionCard title="Deine Übersicht" compact pale>
    {error ? <Text style={ui.small}>Deine Übersicht konnte nicht geladen werden.</Text> : !impact ? <Text style={ui.small}>Deine Übersicht wird geladen …</Text> : !impact.shops ? <Text style={ui.body}>Hier beginnt dein erster Einkauf. Schließe einen Einkauf ab, um deine Übersicht zu starten.</Text> : <>
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'stretch' }}>
        {[
          { amount: String(impact.days), label: `${impact.days === 1 ? "Tag" : "Tage"} mit SmartBasket`, icon: 'sun' as const, display: `${impact.days === 1 ? "Tag" : "Tage"}
App-Nutzung` },
          { amount: String(impact.shops), label: `${impact.shops === 1 ? "Einkauf" : "Einkäufe"} abgeschlossen`, icon: 'shopping-bag' as const, display: `${impact.shops === 1 ? "Einkauf" : "Einkäufe"}\nabgeschlossen` },
          { amount: impact.calorieTargetsMet === null ? '—' : `${impact.calorieTargetsMet}%`, label: "Kalorienziele erreicht", icon: 'target' as const, display: "Kalorienziele erreicht", detail: "Bestätigte Plantage pro Person, die höchstens 10 % vom Kalorienziel abweichen. Geplante Nährwerte, keine erfasste Nahrungsaufnahme." },
          { amount: impact.proteinTargetsMet === null ? '—' : `${impact.proteinTargetsMet}%`, label: "Durchschnittliche Eiweißversorgung", icon: 'bar-chart-2' as const, display: 'Eiweiß\nversorgung', detail: "Durchschnittlich geplantes Eiweiß im Verhältnis zum täglichen Eiweißziel jeder Person an bestätigten Plantagen. Kann über 100 % liegen. Geplante Nährwerte, keine erfasste Nahrungsaufnahme." },
          { amount: `~€${impact.euros.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, label: `Vorräte wiederverwendet${impact.unpriced ? ' (teilweise)' : ''}`, icon: 'refresh-cw' as const, display: `Vorräte
${impact.unpriced ? 'teilweise' : 'verwendet'}` },
          { amount: impact.savedBudgetPercent === null ? '—' : `${impact.savedBudgetPercent}%`, label: "Gespartes Budget", display: "Gespartes Budget", icon: 'percent' as const, detail: "Budget abzüglich geschätzter Kosten im Verhältnis zum Budget abgeschlossener Einkäufe mit vollständigen Preisen. Ein negativer Wert bedeutet eine Budgetüberschreitung." },
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
