import { kindLabel, t, term } from '../services/i18n';
import { Text, View } from 'react-native';
import { AvatarPicker } from './Avatar';
import { NumberInput } from './NumberInput';
import { OptionalNumber } from './ProfileFields';
import { Dropdown, SectionCard, SelectionChip, TextInput } from './ui';
import { estimateCalories, participantKind, patchParticipant } from '../services/profile-domain';
import { allergens, diets, type Diet, type Allergen, type Goal } from '../types/preferences';
import { onboardingActivities, participantKinds, sexes, type PlanParticipant } from '../types/profile';
import { spacing, ui } from '../lib/theme';

const activityChoices = Object.keys(onboardingActivities) as (keyof typeof onboardingActivities)[];
const activityChoice = (person: PlanParticipant) =>
  activityChoices.find(choice => onboardingActivities[choice] === person.activityLevel);

/** Everything about one person on one page: who they are, what they need, what they avoid.
 *
 *  The long answers are dropdowns rather than fields of chips, so the page stays one screen and
 *  each question carries its own heading. Lactose and gluten are asked once, as a way of eating;
 *  repeating them as intolerances beside the milk allergy only invited contradicting answers.
 *
 *  Budget is not here. It belongs to the household, not to a person, and is asked once the
 *  household is complete. */
export function PersonForm({ person, goal, onChange }: {
  person: PlanParticipant;
  goal: Goal;
  onChange: (person: PlanParticipant) => void;
}) {
  const patch = (values: Partial<PlanParticipant>) => onChange(patchParticipant(person, values, goal));
  const words = (values: readonly string[]) => values.map(value => ({ value, label: term(value) }));
  return <View style={{ gap: spacing.md }}>
    <SectionCard compact title={t('person.who')}>
      <AvatarPicker name={person.name} id={person.id} uri={person.avatarUri}
        onChange={avatarUri => patch({ avatarUri })} />
      <TextInput label={t('person.name')} value={person.name} onChangeText={name => patch({ name })} maxLength={60} />
      <View style={ui.wrap}>
        {participantKinds.map(kind => <SelectionChip key={kind} label={kindLabel(kind)}
          selected={participantKind(person) === kind} onPress={() => patch({ kind })} />)}
      </View>
    </SectionCard>
    <SectionCard compact title={t('person.needs')}>
      <Text style={ui.small}>{t('person.needsHint')}</Text>
      <OptionalNumber label={t('person.age')} value={person.age} onChange={age => patch({ age })} />
      <Dropdown label={t('person.sex')} value={person.sex} options={words(sexes)}
        placeholder={t('dropdown.none')}
        onChange={value => patch({ sex: (value as PlanParticipant['sex']) ?? null })} />
      <Dropdown label={t('person.activity')} value={activityChoice(person) ?? null} options={words(activityChoices)}
        placeholder={t('dropdown.none')}
        onChange={value => patch({ activityLevel: value === null ? null
          : onboardingActivities[value as keyof typeof onboardingActivities] })} />
      <NumberInput label={t('person.calories')} value={person.dailyCalories}
        hint={t(person.dailyCalories === estimateCalories(person) ? 'person.ourSuggestion' : 'person.yourNumber')}
        onChange={dailyCalories => patch({
          dailyCalories: dailyCalories === null ? estimateCalories(person) : dailyCalories })} />
    </SectionCard>
    <SectionCard compact title={t('person.diet')}>
      <Dropdown multiple label={t('person.dietLabel')} options={words(diets)}
        value={person.dietaryPreferences.filter(diet => diet !== 'none')}
        placeholder={term('none')}
        onChange={(_one, values) => patch({
          dietaryPreferences: (values.length ? values.filter(diet => diet !== 'none') : ['none']) as Diet[] })} />
      <Dropdown multiple label={t('person.allergyLabel')} options={words(allergens)}
        value={person.allergens} placeholder={t('person.noneChosen')}
        onChange={(_one, values) => patch({ allergens: values as Allergen[] })} />
      <Text style={ui.small}>{t('person.allergiesNote')}</Text>
      <Text style={ui.small}>{t('person.allergyDisclaimer')}</Text>
    </SectionCard>
  </View>;
}
