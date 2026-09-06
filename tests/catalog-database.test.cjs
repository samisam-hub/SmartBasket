require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const { normalizeOpenFoodFacts } = require("../services/catalog/normalize.ts");
const { catalogImportSql } = require("../services/catalog/product-row.ts");
test("catalog migration, idempotent imports, indexed search and read-only RLS in PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; grant usage on schema public to anon, authenticated;");
    await db.exec(fs.readFileSync("supabase/migrations/20260906005004_products_catalog.sql", "utf8"));
    const product = normalizeOpenFoodFacts({ code: "1234567890123", product_name: "Oat milk", brands: "O'Brien", categories_tags: ["en:milk-substitutes"], nutriments: { "energy-kcal_100g": 40, proteins_100g: 4 }, labels_tags: ["en:vegan"] });
    await db.exec(catalogImportSql([product]));
    const first = (await db.query("select * from products")).rows[0];
    await db.exec(catalogImportSql([{ ...product, name: "Oat drink", proteinPer100g: 5 }]));
    const updated = (await db.query("select * from products")).rows[0];
    assert.equal(updated.id, first.id); assert.equal(updated.created_at.getTime(), first.created_at.getTime());
    assert.equal(updated.protein_per_100g, "5");
    assert.equal((await db.query("select count(*)::int n from products")).rows[0].n, 1);
    assert.equal((await db.query("select name from products where search_document @@ to_tsquery('simple','oat:* & bri:*') and vegan = true and high_protein = true")).rows.length, 1);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      assert.equal((await db.query("select * from products")).rows.length, 1);
      for (const sql of ["delete from products", "update products set name = 'tampered'", catalogImportSql([product])])
        await assert.rejects(db.exec(sql), e => e.code === "42501");
      await db.exec("reset role");
    }
    await assert.rejects(db.exec(catalogImportSql([{ ...product, externalId: "different" }])), e => e.code === "23505");
    await assert.rejects(db.exec("update products set protein_per_100g = -1"), e => e.code === "23514");
  } finally { await db.close(); }
});
