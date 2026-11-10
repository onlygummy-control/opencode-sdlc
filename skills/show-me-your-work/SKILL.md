---
name: show-me-your-work
description: "Prove a change with evidence instead of a claim: show the diff, the command output, the test result, and what was left undone. Use before saying a task is done, when handing off to review, or when the user asks whether something works."
---

# Show me your work

A claim is not evidence. Before you say a task is done, show the thing that proves
it. The reader should be able to check the result without trusting you.

## What to show

| Claim | Evidence to show |
| --- | --- |
| "It works" | The command you ran and its exact output or exit code |
| "Tests pass" | The test command and the pass or fail summary line |
| "Lint is clean" | The lint command and a clean exit |
| "I changed X" | The `git diff` hunk for X, not a description of it |
| "It handles the edge case" | The input that hits the edge case and the output it produced |
| "Nothing else changed" | `git status --short` and the file list |

## Order of work

1. State the goal in one line.
2. Run the proof. Copy the command and its output exactly; do not paraphrase an
   error or a result.
3. Show the diff for the files that matter.
4. Name what you did **not** do: untested paths, skipped checks, assumptions.
5. Give one verdict: done, partial, or blocked, with the reason.

## Rules

- Never claim a check passed unless you ran it in this session and saw the output.
- If a check could not run, say why and mark the result `not run`.
- Keep commands, paths, and error text exact. Do not tidy an error message.
- A long output is fine to trim, but keep the lines that carry the verdict.
- If the user cannot reproduce your proof, the proof is weak. Prefer a command
  they can run themselves.

## Output

Short sections: goal, proof, diff, not done, verdict. Reply in the caller's
language. Commands and paths stay exact.
