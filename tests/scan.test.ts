// The decisions in spec/analysis.md and spec/cli.md, checked on what the real command prints for
// ./fixture, for temporary directories and for small GitHub repositories answered from recordings.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { findSkills, SKILL_ROOTS } from '../src/core/find.ts';
import { openGitHub, type Fetch } from '../src/core/github.ts';
import { parseSkill } from '../src/core/parse.ts';
import { replay, type Recording } from '../src/core/replay.ts';
import { scan } from '../src/core/scan.ts';
import { openDirectory } from '../src/local.ts';
import { atlas, CLI, EXAMPLE_COMMIT, FIXTURE } from './helpers.ts';

const fixture = await atlas(['scan', FIXTURE]);
const example = await atlas(['scan', 'github.com/JetBrains/example']);

test('malformed front matter → the directory name, no description and a warning', () => {
  const parsed = parseSkill(readFileSync(join(FIXTURE, '.agents/skills/release-checklist/SKILL.md'), 'utf8'));
  assert.equal(parsed.name, undefined);
  assert.equal(parsed.description, '');
  assert.equal(
    parsed.warning,
    'malformed front matter: Nested mappings are not allowed in compact mappings at line 3, column 14; using the directory name',
  );
});

test('scan prints the repository, then each skill with its first sentence and pinned link', () => {
  assert.equal(example.code, 0, example.stderr);
  assert.equal(
    example.stdout,
    [
      'JetBrains/example · 1 skill',
      'commits — Write commit messages the way this repository does.',
      `  https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
    ].join('\n'),
  );
});

test('./fixture: every project skill, sorted by name then path, linked to its file, copies, a warning for the malformed one', () => {
  const root = pathToFileURL(FIXTURE).href;
  assert.equal(fixture.code, 0);
  assert.equal(
    fixture.stdout,
    [
      'fixture · 8 skills',
      "code-style — Follow the project's code style.",
      `  ${root}/.github/skills/code-style/SKILL.md`,
      'commits — Write commit messages the way this repository does.',
      `  ${root}/.claude/skills/commits/SKILL.md`,
      'commits — Write commit messages in the imperative mood.',
      `  ${root}/.github/skills/commits/SKILL.md`,
      'migrations — Write a database migration for the billing service.',
      `  ${root}/services/billing/.claude/skills/migrations/SKILL.md`,
      'onboarding — Set up a development machine for this repository.',
      `  ${root}/.agent/skills/onboarding/SKILL.md`,
      'release-checklist',
      `  ${root}/.agents/skills/release-checklist/SKILL.md`,
      'testing — Run the tests the way CI does.',
      `  ${root}/.agents/skills/testing/SKILL.md`,
      '  also in .claude/skills/testing/SKILL.md',
      'testing — Run the tests the way CI does.',
      `  ${root}/services/billing/.claude/skills/testing/SKILL.md`,
    ].join('\n'),
  );
  assert.equal(fixture.stderr.split('\n').length, 1, fixture.stderr);
  assert.match(fixture.stderr, /^warning: \.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('a project skill is <dir>/<skills root>/<skill>/SKILL.md; any other SKILL.md is not one', async () => {
  const { skills } = await scan(await openDirectory(FIXTURE));
  const paths = skills.flatMap((skill) => [skill.path, ...skill.copies]);
  for (const path of [
    'SKILL.md', // the repository root
    '.claude/skills/SKILL.md', // no skill directory
    '.claude/skills/commits/templates/SKILL.md', // a file of the skill commits
    '.claude/skills/lowercase/skill.md', // another name
    'agent/skills/no-dot/SKILL.md', // not a skills root
    'skills/library/SKILL.md', // a skill library
    'plugins/assistant/resources/bundledSkills/refactor/SKILL.md', // bundled with a product
    'tests/testData/frontend/SKILL.md', // test data
  ]) {
    assert.ok(!paths.includes(path), path);
  }
  for (const root of SKILL_ROOTS) {
    assert.deepEqual(findSkills([`${root}/x/SKILL.md`, `a/b/${root}/y/SKILL.md`]).map((file) => file.name), ['x', 'y'], root);
  }
});

test('copies: same directory, name and description; listed once, at the first root', async () => {
  const { skills } = await scan(await openDirectory(FIXTURE));
  const testing = skills.filter((skill) => skill.name === 'testing');
  assert.deepEqual(
    testing.map((skill) => [skill.path, skill.copies]),
    [
      ['.agents/skills/testing/SKILL.md', ['.claude/skills/testing/SKILL.md']],
      ['services/billing/.claude/skills/testing/SKILL.md', []], // another directory: another skill
    ],
  );
  const commits = skills.filter((skill) => skill.name === 'commits');
  assert.deepEqual(commits.map((skill) => skill.copies), [[], []]); // another description: two skills
});

test('a symbolic link is not followed: its target is the skill', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.agents/skills/linked'), { recursive: true });
  mkdirSync(join(root, '.claude/skills'), { recursive: true });
  writeFileSync(join(root, '.agents/skills/linked/SKILL.md'), '---\nname: linked\ndescription: Linked.\n---\n');
  symlinkSync('../../.agents/skills/linked', join(root, '.claude/skills/linked'));
  symlinkSync('../../.agents/skills/linked/SKILL.md', join(root, '.claude/skills/file-link'));
  const { skills, warnings } = await scan(await openDirectory(root));
  assert.deepEqual(skills.map((skill) => [skill.path, skill.copies]), [['.agents/skills/linked/SKILL.md', []]]);
  assert.deepEqual(warnings, []);
});

test('the CLI prints the result at once and stores nothing', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const scanned = spawnSync(process.execPath, [CLI, 'scan', FIXTURE], { cwd, encoding: 'utf8' });
  assert.equal(scanned.status, 0, scanned.stderr);
  assert.equal(scanned.stdout, `${fixture.stdout}\n`);
  assert.deepEqual(readdirSync(cwd), []);
});

test('unreachable repository → a clear message, exit code 1', async () => {
  const missing = spawnSync(process.execPath, [CLI, 'scan', join(FIXTURE, 'no-such-directory')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /^Not a GitHub URL or a readable directory: .*no-such-directory\n$/);

  // What GitHub answers for a repository that does not exist.
  const notFound = replay({ 'https://api.github.com/repos/JetBrains/no-such-repository': { status: 404, body: { message: 'Not Found' } } });
  await assert.rejects(openGitHub('https://github.com/JetBrains/no-such-repository', { fetch: notFound }), {
    message: 'Repository not found: https://github.com/JetBrains/no-such-repository',
  });

  const offline = await atlas(['scan', 'https://github.com/JetBrains/not-answered']);
  assert.equal(offline.code, 1);
  assert.match(offline.stderr, /^Cannot reach GitHub: not recorded: https:\/\/api\.github\.com\/repos\/JetBrains\/not-answered$/);
});

test('rate limit → a message that asks for GITHUB_TOKEN', async () => {
  const limited = replay({
    'https://api.github.com/repos/JetBrains/MPS': {
      status: 403,
      body: { message: 'API rate limit exceeded for 192.0.2.1. (But here is the good news: ...)' },
    },
  });
  await assert.rejects(openGitHub('https://github.com/JetBrains/MPS', { fetch: limited }), {
    message: 'GitHub rate limit reached; set GITHUB_TOKEN',
  });
});

const SHA = EXAMPLE_COMMIT;
const SKILL = (name: string) => `---\nname: ${name}\ndescription: The ${name} skill.\n---\n`;

/** JetBrains/tree, without a token: the git tree, then the files. */
function treeRepository(tree: unknown, more: Recording = {}): Fetch {
  return replay({
    'https://api.github.com/repos/JetBrains/tree': { status: 200, body: { full_name: 'JetBrains/tree', default_branch: 'main' } },
    'https://api.github.com/repos/JetBrains/tree/commits/main': { status: 200, body: { sha: SHA } },
    [`https://api.github.com/repos/JetBrains/tree/git/trees/${SHA}?recursive=1`]: { status: 200, body: tree },
    [`https://raw.githubusercontent.com/JetBrains/tree/${SHA}/.agents/skills/a/SKILL.md`]: { status: 200, body: SKILL('a') },
    [`https://raw.githubusercontent.com/JetBrains/tree/${SHA}/.claude/skills/a/SKILL.md`]: { status: 200, body: `${SKILL('a')}<!-- generated -->\n` },
    [`https://raw.githubusercontent.com/JetBrains/tree/${SHA}/web/.github/skills/b/SKILL.md`]: { status: 200, body: SKILL('b') },
    ...more,
  });
}

const blob = (path: string, mode = '100644') => ({ path, mode, type: 'blob', sha: path });

test('GitHub without a token: the git tree; nested roots, copies, no symbolic links', async () => {
  const fetch = treeRepository({
    truncated: false,
    tree: [
      blob('.agents/skills/a/SKILL.md'),
      blob('.claude/skills/a/SKILL.md'),
      blob('.cursor/skills/a', '120000'), // a symbolic link to .agents/skills/a
      blob('web/.github/skills/b/SKILL.md'),
      blob('resources/bundledSkills/c/SKILL.md'),
    ],
  });
  const { skills, warnings } = await scan(await openGitHub('https://github.com/JetBrains/tree', { fetch }));
  assert.deepEqual(
    skills.map((skill) => [skill.path, skill.copies]),
    [
      ['.agents/skills/a/SKILL.md', ['.claude/skills/a/SKILL.md']],
      ['web/.github/skills/b/SKILL.md', []],
    ],
  );
  assert.deepEqual(warnings, []);
});

test('GitHub, a truncated tree: only the skills roots at the repository root, with a warning', async () => {
  const tree = (sha: string, entries: unknown[]) => ({
    [`https://api.github.com/repos/JetBrains/tree/git/trees/${sha}`]: { status: 200, body: { truncated: false, tree: entries } },
  });
  const dir = (path: string) => ({ path, mode: '040000', type: 'tree', sha: path });
  const fetch = treeRepository(
    { truncated: true, tree: [] },
    {
      ...tree(SHA, [dir('.agents'), dir('.claude'), dir('web')]),
      ...tree('.agents', [dir('skills')]),
      ...tree('.claude', [dir('skills')]),
      ...tree('web', [dir('.github')]),
      'https://api.github.com/repos/JetBrains/tree/git/trees/skills?recursive=1': { status: 200, body: { truncated: false, tree: [blob('a/SKILL.md')] } },
    },
  );
  const { skills, warnings } = await scan(await openGitHub('https://github.com/JetBrains/tree', { fetch }));
  // Both roots answer with the same recorded subtree, so .claude/skills/a reads the generated copy.
  assert.deepEqual(skills.map((skill) => [skill.path, skill.copies]), [['.agents/skills/a/SKILL.md', ['.claude/skills/a/SKILL.md']]]);
  assert.match(warnings[0], /^the tree is too large to list at once; looked only in \.agents\/skills, /);
});

test('a listed file missing at the scanned commit → a warning, skipped', async () => {
  const fetch = treeRepository(
    { truncated: false, tree: [blob('.agents/skills/a/SKILL.md'), blob('.claude/skills/gone/SKILL.md')] },
    { [`https://raw.githubusercontent.com/JetBrains/tree/${SHA}/.claude/skills/gone/SKILL.md`]: { status: 404, body: '404: Not Found' } },
  );
  const { skills, warnings } = await scan(await openGitHub('https://github.com/JetBrains/tree', { fetch }));
  assert.deepEqual(skills.map((skill) => skill.path), ['.agents/skills/a/SKILL.md']);
  assert.deepEqual(warnings, ['.claude/skills/gone/SKILL.md: listed, but not found at the scanned commit; skipped']);
});
