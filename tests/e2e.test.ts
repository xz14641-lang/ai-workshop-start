// End to end, on real repositories pinned to a commit: the CLI's output from what GitHub answered,
// recorded in tests/e2e/recordings/ by `npm run record`. Both ways of listing are checked: the git
// tree (no token) and code search (GITHUB_TOKEN). UPDATE_EXPECTED=1 rewrites tests/e2e/expected/.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { replay, type Recording } from '../src/core/replay.ts';
import { atlasWith } from './helpers.ts';
import { recordingPath, REPOSITORIES } from './e2e/repositories.ts';

const TRUNCATED = /^warning: the tree is too large to list at once; looked only in \.agents\/skills, /;

/** Both ways of listing a recorded repository, as the CLI prints them. */
async function scanBoth(id: string) {
  const fetch = replay(JSON.parse(readFileSync(recordingPath(id), 'utf8')) as Recording);
  const url = `https://github.com/${id}`;
  return { tree: await atlasWith(['scan', url], fetch), search: await atlasWith(['scan', url], fetch, 'token') };
}

/** The skills' lines: `name — first sentence`, the link, `also in …`. */
const lines = (stdout: string) => stdout.split('\n').slice(1);

for (const { id, commit } of REPOSITORIES) {
  test(`${id}@${commit.slice(0, 7)}: the same output from the git tree and from code search, as expected`, async () => {
    const { tree, search } = await scanBoth(id);
    assert.equal(tree.code, 0, tree.stderr);
    assert.equal(search.code, 0, search.stderr);
    assert.equal(tree.stdout, search.stdout);
    assert.equal(search.stderr, '');

    const expected = new URL(`./e2e/expected/${id.replace('/', '-')}.txt`, import.meta.url);
    if (process.env.UPDATE_EXPECTED) {
      mkdirSync(new URL('./', expected), { recursive: true });
      writeFileSync(expected, `${search.stdout}\n`);
    }
    assert.ok(existsSync(expected), `${expected.pathname} is missing: run UPDATE_EXPECTED=1 npm test, and review it`);
    assert.equal(`${search.stdout}\n`, readFileSync(expected, 'utf8'));
    for (const link of lines(search.stdout).filter((line) => line.startsWith('  https://'))) {
      assert.ok(link.startsWith(`  https://github.com/${id}/blob/${commit}/`), link);
    }
  });
}

test('JetBrains/MPS: every skill in .agents/skills with its copy in .claude/skills; skills bundled in a plugin are not project skills', async () => {
  const { tree, search } = await scanBoth('JetBrains/MPS');
  assert.match(search.stdout, /^JetBrains\/MPS · 43 skills\n/);
  const skills = lines(search.stdout);
  const links = skills.filter((line) => line.startsWith('  https://'));
  const copies = skills.filter((line) => line.startsWith('  also in '));
  assert.equal(links.length, 43);
  assert.ok(links.every((link) => /\/\.agents\/skills\/[^/]+\/SKILL\.md$/.test(link)));
  assert.deepEqual(
    copies,
    links.map((link) => `  also in ${link.replace(/^.*\/\.agents\/skills\//, '.claude/skills/')}`),
  );
  // Search found them; they are not listed.
  assert.match(readFileSync(recordingPath('JetBrains/MPS'), 'utf8'), /"path":"plugins\/mcp-tools\/resources\/[\w/.-]+\/skills\/[\w-]+\/SKILL\.md"/);
  assert.ok(!links.some((link) => link.includes('/plugins/')));
  // The tree is too large for one answer; its skills roots are at the repository root.
  assert.match(tree.stderr, TRUNCATED);
});

test('JetBrains/android: no project skill; a lowercase skill.md is not one', async () => {
  const { tree, search } = await scanBoth('JetBrains/android');
  assert.equal(search.stdout, 'JetBrains/android · 0 skills');
  assert.match(tree.stderr, TRUNCATED);
  const recording = readFileSync(recordingPath('JetBrains/android'), 'utf8');
  assert.match(recording, /"path":"automation\/sponge-scripts\/skill\.md"/); // what search found
});

test('JetBrains/koog: two skills in .claude/skills; SKILL.md files in test resources are not project skills', async () => {
  const { tree, search } = await scanBoth('JetBrains/koog');
  assert.match(search.stdout, /^JetBrains\/koog · 2 skills\n/);
  assert.ok(!lines(search.stdout).some((line) => line.includes('integration-tests/')));
  assert.match(readFileSync(recordingPath('JetBrains/koog'), 'utf8'), /integration-tests\/src\/jvmTest\/resources\/skills\/[\w-]+\/SKILL\.md/);
  assert.equal(tree.stderr, ''); // the whole tree in one answer
});
