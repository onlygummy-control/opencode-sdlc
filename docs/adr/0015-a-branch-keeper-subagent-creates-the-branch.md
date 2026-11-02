# A branch-keeper subagent creates the branch

`build` used to edit on the trunk and `ship` cut the short-lived branch just
before the commit. Committing was safe because the uncommitted changes follow
`git switch -c`, but the window between the first edit and the commit had no
guard. A manual `git reset`, a `git stash`, or a second change in the same tree
could lose the work or mix two changes into one branch.

Now `build` dispatches a `branch-keeper` subagent before the first edit. `build`
gained `{ action: "subagent", resource: "branch-keeper", effect: "allow" }` and a
"Branch first" step. `branch-keeper` runs as `mode: subagent`, holds exactly one
git write (`git switch -c*`), and reads state for everything else. It runs a state
machine: already on the requested branch reports and does nothing; on a different
branch stops and names the mismatch; on the trunk with a dirty tree stops and
lists the paths; on a clean trunk creates the branch. It refuses a name that
already exists and never uses `git switch -C`. `ship` keeps `git switch*` only as
a fallback for work that was never branched, and its role text says so. Step 2 of
the `git-workflow` skill now checks the branch instead of always creating one.

Three alternatives were rejected. A direct `git switch -c*` allow on `build`
works, but spreads the git write across primary agents and leaves no single place
for the guard. Having `plan` create the branch fails because a plan can be
abandoned before any code exists. Keeping branch creation only in `ship` is the
status quo this replaces. The costs are one extra subagent hop with a fresh
context, and one more copy of the guard rules that can drift from the others.
