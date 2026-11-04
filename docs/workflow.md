# Workflow

Six agents share the work. Each one has a narrow scope and a stopping point.
The permission rules enforce the scope; the prompt describes the job.

## plan

The default agent. It turns a request into requirements, a design, and a work
breakdown. It can edit plan files under `.opencode/plan/` and nothing else. It
dispatches `scribe` to write ADRs, glossary entries, and docs pages. It cannot
edit code, commit, or push.

## build

It writes and refactors code and config. Before the first edit it dispatches
`branch-keeper` to cut the short-lived branch. When the subagent is denied,
unavailable, or the user asks for the branch inline, it cuts the branch itself
with `git switch -c <type/slug>` after the same four checks and the same three
stops. It edits only after the branch exists. It cannot write `README.md`,
`GLOSSARY.md`, `GLOSSARY-MAP.md`, or anything under `docs/`; a decision that
needs recording goes to `scribe` through a brief. It runs lint only. Tests belong
to `review`. It stages and commits one change on the short-lived branch, and it
still cannot push.

## branch-keeper

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

It reads the trunk from `origin/HEAD`, pushes the commit `build` wrote, and
opens the PR on the short-lived branch that `build` or `branch-keeper` cut. It
commits only when the tree arrives uncommitted. A fallback branch is cut
only when the work was never branched: through `branch-keeper` when the tree is
clean, or by `ship` itself when the reviewed change is still in the tree and the
subagent's dirty-trunk check would refuse it. After you merge, it verifies the PR
state, deletes the merged branch after approval, and pulls the trunk.

It deletes only when all four checks pass:

- `gh pr view <number> --json state,headRefName,baseRefName,mergeCommit` returns
  MERGED, the head branch is the branch to delete, and the base branch is the
  trunk.
- `git fetch origin` ran, so remote refs are current.
- `git branch -r --list origin/<branch>` lists the branch, so the delete has a
  target. An already-deleted branch is a no-op, not an error.
- The branch is not the trunk, and the working tree is clean.

If a check fails, it stops and names the check. It cannot merge, force push,
amend, rebase, delete a local branch, or create a release. The local branch stays
after the remote one is deleted.

## scribe

A subagent, launched by `plan` or `build`. It writes ADRs, glossary entries,
`README.md`, and pages under `docs/`. It loads `docs-writing` for README and docs
pages, and `domain-modeling` for ADRs. It has no shell and cannot dispatch other
subagents.

## Gates

| Gate | Owner | Why |
| --- | --- | --- |
| Review passes | `review` | The diff is checked in a fresh context before `ship` pushes, and a failed verdict sends the work back to `build` |
| Merge | user, on the web | No automated test run gates the PR, so the merge click is the check that the diff was read |
| Branch deletion | user approves, `ship` checks | A deleted remote branch is hard to recover |
| Release | user | `release-please` reads conventional commits and opens the release PR; no one creates tags by hand |

## Only scribe writes documents

`plan` and `build` both dispatch `scribe`, so there is one writer for ADRs,
glossary entries, README, and `docs/`. Two writers would drift the format and
race on ADR numbers.

`scribe` starts with no conversation memory, so the caller has to supply a
brief with the target, the decision, the reason, the rejected alternatives, and
the allowed paths. A thin brief produces a guessed document.
