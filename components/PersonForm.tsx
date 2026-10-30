import { kindLabel, t, term } from '../services/i18n';
import { Text, View } from 'react-native';
import { NumberInput } from './NumberInput';
import { OptionalNumber } from './ProfileFields';
import { SectionCard, SelectionChip, TextInput } from './ui';
import { estimateCalories, participantKind, patchParticipant } from '../services/profile-domain';
import { allergens, diets, type Diet, type Allergen, type Goal } from '../types/preferences';
import { onboardingActivities, participantKinds, sexes, type PlanParticipant } from '../types/profile';
import { ui } from '../lib/theme';

const activityChoices = Object.keys(onboardingActivities) as (keyof typeof onboardingActivities)[];
const intolerances = ['lactose', 'gluten'] as const;
const activityChoice = (person: PlanParticipant) =>
  activityChoices
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
    <SectionCard title={t('person.who')}>
      <TextInput label={t('person.name')} value={person.name} onChangeText={name => patch({ name })} maxLength={60} />
      <View style={ui.wrap}>
        {participantKinds.map(kind => <SelectionChip key={kind} label={kindLabel(kind)}
          selected={participantKind(person) === kind} onPress={() => patch({ kind })} />)}
      </View>
    </SectionCard>
    <SectionCard title={t('person.needs')}>
      <Text style={ui.small}>{t('person.needsHint')}</Text>
      <OptionalNumber label={t('person.age')} value={person.age} hint={t('person.optional')}
        onChange={age => patch({ age })} />
      <View style={ui.wrap}>
        {sexes.map(sex => <SelectionChip key={sex} label={term(sex)} selected={person.sex === sex}
          onPress={() => patch({ sex: person.sex === sex ? null : sex })} />)}
      </View>
      <View style={ui.wrap}>
        {activityChoices.map(choice =>
          <SelectionChip key={choice} label={term(choice)} selected={activityChoice(person) === choice}
            onPress={() => patch({ activityLevel: activityChoice(person) === choice ? null : onboardingActivities[choice] })} />)}
      </View>
      <NumberInput label={t('person.calories')} value={person.dailyCalories}
        hint={t(person.dailyCalories === estimateCalories(person) ? 'person.ourSuggestion' : 'person.yourNumber')}
        onChange={dailyCalories => patch({
          dailyCalories: dailyCalories === null ? estimateCalories(person) : dailyCalories })} />
      <Text style={ui.small}>{t('person.caloriesNote')}</Text>
    </SectionCard>
    <SectionCard title={t('person.diet')}>
      <View style={ui.wrap}>
        {diets.map(diet => <SelectionChip key={diet} label={term(diet)}
          selected={person.dietaryPreferences.includes(diet)} onPress={() => setDiet(diet)} />)}
      </View>
    </SectionCard>
    <SectionCard title={t('person.allergies')}>
      <Text style={ui.small}>{t('person.allergiesNote')}</Text>
      <View style={ui.wrap}>
        {allergens.map(allergen => <SelectionChip key={allergen} label={term(allergen)}
          selected={person.allergens.includes(allergen)}
          onPress={() => patch({ allergens: toggle(person.allergens, allergen) as Allergen[] })} />)}
      </View>
      <View style={ui.wrap}>
        {intolerances.map(key =>
          <SelectionChip key={key} label={t('person.intolerance', { term: term(key) })}
            selected={person.intolerances.includes(key)}
            onPress={() => patch({ intolerances: toggle(person.intolerances, key) })} />)}
      </View>
      <Text style={ui.small}>{t('person.allergyDisclaimer')}</Text>
    </SectionCard>
  </View>;
}
