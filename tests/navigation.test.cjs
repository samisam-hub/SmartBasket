require("./register.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { preferenceExitState } = require("../services/preference-navigation.ts");
const { PreferenceStore } = require("../services/preference-store.ts");

test("saving resets the actual routers to the correct tab with no onboarding Back history", async (t) => {
  const { StackRouter, TabRouter, CommonActions } = await import("@react-navigation/routers");
  const stack = StackRouter({});
  const tabs = TabRouter({ initialRouteName: "index", backBehavior: "firstRoute" });
  const rootOptions = { routeNames: ["(tabs)", "onboarding/[step]", "basket-setup"], routeParamList: {}, routeGetIdList: {} };
  const tabOptions = { routeNames: ["index", "products", "basket", "profile"], routeParamList: {}, routeGetIdList: {} };
  for (const intent of ["onboarding", "edit"]) {
    for (const deepLink of [false, true]) {
      await t.test(`${intent}, ${deepLink ? "direct link" : "existing tab stack"}`, async () => {
        let cached = null;
        const store = new PreferenceStore({ getItem: async () => cached, setItem: async (_, value) => { cached = value; } }, "test", null);
        await store.initialize();
        if (intent === "edit") await store.save();
        store.begin();
        store.update({ householdSize: 3 });
        const before = stack.getRehydratedState({ stale: true, index: deepLink ? 0 : 2, routes: [
          ...(!deepLink ? [{ name: "(tabs)" }, { name: "basket-setup" }] : []),
          { name: "onboarding/[step]", params: { step: "review", intent } },
        ] }, rootOptions);
        assert.equal(await store.save(), true);
        const result = stack.getStateForAction(before, CommonActions.reset(preferenceExitState(intent)), rootOptions);
        assert.ok(result);
        const after = stack.getRehydratedState(result, rootOptions);
        assert.deepEqual(after.routes.map((route) => route.name), ["(tabs)"]);
        assert.equal(stack.getStateForAction(after, CommonActions.goBack(), rootOptions), null);
        const tabState = tabs.getRehydratedState(after.routes[0].state, tabOptions);
        assert.equal(tabState.routes[tabState.index].name, intent === "edit" ? "profile" : "index");
        const back = tabs.getStateForAction(tabState, CommonActions.goBack(), tabOptions);
        if (intent === "onboarding") assert.equal(back, null);
        else assert.equal(back.routes[back.index].name, "index");
        assert.equal(store.getSnapshot().saved.householdSize, 3);
        assert.equal(store.getSnapshot().editing, false);
        const reopened = new PreferenceStore({ getItem: async () => cached, setItem: async () => {} }, "test", null);
        await reopened.initialize();
        assert.equal(reopened.getSnapshot().saved.householdSize, 3);
      });
    }
  }
});

test('successful first setup enters planning and Back cannot return to onboarding', async () => {
  const { StackRouter, CommonActions } = await import('@react-navigation/routers');
  const { planningEntryState } = require('../services/preference-navigation.ts');
  const stack = StackRouter({});
  const options = { routeNames: ['(tabs)', 'onboarding/[step]', 'plan/week'], routeParamList: {}, routeGetIdList: {} };
  const before = stack.getRehydratedState({ stale: true, index: 0, routes: [{ name: 'onboarding/[step]' }] }, options);
  const reset = stack.getStateForAction(before, CommonActions.reset(planningEntryState()), options);
  const after = stack.getRehydratedState(reset, options);
  assert.equal(after.routes[after.index].name, 'plan/week');
  const back = stack.getStateForAction(after, CommonActions.goBack(), options);
  assert.deepEqual(back.routes.map(route => route.name), ['(tabs)']);
});
