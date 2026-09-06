// Administrative only: never prefix the secret key with EXPO_PUBLIC_.
require("./register-typescript.cjs");
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");
const { productToRow } = require("../services/catalog/product-row.ts");
(async () => {
  const products = JSON.parse(fs.readFileSync(".expo/catalog/products.json", "utf8"));
  if (!Array.isArray(products) || products.length < 1 || products.length > 1000) throw Error("Invalid catalog import size");
  if (!process.argv.includes("--apply")) {
    console.log(`Prepared ${products.length} products. Add --apply and supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upsert them.`);
    return;
  }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("Administrative SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let i = 0; i < products.length; i += 50) {
    const { error } = await client.from("products").upsert(products.slice(i, i + 50).map(productToRow), { onConflict: "source,external_id" });
    if (error) throw Error(`Batch ${i / 50 + 1}: ${error.message}`);
    console.log(`Upserted ${Math.min(i + 50, products.length)} / ${products.length} products`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
