# Ship pushes without an approval prompt

Push was `ask` in [ADR 0007](0007-vcs-agent-owns-commit-and-push.md): a local
commit is reversible, a pushed one is already on the remote. The user asked for a
frictionless push, and the situation that made push the irreversible step no
longer holds. [ADR 0017](0017-destructive-git-forms-are-denied.md) bounded the
blast radius first: a trunk target is denied, so only a short-lived branch can be
pushed; force push, `--all`, `--tags`, and `--mirror` are denied, so history
cannot be rewritten; and remote branch deletion still asks. A pushed short-lived
branch is also recoverable, because the PR can be closed and the branch deleted.
This supersedes the push-is-ask paragraph of ADR 0007.

`ship` now allows `git push*`. Three ask rules sit after that allow and before
the trunk denies: `git push --delete*`, `git push * --delete*`, and
`git push * :*`, so deletion keeps its prompt and a delete aimed at the trunk
stays denied. The force and trunk guards were tightened after review to cover a
trailing flag, a short refspec, and a fully qualified ref, because the first
version only caught the flag when it followed `push` directly. `ship` still
prints the staged stat and the full commit message before pushing, so the record
shows what went out, but there is no prompt.

Keeping `ask` was rejected because it slows every PR for a step that is
recoverable. Allowing push to the trunk as well was rejected because it bypasses
the pull request, which is the only check in place of CI. Dropping the delete ask
was rejected because deletion is the one step that is hard to recover.

The cost is that a bad commit can reach the remote before anyone reads it, so the
review agent and the merge click carry the whole check. The trunk deny patterns
match a whole command string, so a form not spelled in the list could still reach
the allow.
