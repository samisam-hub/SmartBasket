// Run after fetch-ingredient-catalog. Only coverage-driven, normalized real records are selected.
require('./register-typescript.cjs');
const fs=require('node:fs');
const {ingredients}=require('../data/meals.ts');
const {diagnoseMatches}=require('../services/meals/matching.ts');
const {normalizeOpenFoodFacts}=require('../services/catalog/normalize.ts');
const {catalogImportSql}=require('../services/catalog/product-row.ts');
const {defaultDraft}=require('../types/preferences.ts');
const original=JSON.parse(fs.readFileSync('.expo/phase3c/catalog-before.json'));
const barcodes=new Set(original.map(p=>p.barcode)), pool=new Map();
for(const file of fs.readdirSync('.expo/phase3c/raw'))for(const raw of JSON.parse(fs.readFileSync('.expo/phase3c/raw/'+file)).products){
 const p=normalizeOpenFoodFacts(raw);if(p&&!barcodes.has(p.barcode))pool.set(p.barcode,{...p,id:p.barcode,createdAt:'',updatedAt:''});
}
const preferences={...defaultDraft,dailyCalories:1500,id:null,userId:null,onboardingCompleted:true,createdAt:'',updatedAt:''};
const selected=new Map(),coverage=[];
for(const key of Object.keys(ingredients)){
 const d=diagnoseMatches(key,[...original,...pool.values()],preferences),eligible=d.candidates.filter(c=>c.optimizationProduct);
 for(const c of (eligible.length?eligible.slice(0,3):d.candidates.slice(0,1)))if(!barcodes.has(c.product.barcode))selected.set(c.product.barcode,c.product);
 coverage.push({ingredientKey:key,candidates:d.candidates.length,eligible:eligible.length,selected:eligible.slice(0,3).map(c=>c.product.barcode)});
}
const products=[...selected.values()];fs.writeFileSync('.expo/phase3c/import-products.json',JSON.stringify(products,null,2));
const files=[];for(let i=0;i<products.length;i+=5){const file=`.expo/phase3c/import-${i/5+1}.sql`;fs.writeFileSync(file,catalogImportSql(products.slice(i,i+5)));files.push(file);}
fs.writeFileSync('.expo/phase3c/import-manifest.json',JSON.stringify({selected:products.length,files,coverage},null,2));
console.log(JSON.stringify({selected:products.length,files,coverage}));
