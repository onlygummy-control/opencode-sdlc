# Permissions

A permission rule is one triple:

```
{ action, resource, effect }
```

`action` is what the agent wants to do, such as `edit`, `read`, `shell`, or
`subagent`. `resource` is a path or a command string. `effect` is `allow`,
`deny`, or `ask`.

Rules are ordered. The global rules in `opencode.jsonc` load first, an agent's
rules append after them, and the last rule that matches wins. A broad deny
belongs before the narrow allow that must beat it. A broad allow belongs before
the narrow deny that must beat it. Order is the whole mechanism, so moving a
line changes behavior.

## Global baseline

| Action | Effect |
| --- | --- |
| `edit` | deny |
| `read` | allow |
| `glob` | allow |
| `grep` | allow |
| `skill` | allow |
| `subagent` | deny |
| `shell` | deny, with a read-only allowlist |
| `webfetch` | allow |

Per-agent git rules live in `agents/<agent>.md`, not in the global list. The
reason is ordering: an agent that denies shell has to re-grant each read-only
command after its own deny. See [ADR 0005](adr/0005-per-agent-git-rules.md).

ADR files and the glossary are local-only development docs. They stay on disk
and are not in git.

## Agent scope

| Agent | Edit scope | Shell scope |
| --- | --- | --- |
| `plan` | Files under `.opencode/plan/` | Read-only git, read-only file and exploration commands, and project run commands (lint and typecheck run without a prompt; test and verify ask first) |
| `build` | Code and config; docs files are denied | Full allow, but `git *` is denied except read forms, `git add`, `git rm`, `git mv`, `git stash`, `git commit`, and `git switch*`; `--amend` is allowed only on an unpushed commit, `--no-verify` and `-n` are denied, push stays denied, and the destructive switch forms are denied; test runners ask |
| `branchwright` | Nothing | Read-only state checks plus `cd *` and `git switch -c*`; destructive switch forms and branch deletion are denied |
| `verify` | Nothing | Read-only git, lint and typecheck commands, and test runners that ask |
| `review` | Nothing | Read-only git, test runners, and lint; no `add`, `commit`, or `push` |
| `ship` | Nothing | Git write path and `gh pr` read, create, and squash merge; may dispatch `branchwright` when the tree is clean; push is allowed; `gh pr merge` is allowed but only with squash, and `--merge`, `--rebase`, and `--admin` are denied; trunk push, force push, prune, and tag push stay denied; the merged remote branch is deleted by `--delete-branch`; local `git branch --delete` is allowed, but its force forms are denied |
| `scribe` | The docs tree and `README.md` | Nothing |

`ship` pushes without a prompt, but it denies `git push --prune` and
`git push --follow-tags`. `--prune` deletes remote refs without the delete ask.
`--follow-tags` pushes tags, and `--tags` is already denied. `ship` also allows
`gh pr merge` only with squash, and denies `--merge`, `--rebase`, and `--admin`
in both flag positions.

## How patterns match

Patterns are globs over the whole normalized path or command string. `*` spans
`/`, so `*docs/*` matches a file at any depth under `docs/`. On Windows, pattern
matching ignores case, so `*README.md` also matches a file named `readme.md`.
Name a template `readme-template.md` when only the README itself should be
protected. A shell rule matches a command string, not a single argument.

Pipelines are checked one stage at a time. Each command between pipes is its own
resource, so an allow has to cover every stage. See
[ADR 0006](adr/0006-read-only-pipeline-allowlist.md).

## Read-only escapes

A wildcard allow can inherit a write form hidden inside it. `git branch*` would
also permit `git branch -d`, so `ship` follows that allow with an explicit deny
for `-d` and `-D`. `ship` now also allows `git branch --delete`, because that
long form refuses an unmerged branch, and denies the force spellings
`--delete --force` and `--delete -f`. A short flag and its long spelling are
separate patterns, so every denied branch write form lists both spellings:
`-f`/`--force`, `-m`/`--move`, `-c`/`--copy`, `-t`/`--track`, and
`-u`/`--set-upstream-to`, plus `--unset-upstream`, which has no short form.
`git diff --output=<file>` writes a file through a command that reads as
inspection, so `plan`, `review`, and `ship` deny `git * --output*`.

`build` and `ship` both allow `git switch*`, so that allow inherits the write
forms hidden in the wildcard: `-f`, `--force`, `--discard-changes`, `--detach`,
`--orphan`, and `-C`. Each agent follows the allow with a deny for the five
flagged forms. `-C` cannot be written as a deny that leaves `-c` alone, so the
`git branch --list` pre-check in the prompt is its guard.

The unstage rule shows the fix. `git restore --staged -W` touches only the
index under `--staged`, but the `-W` flag reaches the worktree without matching
a deny written for `--worktree`. `git reset -- <path>` replaced it: after `--`,
every word is a pathspec, so the allowed form has no flag surface. See
[ADR 0010](adr/0010-ship-can-unstage.md).

`build` now holds a commit write. A commit stays on the local branch and can be
amended or dropped, so it is not where work leaves the machine; the
wait-for-checks script is the gate before `ship`'s squash merge, and `review`
still checks the diff before the push. `ship` keeps its commit path as a fallback
for a tree that arrives uncommitted. See
[ADR 0020](adr/0020-build-writes-the-commit.md).

## Residual risk

A pattern matches the whole command string, so argument-level rules are not
expressible. `git -C <path> commit` does not match `git commit*`, and an agent
that can reach `git -C` can commit. `--output=<file>` needs its own deny because
a rule cannot say "this flag, in this position". Closing either gap would need
argument-aware matching, which the permission layer does not offer. Both are
accepted and recorded in [ADR 0005](adr/0005-per-agent-git-rules.md).

Windows matches patterns without case, so `git switch -c` and `git switch -C`
cannot be separated. The branch-exists pre-check in `branchwright` and in
`build` step 3 is the guard for the force form, now that both agents hold the
`git switch*` allow. Trunk push rules have to spell out `main` and `development`,
because a pattern cannot read `origin/HEAD` at run time.

The guard sees the literal command string, so a command substitution such as
`git push origin $(echo main)` matches no trunk deny and reaches the allow. The
same limit covers any push option that omits a refspec, such as
`git push --repo=origin`, because the default push then runs with no branch named
in the string. `ship` pushes unattended, so the prompt still has to forbid the
trunk push, and both bypasses are accepted and recorded in
[ADR 0017](adr/0017-destructive-git-forms-are-denied.md).
