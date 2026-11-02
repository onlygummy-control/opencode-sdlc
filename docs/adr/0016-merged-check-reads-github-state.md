# The merged-branch check reads GitHub state

The third deletion check in [ADR 0013](0013-ship-deletes-a-merged-branch.md) ran
`git branch -r --merged origin/<trunk>` and treated a listed branch as proof that
the trunk contained its commits. [ADR 0008](0008-trunk-based-short-lived-branches.md)
makes squash merge the intended style, and a squash merge writes a new commit, so
the branch tip is never an ancestor of the trunk. Under squash the check would
fail on every merge, and `ship` would never delete a branch. This supersedes
check 3 of ADR 0013.

The check now reads the pull request:
`gh pr view <number> --json state,headRefName,baseRefName,mergeCommit` must return
`MERGED`, the head branch must be the branch to delete, and the base branch must
be the trunk. `git fetch origin` still runs for fresh refs, and
`git branch -r --list origin/<branch>` confirms the delete has a target. An
already-deleted branch is reported as a no-op, not an error. The other checks
stay: the branch is not the trunk, and the working tree is clean. The four-check
shape and the ask gate are unchanged.

Keeping `--merged` and telling users not to squash was rejected because it
contradicts ADR 0008. Accepting a permanently failing check was rejected because
`ship` would stop on every merge. Deleting without any check was already rejected
in ADR 0013.
