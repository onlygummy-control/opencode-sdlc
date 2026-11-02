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

## Agent scope

| Agent | Edit scope | Shell scope |
| --- | --- | --- |
| `plan` | Files under `.opencode/plan/` | Read-only git and read-only file commands |
| `build` | Code and config; docs files are denied | Full allow, but `git *` is denied except read forms, `git add`, `git rm`, `git mv`, and `git stash`; branch write forms are denied; test runners ask |
| `branch-keeper` | Nothing | Read-only state checks plus `git switch -c*`; destructive switch forms and branch deletion are denied |
| `review` | Nothing | Read-only git, test runners, and lint; no `add`, `commit`, or `push` |
| `ship` | Nothing | Git write path and `gh pr` read and create; push is allowed, remote branch deletion asks, and trunk push, force push, prune, tag push, and merge are denied |
| `scribe` | The docs tree and `README.md` | Nothing |

`ship` pushes without a prompt, but it denies `git push --prune` and
`git push --follow-tags`. `--prune` deletes remote refs without the delete ask.
`--follow-tags` pushes tags, and `--tags` is already denied.

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
for `-d` and `-D`. A short flag and its long spelling are separate patterns, so
every denied branch write form lists both spellings: `-d`/`--delete`,
`-f`/`--force`, `-m`/`--move`, `-c`/`--copy`, `-t`/`--track`, and
`-u`/`--set-upstream-to`, plus `--unset-upstream`, which has no short form.
`git diff --output=<file>` writes a file through a command that reads as
inspection, so `plan`, `review`, and `ship` deny `git * --output*`.

The unstage rule shows the fix. `git restore --staged -W` touches only the
index under `--staged`, but the `-W` flag reaches the worktree without matching
a deny written for `--worktree`. `git reset -- <path>` replaced it: after `--`,
every word is a pathspec, so the allowed form has no flag surface. See
[ADR 0010](adr/0010-ship-can-unstage.md).

## Residual risk

A pattern matches the whole command string, so argument-level rules are not
expressible. `git -C <path> commit` does not match `git commit*`, and an agent
that can reach `git -C` can commit. `--output=<file>` needs its own deny because
a rule cannot say "this flag, in this position". Closing either gap would need
argument-aware matching, which the permission layer does not offer. Both are
accepted and recorded in [ADR 0005](adr/0005-per-agent-git-rules.md).

Windows matches patterns without case, so `git switch -c` and `git switch -C`
cannot be separated. The branch-exists pre-check in `branch-keeper` is the guard
for the force form. Trunk push rules have to spell out `main` and `development`,
because a pattern cannot read `origin/HEAD` at run time.

The guard sees the literal command string, so a command substitution such as
`git push origin $(echo main)` matches no trunk deny and reaches the allow. The
same limit covers any push option that omits a refspec, such as
`git push --repo=origin`, because the default push then runs with no branch named
in the string. `ship` pushes unattended, so the prompt still has to forbid the
trunk push, and both bypasses are accepted and recorded in
[ADR 0017](adr/0017-destructive-git-forms-are-denied.md).
