---
name: deslop
description: "Remove AI-generated code smells before delivery: restated comments, premature abstraction, defensive bloat, dead code, copy-paste duplication, and inconsistent naming. Use when a change is working but feels heavy, or before a review, to strip noise without changing behavior."
---

# Deslop

Strip the noise an AI leaves behind. The goal is code that reads like a person
wrote the smallest thing that works. Never change behavior while deslopping; if a
change would alter behavior, list it instead of making it.

## What to look for

| Smell | What it looks like | Fix |
| --- | --- | --- |
| Restated comment | `// increment i` above `i += 1` | Delete it. Keep only the "why". |
| Banner comment | A divider that adds no fact | Delete it. |
| Premature abstraction | A base class, factory, or generic for one caller | Inline it until a second caller exists. |
| Defensive bloat | A null check the type already rules out | Remove it, or fix the type. |
| Dead code | Unused function, import, variable, branch | Delete it. Git keeps history. |
| Copy-paste | The same block twice with one word changed | Extract one function with a parameter. |
| Inconsistent naming | `getUser`, `fetch_user`, `loadUser` for one action | Pick one verb and one casing. |
| Over-config | A constant or option nobody sets | Inline the value. |
| Speculative feature | A flag, mode, or hook nobody asked for | Delete it. YAGNI. |
| Verbose guard | `if (x === null \|\| x === undefined)` | Use the language's nullish or optional form. |

## Order of work

1. Read the diff, not the whole repo. Deslop only what the change touched.
2. Run the checks that already exist: lint, typecheck, tests. Record the result.
3. Apply the table above, smallest fix first.
4. Run the same checks again. Behavior must not change.
5. Report what you removed and why, and list any behavior change you refused to make.

## Rules

- Do not rename public API, exported symbols, or config keys unless the change is
  part of the task.
- Do not delete a comment that explains a non-obvious "why". That comment is the
  one the next reader needs.
- Do not trade readability for line count. A clear function beats a clever one.
- If the checks cannot run, say so and stop. Do not claim a clean pass you did not
  see.

## Output

Give a short list: file, what was removed, and the check result. Keep commands and
paths exact. Reply in the caller's language.
