import { Text, View } from 'react-native';
import { NumberInput } from './NumberInput';
import { OptionalNumber } from './ProfileFields';
import { SectionCard, SelectionChip, TextInput } from './ui';
import { estimateCalories, participantKind, patchParticipant } from '../services/profile-domain';
import { allergens, diets, labels, type Diet, type Allergen, type Goal } from '../types/preferences';
import { onboardingActivities, participantKinds, sexes, type ParticipantKind, type PlanParticipant } from '../types/profile';
import { ui } from '../lib/theme';

export const kindLabels: Record<ParticipantKind, string> = { adult: 'Adult', child: 'Child' };
const activityLabels: Record<keyof typeof onboardingActivities, string> = {
  sedentary: 'Mostly sitting', normal: 'Normal', active: 'Active',
};
const sexLabels: Record<(typeof sexes)[number], string> = {
  female: 'Female', male: 'Male', other: 'Other', prefer_not_to_say: 'Rather not say',
};
const intoleranceLabels = { lactose: 'Lactose', gluten: 'Gluten' } as const;
const activityChoice = (person: PlanParticipant) =>
  (Object.keys(activityLabels) as (keyof typeof onboardingActivities)[])
    .find(choice => onboardingActivities[choice] === person.activityLevel);

/** Everything about one person on one page: who they are, what they need, what they avoid.
 *
 *  Budget is not here. It belongs to the household, not to a person, and is asked once the
 *  household is complete. */
export function PersonForm({ person, goal, onChange }: {
  person: PlanParticipant;
  goal: Goal;
  onChange: (person: PlanParticipant) => void;
}) {
  const patch = (values: Partial<PlanParticipant>) => onChange(patchParticipant(person, values, goal));
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter(other => other !== value) : [...list, value];
  const setDiet = (diet: Diet) => {
    if (diet === 'none') return patch({ dietaryPreferences: ['none'] });
    const next = toggle(person.dietaryPreferences.filter(d => d !== 'none'), diet);
    patch({ dietaryPreferences: next.length ? next : ['none'] });
  };
  return <View style={ui.stack}>
    <SectionCard title="Who is this?">
      <TextInput label="Name" value={person.name} onChangeText={name => patch({ name })} maxLength={60} />
      <View style={ui.wrap}>
        {participantKinds.map(kind => <SelectionChip key={kind} label={kindLabels[kind]}
          selected={participantKind(person) === kind} onPress={() => patch({ kind })} />)}
      </View>
    </SectionCard>
    <SectionCard title="What they need a day">
      <Text style={ui.small}>
        Age, sex and activity sharpen the suggestion. Leave them blank and we use typical values.
      </Text>
      <OptionalNumber label="Age" value={person.age} hint="Optional."
        onChange={age => patch({ age })} />
      <View style={ui.wrap}>
        {sexes.map(sex => <SelectionChip key={sex} label={sexLabels[sex]} selected={person.sex === sex}
          onPress={() => patch({ sex: person.sex === sex ? null : sex })} />)}
      </View>
      <View style={ui.wrap}>
        {(Object.keys(activityLabels) as (keyof typeof onboardingActivities)[]).map(choice =>
          <SelectionChip key={choice} label={activityLabels[choice]} selected={activityChoice(person) === choice}
            onPress={() => patch({ activityLevel: activityChoice(person) === choice ? null : onboardingActivities[choice] })} />)}
      </View>
      <NumberInput label="Daily amount (kcal)" value={person.dailyCalories}
        hint={person.dailyCalories === estimateCalories(person)
          ? 'Our suggestion. Change it and we keep your number.'
          : 'Your own number. Clear it to get the suggestion back.'}
        onChange={dailyCalories => patch({
          dailyCalories: dailyCalories === null ? estimateCalories(person) : dailyCalories })} />
      <Text style={ui.small}>
        A suggestion from age, sex and activity, not a nutrition prescription.
      </Text>
    </SectionCard>
    <SectionCard title="How they eat">
      <View style={ui.wrap}>
        {diets.map(diet => <SelectionChip key={diet} label={labels[diet]}
          selected={person.dietaryPreferences.includes(diet)} onPress={() => setDiet(diet)} />)}
      </View>
    </SectionCard>
    <SectionCard title="Allergies and intolerances">
      <Text style={ui.small}>
        Anything picked here is avoided for the whole household, never traded away for a better fit.
      </Text>
      <View style={ui.wrap}>
        {allergens.map(allergen => <SelectionChip key={allergen} label={labels[allergen]}
          selected={person.allergens.includes(allergen)}
          onPress={() => patch({ allergens: toggle(person.allergens, allergen) as Allergen[] })} />)}
      </View>
      <View style={ui.wrap}>
        {(Object.keys(intoleranceLabels) as (keyof typeof intoleranceLabels)[]).map(key =>
          <SelectionChip key={key} label={`${intoleranceLabels[key]} intolerance`}
            selected={person.intolerances.includes(key)}
            onPress={() => patch({ intolerances: toggle(person.intolerances, key) })} />)}
      </View>
      <Text style={ui.small}>
        Allergy details come from our curated recipes. Always check the label on what you buy.
      </Text>
    </SectionCard>
  </View>;
}
