# Guide for agents

This file explains how to change Humanizer without breaking its package or prompt.

## What this repo contains

Humanizer is an agent skill written in Markdown. `SKILL.md` is the prompt that agents read. The repo has no build step.

Keep the skill portable. Do not write instructions that limit it to one or two agent tools.

## Key files

- `SKILL.md` is the source of truth and the repo's only skill file. It contains portable YAML metadata, 35 numbered patterns, and their examples.
- `README.md` explains installation, use, patterns, and version history.
- `scripts/validate-package.py` checks package files and shared values.

There is no Claude plugin package. Claude Code loads the root `SKILL.md` directly, so the repo has no `.claude-plugin/` directory.

## Rules for changes

Keep `SKILL.md` and `README.md` in sync.

- **Patterns:** The skill has 35 numbered patterns. If you add, remove, or renumber a pattern, update the README table, heading, validator, and every pattern reference.
- **Version:** Keep the same version in `SKILL.md` under `metadata.version` and the first README version entry. Do not add a top-level `version` field to the skill.
- **Compatibility:** Keep install and use instructions neutral across agents. Names such as Claude Code, OpenCode, and Codex are examples, not limits.
- **History:** Add a short README version note for any behavior change or non-obvious fix.
- **Checks:** Before publishing, run `python3 scripts/validate-package.py` and `npx skills add . --list`.

## Writing style

Use Plain Language in code comments, prompts, documentation, descriptions, validation messages, and progress reports.

- Lead with the main point.
- Use common words and active voice.
- Keep sentences and paragraphs short.
- Use one term for the same item.
- Use `must` for requirements.
- Use headings, lists, and tables when they help the reader.
- Remove repeated or unnecessary words.
- Limit acronyms and explain technical terms.
- Avoid double negatives.
- Keep exact identifiers, commands, paths, schema fields, quotations, watched phrases, and behavior-bearing examples.
- Keep the full technical meaning.

## Dash sweep

Prose must not contain long dashes (em dash, en dash, horizontal bar). Run `scripts/strip-dashes.ps1` on the files you changed, then read the result. The script is the deterministic guard: it reports every occurrence, and with `-Fix` it rewrites them to a comma or a hyphen. Fix any line where a colon or period reads better than the comma.

Pattern 14 examples and the "before" passages below it are behavior-bearing: they show the dashes on purpose, so leave those occurrences alone. Do not run `-Fix` on `SKILL.md` or `README.md` without checking each hit.

## Editing the skill

- Keep the YAML metadata valid.
- Treat the prompt below the metadata as the product.
- Prefer a short, clear instruction over another exception or repeated explanation.
