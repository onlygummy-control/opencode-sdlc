---
name: docs-writing
description: "Write and maintain README files and docs pages: document types, page shape, code samples, links, voice, and compaction. Use when creating or editing a README, a how-to, a concept page, a reference page, or a troubleshooting guide, or when a document has grown too large."
---

# Docs writing

Write documentation a reader can act on. Structure first, prose second.

## Precedence

1. Repo rules win: README is usage only, no em dashes, decisions become ADRs.
2. This skill: document type, page shape, compaction.
3. `humanizer`: prose polish, after the structure is final.

## Local-only artifacts

`GLOSSARY.md`, `GLOSSARY-MAP.md`, and `docs/adr/` are development artifacts.
Keep them on disk and out of git. Check `.gitignore` before writing one; report
missing entries to the caller. Never stage them, and never treat a tracked copy
as the target.

## Pick the type first

| Type | Answers | Keep out |
| --- | --- | --- |
| Tutorial or quickstart | How do I get this working once? | Exhaustive options, theory |
| How-to | How do I do this task when I know the basics? | Teaching, full reference |
| Concept or explanation | Why is it built this way? | Step-by-step instructions |
| Reference | What are the exact flags, fields, and values? | Narrative, opinions |
| Troubleshooting | Why did it fail, and what do I change? | General setup |
| README | What is this, should I use it, how do I start? | Design rationale, internals |

One page, one type. If the title needs "and", it is two pages.

## README

Answer five questions, in this order:

1. What is this?
2. Why is it useful?
3. How do I start? Install and first run, copy-pasteable.
4. Where do I get help?
5. Who maintains it? Only when that differs from the git history.

README is the entry point. Design reasoning, permission internals, and decision
records belong under `docs/` with a link from the README.

## Page shape

- Title in sentence case.
- One sentence that says what the page covers.
- Headings start at H2, never skip a level, and stay unique at the same level.
- Prerequisites come before the first step.
- Procedures use numbered lists, one action per step, optional steps marked first.
- End with the result and one next step.

## Code samples

- Fence every block with a language.
- No shell prompt characters. The reader must be able to copy the command.
- Show output as a comment, not as loose text.
- Use ALL-CAPS placeholders in user-facing docs, such as `git switch TRUNK`, and
  say on the line above what to replace.
- Keep lines short enough to avoid horizontal scrolling.
- Do not invent a flag. Read the help output or run the command before writing it.

## Links

- Relative links for files in the same repo.
- Link text names the destination. No bare URLs, no "click here".
- Link once. If the same link appears twice on a page, cut one.
- Every link must resolve. After moving or splitting a page, fix the links that
  pointed at it.

## Voice

- Second person, active voice, present tense.
- Conditions before instructions: "If the tree is clean, run ...".
- Short sentences, one idea each. Define an acronym on first use.
- Avoid "simply", "just", "obviously", and claims about how easy something is.
- Inclusive terms: allowlist, denylist, main branch.

## Compaction

Measure before writing and before returning.

| File | Limit |
| --- | --- |
| `README.md` | 80 lines |
| A page under `docs/` | 150 lines |
| One section | 30 lines |

A page over the limit either has more than one purpose or repeats another page.

| Symptom | Move |
| --- | --- |
| One page answers several questions | Split by type, one file per type under `docs/` |
| The same fact sits in two files | Keep one, link from the other |
| A long flat list is hard to scan | Table, or a shorter list |
| Decision history is mixed into the page | ADR, with a link back |
| Content is obsolete | Delete it after checking that nothing links to it |
| Detail is needed but rarely | Summary at the top, detail page behind a link |

Never delete a fact without giving it a new home or recording why it is gone.
Report every page split, every new path, and every link changed.

## Before you return

- [ ] The page has one type and one purpose
- [ ] README answers the five questions and holds no design notes
- [ ] Headings start at H2, never skip a level, and are unique at their level
- [ ] Every command is copy-pasteable and every placeholder is explained
- [ ] Every link resolves, and in-repo links are relative
- [ ] No em dashes, no sales language, no "simply" or "just"
- [ ] Length is inside the limits, or the reason for exceeding it is stated
- [ ] Facts moved during compaction exist in their new home
- [ ] `humanizer` has run on the final draft

Templates: `templates/readme-template.md` and `templates/page-template.md`.
