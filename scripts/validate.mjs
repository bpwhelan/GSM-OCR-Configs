import * as fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { parseOcrCatalog, parseOcrProfile } from '../lib/ocr_profiles.ts';
import { revisionOf } from '../lib/catalog.mjs';
const catalog = parseOcrCatalog(JSON.parse(await fs.readFile('catalog.json', 'utf8')));
for (const entry of catalog.profiles) {
  assert.equal(revisionOf(entry.profile), entry.revision);
  const profile = parseOcrProfile(JSON.parse(await fs.readFile(`profiles/${entry.id}.json`, 'utf8')));
  assert.deepEqual(profile, entry.profile);
}
const files = (await fs.readdir('profiles')).filter((file) => file.endsWith('.json'));
assert.equal(files.length, catalog.profiles.length, 'Orphaned or unsupported profile files');
console.log(`Validated ${catalog.profiles.length} configurations.`);
