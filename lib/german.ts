/** German display labels; persisted identifiers and API values stay unchanged. */
const displayLabels: Record<string, string> = {
  curated: 'Geprüfte', alias: 'Namensbasierte', 'category-keyword': 'Kategoriebasierte',
  package_size_conflicting: 'Widersprüchliche Packungsgröße', package_size_unknown: 'Unbekannte Packungsgröße', piece_mass_unknown: 'Unbekanntes Stückgewicht', possible_serving_not_package: 'Möglicherweise Portions- statt Packungsangabe', drained_weight_unknown: 'Unbekanntes Abtropfgewicht', unit_conversion_unknown: 'Unbekannte Einheitenumrechnung', product_already_allocated: 'Produkt bereits zugeordnet',
  female: 'Weiblich', male: 'Männlich', other: 'Divers', prefer_not_to_say: 'Keine Angabe',
  sedentary: 'Überwiegend sitzend', lightly_active: 'Leicht aktiv', moderately_active: 'Mäßig aktiv', very_active: 'Sehr aktiv', extra_active: 'Besonders aktiv',
  light: 'Leicht aktiv', very_high: 'Sehr aktiv', low: 'Gering', moderate: 'Mittel', high: 'Hoch', automatic: 'Automatisch', manual: 'Selbst festgelegt',
  maintain: 'Gewicht halten', lose_weight: 'Abnehmen', build_muscle: 'Muskeln aufbauen', high_protein: 'Eiweißreich', balanced: 'Ausgewogene Ernährung', improve_habits: 'Essgewohnheiten verbessern', lactose: 'Laktose', gluten: 'Gluten',
  vegetarian: 'Vegetarisch', vegan: 'Vegan', pescatarian: 'Pescetarisch', lactose_free: 'Laktosefrei', gluten_free: 'Glutenfrei', diabetes: 'Diabetesbewusst',
  breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen', snack: 'Snack',
  milk: 'Milch', eggs: 'Eier', fish: 'Fisch', shellfish: 'Krebstiere und Weichtiere', peanuts: 'Erdnüsse', tree_nuts: 'Schalenfrüchte', soy: 'Soja', wheat: 'Weizen', sesame: 'Sesam', mustard: 'Senf', celery: 'Sellerie',
};
export const germanLabel = (value: string) => displayLabels[value] ?? value;
export const formatNumber = (value: number, digits = 0) => value.toLocaleString('de-DE', { maximumFractionDigits: digits });
export const formatDecimal = (value: number, digits = 2) => value.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const formatEuro = (value: number) => value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** Supabase error codes stay stable; its English messages are not shown verbatim. */
export function germanAuthError(error: { code?: string; message?: string }): Error {
  const messages: Record<string, string> = {
    invalid_credentials: 'E-Mail-Adresse oder Passwort ist falsch.',
    email_not_confirmed: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
    user_already_exists: 'Für diese E-Mail-Adresse besteht bereits ein Konto. Melde dich an.',
    email_exists: 'Diese E-Mail-Adresse wird bereits verwendet.',
    weak_password: 'Wähle ein stärkeres Passwort mit mindestens acht Zeichen.',
    same_password: 'Wähle ein anderes Passwort als dein bisheriges.',
    otp_expired: 'Der Bestätigungscode ist ungültig oder abgelaufen. Fordere einen neuen an.',
    over_email_send_rate_limit: 'Zu viele E-Mail-Anfragen. Bitte warte kurz und versuche es erneut.',
    over_request_rate_limit: 'Zu viele Anfragen. Bitte warte kurz und versuche es erneut.',
    session_not_found: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
  };
  const network = /network|failed to fetch|fetch failed/i.test(error.message ?? '');
  return new Error(messages[error.code ?? ''] ?? (network ? 'Netzwerkfehler. Prüfe deine Internetverbindung und versuche es erneut.' : 'Die Kontoanfrage ist fehlgeschlagen. Bitte versuche es erneut.'));
}
