import { useState } from 'react';
import { Text, View } from 'react-native';
import { NumberInput } from './NumberInput';
import { OptionalNumber } from './ProfileFields';
import { SectionCard, SelectionChip, SecondaryButton, TextButton, TextInput } from './ui';
import { newParticipant, updateParticipant } from '../services/participant-domain';
import { sexes, type PlanParticipant } from '../types/profile';
import { ui } from '../lib/theme';

export function OnboardingPeople({ people, onChange }: { people: PlanParticipant[]; onChange: (people: PlanParticipant[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const patch = (id: string, value: Partial<PlanParticipant>) => onChange(people.map(p => p.id === id ? updateParticipant(p, value) : p));
  return <>
    {people.map(p => <SectionCard key={p.id} title={p.name || 'Person'}>
      <View style={ui.wrap}>{(['adult', 'child'] as const).map(kind => <SelectionChip key={kind}
        label={kind === 'adult' ? 'Adult' : 'Child'} selected={p.kind === kind}
        onPress={() => patch(p.id, { kind, ...(p.kind !== kind ? { age: null } : {}) })} />)}</View>
      <Text style={ui.small}>{p.kind === 'child' ? 'A smaller planning portion' : 'A balanced daily portion'} · Recommendation, adjustable any time.</Text>
      <TextButton label={expanded === p.id ? 'Hide details' : 'Adjust recommendation or add details'} onPress={() => setExpanded(expanded === p.id ? null : p.id)} />
      {expanded === p.id && <>
        <TextInput label="Name (optional)" value={p.name} onChangeText={name => patch(p.id, { name })}
          onBlur={() => { if (!p.name.trim()) patch(p.id, { name: p.isCurrentUser ? 'You' : 'Person' }); }} />
        <OptionalNumber label="Age (optional)" value={p.age} onChange={age => patch(p.id, { age })} />
        <Text style={ui.small}>Sex (optional)</Text>
        <View style={ui.wrap}>{sexes.map(sex => <SelectionChip key={sex} label={sex.replaceAll('_', ' ')} selected={p.sex === sex} onPress={() => patch(p.id, { sex: p.sex === sex ? null : sex })} />)}</View>
        <Text style={ui.small}>Activity (optional)</Text>
        <View style={ui.wrap}>{(['sedentary', 'normal', 'active'] as const).map(activityLevel => <SelectionChip key={activityLevel} label={activityLevel} selected={p.activityLevel === activityLevel} onPress={() => patch(p.id, { activityLevel: p.activityLevel === activityLevel ? null : activityLevel })} />)}</View>
        {p.kind !== 'child' && <>
          <OptionalNumber label="Height in cm (optional)" value={p.heightCm ?? null} onChange={heightCm => patch(p.id, { heightCm })} />
          <OptionalNumber label="Weight in kg (optional)" value={p.weightKg ?? null} onChange={weightKg => patch(p.id, { weightKg })} />
        </>}
        <Text style={ui.small}>{p.kind === 'child' ? 'Child portions start at 1,400 kcal; adjust to the needs of your child. The adult formula is not used.' : 'With age, height, weight and male/female sex, we use Mifflin–St Jeor and activity (normal if omitted). Otherwise the starting portion is 2,000 kcal.'}</Text>
        <SelectionChip label="Use recommendation" selected={p.calorieTargetMode === 'recommended'} onPress={() => patch(p.id, { calorieTargetMode: 'recommended' })} />
        <NumberInput label="Daily planning target (kcal)" hint="Editable recommendation: 1,000–5,000 kcal" value={p.dailyCalories}
          onChange={dailyCalories => patch(p.id, { calorieTargetMode: 'manual', dailyCalories, proteinTarget: dailyCalories === null ? null : Math.round(dailyCalories * .2 / 4) })} />
      </>}
      {!p.isCurrentUser && <TextButton label="Remove person" onPress={() => onChange(people.filter(x => x.id !== p.id))} />}
    </SectionCard>)}
    <SecondaryButton label="Add person" disabled={people.length >= 10} onPress={() => onChange([...people, newParticipant(`person-${Date.now()}`, `Person ${people.length + 1}`)])} />
  </>;
}
