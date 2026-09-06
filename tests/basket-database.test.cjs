require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { catalog, prefs } = require('./basket-fixtures.cjs');
const { catalogImportSql } = require('../services/catalog/product-row.ts');
const { generateBasket } = require('../services/basket/basketGenerator.ts');
test('basket tables/RPC enforce two-user isolation, atomic saves, retries, foreign keys and append-only permissions', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated,anon;`);
    for (const file of ['20260906005004_products_catalog.sql','20260906124417_product_image_quality.sql','20260906131336_generated_baskets.sql'])
      await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
    const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    await db.query('insert into auth.users values ($1),($2)', [a,b]);
    await db.exec(catalogImportSql(catalog));
    const ids = (await db.query('select id,name from products')).rows;
    const result = generateBasket(prefs(), catalog.map(p => ({ ...p, id: ids.find(r => r.name === p.name).id })));
    const asUser = async id => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); };
    const save = (key, r = result) => db.query('select public.save_generated_basket($1,$2,$3::jsonb,$4::jsonb) id', [key,'Test basket',JSON.stringify(prefs()),JSON.stringify(r)]);
    await asUser(a);
    const id = (await save('retry-key')).rows[0].id;
    assert.equal((await save('retry-key')).rows[0].id,id);
    assert.equal((await db.query('select * from baskets')).rows.length,1);
    assert.equal((await db.query('select * from basket_items')).rows.length,result.items.length);
    const child = (await db.query('select * from basket_items limit 1')).rows[0];
    await asUser(b);
    assert.equal((await db.query('select * from baskets')).rows.length,0);
    assert.equal((await db.query('select * from basket_items')).rows.length,0);
    await assert.rejects(db.query(`insert into basket_items(basket_id,product_id,position,package_count,total_weight,total_calories,total_protein,reason_selected,item_snapshot)
      values ($1,$2,23,1,500,100,10,'[]','{}')`,[id,child.product_id]), e => e.code === '42501');
    const other = (await save('retry-key')).rows[0].id; assert.notEqual(other,id);
    await assert.rejects(db.query('update baskets set user_id=$1',[a]), e => e.code === '42501');
    await assert.rejects(db.exec('delete from basket_items'), e => e.code === '42501');
    const bad = structuredClone(result); bad.items[bad.items.length-1].product.id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    await assert.rejects(save('atomic-failure',bad), e => e.code === '23503');
    assert.equal((await db.query('select count(*)::int n from baskets')).rows[0].n,1);
    await assert.rejects(save('empty',{ ...result,items:[] }));
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from baskets'), e => e.code === '42501');
    await assert.rejects(save('anon'), e => e.code === '42501');
    await asUser(''); await assert.rejects(save('no-uid'), e => e.code === '42501');
  } finally { await db.close(); }
});
