// Explicit hosted smoke test; never run automatically as part of npm test.
// Creates two disposable anonymous identities and records their IDs for cleanup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Configure the dedicated SmartBasket backend first.');
const create = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const marker = `smartbasket-verification-${Date.now()}`;
const report = { marker, userIds: [], passed: false };
const record = () => fs.writeFileSync('.expo/backend-verification.json', JSON.stringify(report, null, 2));
const check = (result) => { if (result.error) throw new Error(result.error.message); return result.data; };
(async () => {
  const a = create(), b = create();
  const authA = check(await a.auth.signInAnonymously({ options: { data: { verification: marker } } }));
  report.userIds.push(authA.user.id); record();
  const authB = check(await b.auth.signInAnonymously({ options: { data: { verification: marker } } }));
  report.userIds.push(authB.user.id); record();
  const payload = (userId) => ({ user_id: userId, household_size: 2, planning_days: 14, daily_calories: 2400,
    primary_goal: 'build_muscle', protein_mode: 'manual', protein_target_grams: 150, dietary_preferences: ['lactose_free'],
    allergens: ['milk'], budget_enabled: true, weekly_budget_eur: 95.50, onboarding_completed: true });
  const saved = check(await a.from('user_preferences').upsert(payload(authA.user.id), { onConflict: 'user_id' }).select().single());
  check(await b.from('user_preferences').upsert(payload(authB.user.id), { onConflict: 'user_id' }));
  const update = check(await a.from('user_preferences').upsert({ ...payload(authA.user.id), daily_calories: 2500 }, { onConflict: 'user_id' }).select().single());
  assert.equal(update.id, saved.id); assert.equal(update.created_at, saved.created_at);
  assert.equal(update.daily_calories, 2500); assert.ok(update.updated_at >= saved.updated_at);
  const restored = create();
  check(await restored.auth.setSession({ access_token: authA.session.access_token, refresh_token: authA.session.refresh_token }));
  check(await restored.auth.refreshSession());
  const loaded = check(await restored.from('user_preferences').select().single());
  assert.equal(loaded.id, saved.id); assert.equal(loaded.daily_calories, 2500);
  const ownB = check(await b.from('user_preferences').select());
  assert.equal(ownB.length, 1); assert.equal(ownB[0].user_id, authB.user.id);
  assert.equal(check(await b.from('user_preferences').select().eq('user_id', authA.user.id)).length, 0);
  assert.equal((await b.from('user_preferences').insert(payload(authA.user.id))).error?.code, '42501');
  assert.equal((await b.from('user_preferences').update({ user_id: authA.user.id }).eq('user_id', authB.user.id)).error?.code, '42501');
  assert.equal(check(await b.from('user_preferences').update({ daily_calories: 3000 }).eq('user_id', authA.user.id).select()).length, 0);
  assert.equal((await b.from('user_preferences').delete().eq('user_id', authB.user.id)).error?.code, '42501');
  assert.ok((await create().from('user_preferences').select()).error);
  report.passed = true; report.checkedAt = new Date().toISOString(); record();
  console.log(JSON.stringify({ passed: true, checks: ['anonymous identity', 'insert/upsert', 'session restore/refresh', 'readback', 'two-user RLS', 'denied ownership change', 'denied anon/delete access'], verificationIds: report.userIds }));
})().catch((error) => { record(); console.error(error.message); process.exitCode = 1; });
