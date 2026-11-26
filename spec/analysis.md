# Repository analysis
## Input
A **GitHub repository** URL, or a local directory
## Output
Every **project skill**: **name**, **description**, **link**, its *copies*
## Architecture
Core: fetch → find → parse → merge copies. CLI: a *thin client*.
Skill: id = `repo:path`, name, description, commit, copies
## What a project skill is
A skill an agent loads when it works *in this repository*:
`<dir>/<skills root>/<skill>/SKILL.md`, where
- **skills root**: an agent's skill folder, in this order:
  `.agents/skills`, `.claude/skills`, `.github/skills`, `.agent/skills`,
  `.cursor/skills`, `.gemini/skills`, `.opencode/skills`
- **dir**: the repository root, *or any directory under it* (agents load nested
  skills in monorepos)
- **skill**: exactly one directory level; it names the skill
- `SKILL.md`: exactly that name, case included

Not a project skill, so *not listed and no warning*:
- `SKILL.md` anywhere else: bundled in a product's resources, test data, a skill
  library's `skills/<name>/`, the repository root
- `<root>/SKILL.md` (no skill directory); `<root>/<skill>/<sub>/SKILL.md` (a file of the
  skill `<skill>`)
- `skill.md`, `SKILL.md.ft` and other names
- a **symbolic link**: not followed, its target is listed where it is
## Copies
- **One skill** in several roots of the same `<dir>`: same *name* and same *description*;
  the body may differ (a generated mirror)
- Listed once, at the first root in the order above; the others are its *copies*
- Same directory, other name or description → *two skills*
- Same skill under two different `<dir>`s → *two skills*
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- With `GITHUB_TOKEN`: code search, the whole default branch
- Without: the git tree; when GitHub truncates it, only the skills roots at the
  repository root, with a *warning*
- A listed file missing at the scanned commit (a stale search) → a *warning*, skipped
- The name: front matter, else the skill directory
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, no description, the scan goes on
- Unreachable repository → a clear message, exit code 1
