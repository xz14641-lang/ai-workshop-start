import { findSkills, type SkillFile } from './find.ts';
import { sortSkills, type Repository, type Skill } from './model.ts';
import { parseSkill } from './parse.ts';

/** A repository to scan: its files, and how to read them. */
export type Source = {
  repository: Repository;
  /** Every file path, relative to the repository root. */
  paths: string[];
  /** What listing the files had to leave out. */
  warnings: string[];
  /** The file's bytes, or undefined if it is not there. */
  read(path: string): Promise<Uint8Array | undefined>;
};

export type ScanResult = { repository: Repository; skills: Skill[]; warnings: string[] };

/** fetch → find → parse → merge copies. Nothing is stored: the result is all there is. */
export async function scan(source: Source): Promise<ScanResult> {
  const files = findSkills(source.paths);
  // The files are read at the same time: on GitHub, each one is a request.
  const results = await Promise.all(files.map((file) => readSkill(source, file)));
  const read = results.flatMap((result, index) => (result.skill ? [{ skill: result.skill, file: files[index] }] : []));
  return {
    repository: source.repository,
    skills: sortSkills(mergeCopies(read)),
    warnings: [...source.warnings, ...results.flatMap((result) => (result.warning ? [result.warning] : []))],
  };
}

/**
 * One skill in several skills roots of the same directory, with the same name and description,
 * is listed once: at the first root in SKILL_ROOTS, with the others as its copies.
 */
function mergeCopies(read: { skill: Skill; file: SkillFile }[]): Skill[] {
  const byRoot = [...read].sort((a, b) => a.file.root - b.file.root);
  const originals = new Map<string, Skill>();
  for (const { skill, file } of byRoot) {
    const key = JSON.stringify([file.dir, skill.name, skill.description]);
    const original = originals.get(key);
    if (original) original.copies.push(skill.path);
    else originals.set(key, skill);
  }
  return [...originals.values()];
}

async function readSkill(source: Source, file: SkillFile): Promise<{ skill?: Skill; warning?: string }> {
  const bytes = await source.read(file.path);
  if (!bytes) return { warning: `${file.path}: listed, but not found at the scanned commit; skipped` };
  const parsed = parseSkill(new TextDecoder().decode(bytes));
  const skill: Skill = {
    id: `${source.repository.id}:${file.path}`,
    repository: source.repository.id,
    path: file.path,
    name: parsed.name ?? file.name,
    description: parsed.description,
    commit: source.repository.commit,
    copies: [],
  };
  return { skill, warning: parsed.warning && `${file.path}: ${parsed.warning}` };
}
