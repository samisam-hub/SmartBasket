const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const ts = require("typescript"), React = require("react"), { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "react-native") return { View: "View", Image: "Image", ActivityIndicator: "Spinner", StyleSheet: { create: v => v, absoluteFill: {} } };
  if (request === "@expo/vector-icons/Feather") return { __esModule: true, default: props => React.createElement("Placeholder", props) };
  if (request.startsWith("@/")) request = path.resolve(path.dirname(require.resolve("../package.json")), request.slice(2));
  return originalLoad.call(this, request, parent, isMain);
};
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  module._compile(result.outputText, filename);
};
const { ProductImage } = require("../components/ProductImage.tsx");
test("actual image component handles loading, failures, missing URLs and recycled products", async () => {
  let renderer;
  await act(() => { renderer = create(React.createElement(ProductImage, { uri: "https://example.com/a.jpg", name: "A" })); });
  assert.equal(renderer.root.findAllByType("Spinner").length, 1);
  await act(() => renderer.root.findByType("Image").props.onError());
  assert.equal(renderer.root.findAllByType("Image").length, 0);
  assert.equal(renderer.root.findAllByType("Placeholder").length, 1);
  await act(() => renderer.update(React.createElement(ProductImage, { uri: "https://example.com/b.jpg", name: "B" })));
  assert.equal(renderer.root.findAllByType("Image").length, 1);
  assert.equal(renderer.root.findAllByType("Spinner").length, 1);
  await act(() => renderer.root.findByType("Image").props.onLoad());
  assert.equal(renderer.root.findAllByType("Spinner").length, 0);
  await act(() => renderer.update(React.createElement(ProductImage, { uri: null, name: "C", large: true })));
  assert.equal(renderer.root.findAllByType("Image").length, 0);
  assert.equal(renderer.root.findAllByType("Placeholder").length, 1);
  await act(() => renderer.unmount());
});
