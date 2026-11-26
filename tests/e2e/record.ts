// Records what GitHub answers for the repositories in REPOSITORIES, at their pinned commits, into
// tests/e2e/recordings/, so the end-to-end tests replay real answers offline.
//   GITHUB_TOKEN=$(gh auth token) npm run record
// To move a repository to a newer commit, change its commit below, record, and review the diff
// of tests/e2e/expected/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { openGitHub, type Fetch } from '../../src/core/github.ts';
import type { Recording } from '../../src/core/replay.ts';
import { scan } from '../../src/core/scan.ts';
import { REPOSITORIES, recordingPath } from './repositories.ts';

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('Set GITHUB_TOKEN: recording both modes takes more requests than the anonymous limit');

for (const { id, commit } of REPOSITORIES) {
  const recording: Recording = {};
  const recorder: Fetch = async (url, init) => {
    // The default branch resolves to the pinned commit, whatever it is today.
    if (/\/repos\/[^/]+\/[^/]+\/commits\/[^/]+$/.test(url)) {
      recording[url] = { status: 200, body: { sha: commit } };
      return new Response(JSON.stringify({ sha: commit }));
    }
    // Authorized either way, so recording is not rate limited; the mode follows the `token` option.
    const response = await fetch(url, { headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
    const text = await response.text();
    const json = response.headers.get('content-type')?.includes('json');
    recording[url] = { status: response.status, body: json ? trim(url, JSON.parse(text)) : text };
    return new Response(json ? JSON.stringify(recording[url].body) : text, { status: response.status });
  };
  const url = `https://github.com/${id}`;
  const tree = await scan(await openGitHub(url, { fetch: recorder })); // the git tree, at the commit
  const search = await scan(await openGitHub(url, { fetch: recorder, token })); // code search
  mkdirSync(new URL('./recordings/', import.meta.url), { recursive: true });
  writeFileSync(recordingPath(id), format(recording));
  console.log(`${id}@${commit}: ${tree.skills.length} skills from the tree, ${search.skills.length} from search`);
}

/**
 * Only what Skill Atlas reads: a repository's name and default branch; a search result's paths;
 * a git tree entry's path, mode and type, and its sha where the tree is walked one level at a time.
 * A truncated tree is never read past its `truncated` flag, and is tens of megabytes, so its
 * entries go.
 */
function trim(url: string, body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return body;
  if ('full_name' in body && 'default_branch' in body) {
    return { full_name: body.full_name, default_branch: body.default_branch };
  }
  if ('items' in body && Array.isArray(body.items)) {
    const { total_count, items } = body as { total_count: number; items: { path: string }[] };
    return { total_count, items: items.map(({ path }) => ({ path })) };
  }
  if ('tree' in body && Array.isArray(body.tree)) {
    const { truncated, tree } = body as { truncated: boolean; tree: Record<string, unknown>[] };
    const walked = !url.endsWith('?recursive=1');
    const entries = tree.map(({ path, mode, type, sha }) => (walked ? { path, mode, type, sha } : { path, mode, type }));
    return { truncated, tree: truncated ? [] : entries };
  }
  return body;
}

/** One answer a line, by URL, so a new recording's diff shows what changed. */
function format(recording: Recording): string {
  const entries = Object.entries(recording).sort(([a], [b]) => (a < b ? -1 : 1));
  return `{\n${entries.map(([url, answer]) => `${JSON.stringify(url)}: ${JSON.stringify(answer)}`).join(',\n')}\n}\n`;
}
