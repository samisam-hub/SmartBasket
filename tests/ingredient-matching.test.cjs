require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {product,prefs}=require('./basket-fixtures.cjs');
const {normalizePackage}=require('../services/catalog/package-size.ts');
const {diagnoseMatches,matchProducts}=require('../services/meals/matching.ts');
const {canonicalIngredientKey}=require('../data/ingredient-mappings.ts');
const {ingredients,meals}=require('../data/meals.ts');
const {skuSafety}=require('../services/meals/skuSafety.ts');
const rice=(patch={})=>product(1,{name:'Basmati Reis',quantityLabel:'500 g',...patch});
test('package normalization preserves units, multipacks/counts and refuses conflicting/serving guesses',()=>{
 for(const [q,size,unit] of [['500 g',500,'g'],['1 kg',1000,'g'],['1 L',1000,'ml'],['75 cl',750,'ml'],['250 ml',250,'ml'],['6 eggs',6,'piece'],['10.0 pcs',10,'piece'],['2 x 400 g',800,'g'],['4*125g',500,'g']]){
  const p=normalizePackage({quantity:q});assert.equal(p.packageSize,size,q);assert.equal(p.packageUnit,unit,q);
 }
 assert.equal(normalizePackage({quantity:'unknown',name:'Product 750 ml'}).packageSize,750);
 assert.equal(normalizePackage({quantity:'6 eggs',servingText:'1 egg (55 g)'}).packageMassPerUnit,55);
 assert.equal(normalizePackage({quantity:'6 eggs',servingText:'55 g'}).packageMassPerUnit,null);
 assert.equal(normalizePackage({quantity:'400 g, drained weight 240 g'}).packageDrainedWeight,240);
 assert.equal(normalizePackage({quantity:'500 g',size:600,unit:'g'}).packageSizeStatus,'conflicting');
 assert.equal(normalizePackage({quantity:'1 serving 50 g'}).packageSizeStatus,'unknown');
 assert.equal(normalizePackage({quantity:'variable'}).packageSize,null);
});
test('canonical concepts preserve old snapshots, aliases and staged category-keyword matches',()=>{
 assert.equal(canonicalIngredientKey('chicken'),'chicken_breast');assert.equal(ingredients.chicken,ingredients.chicken_breast);
 assert.ok(meals.every(m=>m.ingredients.every(l=>!['chicken','bread','oil','tomatoes'].includes(l.ingredientKey))));
 assert.equal(diagnoseMatches('rice',[rice()],prefs()).candidates[0].stage,'alias');
 const tomato=product(2,{name:'Tomaten gehackt',category:'vegetables',quantityLabel:'400 g',packageSize:400,caloriesPer100g:22,proteinPer100g:1,carbohydratesPer100g:4,fatPer100g:.2});
 assert.equal(diagnoseMatches('chopped_tomatoes',[tomato],prefs()).candidates[0].stage,'category-keyword');
 assert.equal(matchProducts('rice',[rice({category:'snacks'})],prefs()).length,0);
});
test('product identity remains visible without package eligibility; quantity labels rescue missing numeric metadata',()=>{
 const unknown=diagnoseMatches('rice',[rice({packageSize:null,quantityLabel:null})],prefs());assert.equal(unknown.candidates.length,1);assert.equal(unknown.candidates[0].packageIssue,'package_size_unknown');
 assert.equal(unknown.candidates[0].optimizationProduct,null);
 assert.equal(matchProducts('rice',[rice({packageSize:null,packageUnit:null,quantityLabel:'1 kg'})],prefs())[0].packageSize,1000);
 assert.equal(diagnoseMatches('olive_oil',[product(2,{name:'Olive oil',category:'other',packageSize:750,packageUnit:'ml',quantityLabel:'750 ml',caloriesPer100g:884,proteinPer100g:0,carbohydratesPer100g:0,fatPer100g:100})],prefs()).candidates[0].packageIssue,'unit_conversion_unknown');
});
test('unknown lifestyle is confidence, known conflicts and allergen uncertainty remain exclusions',()=>{
 const p=prefs({dietaryPreferences:['lactose_free']}),r=rice({lactoseFree:null});
 assert.equal(matchProducts('rice',[r],p).length,1);assert.deepEqual(diagnoseMatches('rice',[r],p).candidates[0].dietaryUnknown,['lactoseFree']);
 assert.equal(matchProducts('rice',[{...r,lactoseFree:false}],p).length,0);
 for(const patch of [{allergens:['milk']},{mayContainAllergens:['milk']},{allergenInfoAvailable:false},{ingredientsText:null},{labels:[]}])assert.ok(skuSafety({...r,...patch},prefs({allergens:['milk']})).rejection);
 assert.equal(skuSafety({...r,ingredientsText:'Rice',labels:['milk free']},prefs({allergens:['milk']})).rejection,null);
 assert.equal(skuSafety({...r,ingredientsText:'Rice, milk',labels:['milk free']},prefs({allergens:['milk']})).rejection,'allergen_conflict');
});
test('prepared, mixed and manually named products cannot bypass ingredient or safety rules',()=>{
 const salmon=product(99,{name:'Citrus Herb Salmon',category:'fish',caloriesPer100g:208,proteinPer100g:20,carbohydratesPer100g:0,fatPer100g:13,quantityLabel:'500 g'});
 assert.equal(matchProducts('salmon',[salmon],prefs()).length,0);
 assert.equal(matchProducts('salmon',[{...salmon,name:'Salmon fillets'}],prefs()).length,1);
 for(const name of ['Rice pudding','Reis Waffeln','Rice & quinoa','rice cakes'])assert.equal(matchProducts('rice',[rice({name})],prefs()).length,0);
 const cheese=product(3,{name:'Tofu rella',category:'legumes',caloriesPer100g:150,proteinPer100g:16,carbohydratesPer100g:3,fatPer100g:9,quantityLabel:'500g'});
 assert.equal(matchProducts('tofu',[cheese],prefs()).length,0);
 assert.equal(matchProducts('rice',[rice(),rice({vegan:false})],prefs()).length,0);
 const noMacros=rice({proteinPer100g:null});assert.equal(diagnoseMatches('rice',[noMacros],prefs()).candidates.length,1);
});
