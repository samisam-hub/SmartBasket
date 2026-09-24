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
    await db.exec(fs.readFileSync("supabase/migrations/20260906124417_product_image_quality.sql", "utf8"));
    const product = normalizeOpenFoodFacts({ code: "1234567890123", product_name: "Oat milk", brands: "O'Brien", categories_tags: ["en:milk-substitutes"], nutriments: { "energy-kcal_100g": 40, proteins_100g: 4 }, labels_tags: ["en:vegan"] });
    await db.exec(fs.readFileSync("supabase/migrations/20260907081513_ingredient_package_metadata.sql", "utf8"));
    await db.exec(fs.readFileSync("supabase/migrations/20260907120000_synthetic_price_metadata.sql", "utf8"));
  await db.exec(fs.readFileSync('supabase/migrations/20260924144255_ready_meal_metadata.sql','utf8'));
    await db.exec(catalogImportSql([product]));
    const first = (await db.query("select * from products")).rows[0];
    await db.exec(catalogImportSql([{ ...product, name: "Oat drink", proteinPer100g: 5 }]));
    const updated = (await db.query("select * from products")).rows[0];
    assert.equal(updated.id, first.id); assert.equal(updated.created_at.getTime(), first.created_at.getTime());
    assert.equal(updated.protein_per_100g, "5");
    assert.equal((await db.query("select count(*)::int n from products")).rows[0].n, 1);
    // A nutrition re-import cannot erase or synthesize over a pre-existing curated/real estimate.
    await db.exec("update products set price_estimate=7.99, price_kind='estimate',price_estimate_source='curated' where true");
    await db.exec(catalogImportSql([{...product,quantityLabel:'1 L',packageSize:1000,packageUnit:'ml'}]));
    const preserved=(await db.query('select price_estimate,price_estimate_source from products')).rows[0];
    assert.equal(Number(preserved.price_estimate),7.99);assert.equal(preserved.price_estimate_source,'curated');
    await assert.rejects(db.exec("insert into products(name,category,source,nutrition_basis,price_estimate_source) values ('Bad','other','manual','100g','synthetic_mvp')"),e=>e.code==='23514');
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
    await assert.rejects(db.exec("update products set ready_meal = '{}'::jsonb"), e => e.code === '23514');
    const metadata = {category:'lasagne',modes:['heat_and_eat'],slots:['lunch','dinner'],portionGrams:350,available:true,evidence:'Test label'};
    await db.query('update products set ready_meal=$1::jsonb',[JSON.stringify(metadata)]);
    await db.exec(catalogImportSql([product]));
    assert.deepEqual((await db.query('select ready_meal from products')).rows[0].ready_meal,metadata);
    for(const invalid of [{...metadata,modes:['cook']},{...metadata,available:null},{...metadata,portionGrams:0},{...metadata,evidence:''}])
      await assert.rejects(db.query('update products set ready_meal=$1::jsonb',[JSON.stringify(invalid)]),e=>e.code==='23514');
    await assert.rejects(db.exec("update products set image_quality = 'usable', display_image_url = 'https://example.com/tiny.jpg', image_width = 100, image_height = 100"), e => e.code === "23514");
    await assert.rejects(db.exec("update products set image_quality = 'usable', display_image_url = 'https://example.com/unknown.jpg'"), e => e.code === "23514");
  } finally { await db.close(); }
});
