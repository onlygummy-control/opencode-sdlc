# Destructive git forms are denied at the permission layer

More than four guards were reachable even though the prompts forbade the same
operations in prose; the four below started the investigation. The `git switch*`
allow covered `-f`, `--force`, and `--discard-changes`, which throw away the
uncommitted work `ship` exists to commit.
`git branch --delete` did not match the `-d` deny because `--delete` starts with
`--`. `git commit --amend` matched only when `--amend` followed `commit` directly,
so `git commit -a --amend` fell through to the allow. And `git push*` was only
`ask`, so a direct push to the trunk could bypass the pull request.

`ship` now denies `git switch -f*`, `--force*`, `--discard-changes*`, `--detach*`,
and `--orphan*`; `git commit *--amend*` and `git commit * --amend*`; and the
branch write forms and push forms below.

Force push is denied wherever the flag sits: `git push *--force*`,
`git push * -f*`, and `git push -?f*` for a combined short flag such as `-uf`.
`--all`, `--tags`, `--mirror`, `--prune`, and `--follow-tags` are denied both
directly after `push` and with the flag after the remote, so `git push --prune*`
and `git push *--prune*` both match. `--prune` deletes remote refs that have no
local counterpart, so it is a deletion without the delete ask, and
`--follow-tags` pushes tags while `--tags` is already denied. A leading `+` on a
refspec counts as force push. A trunk target is denied as a bare name at the end
of the command (`git push * main`) and before another refspec
(`git push * main *`), as a short refspec (`git push *:main*`), and as a fully
qualified ref (`git push *refs/heads/main*`), with the same forms for
`development`. The bare forms `git push`, `git push --`, `git push origin`,
`git push -u`, and `git push -u origin` are denied because they push the current
branch to its upstream. `--set-upstream` is the long spelling of `-u`, so it is
denied in both positions for the same reason: `git push --set-upstream*` and
`git push *--set-upstream*` both match. `plan`, `build`, `review`, and `ship`
deny the same branch write forms, and the short and long spellings are listed
separately wherever both exist, because a long flag does not match its short
one: `-d`/`--delete`, `-f`/`--force`, `-m`/`--move`, `-c`/`--copy`,
`-u`/`--set-upstream-to`, `-t`/`--track`, `--no-track`, `--unset-upstream`, and
`--edit-description`. Before this change, `plan` and `review` denied the short
spellings plus `--set-upstream-to` and `--edit-description`; `ship` denied only
`-d` and `-D`; and `build` had no branch block at all. This change adds
`--delete`, the long spelling of every form that had only a short one, the block
for `build`, and the full set for `ship`.

`git remote show*` was added so the Step 0 fallback works. The new `branch-keeper`
agent allows only the exact list forms `git branch -a`, `git branch -r`,
`git branch -a --list*`, and `git branch -r --list*`, so a positional form such
as `git branch -r -d origin/x` matches no allow and falls through to the global
shell deny, which keeps the "one git write" claim in
[ADR 0015](0015-a-branch-keeper-subagent-creates-the-branch.md) true.

Deleting the rules and trusting the prompt was rejected because the prompt
already said never and the commands still ran. Blocking every `git push *main*`
was rejected because it also blocks legitimate branch slugs that contain the word
`main`.

Two risks remain. Windows matches patterns without case, so `git switch -C`
cannot be separated from `-c`; the branch-exists check in `branch-keeper` is its
guard. Patterns match a whole command string, so a form not spelled in the list
can still reach the allow, which is why the prompt still forbids every force and
trunk push. The trunk name is read from `origin/HEAD` at runtime, but the rules
have to spell `main` and `development` because a pattern cannot read config.
