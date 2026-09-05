const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

test("migration executes in PostgreSQL; RLS isolates two identities and enforces constraints", async (t) => {
  const db = new PGlite();
  try {
    // Isolated Supabase auth fixture. No hosted projects or real auth users are modified.
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant usage on schema public to authenticated, anon;
    `);
    const migration = fs.readFileSync(
      require.resolve(
        "../supabase/migrations/20260905231852_user_preferences.sql",
      ),
      "utf8",
    );
    await db.exec(migration);
    const a = randomUUID(),
      b = randomUUID();
    await db.query("insert into auth.users(id) values ($1), ($2)", [a, b]);
    const asUser = async (id) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    const insert = (id) =>
      db.query(
        `insert into public.user_preferences
      (user_id, household_size, planning_days, daily_calories, primary_goal, protein_mode, weekly_budget_eur, onboarding_completed)
      values ($1, 1, 7, 2000, 'maintain', 'automatic', 70, true) returning *`,
        [id],
      );
    await asUser(a);
    const first = (await insert(a)).rows[0];
    await asUser(b);
    await insert(b);

    await t.test("each user can read only their own row", async () => {
      for (const id of [a, b]) {
        await asUser(id);
        const result = await db.query(
          "select user_id from public.user_preferences",
        );
        assert.deepEqual(
          result.rows.map((r) => r.user_id),
          [id],
        );
      }
    });
    await t.test(
      "foreign inserts and ownership reassignment are denied",
      async () => {
        await asUser(a);
        await assert.rejects(insert(b), (e) => e.code === "42501");
        await assert.rejects(
          db.query(
            "update public.user_preferences set user_id = $1 where user_id = $2",
            [b, a],
          ),
          (e) => e.code === "42501",
        );
        const update = await db.query(
          "update public.user_preferences set daily_calories = 2500 where user_id = $1 returning id",
          [b],
        );
        assert.equal(update.rows.length, 0);
      },
    );
    await t.test(
      "own upsert updates in place with server timestamps and immutable ID",
      async () => {
        await asUser(a);
        const result = await db.query(
          `insert into public.user_preferences
        (user_id,household_size,planning_days,daily_calories,primary_goal,protein_mode,weekly_budget_eur,onboarding_completed)
        values ($1,2,14,2400,'build_muscle','automatic',95.50,true)
        on conflict(user_id) do update set daily_calories=excluded.daily_calories, weekly_budget_eur=excluded.weekly_budget_eur
        returning *`,
          [a],
        );
        assert.equal(result.rows[0].id, first.id);
        assert.equal(
          String(result.rows[0].created_at),
          String(first.created_at),
        );
        assert.equal(result.rows[0].daily_calories, 2400);
        assert.ok(
          new Date(result.rows[0].updated_at) >= new Date(first.updated_at),
        );
        const immutable = await db.query(
          "update public.user_preferences set id=$1, created_at=$2 returning id, created_at",
          [randomUUID(), "2000-01-01"],
        );
        assert.equal(immutable.rows[0].id, first.id);
        assert.equal(
          String(immutable.rows[0].created_at),
          String(first.created_at),
        );
      },
    );
    await t.test(
      "invalid ranges, incompatible diets and mode/value mismatches are rejected",
      async () => {
        await asUser(a);
        for (const change of [
          "household_size=0",
          "planning_days=6",
          "daily_calories=999",
          "primary_goal='unknown'",
          "protein_mode='manual', protein_target_grams=null",
          "budget_enabled=false, weekly_budget_eur=70",
          "weekly_budget_eur=0",
          "dietary_preferences=array['none','vegan']",
          "dietary_preferences=array['vegan','pescatarian']",
          "allergens=array['unknown']",
          "allergens=array[null]::text[]",
        ])
          await assert.rejects(
            db.exec(`update public.user_preferences set ${change}`),
            (e) => e.code === "23514",
          );
      },
    );
    await t.test(
      "unauthenticated access and client deletion are denied",
      async () => {
        await asUser(a);
        await assert.rejects(
          db.exec("delete from public.user_preferences"),
          (e) => e.code === "42501",
        );
        await db.exec("reset role; set role anon");
        await assert.rejects(
          db.exec("select * from public.user_preferences"),
          (e) => e.code === "42501",
        );
        await assert.rejects(insert(a), (e) => e.code === "42501");
      },
    );
  } finally {
    await db.close();
  }
});
