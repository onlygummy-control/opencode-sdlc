# OpenCode agent configuration

This repo configures OpenCode: four primary agents (plan, build, review, ship),
two subagents (scribe and branch-keeper), the global permission baseline, and the
skills those agents load. The domain is agent behavior, not application code.

## Language

**Agent**: One named assistant profile: a system prompt, a mode, and a permission
set. This repo defines four primary agents and two subagents. The reviewer runs in
a fresh context with no history of how the code it checks was written.

_Avoid_: assistant, bot

**Permission rule**: One ordered `{action, resource, effect}` triple. Global rules
load first, agent rules append after them, and the last rule that matches wins. A
broad deny belongs before the narrow allow that must beat it.

_Avoid_: permission block, access control entry

**Pipeline stage**: One command between pipes or statement separators. The
scanner emits each stage as its own shell resource, so an allow has to cover
every stage of a pipeline. A rule written for the whole line never matches.

_Avoid_: sub-command, pipe part

**Mode**: Where an agent runs. `primary` means it is the main agent of a session
and the user switches to it by tab. `subagent` means a parent agent launches it in
a child session. `all` means either.

_Avoid_: role, type

**Skill**: A Markdown instruction file with an ID derived from its path, loaded on
demand by the `skill` tool. It holds reusable behavior that would bloat every
agent prompt if copied inline. Its `description` decides whether the model sees it.

_Avoid_: plugin, command, helper

**Independent reviewer**: The review agent. It verifies a diff with no shared
context with the implementer and holds no `edit` permission, so it reports issues
instead of fixing them.

_Avoid_: checker, QA bot

**Baseline**: The test and lint failure count a repo already had before a change.
Only failures above the baseline block a commit.

_Avoid_: golden state, reference run

**Frontier**: In a grilling interview, the set of decisions whose prerequisites are
already settled. A question that depends on an unanswered one belongs to a later
round.

_Avoid_: open questions, backlog

**Domain doc**: `GLOSSARY.md`, `GLOSSARY-MAP.md`, and every file under `docs/`,
including `docs/adr/`. The scribe subagent writes them; no primary agent does.

_Avoid_: vault, notes

**Scribe**: The subagent that writes the docs tree. It owns the format and the
numbering, never the decision, so a caller has to supply a brief.

_Avoid_: docs bot, document writer

**Branch-keeper**: The subagent that creates and validates the short-lived branch
for a primary agent. It is not the sole owner of branch creation: `build` carries
the same guard as a fallback when the subagent is unavailable, so a rule change
has to land in both places. It owns the branch mechanics, never the branch name.

_Avoid_: mini-ship, branch bot, git helper

**Usage doc**: `README.md`. It explains how to use the config and is not a place
for design notes; those go under `docs/`.

_Avoid_: guide, manual

**Read-only escape**: A command pattern that still lets an agent without `edit`
permission change state, such as `git branch -d` or `git diff --output=<file>`.
An allow written as a wildcard inherits every write form hidden inside it.

_Avoid_: permission bypass, hole

**Residual risk**: A known gap in the permission layer that is accepted and
recorded rather than patched, because a resource pattern matches a whole command
string and cannot express argument-level rules.

_Avoid_: known issue, accepted limitation

**Trunk**: The branch a repo treats as its mainline. Read it from `origin/HEAD`
rather than assuming `main`, because a repo may keep its trunk on
`development`. Short-lived branches are cut from it and merged back into it.

_Avoid_: main branch, master

**Short-lived branch**: A branch that carries one change, cut from the trunk by
branch-keeper, or by build when the subagent is unavailable, before the first
edit, and lives hours to a couple of days before merging back. The thing it is
not is a long-lived integration branch, which holds unmerged work for weeks.

_Avoid_: dev branch, feature branch

**Ship agent**: The `ship` main agent that owns push and the pull request. It is
a primary agent selected by tab, not a subagent, and it starts only when the
user switches to it deliberately. It holds git and gh permissions of its own so
the other agents stay read-only, and it stops before merge. On the normal path
it pushes the commit `build` wrote and opens the PR on the branch branch-keeper
created; it commits only when the tree arrives uncommitted. A fallback branch is
cut only for work that was never branched.

_Avoid_: VCS agent, git bot, commit bot

**Commit gate**: The point where a change leaves the machine for good. Push is
not it: a push runs unattended on a short-lived branch that can still be
corrected or abandoned. A commit is local and reversible, so `build` writes one
on the short-lived branch. The gate is the merge click on the web, the last time
a person reads the diff before it reaches the trunk.

_Avoid_: approval step, checkpoint

**Release PR**: The pull request `release-please` opens on the trunk carrying
the changelog and the version bump. Merging it creates the tag, so it is the
only place a version changes.

_Avoid_: version PR, bump PR
