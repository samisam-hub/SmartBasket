import { t, term , kindLabel } from '../services/i18n';
import { useState } from "react";
import { Text, View } from "react-native";
import { NumberInput } from "./NumberInput";
import { OptionalNumber } from "./ProfileFields";
import {
  IconButton,
  SecondaryButton,
  SectionCard,
  SelectionChip,
  TextInput,
} from "./ui";
import { HouseholdList, maxHousehold } from "./HouseholdList";
import {
  estimateCalories,
  newParticipant,
  participantKind,
  patchParticipant,
} from "../services/profile-domain";
import {
  onboardingActivities,
  participantKinds,
  sexes,
  type PlanParticipant,
} from "../types/profile";
import type { Goal } from "../types/preferences";
import { ui } from "../lib/theme";

const activityChoices = Object.keys(onboardingActivities) as (keyof typeof onboardingActivities)[];
const activityChoice = (person: PlanParticipant) =>
  activityChoices.find(
    (choice) => onboardingActivities[choice] === person.activityLevel,
  );

/** One tap per person is enough: adult or child. Everything else refines the suggestion. */
export function HouseholdFields({
  people,
  goal,
  onChange,
  title,
  onBack,
}: {
  people: PlanParticipant[];
  goal: Goal;
  onChange: (people: PlanParticipant[]) => void;
  /** Given on a screen of its own, where this is the heading and adding belongs next to it.
   *  Left out inside onboarding, which brings its own header. */
  title?: string;
  onBack?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = people.find((person) => person.id === openId) ?? null;
  const patch = (id: string, values: Partial<PlanParticipant>) =>
    onChange(
      people.map((person) =>
        person.id === id ? patchParticipant(person, values, goal) : person,
      ),
    );
  // One way in, as on the household screen. Adult or child is the first choice in the editor that
  // opens, so a child is one tap further rather than a second button to read.
  const add = () => {
    const id = `person-${Date.now()}`;
    onChange([...people, newParticipant("adult", id, t('fields.numbered', { number: people.length + 1 }), goal)]);
    setOpenId(id);
  };
  return (
    <View style={ui.stack}>
      {title && (
        <View style={ui.row}>
          {onBack && (
            <IconButton icon="chevron-left" label={t('fields.back')} onPress={onBack} />
          )}
          <Text accessibilityRole="header" style={[ui.title, { flex: 1 }]}>
            {title}
          </Text>
          <IconButton
            icon="plus"
            label={t('household.add')}
            disabled={people.length >= maxHousehold}
            onPress={add}
          />
        </View>
      )}
      <HouseholdList
        people={people}
        onOpen={(id) => setOpenId(id === openId ? null : id)}
        onAdd={add}
      />
      <Text style={ui.small}>{t('fields.hint')}</Text>
      {open && (
        <SectionCard title={open.name || t('fields.thisPerson')}>
          <TextInput
            label={t('person.name')}
            value={open.name}
            onChangeText={(name) => patch(open.id, { name })}
          />
          <Text style={ui.subheading}>{t('fields.kind')}</Text>
          <View style={ui.wrap}>
            {participantKinds.map((kind) => (
              <SelectionChip
                key={kind}
                label={kindLabel(kind)}
                selected={participantKind(open) === kind}
                onPress={() => patch(open.id, { kind })}
              />
            ))}
          </View>
          <Text style={ui.subheading}>{t('fields.optional')}</Text>
          <OptionalNumber
            label={t('person.age')}
            value={open.age}
            hint={t('fields.ageHint')}
            onChange={(age) => patch(open.id, { age })}
          />
          <View style={ui.wrap}>
            {sexes.map((sex) => (
              <SelectionChip
                key={sex}
                label={term(sex)}
                selected={open.sex === sex}
                onPress={() =>
                  patch(open.id, { sex: open.sex === sex ? null : sex })
                }
              />
            ))}
          </View>
          <View style={ui.wrap}>
            {activityChoices.map((choice) => (
              <SelectionChip
                key={choice}
                label={term(choice)}
                selected={activityChoice(open) === choice}
                onPress={() =>
                  patch(open.id, {
                    activityLevel:
                      activityChoice(open) === choice
                        ? null
                        : onboardingActivities[choice],
                  })
                }
              />
            ))}
          </View>
          <NumberInput
            label={t('fields.calories')}
            hint={t(open.dailyCalories === estimateCalories(open) ? 'person.ourSuggestion' : 'person.yourNumber')}
            value={open.dailyCalories}
            onChange={(dailyCalories) =>
              patch(open.id, {
                dailyCalories:
                  dailyCalories === null
                    ? estimateCalories(open)
                    : dailyCalories,
              })
            }
          />
          {!open.isCurrentUser && (
            <SecondaryButton
              label={t('fields.remove')}
              onPress={() => {
                onChange(people.filter((person) => person.id !== open.id));
                setOpenId(null);
              }}
            />
          )}
        </SectionCard>
      )}
    </View>
  );
}
