// Explicit bounded administrative import. No database writes or automatic app requests.
require('./register-typescript.cjs');
const fs = require('node:fs'), path = require('node:path');
const { normalizeOpenFoodFacts } = require('../services/catalog/normalize.ts');
const { catalogImportSql } = require('../services/catalog/product-row.ts');
const { withMissingPriceEstimate } = require('../services/pricing/priceEstimator.ts');
const manifest = require('../data/ready-meal-import.json');
const out = path.resolve('.expo/ready-meals');
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const products = [];
  for (const entry of manifest) {
    const file = path.join(out, `${entry.barcode}.json`);
    if (process.argv.includes('--fetch')) {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${entry.barcode}.json`, {
        headers: { 'User-Agent': 'SmartBasket/0.1 (https://github.com/samisam-hub/SmartBasket)' }, signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw Error(`OFF ${entry.barcode}: HTTP ${response.status}`);
      fs.writeFileSync(file, JSON.stringify(await response.json()));
    }
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')).product;
    const p = normalizeOpenFoodFacts(raw);
    if (!p || p.barcode !== entry.barcode || !p.ingredientsText || p.packageUnit !== 'g' || !p.packageSize || p.packageSizeStatus !== 'known' ||
      [p.caloriesPer100g, p.proteinPer100g, p.carbohydratesPer100g, p.fatPer100g].some(n => n === null)) throw Error(`Incomplete product ${entry.barcode}; review before importing.`);
    // Curated food category overrides ingredient-like OFF taxonomy, without altering source nutrition.
    p.category = 'other';
    if (entry.verifiedVegan) {
      if (p.allergens.some(a => ['milk','eggs','fish','shellfish'].includes(a))) throw Error(`Conflicting vegan evidence ${entry.barcode}`);
      p.vegan = true; p.vegetarian = true;
      p.labels.push('smartbasket:vegan:manufacturer-verified');
    }
    p.mayContainAllergens = [...new Set([...p.mayContainAllergens, ...(entry.additionalTraces || [])])].sort();
    // Existing SmartBasket lactose-intolerance convention; never a certified milk-allergy claim.
    if (p.vegan === true && !p.allergens.includes('milk')) {
      p.lactoseFree = true;
      p.labels.push('smartbasket:inferred-lactose-free:vegan-recipe');
    }
    p.readyMeal = { category: entry.category, modes: entry.modes, slots: ['lunch','dinner'], portionGrams: entry.portionGrams,
      available: true, evidence: `Reviewed 2026-09-24. Preparation: ${entry.evidence}. ${entry.preparation} Portion: ${entry.portionBasis} Nutrition/product data: ${p.sourceUrl}. Availability means included in SmartBasket catalog, not retailer stock.` };
    products.push(withMissingPriceEstimate(p));
  }
  if (new Set(products.map(p => p.barcode)).size !== manifest.length) throw Error('Duplicate barcode');
  fs.writeFileSync(path.join(out,'normalized.json'),JSON.stringify(products,null,2));
  fs.writeFileSync(path.join(out,'import.sql'),catalogImportSql(products));
  console.log(JSON.stringify(products.map(p=>({barcode:p.barcode,name:p.name,category:p.readyMeal.category,image:p.imageQuality,price:p.priceEstimate,lactoseFree:p.lactoseFree}))));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
