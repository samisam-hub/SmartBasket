// Shared by the mobile app and the isolated voice backend. No platform dependencies.
export const voiceDiets = ['none', 'vegetarian', 'vegan', 'pescatarian', 'lactose_free', 'gluten_free', 'diabetes'] as const;
export const voiceAllergens = ['milk', 'eggs', 'fish', 'shellfish', 'peanuts', 'tree_nuts', 'soy', 'wheat', 'sesame'] as const;
export interface VoicePerson {
  name: string;
  calories: number | null;
  protein: number | null;
  diets: (typeof voiceDiets[number])[];
  allergens: (typeof voiceAllergens[number])[];
}
export interface VoicePlan {
  days: number | null;
  budgetEnabled: boolean | null;
  budget: number | null;
  people: VoicePerson[];
  preferredMealIds: string[];
}
export interface VoiceReply {
  reply: string;
  language: 'de' | 'en';
  unresolved: string | null;
  plan: VoicePlan;
}
const nullableNumber = { type: ['number', 'null'] };
const enumArray = (values: readonly string[]) => ({ type: 'array', items: { type: 'string', enum: values } });
export const voiceSchema = {
  type: 'object', additionalProperties: false,
  required: ['reply', 'language', 'unresolved', 'plan'],
  properties: {
    reply: { type: 'string' }, language: { type: 'string', enum: ['de', 'en'] }, unresolved: { type: ['string', 'null'] },
    plan: {
      type: 'object', additionalProperties: false,
      required: ['days', 'budgetEnabled', 'budget', 'people', 'preferredMealIds'],
      properties: {
        days: nullableNumber, budgetEnabled: { type: ['boolean', 'null'] }, budget: nullableNumber,
        preferredMealIds: { type: 'array', items: { type: 'string' } },
        people: { type: 'array', items: {
          type: 'object', additionalProperties: false, required: ['name', 'calories', 'protein', 'diets', 'allergens'],
          properties: { name: { type: 'string' }, calories: nullableNumber, protein: nullableNumber, diets: enumArray(voiceDiets), allergens: enumArray(voiceAllergens) },
        } },
      },
    },
  },
};
export function isVoicePlan(value: unknown): value is VoicePlan {
  if (!value || typeof value !== 'object') return false;
  const p = value as VoicePlan;
  const number = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
  return number(p.days) && (p.budgetEnabled === null || typeof p.budgetEnabled === 'boolean') && number(p.budget)
    && Array.isArray(p.preferredMealIds) && p.preferredMealIds.length <= 32 && p.preferredMealIds.every(x => typeof x === 'string' && x.length < 100)
    && Array.isArray(p.people) && p.people.length <= 20 && p.people.every(x => x && typeof x.name === 'string' && x.name.length <= 80
      && number(x.calories) && number(x.protein) && Array.isArray(x.diets) && x.diets.length <= 6 && x.diets.every(d => voiceDiets.includes(d))
      && Array.isArray(x.allergens) && x.allergens.length <= 9 && x.allergens.every(a => voiceAllergens.includes(a)));
}
export function isVoiceReply(value: unknown): value is VoiceReply {
  if (!value || typeof value !== 'object') return false;
  const r = value as VoiceReply;
  return typeof r.reply === 'string' && r.reply.length <= 3000 && ['de', 'en'].includes(r.language)
    && (r.unresolved === null || (typeof r.unresolved === 'string' && r.unresolved.length <= 1000)) && isVoicePlan(r.plan);
}
export function clarification(p: VoicePlan, language: 'de' | 'en'): string | null {
  const de = language === 'de';
  if (![3, 5, 7, 14].includes(p.days ?? 0)) return de ? 'Für wie viele Tage? Möglich sind 3, 5, 7 oder 14 Tage.' : 'How many days? Choose 3, 5, 7 or 14 days.';
  if (p.people.length < 1 || p.people.length > 10) return de ? 'Für wie viele Personen? Möglich sind 1 bis 10.' : 'How many people? Choose between 1 and 10.';
  for (const [i, person] of p.people.entries()) {
    const name = person.name.trim() || `${de ? 'Person' : 'Person'} ${i + 1}`;
    if (!person.name.trim()) return de ? `Wie heißt Person ${i + 1}?` : `What is person ${i + 1}'s name?`;
    if (!Number.isInteger(person.calories) || person.calories! < 1000 || person.calories! > 5000) return de ? `Welches tägliche Kalorienziel hat ${name}? Möglich sind 1.000 bis 5.000 kcal.` : `What is ${name}'s daily calorie target? Choose 1,000–5,000 kcal.`;
    if (!Number.isInteger(person.protein) || person.protein! < 1 || person.protein! > 500) return de ? `Welches tägliche Proteinziel hat ${name}? Bitte 1 bis 500 Gramm angeben.` : `What is ${name}'s daily protein target? Choose 1–500 grams.`;
    if (!person.diets.length || (person.diets.includes('none') && person.diets.length > 1) || person.diets.filter(d => ['vegan', 'vegetarian', 'pescatarian'].includes(d)).length > 1) return de ? `Welche Ernährungsweise soll für ${name} gelten?` : `Which diet should apply to ${name}?`;
  }
  if (p.budgetEnabled === null) return de ? 'Möchtest du ein Gesamtbudget für diesen Einkauf festlegen?' : 'Would you like a total budget for this shop?';
  if (p.budgetEnabled && (p.budget === null || p.budget <= 0 || p.budget > 10000 || Math.abs(p.budget * 100 - Math.round(p.budget * 100)) > 0.00001)) return de ? 'Wie hoch ist das Gesamtbudget in Euro für alle Personen und Tage (maximal 10.000 €)?' : 'What is the total euro budget for all people and days (up to €10,000)?';
  return null;
}
