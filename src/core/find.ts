/** A project skill's SKILL.md: where it is and what it is called before it is read. */
export type SkillFile = {
  path: string;
  /** The skill directory's name. */
  name: string;
  /** The directory the skills root is in: '' for the repository root. */
  dir: string;
  /** The skills root's index in SKILL_ROOTS: the lower, the more it is the original. */
  root: number;
};

/** Where agents keep a repository's own skills, the original first: see spec/analysis.md. */
export const SKILL_ROOTS = [
  '.agents/skills',
  '.claude/skills',
  '.github/skills',
  '.agent/skills',
  '.cursor/skills',
  '.gemini/skills',
  '.opencode/skills',
];

/**
 * The project skills: `<dir>/<skills root>/<skill>/SKILL.md`, at the repository root or nested.
 * Any other SKILL.md (resources, test data, a file of a skill) is not one.
 */
export function findSkills(paths: string[]): SkillFile[] {
  const files: SkillFile[] = [];
  for (const path of [...paths].sort()) {
    const segments = path.split('/');
    if (segments.length < 4 || segments.at(-1) !== 'SKILL.md') continue;
    const root = SKILL_ROOTS.indexOf(segments.slice(-4, -2).join('/'));
    if (root < 0) continue;
    files.push({ path, name: segments.at(-2)!, dir: segments.slice(0, -4).join('/'), root });
  }
  return files;
}
