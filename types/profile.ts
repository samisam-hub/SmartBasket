import type { Allergen, Diet, Goal } from './preferences';
export const sexes=['female','male','prefer_not_to_say','other'] as const;
export const activities=['low','light','moderate','high','very_high'] as const;
export type PersonalGoal=Goal|'improve_habits';
export interface PersonalProfile {
 id:string|null; displayName:string; sex:typeof sexes[number]|null; age:number|null;
 heightCm:number|null; weightKg:number|null; primaryNutritionGoal:PersonalGoal;
 activityLevel:typeof activities[number]|null; defaultDailyCalories:number|null;
 proteinMode:'automatic'|'manual'; defaultProteinTargetGrams:number|null;
 dietaryPreferences:Diet[]; allergens:Allergen[]; intolerances:('lactose'|'gluten')[];
 onboardingCompleted:boolean;
}
export const emptyProfile:PersonalProfile={id:null,displayName:'',sex:null,age:null,heightCm:null,weightKg:null,
 primaryNutritionGoal:'balanced',activityLevel:null,defaultDailyCalories:null,proteinMode:'automatic',defaultProteinTargetGrams:null,
 dietaryPreferences:['none'],allergens:[],intolerances:[],onboardingCompleted:false};
export interface PlanParticipant {
 id:string;name:string;age:number|null;sex:PersonalProfile['sex'];dailyCalories:number|null;
 proteinTarget:number|null;dietaryPreferences:Diet[];allergens:Allergen[];intolerances:PersonalProfile['intolerances'];isCurrentUser:boolean;
}
