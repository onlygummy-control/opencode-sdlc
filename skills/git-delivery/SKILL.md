---
name: git-delivery
description: "Ordered workflow for turning a working tree into a merged pull request: branch, scan, conventional commit, push, PR, wait for checks, squash merge, sync trunk. Use when committing, pushing, opening a PR, merging, or preparing a release."
---

# Git delivery

Work the steps in order. Stop at the first step whose condition says stop. Never
skip step 0, never push before step 8, and never merge before step 10 passes.

Use `gh` when it is shorter than the git equivalent. The one rule that matters:
`gh` talks to the same remote, so every guard on `git push` still applies.

## Step 0 - Identify the repo

```powershell
git rev-parse --show-toplevel
git status --short
gh repo view --json defaultBranchRef,nameWithOwner
```

- Name the repo path in your first line of output. A session opened in the wrong
  directory must be caught here, not after a commit.
- The trunk is `defaultBranchRef.name` from `gh repo view`. When `gh` fails, fall
  back to `git rev-parse --abbrev-ref origin/HEAD` and drop the `origin/` prefix.
  Never assume `main`.
- No remote means there is nothing to push to. Stop.

## Step 1 - Decide the type

| Type | Use for |
| --- | --- |
| `feat` | new behaviour or new file that adds capability |
| `fix` | corrects wrong behaviour |
| `docs` | documentation and comments only |
| `refactor` | same behaviour, different shape |
| `test` | tests only |
| `chore` | tooling, deps, config that is not product behaviour |
| `perf` | measurable speed or size win |

The branch prefix is the same word. If the diff spans more than one type, it is
more than one commit. Stop and report the split.

## Step 2 - Branch

```powershell
git fetch origin
git branch --show-current
```

- If `branchwright` already created the branch for this work, the check returns
  it. Stay on it and say so instead of stacking another branch.
- Otherwise the work was never branched. When the tree is clean, dispatch
  `branchwright`. When the reviewed change is still in the tree, its dirty-trunk
  guard would refuse, so cut the branch once yourself: `git switch -c <type>/<slug>`.
  Slug is kebab-case, describes the change, and the whole name stays under 40
  characters: `feat/pipeline-allowlist`. Never use `git switch -C`.
- Do not `pull` while the tree is dirty.

## Step 3 - Scan before staging

```powershell
git diff
```

Read the diff for keys, tokens, passwords, `.env` files, credentials, build
output, caches, binaries, and debug leftovers. Stop on a secret. Never stage it,
and never commit it to be removed later: the first commit keeps it in history.

## Step 4 - Stage explicitly

```powershell
git status --short
git add <path> <path>
```

Name the paths. `git add -A` and `git add .` are banned: they pick up whatever
else the session touched.

## Step 5 - Re-check what you staged

```powershell
git status --short
git diff --cached --stat
```

Every staged file must belong to the stated purpose. If one does not, take it
back out with `git reset -- <path>` and stage the right paths.

## Step 6 - Commit

```powershell
git commit -m "type(scope): subject" -m "why this change is needed"
```

- Subject: lowercase, imperative, no trailing period, 72 characters or fewer.
- Body: the reason, not a restatement of the diff. Break each line at 72 columns.
- Footer for an issue: `Refs: #123`.
- Breaking change: `type(scope)!:` plus a `BREAKING CHANGE:` footer.
- No `Co-authored-by`, no agent attribution.

## Step 7 - Clean the unpushed history

Only when the branch has more than one WIP commit and the message matters. A
squash merge on step 11 already makes the trunk clean, so skip this unless the
PR itself should read as one commit.

```powershell
git branch -r --list origin/<branch>
```

- Empty output means the branch is unpushed, so an amend is local and safe.
- Non-empty output means the branch is pushed. Do not amend: it would need a
  force push, which is denied. Report and leave it.

Then, unpushed only:

```powershell
git reset --soft <trunk>
git commit -m "type(scope): subject" -m "why this change is needed"
```

`git reset --soft` keeps the tree and the index, so the new commit holds the same
content. Never use `--hard`.

## Step 8 - Push

Print the commit stat and the full message first, then:

```powershell
git push -u origin <branch>
```

Push runs unattended. Only a short-lived branch is reachable: a trunk target is
denied, force push is denied, and deleting a remote branch still asks. If the
remote rejects it as non-fast-forward, stop. Never force push.

## Step 9 - Open the PR

```powershell
gh pr create --base <trunk> --title "type(scope): subject" --body "<body>"
```

Title matches the commit subject. Body:

```md
## Summary

Why this change exists, in one or two sentences.

## Changes

- what changed, in review order

## Test plan

- what was run, or: not run, verification is the review agent's step
```

Do not invent a test plan. "Not run" is the honest entry. If a PR already exists
for the branch, reuse it instead of opening a second one.

## Step 10 - Wait for checks

The wait script sits in this skill's own `scripts/` folder. Run it with its full
path inside the OpenCode config tree, because the working directory is the
project, not the config:

```powershell
powershell -ExecutionPolicy Bypass -File "<config>/skills/git-delivery/scripts/wait-for-pr.ps1" -Pr <number> -TimeoutMinutes 30
```

`<config>` is the OpenCode config directory, for example
`$env:USERPROFILE\.config\opencode`.

Exit codes: `0` ready to merge, `2` a check failed, `3` timed out, `1` the PR
closed or the read failed. On any non-zero exit, stop and report the exact
reason. Never merge on a guess.

## Step 11 - Merge

Only after step 10 returns `0`:

```powershell
gh pr merge <number> --squash --delete-branch
```

- Squash is the only merge method. It keeps the trunk linear: one commit per PR.
- `--delete-branch` removes the remote branch in the same call.
- Never pass `--admin`. If branch protection blocks the merge, report it and
  stop; do not bypass the rule.
- Never pass `--merge` or `--rebase`.

## Step 12 - Sync the trunk

```powershell
git switch <trunk>
git pull --ff-only origin <trunk>
```

- `<trunk>` is the branch from step 0, never an assumed `main`.
- The local short-lived branch stays. Delete it with `git branch --delete <branch>`
  when it is fully merged; that form is safe because it refuses an unmerged
  branch. Never use `-D`.
- Report the new short SHA of the trunk.

## Step 13 - Stop

Report the repo, branch, commit subject and SHA, push result, PR URL, merge
result, and the new trunk SHA. Do not tag the merge or open a release.

## Failure handling

| Situation | Action |
| --- | --- |
| No remote | Stop, say the repo is local-only |
| `gh auth status` fails | Stop, tell the user to run `gh auth login` |
| Branch name already exists | Stop, do not reuse or rename silently |
| Unrelated changes in the tree | Stop, list the file groups |
| Secret in the diff | Stop, name the file and the line, do not stage |
| Push rejected | Stop, report the remote message, do not retry with force |
| Wait script exits non-zero | Stop, report the check name and the raw output |
| Merge blocked by protection | Stop, report it, do not use `--admin` |
| `gh pr create` fails | Report the raw error, keep the pushed branch |

## Releases

`release-please` reads conventional commits on the trunk and opens a release PR
with the changelog and the version bump. Never edit the version or the changelog
by hand, and never create a tag.
