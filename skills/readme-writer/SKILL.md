---
description: Write or rewrite a README.md in a concise, human, first-person voice instead of generic AI-report style. Use when creating a new README, or when a README feels too formal, boilerplate, or AI-generated.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - mcp__plugin_better-readme-mcp_better-readme__get_readme_style_guide
  - mcp__plugin_better-readme-mcp_better-readme__set_readme_style
  - mcp__plugin_better-readme-mcp_better-readme__infer_style_from_github
  - mcp__plugin_better-readme-mcp_better-readme__list_reference_readmes
  - mcp__plugin_better-readme-mcp_better-readme__lint_readme
---

# README Writer

Write README files the way a real developer would describe their own project — not the way an AI summarizes one.

Before drafting or rewriting a README:

1. Decide which style to write in:
   - If the user has a GitHub username in mind and wants the README to match how they normally write (e.g. "make it sound like my other repos", "check my GitHub"), call `infer_style_from_github` with their username first. If they want it remembered for next time, call `set_readme_style` with the returned `inferredStyle` (ask project vs. global scope if unclear).
   - Otherwise, call `get_readme_style_guide`. It automatically returns the user's own saved style if one exists (from a prior `set_readme_style` call), otherwise the built-in default. Follow whichever it returns.
   - The built-in default: first person, a one-line tagline, a short paragraph of what/why, single-line feature bullets, then straight to runnable install/usage code blocks. No padding, no invented features.
   - If the user just states a style preference directly (e.g. "always include a screenshots section", "use emoji in headings", "no em dashes", "don't write in first person"), call `set_readme_style` with that instead of guessing. Three boolean toggles exist specifically for voice/punctuation: `noEnDashes` (forbid –/—), `noFirstPerson` (forbid I/my/we), `noThirdPerson` (forbid "this project"/"this repository" phrasing). Don't set both `noFirstPerson` and `noThirdPerson` unless the user clearly wants a purely neutral/imperative voice with neither.
2. Call `list_reference_readmes` for a couple of concrete examples of what "good and terse" looks like in practice.
3. Explore the actual project (source files, manifests, entry points) before writing anything — every claim in the README must be true of the current code.
4. Write the draft, following whichever style guide was resolved in step 1, including any `options` it sets.
5. Call `lint_readme` on your draft. It checks against the same effective style (including `options`), so it will flag first/third-person or dash usage according to whatever the active style forbids. If it flags boilerplate phrases, wrong voice, dash usage, missing tagline, or excessive length, revise and lint again until the issues are gone or you have a good reason to keep something (e.g. a project that genuinely needs more length because it has real surface area — a monorepo, multiple sub-apps, etc., or the user's own style explicitly differs from the default).
6. Only then write the file.

Never invent features, commands, or setup steps the code doesn't actually support. If part of the project is broken or unfinished, say so briefly and honestly instead of glossing over it.
