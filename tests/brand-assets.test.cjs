require('./register.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {failureIllustration}=require('../lib/failureIllustration.ts');
test('network artwork stays distinct from backend errors including plain service error objects',()=>{
 assert.equal(failureIllustration(new Error('Network request failed')),'offline');
 assert.equal(failureIllustration({message:'TypeError: Failed to fetch'}),'offline');
 assert.equal(failureIllustration({message:'permission denied for table products'}),'dataError');
 assert.equal(failureIllustration(null),'dataError');
});
test('every approved PNG is packaged with its declared dimensions',()=>{
 for(const asset of require('../assets/config/asset-manifest.json').assets){
  const bytes=fs.readFileSync(path.join(path.dirname(require.resolve('../package.json')),'assets',asset.relativePath));
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(bytes.readUInt32BE(16),asset.width,asset.relativePath);
  assert.equal(bytes.readUInt32BE(20),asset.height,asset.relativePath);
 }
});
