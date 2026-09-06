// Explicit, bounded administrative import. Never runs in the app or CI.
require("./register-typescript.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { createGunzip } = require("node:zlib");
const { createInterface } = require("node:readline");
const { OpenFoodFactsProvider } = require("../services/catalog/OpenFoodFactsProvider.ts");
const { catalogImportSql } = require("../services/catalog/product-row.ts");
const url = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz";
const userAgent = process.env.OFF_USER_AGENT || "SmartBasket/0.1 (https://github.com/samisam-hub/SmartBasket)";
const provider = new OpenFoodFactsProvider(userAgent);
const out = path.resolve(".expo/catalog");
const target = Math.min(1000, Math.max(500, Number(process.env.CATALOG_TARGET || 750)));
if (!Number.isInteger(target)) throw Error("Invalid CATALOG_TARGET");
const selected = new Map(), counts = {};
const report = { source: url, startedAt: new Date().toISOString(), scanned: 0, rejected: 0, duplicates: 0, target, complete: false };
function save() {
  fs.mkdirSync(out, { recursive: true });
  const products = [...selected.values()];
  fs.writeFileSync(path.join(out, "products.json"), JSON.stringify(products));
  const files = [];
  for (let i = 0; i < products.length; i += 50) {
    const file = `batch-${Math.floor(i / 50) + 1}.sql`;
    fs.writeFileSync(path.join(out, file), catalogImportSql(products.slice(i, i + 50)));
    files.push(file);
  }
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ ...report, normalized: products.length,
    categories: counts, files, finishedAt: new Date().toISOString() }, null, 2));
}
(async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600000);
  let input, unzip, lines;
  try {
    const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: controller.signal });
    if (!response.ok || !response.body) throw Error(`OFF bulk export HTTP ${response.status}`);
    input = Readable.fromWeb(response.body); unzip = input.pipe(createGunzip());
    input.on("error", error => unzip.destroy(error));
    lines = createInterface({ input: unzip, crlfDelay: Infinity });
    for await (const line of lines) {
      if (++report.scanned > 80000) break;
      let raw; try { raw = JSON.parse(line); } catch { report.rejected++; continue; }
      const p = provider.normalize(raw);
      // Prefer complete, pictured groceries and cap each category to avoid a snack-heavy sample.
      if (!p || p.category === "other" || !p.imageUrl || !p.brand ||
          [p.proteinPer100g, p.carbohydratesPer100g, p.fatPer100g].some(v => v === null)) {
        report.rejected++; continue;
      }
      if (selected.has(p.barcode)) { report.duplicates++; continue; }
      if ((counts[p.category] || 0) >= Math.ceil(target / 12)) continue;
      selected.set(p.barcode, p); counts[p.category] = (counts[p.category] || 0) + 1;
      if (selected.size % 100 === 0) { save(); console.log(JSON.stringify({ selected: selected.size, scanned: report.scanned, categories: counts })); }
      if (selected.size >= target) { report.complete = true; break; }
    }
  } finally {
    clearTimeout(timer); lines?.close(); input?.destroy(); unzip?.destroy(); controller.abort(); save();
  }
  console.log(JSON.stringify({ ...report, selected: selected.size, categories: counts, output: out }));
  if (selected.size < 500) throw Error("Insufficient useful products; partial output saved for inspection");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
