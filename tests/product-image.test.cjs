const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const ts = require("typescript"), React = require("react"), { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "react-native") return { PixelRatio: { get: () => 3 }, View: "View", Image: "Image", ActivityIndicator: "Spinner", StyleSheet: { create: v => v, absoluteFill: {} } };
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
  await act(() => { renderer = create(React.createElement(ProductImage, { width: 1200, height: 1200, uri: "https://example.com/a.jpg", name: "A" })); });
  assert.equal(renderer.root.findAllByType("Spinner").length, 1);
  await act(() => renderer.root.findByType("Image").props.onError());
  assert.equal(renderer.root.findAllByType("Image").length, 0);
  assert.equal(renderer.root.findAllByType("Placeholder").length, 1);
  await act(() => renderer.update(React.createElement(ProductImage, { width: 1200, height: 1200, uri: "https://example.com/b.jpg", name: "B" })));
  assert.equal(renderer.root.findAllByType("Image").length, 1);
  assert.equal(renderer.root.findAllByType("Spinner").length, 1);
  await act(() => renderer.root.findByType("Image").props.onLoad({ nativeEvent: { source: { width: 900, height: 1200 } } }));
  assert.equal(renderer.root.findAllByType("Spinner").length, 0);
  assert.equal(renderer.root.findByType("Image").props.style.maxWidth, 300);
  assert.equal(renderer.root.findByType("Image").props.style.maxHeight, 400);
  await act(() => renderer.update(React.createElement(ProductImage, { width: 1200, height: 1200, uri: null, name: "C", large: true })));
  assert.equal(renderer.root.findAllByType("Image").length, 0);
  assert.equal(renderer.root.findAllByType("Placeholder").length, 1);
  await act(() => renderer.unmount());
});
test("actual image component rejects small metadata and small downloaded files on dense displays", async () => {
  let renderer;
  await act(() => { renderer = create(React.createElement(ProductImage, { uri: 'https://example.com/tiny.jpg', width: 200, height: 200, name: 'Tiny', large: true })); });
  assert.equal(renderer.root.findAllByType('Image').length, 0);
  await act(() => renderer.update(React.createElement(ProductImage, { uri: 'https://example.com/front.jpg', width: 600, height: 900, name: 'Front', large: true })));
  assert.equal(renderer.root.findByType('Image').props.style.maxWidth, 200);
  assert.equal(renderer.root.findByType('Image').props.style.opacity, 0);
  await act(() => renderer.root.findByType('Image').props.onLoad({ nativeEvent: { source: { width: 100, height: 150 } } }));
  assert.equal(renderer.root.findAllByType('Image').length, 0);
  assert.equal(renderer.root.findAllByType('Placeholder').length, 1);
  await act(() => renderer.update(React.createElement(ProductImage, { uri: 'https://example.com/large.jpg', width: 3024, height: 4032, name: 'Large', large: true })));
  await act(() => renderer.root.findByType('Image').props.onLoad({ nativeEvent: { source: { width: 384, height: 512 } } }));
  assert.equal(renderer.root.findAllByType('Image').length, 1); // Native downsampling is not bad source metadata.
  assert.equal(renderer.root.findByType('Image').props.style.opacity, 1);
  await act(() => renderer.unmount());
});

test('web DOM image events load safely with stable callbacks and malformed events show placeholder', async () => {
 let renderer;
 await act(()=>{renderer=create(React.createElement(ProductImage,{uri:'https://example.com/web.jpg',width:900,height:1200,name:'Web',large:true}));});
 const onLoad=renderer.root.findByType('Image').props.onLoad;
 await act(()=>onLoad({nativeEvent:{target:{naturalWidth:900,naturalHeight:1200}}}));
 assert.equal(renderer.root.findByType('Image').props.style.maxWidth,300);
 assert.equal(renderer.root.findByType('Image').props.style.opacity,1);
 assert.equal(renderer.root.findByType('Image').props.onLoad,onLoad);
 for(const event of [undefined,{}, {nativeEvent:{}}, {nativeEvent:{target:{naturalWidth:0,naturalHeight:0}}}]){
  await act(()=>renderer.update(React.createElement(ProductImage,{uri:`https://example.com/${Math.random()}.jpg`,width:900,height:1200,name:'Missing'})));
  await act(()=>renderer.root.findByType('Image').props.onLoad(event));
  assert.equal(renderer.root.findAllByType('Placeholder').length,1);
  assert.equal(renderer.root.findAllByType('Spinner').length,0);
 }
 await act(()=>renderer.unmount());
});
