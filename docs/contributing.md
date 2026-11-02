# Contributing

## Add an agent

Create a Markdown file in `agents/`. The frontmatter holds `description`,
`mode`, `color`, and `permissions`. The body is the system prompt. Add a row for
the agent to the table in `README.md`.

Rules are appended after the global baseline, and the last match wins. Read
[permissions.md](permissions.md) before writing the list.

A subagent that touches git must copy the guard block from the closest existing
agent, because each agent file keeps its own copy and there is no shared include.

## Add a skill

Create a folder under `skills/` with a `SKILL.md`. The frontmatter holds `name`
and `description`. The description decides when the model loads the skill, so
state the trigger.

## Write documents

Dispatch `scribe`. It is the only writer of `README.md`, `GLOSSARY.md`,
`GLOSSARY-MAP.md`, and files under `docs/`. `plan` and `build` both reach it.
Scribe loads the `docs-writing` skill for README and docs pages. It fixes the
page types, the page shape, the length limits, and the compaction rules.

The brief needs the target, the decision, the reason, the rejected alternatives,
and the allowed paths. `scribe` starts with no conversation memory, so anything
the brief leaves out is a guess.

ADR numbers are sequential in `docs/adr/`. Take the highest number and add one,
padded to four digits. Glossary entries follow the shape already in
`GLOSSARY.md`, including the `_Avoid_:` line when a term has aliases.

## Change flow

1. `plan` settles the requirements and records the decisions.
2. `build` creates the short-lived branch through `branch-keeper`, implements the
   change, and runs lint.
3. `review` verifies the diff and writes the commit message.
4. `ship` commits, pushes, and opens the PR.

The user merges on the web. `ship` then verifies the merge, deletes the remote
branch after approval, and pulls the trunk.

## Commits

Commit messages use conventional commit form. `release-please` reads them on the
trunk and opens the release PR with the version and changelog. The user merges
that PR. No one creates tags by hand.
