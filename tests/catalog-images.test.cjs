require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeOffImages } = require('../services/catalog/off-images.ts');
const code = '1234567890123';
const front = (w, h) => ({ rev: '7', sizes: { full: { w, h }, '400': { w: 300, h: 400 }, '200': { w: 150, h: 200 } } });
test('full selected crop outranks low-resolution convenience URL and preserves thumbnail/provenance', () => {
  const p = normalizeOffImages({ image_front_url: 'https://example.com/200.jpg', images: { selected: { front: { en: front(900, 1200) } } } }, code);
  assert.match(p.displayImageUrl, /front_en\.7\.full\.jpg$/);
  assert.match(p.imageThumbnailUrl, /\.400\.jpg$/);
  assert.equal(p.sourceImageUrl, p.displayImageUrl); assert.equal(p.imageUrl, p.displayImageUrl);
  assert.equal(p.imageQuality, 'usable'); assert.equal(p.imageWidth, 900); assert.equal(p.imageHeight, 1200);
});
test('best usable front can be another language, and legacy selected crops remain supported', () => {
  const p = normalizeOffImages({ images: { front_en: front(200, 200), front_de: front(1000, 1200) } }, code);
  assert.match(p.displayImageUrl, /front_de/);
});
test('tiny, unknown, malformed, missing and non-front images are never displayed', () => {
  const p = normalizeOffImages({ images: { selected: { front: { en: front(150, 200) } } } }, code);
  assert.equal(p.imageQuality, 'low-resolution'); assert.equal(p.displayImageUrl, null); assert.equal(p.imageThumbnailUrl, null);
  assert.equal(p.imageWidth, 150); // A 400 variant upscaled from 150x200 is not counted as usable.
  const unknown = normalizeOffImages({ image_front_url: 'https://example.com/front.jpg' }, code);
  assert.equal(unknown.imageQuality, 'unknown'); assert.equal(unknown.displayImageUrl, null);
  for (const images of [{ uploaded: { '1': front(3000, 4000) } }, { selected: { nutrition: { en: front(3000, 4000) } } }, { front_en: { rev: '../bad', sizes: { full: { w: 1200, h: 1200 } } } }, { front_en: { rev: 1, sizes: { full: { w: 'invalid', h: 1200 } } } }]) {
    assert.equal(normalizeOffImages({ images }, code).displayImageUrl, null);
  }
  assert.equal(normalizeOffImages({}, code).imageQuality, 'missing');
});
