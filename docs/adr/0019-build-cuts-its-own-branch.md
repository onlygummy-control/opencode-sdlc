# Build cuts its own branch

`build` hit a permission denial when it tried to branch, so the workflow stopped
before the first edit. A real run showed the cause one level down: the
`branch-keeper` child opened with `cd "<repo>"; git rev-parse --show-toplevel`,
and the whole command was rejected because no rule allowed `cd`. `git -C <path>`
is not an escape either, because the allowlist matches whole command strings.
[ADR 0015](0015-a-branch-keeper-subagent-creates-the-branch.md) made the subagent
the only branch writer on purpose, so a caller had no way around a stuck child.

Three changes landed together. `build` holds `git switch*` with the destructive
forms denied after it so they win the match: `-f`, `--force`,
`--discard-changes`, `--detach`, and `--orphan`. `ship` holds a `branch-keeper`
subagent allow after its blanket subagent deny. `branch-keeper` holds `cd *` and
passes the repo path as the shell's working directory. `build` still dispatches
`branch-keeper` first and falls back to `git switch -c <type/slug>` only when
the subagent is denied, unavailable, or the user asks for the branch inline.
The fallback prompt carries the same four checks (trunk from `origin/HEAD`,
current branch, dirty tree, existing name) and the same three stops: a dirty
trunk, a different branch already checked out, or a name that exists.

Fixing only the `cd` gap was rejected because the caller stays blocked whenever
the subagent is unavailable. Letting `ship` branch with no subagent allow was
rejected because a clean-tree fallback can reuse the existing guard instead of
copying it. Denying `git switch -c*` in `ship` to force delegation was rejected
because `branch-keeper` refuses the dirty trunk that `ship` is about to commit,
which cuts the only fallback that matters. Allowing `git -C *` in `branch-keeper`
instead of `cd *` was rejected because that pattern also reaches write forms
such as `git -C <path> commit`, the residual risk
[ADR 0005](0005-per-agent-git-rules.md) already records.

The branch guard now lives in two prompts, `build` step 3 and `branch-keeper`,
and they have to change together. `git switch -C` cannot be separated from
`git switch -c` because Windows matches patterns without case, so only the
prompt's `git branch --list` pre-check guards the force form. `build` can now
leave the branch it created with `git switch <other>`, which the prompt forbids.
The single-owner claim in ADR 0015 no longer holds. This ADR amends it, and
ADR 0015 stays as written.
