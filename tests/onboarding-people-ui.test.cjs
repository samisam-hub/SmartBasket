require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), Module = require('node:module'), ts = require('typescript');
const React = require('react'), { create, act } = require('react-test-renderer');
const { newParticipant } = require('../services/participant-domain.ts');
global.IS_REACT_ACT_ENVIRONMENT = true;
const original = Module._load;
const component = name => { function Stub(props) { return React.createElement(name, props, props.children); } Stub.displayName = name; return Stub; };
Module._load = function(request, parent, isMain) {
  if (request === 'react-native') return { View: component('View'), Text: component('Text') };
  if (request === './ui') return Object.fromEntries(['SectionCard','SelectionChip','SecondaryButton','TextButton','TextInput'].map(n => [n, component(n)]));
  if (request === './NumberInput') return { NumberInput: component('NumberInput') };
  if (request === './ProfileFields') return { OptionalNumber: component('OptionalNumber') };
  if (request === '../lib/theme') return { ui: {} };
  return original.call(this, request, parent, isMain);
};
require.extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const { OnboardingPeople } = require('../components/OnboardingPeople.tsx');
Module._load = original;

test('people screen supports one-tap setup, child addition, editing recommendations and removal', async () => {
  let people = [newParticipant('me', 'You', true)], screen;
  const render = () => React.createElement(OnboardingPeople, { people, onChange: value => { people = value; screen.update(render()); } });
  const find = (type, label, index = 0) => screen.root.findAllByType(type).filter(n => n.props.label === label)[index];
  await act(() => { screen = create(render()); });
  assert.equal(screen.root.findAllByType('NumberInput').length, 0);
  await act(() => find('SelectionChip', 'Adult').props.onPress());
  assert.equal(people[0].dailyCalories, 2000);
  await act(() => find('SecondaryButton', 'Add person').props.onPress());
  await act(() => find('SelectionChip', 'Child', 1).props.onPress());
  assert.equal(people[1].dailyCalories, 1400);
  await act(() => find('TextButton', 'Adjust recommendation or add details', 1).props.onPress());
  await act(() => find('NumberInput', 'Daily planning target (kcal)').props.onChange(1600));
  assert.equal(people[1].calorieTargetMode, 'manual');
  assert.equal(people[1].dailyCalories, 1600);
  await act(() => find('TextButton', 'Remove person').props.onPress());
  assert.equal(people.length, 1);
  assert.equal(screen.root.findAllByType('TextButton').filter(n => n.props.label === 'Remove person').length, 0);
  await act(() => screen.unmount());
});

test('onboarding completes into Home, keeps snack off, and has no planning-period or calorie form in the normal path', async () => {
  const { PreferenceStore } = require('../services/preference-store.ts');
  const { updateParticipant } = require('../services/participant-domain.ts');
  let cached, params = { step: 'welcome' }, screen, exitState;
  const store = new PreferenceStore({ getItem: async () => cached ?? null, setItem: async (_, v) => { cached = v; } }, 'ui-onboarding', null);
  await store.initialize();
  const navigation = { reset: state => { exitState = state; } };
  const router = { replace: route => { params = route.params; screen.update(render()); } };
  Module._load = function(request, parent, isMain) {
    if (request === 'react-native') return { View: component('View'), Text: component('Text'), BackHandler: { addEventListener: () => ({ remove() {} }) } };
    if (request === 'expo-router') return { router, Redirect: component('Redirect'), useLocalSearchParams: () => params, useNavigation: () => navigation, useFocusEffect: callback => React.useEffect(callback, [callback]) };
    if (request === '@/components/ui') return Object.fromEntries(['EmptyState','ErrorMessage','InfoCard','PrimaryButton','ProgressIndicator','Screen','ScreenHeader','SectionCard','SelectionChip','TextButton'].map(n => [n, component(n)]));
    if (request === '@/components/NumberInput') return { NumberInput: component('NumberInput') };
    if (request === '@/components/OnboardingPeople') return { OnboardingPeople: component('OnboardingPeople') };
    if (request === '@/components/PreferenceSummary') return { PreferenceSummary: component('PreferenceSummary') };
    if (request === '@/context/PreferencesContext') return { usePreferences: () => ({ ...React.useSyncExternalStore(store.subscribe, store.getSnapshot), store }) };
    if (request === '@/lib/theme') return { ui: {} };
    if (request.startsWith('@/')) return original.call(this, require.resolve('../' + request.slice(2)), parent, isMain);
    return original.call(this, request, parent, isMain);
  };
  const Onboarding = require('../app/onboarding/[step].tsx').default;
  Module._load = original;
  const render = () => React.createElement(Onboarding);
  const button = () => screen.root.findByType('PrimaryButton');
  await act(() => { screen = create(render()); });
  assert.equal(store.getSnapshot().draft.participants.length, 1);
  await act(() => button().props.onPress());
  assert.equal(params.step, 'household');
  await act(() => button().props.onPress());
  assert.equal(params.step, 'household', 'Adult/Child choice is required');
  assert.equal(screen.root.findAllByType('NumberInput').length, 0);
  await act(() => screen.root.findByType('OnboardingPeople').props.onChange([updateParticipant(store.getSnapshot().draft.participants[0], { kind: 'adult' })]));
  await act(() => button().props.onPress());
  assert.equal(params.step, 'meals');
  const snack = screen.root.findAllByType('SelectionChip').find(n => n.props.label === 'Snack');
  assert.equal(snack.props.selected, false);
  for (const expected of ['diet', 'allergies', 'review']) {
    await act(() => button().props.onPress());
    assert.equal(params.step, expected);
  }
  assert.equal(button().props.label, 'Open my calendar');
  await act(async () => { button().props.onPress(); await new Promise(resolve => setImmediate(resolve)); });
  assert.equal(exitState.routes[0].state.index, 0);
  assert.equal(store.getSnapshot().saved.slotDefaults.snack, false);
  assert.equal(store.getSnapshot().saved.participants[0].kind, 'adult');
  assert.equal(store.getSnapshot().saved.onboardingCompleted, true);
  await act(() => screen.unmount());
});
