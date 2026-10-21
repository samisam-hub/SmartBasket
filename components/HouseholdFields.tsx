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
import { HouseholdList, kindLabels, maxHousehold } from "./HouseholdList";
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

const activityLabels: Record<keyof typeof onboardingActivities, string> = {
  sedentary: "Mostly sitting",
  normal: "Normal",
  active: "Active",
};
const sexLabels: Record<(typeof sexes)[number], string> = {
  female: "Female",
  male: "Male",
  other: "Other",
  prefer_not_to_say: "Rather not say",
};
const activityChoice = (person: PlanParticipant) =>
  (Object.keys(activityLabels) as (keyof typeof onboardingActivities)[]).find(
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
    onChange([...people, newParticipant("adult", id, `Person ${people.length + 1}`, goal)]);
    setOpenId(id);
  };
  return (
    <View style={ui.stack}>
      {title && (
        <View style={ui.row}>
          {onBack && (
            <IconButton icon="chevron-left" label="Back" onPress={onBack} />
          )}
          <Text accessibilityRole="header" style={[ui.title, { flex: 1 }]}>
            {title}
          </Text>
          <IconButton
            icon="plus"
            label="Add person"
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
      <Text style={ui.small}>
        The daily amount is a suggestion from age, sex and activity, not a
        nutrition prescription. Tap a person to refine or correct it.
      </Text>
      {open && (
        <SectionCard title={open.name || "This person"}>
          <TextInput
            label="Name"
            value={open.name}
            onChangeText={(name) => patch(open.id, { name })}
          />
          <Text style={ui.subheading}>Adult or child</Text>
          <View style={ui.wrap}>
            {participantKinds.map((kind) => (
              <SelectionChip
                key={kind}
                label={kindLabels[kind]}
                selected={participantKind(open) === kind}
                onPress={() => patch(open.id, { kind })}
              />
            ))}
          </View>
          <Text style={ui.subheading}>Optional details</Text>
          <OptionalNumber
            label="Age"
            value={open.age}
            hint="Leave blank to use a typical age for the suggestion."
            onChange={(age) => patch(open.id, { age })}
          />
          <View style={ui.wrap}>
            {sexes.map((sex) => (
              <SelectionChip
                key={sex}
                label={sexLabels[sex]}
                selected={open.sex === sex}
                onPress={() =>
                  patch(open.id, { sex: open.sex === sex ? null : sex })
                }
              />
            ))}
          </View>
          <View style={ui.wrap}>
            {(
              Object.keys(activityLabels) as (keyof typeof onboardingActivities)[]
            ).map((choice) => (
              <SelectionChip
                key={choice}
                label={activityLabels[choice]}
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
            label="Daily amount for this person (kcal)"
            hint={
              open.dailyCalories === estimateCalories(open)
                ? "Our suggestion. Change it and we keep your number."
                : "Your own number. Clear it to get the suggestion back."
            }
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
              label="Remove this person"
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
