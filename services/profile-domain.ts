import { activities,participantKinds,sexes,type ParticipantKind,type PersonalProfile,type PlanParticipant } from '../types/profile';
import { allergens,diets,goals,defaultDraft,type Goal,type UserPreferences,type Diet } from '../types/preferences';
import { validatePreferences } from './preference-domain';
import { proteinPercent } from './basket/nutritionTargets';
const range=(v:number|null,min:number,max:number,integer=false)=>v===null||(Number.isFinite(v)&&v>=min&&v<=max&&(!integer||Number.isInteger(v)));
export function validateProfile(p:PersonalProfile):Record<string,string>{
 const e:Record<string,string>={};
 if(typeof p.displayName!=='string'||p.displayName.trim().length>80)e.displayName='Use at most 80 characters.';
 if(p.sex!==null&&!sexes.includes(p.sex))e.sex='Choose a listed option or skip.';
 if(!range(p.age,1,120,true))e.age='Enter a whole age from 1 to 120, or leave blank.';
 if(!range(p.heightCm,50,250))e.heightCm='Enter 50–250 cm, or leave blank.';
 if(!range(p.weightKg,10,500))e.weightKg='Enter 10–500 kg, or leave blank.';
 if(![...goals,'improve_habits'].includes(p.primaryNutritionGoal))e.primaryNutritionGoal='Choose a goal.';
 if(p.activityLevel!==null&&!activities.includes(p.activityLevel))e.activityLevel='Choose an activity level or skip.';
 if(!range(p.defaultDailyCalories,1000,5000,true))e.defaultDailyCalories='Enter 1,000–5,000 kcal, or leave blank.';
 if(!['automatic','manual'].includes(p.proteinMode)||p.proteinMode==='manual'&&(p.defaultProteinTargetGrams===null||!range(p.defaultProteinTargetGrams,1,500,true)))e.defaultProteinTargetGrams='Enter 1–500 g for a manual target.';
 const v=validatePreferences({...defaultDraft,dailyCalories:2000,dietaryPreferences:p.dietaryPreferences,allergens:p.allergens});
 if(v.dietaryPreferences)e.dietaryPreferences=v.dietaryPreferences;if(v.allergens)e.allergens=v.allergens;
 if(!Array.isArray(p.intolerances)||p.intolerances.some(x=>!['lactose','gluten'].includes(x))||new Set(p.intolerances).size!==p.intolerances.length)e.intolerances='Choose listed intolerances.';
 return e;
}
/** Harris-Benedict-style activity factors for the Mifflin-St Jeor result; "normal" is the default choice. */
export const activityFactors:Record<typeof activities[number],number>={low:1.2,light:1.375,moderate:1.55,high:1.725,very_high:1.9};
// Development reference bodies, used only when height and weight are unknown. They are population
// starting points, not measurements of this person, and the result is shown as an editable suggestion.
const referenceAdult={female:{heightCm:165,weightKg:65},male:{heightCm:178,weightKg:78},other:{heightCm:172,weightKg:72}};
const referenceChild=[{maxAge:3,heightCm:95,weightKg:14},{maxAge:6,heightCm:115,weightKg:21},
 {maxAge:9,heightCm:133,weightKg:29},{maxAge:12,heightCm:148,weightKg:40},{maxAge:120,heightCm:165,weightKg:55}];
const referenceAge={adult:40,child:8};
export const participantKind=(p:Pick<PlanParticipant,'kind'>):ParticipantKind=>p.kind??'adult';
/** Mifflin-St Jeor basal rate times an activity factor, rounded to 50 kcal and clamped to the stored 1,000-5,000 range.
 *  A suggestion for shopping amounts, never a personalized nutrition prescription. */
export function estimateCalories(p:{kind?:ParticipantKind;age?:number|null;sex?:PersonalProfile['sex'];activityLevel?:typeof activities[number]|null;heightCm?:number|null;weightKg?:number|null}):number {
 const kind=participantKind(p),age=p.age??referenceAge[kind];
 const body=kind==='child'?referenceChild.find(b=>age<=b.maxAge)!:referenceAdult[p.sex==='female'?'female':p.sex==='male'?'male':'other'];
 const heightCm=p.heightCm??body.heightCm,weightKg=p.weightKg??body.weightKg;
 // Mifflin-St Jeor offsets: +5 male, -161 female; an unstated sex uses the midpoint of the two.
 const offset=p.sex==='male'?5:p.sex==='female'?-161:-78;
 const basal=10*weightKg+6.25*heightCm-5*age+offset;
 const estimate=basal*activityFactors[p.activityLevel??'moderate'];
 return Math.min(5000,Math.max(1000,Math.round(estimate/50)*50));
}
export const estimateProtein=(calories:number,goal:Goal):number=>Math.max(1,Math.round(calories*proteinPercent[goal]/4));
/** Targets follow from the taps the person made; both stay editable afterwards. */
export function estimatedTargets(p:PlanParticipant,goal:Goal):{dailyCalories:number;proteinTarget:number} {
 const dailyCalories=estimateCalories(p);
 return {dailyCalories,proteinTarget:estimateProtein(dailyCalories,goal)};
}
/** Detail taps move the suggestion along; a target the person corrected by hand stays as it is. */
export function patchParticipant(person:PlanParticipant,patch:Partial<PlanParticipant>,goal:Goal):PlanParticipant {
 const next={...person,...patch};
 const followsSuggestion=patch.dailyCalories===undefined&&person.dailyCalories===estimateCalories(person);
 const dailyCalories=followsSuggestion?estimateCalories(next):next.dailyCalories;
 return {...next,dailyCalories,proteinTarget:dailyCalories===null?null:estimateProtein(dailyCalories,goal)};
}
export function newParticipant(kind:ParticipantKind,id:string,name:string,goal:Goal):PlanParticipant {
 const base:PlanParticipant={id,name,kind,age:null,sex:null,activityLevel:null,dailyCalories:null,proteinTarget:null,
  dietaryPreferences:['none'],allergens:[],intolerances:[],isCurrentUser:false};
 return {...base,...estimatedTargets(base,goal)};
}
export function profileParticipant(p:PersonalProfile,fallback:UserPreferences):PlanParticipant {
 const calories=p.defaultDailyCalories??fallback.dailyCalories,goal=p.primaryNutritionGoal==='improve_habits'?'balanced':p.primaryNutritionGoal;
 return {id:'current-user',name:p.displayName.trim()||'You',sex:p.sex,age:p.age,dailyCalories:calories,
 proteinTarget:p.proteinMode==='manual'?p.defaultProteinTargetGrams:Math.round(calories*proteinPercent[goal]/4),
 dietaryPreferences:[...p.dietaryPreferences],allergens:[...p.allergens],intolerances:[...p.intolerances],isCurrentUser:true,
 kind:'adult',activityLevel:p.activityLevel};
}
export function isParticipant(p:PlanParticipant):boolean {
 return !!p&&typeof p.id==='string'&&p.id.length>0&&p.id.length<=100&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=80&&
 range(p.age,1,120,true)&&(p.sex===null||sexes.includes(p.sex))&&p.dailyCalories!==null&&range(p.dailyCalories,1000,5000,true)&&
 p.proteinTarget!==null&&range(p.proteinTarget,1,500,true)&&Array.isArray(p.dietaryPreferences)&&p.dietaryPreferences.length>0&&p.dietaryPreferences.every(x=>diets.includes(x))&&
 Array.isArray(p.allergens)&&p.allergens.every(x=>allergens.includes(x))&&Array.isArray(p.intolerances)&&p.intolerances.every(x=>['lactose','gluten'].includes(x))&&typeof p.isCurrentUser==='boolean'&&
 (p.kind===undefined||participantKinds.includes(p.kind))&&(p.activityLevel===undefined||p.activityLevel===null||activities.includes(p.activityLevel));
}
/** One shared menu must meet everybody's restrictions; each person's defaults remain distinct. */
export function participantPreferences(base:UserPreferences,participants:PlanParticipant[]):UserPreferences {
 if(!participants.length||participants.length>10||!participants.every(isParticipant)||new Set(participants.map(p=>p.id)).size!==participants.length||participants.filter(p=>p.isCurrentUser).length>1)throw Error('Each person needs a name, 1,000–5,000 kcal and 1–500 g protein. Check optional age and sex.');
 const all=new Set(participants.flatMap(p=>p.dietaryPreferences)),merged:Diet[]=[];
 const strict=(['vegan','vegetarian','pescatarian'] as Diet[]).find(d=>all.has(d));if(strict)merged.push(strict);
 if(all.has('lactose_free')||participants.some(p=>p.intolerances.includes('lactose')))merged.push('lactose_free');
 if(all.has('gluten_free')||participants.some(p=>p.intolerances.includes('gluten')))merged.push('gluten_free');
 const allergySet=new Set(participants.flatMap(p=>p.allergens));
 // Gluten intolerance is a strict avoidance requirement, not an inferred diagnosis.
 if(participants.some(p=>p.intolerances.includes('gluten')))allergySet.add('wheat');
 return {...base,householdSize:participants.length,dailyCalories:Math.round(participants.reduce((s,p)=>s+p.dailyCalories!,0)/participants.length),
 proteinMode:'manual',proteinTargetGrams:Math.round(participants.reduce((s,p)=>s+p.proteinTarget!,0)/participants.length),
 dietaryPreferences:merged.length?merged:['none'],allergens:[...allergySet],participants:structuredClone(participants)};
}
