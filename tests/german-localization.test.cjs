require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {germanLabel,formatNumber,formatDecimal,formatEuro,germanAuthError}=require('../lib/german.ts');
const {germanSavedName}=require('../lib/legacy-display.ts');
const {labels,goals,diets,allergens}=require('../types/preferences.ts');
const {categoryLabels,categories}=require('../types/product.ts');
const {planDateLabel}=require('../services/meals/weekPlan.ts');
const {basketDisplayName}=require('../services/basket/naming.ts');
test('German display labels preserve stored diet, category and meal identifiers',()=>{
 assert.ok(goals.includes('build_muscle'));assert.ok(diets.includes('lactose_free'));assert.ok(allergens.includes('milk'));assert.ok(categories.includes('vegetables'));
 assert.equal(labels.build_muscle,'Muskeln aufbauen');assert.equal(labels.milk,'Milch');assert.equal(categoryLabels.other,'Sonstiges');
 assert.equal(germanLabel('dinner'),'Abendessen');assert.equal(germanLabel('very_high'),'Sehr aktiv');assert.equal(germanLabel('prefer_not_to_say'),'Keine Angabe');
});
test('dates, decimals and euro amounts use German conventions',()=>{
 assert.equal(planDateLabel('2026-10-05'),'Mo., 5. Okt.');assert.equal(formatNumber(1234.5,1),'1.234,5');
 assert.equal(formatDecimal(12.5),'12,50');assert.equal(formatEuro(12.5),'12,50\u00a0€');
});
test('older saved names display in German without rewriting snapshots or custom names',()=>{
 const snapshot={name:'3-day basket',preferences:{planningDays:3},result:{mealPlan:{version:'1',planningDays:5}}};
 const before=JSON.stringify(snapshot);assert.equal(basketDisplayName(snapshot),'Warenkorb für 5 Tage');assert.equal(JSON.stringify(snapshot),before);
 assert.equal(basketDisplayName({...snapshot,name:'Anna & Paul'}),'Anna & Paul');
 assert.equal(germanSavedName('Oatmeal with berries'),'Haferbrei mit Beeren');assert.equal(germanSavedName('Omas Lieblingsgericht'),'Omas Lieblingsgericht');
});
test('account error codes produce actionable German messages without exposing provider text',()=>{
 assert.equal(germanAuthError({code:'invalid_credentials',message:'Invalid login credentials'}).message,'E-Mail-Adresse oder Passwort ist falsch.');
 assert.match(germanAuthError({message:'Failed to fetch'}).message,/Netzwerkfehler/);
 assert.equal(germanAuthError({code:'unknown',message:'internal provider details'}).message,'Die Kontoanfrage ist fehlgeschlagen. Bitte versuche es erneut.');
});
