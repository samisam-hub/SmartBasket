// Read-only, bounded metadata refresh for the existing catalog; no product replacement.
require('./register-typescript.cjs');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const { createGunzip } = require('node:zlib');
const { createInterface } = require('node:readline');
const { createClient } = require('@supabase/supabase-js');
const out = '.expo/catalog-images';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.from('products').select('id,barcode,image_url,image_thumbnail_url').eq('source', 'open-food-facts').order('id').limit(1000);
  if (error) throw error;
  fs.writeFileSync(`${out}/before.json`, JSON.stringify(data));
  const wanted = new Set(data.map(p => p.barcode)), found = [];
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 600000);
  let input, unzip, lines, scanned = 0;
  try {
    const response = await fetch('https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz', { signal: controller.signal, headers: { 'User-Agent': 'SmartBasket/0.1 (https://github.com/samisam-hub/SmartBasket)' } });
    if (!response.ok || !response.body) throw Error(`OFF HTTP ${response.status}`);
    input = Readable.fromWeb(response.body); unzip = input.pipe(createGunzip());
    input.on('error', error => unzip.destroy(error));
    lines = createInterface({ input: unzip, crlfDelay: Infinity });
    for await (const line of lines) {
      if (++scanned > 80000) break;
      let p; try { p = JSON.parse(line); } catch { continue; }
      const code = String(p.code ?? '');
      const canonical = code.length === 14 && code.startsWith('0') ? code.slice(1) : code.padStart(13, '0');
      if (!wanted.delete(canonical)) continue;
      found.push({ code, lc: p.lc, images: p.images, image_front_url: p.image_front_url, image_url: p.image_url,
        image_front_small_url: p.image_front_small_url, image_small_url: p.image_small_url, selected_images: p.selected_images });
      if (!wanted.size) break;
    }
  } finally {
    clearTimeout(timer); lines?.close(); input?.destroy(); unzip?.destroy(); controller.abort();
    fs.writeFileSync(`${out}/metadata.json`, JSON.stringify(found));
    console.log(JSON.stringify({ scanned, found: found.length, missing: [...wanted] }));
  }
  if (wanted.size) throw Error('Incomplete metadata audit; do not apply a partial refresh silently');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
