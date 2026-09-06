// Generate an image-only update for audited IDs; never changes nutrition or catalog membership.
require('./register-typescript.cjs');
const fs = require('node:fs');
const { normalizeOffImages } = require('../services/catalog/off-images.ts');
const { productColumns } = require('../services/catalog/product-row.ts');
const out = '.expo/catalog-images';
const before = JSON.parse(fs.readFileSync(`${out}/before.json`, 'utf8'));
const raw = JSON.parse(fs.readFileSync(`${out}/metadata.json`, 'utf8'));
const byCode = new Map(raw.map(p => [p.code.length === 14 && p.code.startsWith('0') ? p.code.slice(1) : p.code.padStart(13, '0'), p]));
const products = before.map(p => {
  const data = byCode.get(p.barcode);
  if (!data) throw Error(`Missing metadata for ${p.barcode}`);
  return { id: p.id, ...normalizeOffImages(data, data.code) };
});
const fields = Object.keys(products[0]).filter(k => k !== 'id');
const rows = products.map(p => ({ id: p.id, ...Object.fromEntries(fields.map(k => [productColumns[k], p[k]])) }));
const files = [];
for (let i = 0; i < rows.length; i += 100) {
  const json = JSON.stringify(rows.slice(i, i + 100)).replace(/'/g, "''");
  const file = `${out}/update-${i / 100 + 1}.sql`;
  fs.writeFileSync(file, `with refreshed as (update public.products p set ${fields.map(k => `${productColumns[k]} = r.${productColumns[k]}`).join(', ')} from jsonb_populate_recordset(null::public.products, '${json}'::jsonb) r where p.id = r.id and p.source = 'open-food-facts' returning p.id) select count(*) as updated from refreshed;`);
  files.push(file);
}
fs.writeFileSync(`${out}/after.json`, JSON.stringify(products));
const dimensions = products.filter(p => p.imageQuality === 'usable').map(p => Math.max(p.imageWidth, p.imageHeight)).sort((a, b) => a - b);
const report = { total: products.length, quality: products.reduce((a, p) => ({ ...a, [p.imageQuality]: (a[p.imageQuality] || 0) + 1 }), {}),
  displayLongEdge: { min: dimensions[0], median: dimensions[Math.floor(dimensions.length / 2)], p90: dimensions[Math.floor(dimensions.length * .9)], max: dimensions.at(-1) }, files };
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
