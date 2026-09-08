require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { productDietaryNotes, generalBasketNotes } = require('../lib/basket-notes.ts');
test('saved ingredient warnings move to products; allergy, unmatched and unattachable notes remain visible', () => {
 const fish={ingredientKey:'salmon',product:{id:'fish'}};
 const warnings=[{code:'diet_uncertain_salmon',message:'Unknown lactose-free'}, {code:'allergen_conflict',message:'Milk'}, {code:'unmatched_tofu',message:'No tofu'}, {code:'diet_uncertain_missing',message:'Unknown'}];
 assert.deepEqual(productDietaryNotes(warnings,fish),[warnings[0]]);
 assert.deepEqual(generalBasketNotes({items:[fish],warnings}),warnings.slice(1));
 assert.deepEqual(generalBasketNotes({items:[],warnings}),warnings);
 const scoped={code:'diet_uncertain_salmon',productIds:['other'],message:'Other SKU'};
 assert.deepEqual(productDietaryNotes([scoped],fish),[]);
 assert.deepEqual(productDietaryNotes([scoped],{product:{id:'other'}}),[scoped]);
});
