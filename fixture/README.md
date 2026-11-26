# fixture

A small repository for the tests: one case of [spec/analysis.md](../spec/analysis.md) each.

| Path | Case |
| --- | --- |
| `.claude/skills/commits` | a skill |
| `.github/skills/code-style` | a skill in another agent's folder |
| `.agents/skills/release-checklist` | malformed front matter |
| `.agents/skills/testing`, `.claude/skills/testing` | one skill and its copy, a generated mirror |
| `.github/skills/commits` | same directory as `.claude/skills/commits`, another description: two skills |
| `services/billing/.claude/skills/migrations` | a skills root nested in a directory |
| `services/billing/.claude/skills/testing` | same skill as `.agents/skills/testing`, another directory: two skills |
| `.agent/skills/onboarding` | a skills root of another agent |
| `SKILL.md` | not a skill: the repository root |
| `.claude/skills/SKILL.md` | not a skill: no skill directory |
| `.claude/skills/commits/templates/SKILL.md` | not a skill: a file of the skill `commits` |
| `.claude/skills/lowercase/skill.md` | not a skill: another name |
| `agent/skills/no-dot` | not a skill: not a skills root |
| `skills/library` | not a skill: a skill library |
| `plugins/assistant/resources/bundledSkills/refactor` | not a skill: bundled with a product |
| `tests/testData/frontend` | not a skill: test data |

A symbolic link can't be relied on in a checkout, so the tests make their own.
