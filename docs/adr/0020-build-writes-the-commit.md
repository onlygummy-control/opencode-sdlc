# Build writes the commit

`build` may create and amend a commit on its own short-lived branch. It still
cannot push. `ship` normally pushes a commit `build` already wrote and opens the
pull request; its commit path survives only as a fallback for a tree that
arrives uncommitted.

A commit is local and reversible, so it is not the point where a change leaves
the machine. The gate is the merge click on the web, which `GLOSSARY.md`
already records. `review` now verifies the committed range instead of a working
tree, and it cross-checks the message instead of writing it, so the old handoff
(review writes a message, the user runs the commit) was a round trip that bought
nothing.

Three alternatives were rejected. Keeping commit in `ship` only leaves `build`
unable to close the loop, and the message crosses two sessions. Giving `build`
push as well removes the short-lived-branch guard and lets a pull request exist
before anyone read the diff. Letting `review` commit fails for the reason
[ADR 0001](0001-reviewer-is-read-only.md) records: a reviewer that lands its own
findings is not a reviewer.

Four risks remain. `build` may amend only its own unpushed commit; if it ever
amends a pushed one, the remote needs a force push that no agent holds, so the
repair is manual. `build` runs lint only, per
[ADR 0004](0004-build-does-not-run-tests.md), so a commit can be test-broken
until `review` runs. `--no-verify` and `-n` are denied for `build`, because a
hook can be the only local check in a target repo. The `git -C <path> commit`
gap from [ADR 0005](0005-per-agent-git-rules.md) is unchanged.

[ADR 0007](0007-vcs-agent-owns-commit-and-push.md) gave commit and push to a
dedicated agent and kept `build` out of both. This ADR amends it, and ADR 0007
stays as written.
