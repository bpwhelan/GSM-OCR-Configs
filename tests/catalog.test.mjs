import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileCatalog, revisionOf } from '../lib/catalog.mjs';
import { OCR_PROFILE_MARKER, OCR_VERIFICATION_MARKER } from '../lib/ocr_profiles.ts';

const profile = () => ({ schemaVersion: 1, name: 'Dialogue', game: { title: 'Test Game', executableNames: ['game.exe'], platform: 'windows', language: 'ja' }, notes: '', resolution: { width: 1920, height: 1080 }, areas: [{ coordinates: [0.1, 0.7, 0.8, 0.2] }] });
const issue = (number, data, marker = OCR_PROFILE_MARKER, user = { id: 1, login: 'author', type: 'User' }) => ({ number, body: `${marker}\n\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\``, user, updated_at: '2026-10-08T10:00:00Z', created_at: '2026-10-08T10:00:00Z', labels: [], state: 'open' });
const report = (revision, result = 'works') => ({ schemaVersion: 1, profileId: 'profile-1', revision, result, resolution: { width: 1280, height: 720 }, settingsApplied: false, notes: '' });
const viewer = { id: 2, login: 'viewer', type: 'User' };

test('publishes only validated data and derives identity and attribution from GitHub', () => {
 const result = compileCatalog([issue(1, { ...profile(), author: 'forged', id: '../../path', password: 'secret', settings: { scanRate: 0.5, token: 'secret' } })]);
 assert.equal(result.catalog.profiles.length, 1);
 const entry = result.catalog.profiles[0];
 assert.equal(entry.id, 'profile-1'); assert.equal(entry.author, 'author');
 assert.equal(entry.revision, revisionOf(entry.profile));
 assert.ok(!JSON.stringify(entry).includes('secret'));
 assert.equal(result.outcomes.get(1).status, 'published');
});
test('rejects bad JSON, oversized data, invalid coordinates, unsupported versions, bots, and pull requests', () => {
 const bad = issue(2, profile()); bad.body = OCR_PROFILE_MARKER + '\n```json\n{}\n```\n```json\n{}\n```';
 const huge = issue(3, profile()); huge.body += 'x'.repeat(70_000);
 const entries = [issue(1, { ...profile(), schemaVersion: 2 }), bad, huge, issue(4, { ...profile(), areas: [{ coordinates: [0, 0, -1, 1] }] }), { ...issue(5, profile()), pull_request: {} }, issue(6, profile(), OCR_PROFILE_MARKER, { ...viewer, type: 'Bot' })];
 assert.equal(compileCatalog(entries).catalog.profiles.length, 0);
});
test('counts the latest independent account report once and ignores self-verification', () => {
 const p = issue(1, profile()); const revision = revisionOf(profile());
 const good = issue(2, report(revision), OCR_VERIFICATION_MARKER, viewer);
 const later = { ...issue(3, report(revision, 'needsWork'), OCR_VERIFICATION_MARKER, viewer), updated_at: '2026-10-08T11:00:00Z' };
 const self = issue(4, report(revision), OCR_VERIFICATION_MARKER);
 assert.deepEqual(compileCatalog([later, self, p, good]).catalog.profiles[0].verification, { works: 0, needsWork: 1 });
});
test('profile edits invalidate old confirmations; account renames cannot multiply votes', () => {
 const revision = revisionOf(profile());
 const good = issue(2, report(revision), OCR_VERIFICATION_MARKER, viewer);
 const rename = issue(3, report(revision), OCR_VERIFICATION_MARKER, { ...viewer, login: 'renamed' });
 assert.equal(compileCatalog([issue(1, profile()), good, rename]).catalog.profiles[0].verification.works, 1);
 assert.equal(compileCatalog([issue(1, { ...profile(), notes: 'New setup' }), good]).catalog.profiles[0].verification.works, 0);
});
test('closed accepted issues remain published; withdrawn, hidden, and deleted contributions disappear', () => {
 const accepted = { ...issue(1, profile()), state: 'closed', state_reason: 'completed' };
 assert.equal(compileCatalog([accepted]).catalog.profiles.length, 1);
 assert.equal(compileCatalog([{ ...accepted, state_reason: 'not_planned' }]).catalog.profiles.length, 0);
 assert.equal(compileCatalog([{ ...accepted, labels: [{ name: 'hidden' }] }]).catalog.profiles.length, 0);
 assert.equal(compileCatalog([]).catalog.profiles.length, 0);
});
test('ordinary issues are ignored and user-supplied scripts stay inert text', () => {
 const p = profile(); p.notes = '$(echo unsafe) <script>alert(1)</script> `${process.env.GITHUB_TOKEN}`';
 const result = compileCatalog([issue(1, p), { ...issue(2, profile()), body: 'Please help' }]);
 assert.equal(result.catalog.profiles[0].profile.notes, p.notes);
 assert.equal(result.outcomes.size, 1);
});
