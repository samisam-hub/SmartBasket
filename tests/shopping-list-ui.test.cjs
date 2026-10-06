require('./register.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), Module = require('node:module'), ts = require('typescript');
const React = require('react'), { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const values = new Map(), sent = [], platform = { OS: 'android' };
let rejectShare = false;
const stub = name => { function Stub(props) { return React.createElement(name, props, props.children); } return Stub; };
const original = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'react-native') return { Platform: platform, View: 'View', Text: 'Text', Pressable: 'Pressable', Share: { share: async data => { if (rejectShare) throw Error('Sharing unavailable'); sent.push(data); } } };
  if (request === '@react-native-async-storage/async-storage') return { __esModule: true, default: { getItem: async k => values.get(k) ?? null, setItem: async (k, v) => { values.set(k, v); } } };
  if (request === './ui') return Object.fromEntries(['ErrorMessage','SectionCard','SecondaryButton','TextButton'].map(n => [n, stub(n)]));
  if (request === '../lib/theme') return { ui: {} };
  return original.call(this, request, parent, isMain);
};
require.extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
const { ShoppingList } = require('../components/ShoppingList.tsx');
Module._load = original;
const uiAct = action => act(async () => { await action(); await new Promise(resolve => setImmediate(resolve)); });
const basket = { id: 'basket-1', ownerId: 'anna', name: 'Family week', result: { items: [{ product: { id: 'milk', name: 'Milk', brand: null }, packageCount: 2, packageAmount: 1000, quantityUnit: 'ml' }] } };

test('shopping screen checks and reopens items, persists them, and shares the visible shopping text', async () => {
  let screen;
  await uiAct(() => { screen = create(React.createElement(ShoppingList, { basket })); });
  const checkbox = () => screen.root.findByType('Pressable');
  assert.equal(checkbox().props.accessibilityRole, 'checkbox');
  await uiAct(() => checkbox().props.onPress());
  assert.equal(checkbox().props.accessibilityState.checked, true);
  await uiAct(() => screen.root.findByType('SecondaryButton').props.onPress());
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /Already picked up:/);
  assert.match(sent[0].message, /\[x\] Milk — 2 × 1,000 ml/);
  await uiAct(() => screen.unmount());
  await uiAct(() => { screen = create(React.createElement(ShoppingList, { basket })); });
  assert.equal(checkbox().props.accessibilityState.checked, true);
  const changed = { ...basket, result: { items: [{ ...basket.result.items[0], packageCount: 3 }] } };
  await uiAct(() => screen.update(React.createElement(ShoppingList, { basket: changed })));
  assert.equal(checkbox().props.accessibilityState.checked, false);
  await uiAct(() => checkbox().props.onPress());
  await uiAct(() => screen.update(React.createElement(ShoppingList, { basket: { ...changed, ownerId: 'partner' } })));
  assert.equal(checkbox().props.accessibilityState.checked, false, 'another account does not inherit checkmarks');
  rejectShare = true;
  await uiAct(() => screen.root.findByType('SecondaryButton').props.onPress());
  assert.match(screen.root.findAllByType('Text').find(n => n.props.selectable).props.children, /Milk — 3 × 1,000 ml/);
  await uiAct(() => screen.unmount());
  rejectShare = false;
});

test('browser without native sharing exposes a selectable text copy', async () => {
  platform.OS = 'web'; let screen;
  await uiAct(() => { screen = create(React.createElement(ShoppingList, { basket: { ...basket, id: 'web' } })); });
  await uiAct(() => screen.root.findByType('SecondaryButton').props.onPress());
  assert.match(screen.root.findAllByType('Text').find(n => n.props.selectable).props.children, /\[ \] Milk/);
  await uiAct(() => screen.unmount()); platform.OS = 'android';
});
