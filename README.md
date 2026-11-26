# Skill Atlas

Every agent skill in a repository: `./skill-atlas scan` finds each `SKILL.md` and prints its name,
description and link.

```console
$ npm ci
$ ./skill-atlas scan https://github.com/JetBrains/kotlin
JetBrains/kotlin · 6 skills
…
build-tools-bump-gradle-api — Bumps the Gradle API version that Kotlin Gradle plugins are compiled against in the Kotlin compiler repository.
  https://github.com/JetBrains/kotlin/blob/5ab6270ab772d113e8ad52ebfcaa0109c522ae00/.claude/skills/build-tools-bump-gradle-api/SKILL.md
…
```

Set `GITHUB_TOKEN` for a higher GitHub rate limit. `npm test` runs the tests, offline.

The end-to-end tests replay what GitHub answered for real repositories at pinned commits
([tests/e2e/repositories.ts](tests/e2e/repositories.ts)). To add a repository or move one to a newer
commit: edit that file, run `GITHUB_TOKEN=$(gh auth token) npm run record`, then
`UPDATE_EXPECTED=1 npm test`, and review the diff of `tests/e2e/expected/`.

- [spec/](spec/): what it does. [AGENTS.md](AGENTS.md): the definition of done.
- [fixture/](fixture/README.md): a small repository for the tests.
