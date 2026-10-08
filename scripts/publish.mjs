import * as fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { compileCatalog } from '../lib/catalog.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!token || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository || '')) throw new Error('Run this publisher with the repository GitHub Actions workflow.');
const base = `https://api.github.com/repos/${repository}`;
async function api(route, method = 'GET', body) {
  const response = await fetch(base + route, { method, signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(`GitHub ${method} ${route.split('?')[0]} returned ${response.status}`);
  return response.status === 204 ? null : response.json();
}
async function all(route) {
  const result = [];
  for (let page = 1; ; page++) {
    const batch = await api(`${route}${route.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    result.push(...batch);
    if (batch.length < 100) return result;
  }
}
const issues = await all('/issues?state=all&sort=created&direction=asc');
const { catalog, outcomes } = compileCatalog(issues);
try {
  const previous = JSON.parse(await fs.readFile('catalog.json', 'utf8'));
  if (JSON.stringify(previous.profiles) === JSON.stringify(catalog.profiles)) catalog.generatedAt = previous.generatedAt;
} catch { /* First publication. */ }
await fs.mkdir('profiles', { recursive: true });
const wanted = new Set(catalog.profiles.map((entry) => `${entry.id}.json`));
for (const file of await fs.readdir('profiles')) {
  if (/^profile-[0-9]+\.json$/u.test(file) && !wanted.has(file)) await fs.unlink(`profiles/${file}`);
}
for (const entry of catalog.profiles) await fs.writeFile(`profiles/${entry.id}.json`, JSON.stringify(entry.profile, null, 2) + '\n');
await fs.writeFile('catalog.json', JSON.stringify(catalog, null, 2) + '\n');

// Git arguments and paths are fixed. No issue text is interpolated into shell commands.
execFileSync('git', ['add', '--', 'catalog.json', 'profiles']);
let changed = false;
try { execFileSync('git', ['diff', '--cached', '--quiet']); }
catch (error) { if (error.status === 1) changed = true; else throw error; }
if (changed) {
  execFileSync('git', ['commit', '-m', 'chore: publish community OCR configurations'], { stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' });
}

// Acknowledgements happen only after publication succeeds. Closed contributions
// remain the source of truth; editing their JSON publishes a new revision.
let event = {};
if (process.env.GITHUB_EVENT_PATH) event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
for (const issue of issues) {
  const outcome = outcomes.get(issue.number);
  if (!outcome || (issue.state !== 'open' && issue.number !== event.issue?.number)) continue;
  const marker = '<!-- gsm-catalog-bot -->';
  const message = outcome.status === 'published' ? `Published as [${outcome.id}](https://github.com/${repository}/blob/main/profiles/${outcome.id}.json). Refresh the community library in GSM in a few minutes. Edit the JSON in this issue to update it. Close as **not planned** to withdraw it.` :
    outcome.status === 'verified' ? 'Verification recorded. Only the latest report from each independent GitHub account counts for this revision. Refresh the community library in GSM in a few minutes.' :
    outcome.status === 'stale' ? 'This report refers to a configuration revision that is no longer published. Download the current revision in GSM before testing and submitting a new report.' :
    `Could not publish this submission: ${outcome.message} Edit the issue body to retry automatically.`;
  const body = `${marker}\n${message}`;
  const comments = await all(`/issues/${issue.number}/comments`);
  const previous = comments.find((comment) => comment.user?.login === 'github-actions[bot]' && comment.body?.startsWith(marker));
  if (!previous) await api(`/issues/${issue.number}/comments`, 'POST', { body });
  else if (previous.body !== body) await api(`/issues/comments/${previous.id}`, 'PATCH', { body });
  if (outcome.status !== 'invalid' && issue.state === 'open') await api(`/issues/${issue.number}`, 'PATCH', { state: 'closed', state_reason: 'completed' });
}
console.log(`Published ${catalog.profiles.length} configurations; processed ${outcomes.size} submissions.`);
