---
name: git-workflow
description: "Ordered workflow for turning a dirty working tree into a pull request: branch, scan, conventional commit, gated push, PR, stop. Use when committing, pushing, opening a PR, or preparing a release."
---

# Git Workflow

Work the steps in order. Stop at the first step whose condition says stop. Never
skip step 0, and never push before step 8.

## Step 0 — Identify the repo

```powershell
git rev-parse --show-toplevel
git status --short
git rev-parse --abbrev-ref origin/HEAD
git remote -v
```

- Name the repo path in your first line of output. A session opened in the
  wrong directory must be caught here, not after a commit.
- The trunk is whatever `origin/HEAD` points at; `--abbrev-ref` prints it as
  `origin/main`, so drop the `origin/` prefix. If it does not resolve, try
  `git remote show origin` and read "HEAD branch".
- No remote means there is nothing to push to. Stop.

## Step 1 — Decide the type

| Type | Use for |
| --- | --- |
| `feat` | new behaviour or new file that adds capability |
| `fix` | corrects wrong behaviour |
| `docs` | documentation and comments only |
| `refactor` | same behaviour, different shape |
| `test` | tests only |
| `chore` | tooling, deps, config that is not product behaviour |
| `perf` | measurable speed or size win |

The branch prefix is the same word. If the diff spans more than one type, it
is more than one commit. Stop and report the split.

## Step 2 — Branch

```powershell
git fetch origin
git branch --show-current
```

- If `branch-keeper` already created the branch for this work, the check returns
  it. Stay on it and say so instead of stacking another branch.
- If the current branch is already a short-lived branch for this work, stay on
  it and say so instead of stacking another branch.
- Otherwise the work was never branched. When the tree is clean, dispatch
  `branch-keeper`; it reads the trunk, refuses an existing name, and cuts the
  branch. When the reviewed change is still in the tree, its dirty-trunk guard
  would refuse, so cut the branch once yourself: `git switch -c <type>/<slug>`.
  Slug is kebab-case, describes the change, and the whole name stays under 40
  characters: `feat/pipeline-allowlist`. Never use `git switch -C`.
- Do not `pull` while the tree is dirty. Switching keeps the uncommitted
  changes, and the PR diff is computed from the merge base, so a slightly
  behind trunk costs nothing.

## Step 3 — Scan before staging

```powershell
git diff
```

Read the diff for:

- keys, tokens, passwords, `BEGIN PRIVATE KEY`, connection strings
- `.env`, `.env.*`, credential files, local config with machine paths
- build output, caches, `node_modules`, binaries and files over a few hundred KB
- debug leftovers: `console.log`, `print(`, `debugger`, commented-out blocks

Stop on a secret. Never stage it, and never commit it to be removed later: the
first commit keeps the secret in history forever.

## Step 4 — Stage explicitly

```powershell
git status --short
git add <path> <path>
```

Name the paths. `git add -A` and `git add .` are banned: they pick up whatever
else the session touched.

## Step 5 — Re-check what you staged

```powershell
git status --short
git diff --cached --stat
```

Every staged file must belong to the stated purpose. If one does not, take it
back out of the index with `git reset -- <path>` and stage the right paths. If
the change itself is wrong, stop before committing and let the user decide.

## Step 6 — Commit

```powershell
git commit -m "type(scope): subject" -m "why this change is needed"
```

- Subject: lowercase, imperative, no trailing period, 72 characters or fewer.
- Body: the reason, not a restatement of the diff. Break each line at 72 columns
  yourself. Git keeps the line lengths you pass in, so one long paragraph stays
  one long line in the log. In PowerShell `\n` is literal text; use backtick-n
  or pipe a here-string to `git commit -F -`.
- Footer for an issue: `Refs: #123`.
- Breaking change: `type(scope)!:` plus a `BREAKING CHANGE:` footer.
- No `Co-authored-by`, no "Generated with", no agent attribution.
- Use a scope only when the repo has real areas, for example
  `feat(agents):`. A meaningless scope is worse than none.

## Step 7 — Pre-push check

```powershell
git log --oneline origin/<trunk>..HEAD
git show --stat HEAD
```

Expect exactly the commits you intended, usually one. This agent does not run
tests or lint: verification belongs to the review agent. If the change was not
verified, say so in the PR body instead of implying it was.

## Step 8 — Push

Print the staged stat and the full commit message first, then:

```powershell
git push -u origin <branch>
```

Push runs unattended. Only a short-lived branch is reachable: a trunk target is
denied, force push is denied, and deleting a remote branch still asks. If the
remote rejects it as non-fast-forward, stop. Never force push, never rebase,
never delete and re-push.

## Step 9 — Open the PR

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

Do not invent a test plan. "Not run" is a valid entry and the honest one.

## Step 10 — Stop

Report the repo, branch, commit subject and SHA, push result, and PR URL. Then
stop. Merge, tagging, and releasing are not this agent's job. Branch deletion
follows the merged-branch checks in the agent prompt, and only after the user
reports the merge.

Stopping is not the end of the user's work. Close with the post-merge handoff
from the agent prompt: merge on the web, report the merge so the agent can
verify it, then the agent deletes the branch and pulls the trunk.

## When the trunk is `development`

If `origin/HEAD` resolves to `development`, that is the base branch for the PR
and the branch to compare against in step 7. Do not force `main` because
trunk-based practice says so. Follow the repo, and mention the choice in the
report.

## Failure handling

| Situation | Action |
| --- | --- |
| No remote | Stop, say the repo is local-only |
| `gh auth status` fails | Stop, tell the user to run `gh auth login` |
| Branch name already exists | Stop, do not reuse or rename silently |
| Unrelated changes in the tree | Stop, list the file groups |
| Secret in the diff | Stop, name the file and the line, do not stage |
| Push rejected | Stop, report the remote message, do not retry with force |
| `gh pr create` fails | Report the raw error, keep the pushed branch |

## Releases

`release-please` reads conventional commits on the trunk and opens a release PR
with the changelog and the version bump. Never edit the version or the
changelog by hand, and never create a tag. If a release PR exists, it is the
user's to merge.
