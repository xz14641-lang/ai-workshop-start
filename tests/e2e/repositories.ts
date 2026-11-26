import { fileURLToPath } from 'node:url';

/** Real repositories, each pinned to a commit; their GitHub answers are in recordings/. */
export const REPOSITORIES = [
  // A truncated tree; every skill in .agents/skills with a copy in .claude/skills; skills bundled
  // in a plugin's resources.
  { id: 'JetBrains/MPS', commit: '1cbf7f783dbc5c74c8e5231d31f61b02829143de' },
  // A truncated tree; no project skill, only a lowercase skill.md.
  { id: 'JetBrains/android', commit: '294d4c098cb833f7a457cd891a125de82d4e1715' },
  // A whole tree; skills in .claude/skills; SKILL.md files in test resources.
  { id: 'JetBrains/koog', commit: '709079e4a34d6c9234583352550e6a2b88a0bb85' },
];

export function recordingPath(id: string): string {
  return fileURLToPath(new URL(`./recordings/${id.replace('/', '-')}.json`, import.meta.url));
}
