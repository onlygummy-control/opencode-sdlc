# Workflow

Seven agents share the work. Each one has a narrow scope and a stopping point.
The permission rules enforce the scope; the prompt describes the job.

## plan

The default agent. It turns a request into requirements, a design, and a work
breakdown. It can edit plan files under `.opencode/plan/` and nothing else. It
dispatches `scribe` to write ADRs, glossary entries, and docs pages. It cannot
edit code, commit, or push.

ADRs and glossary entries are local-only development docs. They stay on disk and
are not in git.

## build

It writes and refactors code and config. Before the first edit it dispatches
`branchwright` to cut the short-lived branch. When the subagent is denied,
unavailable, or the user asks for the branch inline, it cuts the branch itself
with `git switch -c <type/slug>` after the same four checks and the same three
stops. It edits only after the branch exists. It cannot write `README.md`,
`GLOSSARY.md`, `GLOSSARY-MAP.md`, or anything under `docs/`; a decision that
needs recording goes to `scribe` through a brief. It runs lint, and it can
dispatch `verify` for a test run when a change needs one; the pre-push test gate
still belongs to `review`. It stages and commits one change on the
short-lived branch, and it still cannot push.

## branchwright

A subagent, launched by `build`, and by `ship` on a clean tree. It cuts the
short-lived branch from the trunk before the first edit, or stops and names the
condition that blocked it: a different branch already checked out, a dirty
trunk, or a branch name that exists. It is no longer the only owner of branch
creation: `build` holds the same `git switch*` allow and repeats the guard in its
own prompt, so the two lists change together. It edits nothing and holds one git
write, `git switch -c*`, plus `cd *` so it can set the repo as the shell's
working directory; `git -C` is still not allowed. The rest is state reads. It
never force-switches or reuses a name.

Every agent now opens its system prompt by naming its own id, so a handoff names
the right tab and a subagent never offers to switch to another agent.

## review

It verifies the commits against the trunk in a fresh context. It cannot edit,
stage, commit, or push. The baseline is the merge base with the trunk. A
`git worktree` at a scratch path is used only while the tree is still dirty,
because `git stash` would strand the user's changes if the pop failed. It runs
a static security scan and the `requesting-code-review` pipeline, then
cross-checks the commit message against the diff instead of writing it.

## ship

It reads the trunk from `gh repo view`, falling back to `origin/HEAD`, pushes
the commit `build` wrote, and opens the PR on the short-lived branch that
`build` or `branchwright` cut. It commits only when the tree arrives
uncommitted. A fallback branch is cut only when the work was never branched:
through `branchwright` when the tree is clean, or by `ship` itself when the
reviewed change is still in the tree and the subagent's dirty-trunk check
would refuse it. It then waits for checks with a script, squash-merges the
PR, deletes the merged remote branch, and syncs the trunk.

The wait script is the gate: a non-zero exit stops the run and names the check
that failed. It cannot force push, amend, rebase, delete a local branch, or
create a release, and it never uses `--admin`. The local branch stays after the
remote one is deleted.

## scribe

A subagent, launched by `plan` or `build`. It writes ADRs, glossary entries,
`README.md`, and pages under `docs/`. It loads `docs-writing` for README and docs
pages, and `domain-modeling` for ADRs. It has no shell and cannot dispatch other
subagents.

## verify

A subagent, launched by `build` when a change needs a test run to confirm it. It
runs the project's lint, typecheck, and test suite, and reports the exact
commands, exit codes, and failing lines. It never edits, stages, commits, pushes,
or changes branch state.

Lint and typecheck run without a prompt; test runners ask first because they can
be slow or costly. The verdict is `pass`, `fail`, or `not run` with the reason.

## Gates

| Gate | Owner | Why |
| --- | --- | --- |
| Review passes | `review` | The diff is checked in a fresh context before `ship` pushes, and a failed verdict sends the work back to `build` |
| Merge | `ship` | Squash merge runs only after the wait script returns ready; a protection rule that blocks it stops the run, and `--admin` is never used |
| Branch deletion | `ship`, after the merge | `--delete-branch` removes the branch in the merge call; `ship` never deletes an unmerged branch |
| Release | user | `release-please` reads conventional commits and opens the release PR; no one creates tags by hand |

## Only scribe writes documents

`plan` and `build` both dispatch `scribe`, so there is one writer for ADRs,
glossary entries, README, and `docs/`. Two writers would drift the format and
race on ADR numbers.

`scribe` starts with no conversation memory, so the caller has to supply a
brief with the target, the decision, the reason, the rejected alternatives, and
the allowed paths. A thin brief produces a guessed document.
