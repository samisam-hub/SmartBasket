import { router } from "expo-router";
import { usePreferences } from "@/context/PreferencesContext";
import type { OnboardingStep } from "@/types/preferences";
import {useProfile} from '@/context/ProfileContext';
import {profileParticipant,participantPreferences} from '@/services/profile-domain';
import {defaultDraft} from '@/types/preferences';
export function useBasketFlow() {
  const { store, saved, ready, saving } = usePreferences();
  const personal=useProfile();
  const edit = (step?: OnboardingStep) => {
    if (!ready || saving) return;
    if(!saved&&!store.getSnapshot().editing&&personal.saved){
      const base={...defaultDraft,dailyCalories:defaultDraft.dailyCalories!,id:null,userId:null,onboardingCompleted:true,createdAt:'',updatedAt:''};
      const defaults=participantPreferences(base,[profileParticipant(personal.saved,base)]);
      store.update({dailyCalories:defaults.dailyCalories,primaryGoal:personal.saved.primaryNutritionGoal==='improve_habits'?'balanced':personal.saved.primaryNutritionGoal,proteinMode:personal.saved.proteinMode,proteinTargetGrams:personal.saved.defaultProteinTargetGrams,dietaryPreferences:defaults.dietaryPreferences,allergens:defaults.allergens});
    }
    router.push({
      pathname: "/onboarding/[step]",
      params: {
        step: store.begin(step),
        intent: saved?.onboardingCompleted ? "edit" : "onboarding",
      },
    });
  };
  return {
    edit,
    disabled: !ready || saving,
    create: () => {
      if (!ready || saving) return;
      if (saved?.onboardingCompleted) router.push("/plan-setup");
      else edit();
    },
  };
}
