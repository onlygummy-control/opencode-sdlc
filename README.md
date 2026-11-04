# OpenCode config

This repo is a personal OpenCode configuration, installed at `~/.config/opencode`
(`%USERPROFILE%\.config\opencode` on Windows). It defines four primary agents,
two subagents, a global permission baseline, and the skills those agents load.

## Install

Put the repo at `~/.config/opencode`. On Windows that is
`%USERPROFILE%\.config\opencode`.

Restart OpenCode after you change an agent file. Sessions start in `plan`.
Switch agents with `tab`.

## Agents

### Agent

| Agent | Use it for | Can edit |
| --- | --- | --- |
| plan | Requirements, design, and work breakdown; the default agent | Plan files under `.opencode/plan/` |
| build | Writing and refactoring code and config; it also commits on its short-lived branch | Code and config, but not `README.md`, `GLOSSARY.md`, `GLOSSARY-MAP.md`, or `docs/` |
| review | Pre-push verification and a commit message cross-check | Nothing |
| ship | Pushing and the pull request; it commits only when the tree arrives uncommitted | Nothing; it writes git and `gh` state only |

### Sub Agent

| Agent | Use it for | Can edit |
| --- | --- | --- |
| branch-keeper | Creates the short-lived branch for another agent | Nothing; it writes git branch state only |
| scribe | ADRs, glossary entries, README, and pages under `docs/` | `README.md`, `GLOSSARY.md`, `GLOSSARY-MAP.md`, and `docs/` |

## Flow

1. `plan` clarifies the request and records decisions through `scribe`. When the request is fuzzy it loads `grill-with-docs`, which runs the grilling interview and writes ADRs and glossary entries as decisions settle.
2. `build` dispatches `branch-keeper`, or cuts the short-lived branch itself when the subagent is unavailable, then edits, runs lint, and sends any docs work to `scribe`.
3. `build` commits the change. `review` loads `requesting-code-review`, verifies the commits against the trunk in a fresh context, and cross-checks the conventional commit message.
4. `ship` loads `git-workflow`, pushes without a prompt, and opens the PR on the short-lived branch. It dispatches `branch-keeper` for an unbranched clean tree and commits only when the tree arrives uncommitted.
5. You merge on the web. `ship` verifies the merge, deletes the remote branch after approval, and pulls the trunk.

## Human gates

1. `review` must pass before the push.
2. You merge the PR on the web. Merge is never automated.
3. You approve deleting the merged remote branch.

## Docs

- [GLOSSARY.md](GLOSSARY.md): terms used in this repo
- [docs/adr/](docs/adr/): decisions, numbered in sequence
- [docs/workflow.md](docs/workflow.md): what each agent does and where it stops
- [docs/permissions.md](docs/permissions.md): how the permission rules work
- [docs/contributing.md](docs/contributing.md): adding agents, skills, and docs

Design notes live under `docs/`.
