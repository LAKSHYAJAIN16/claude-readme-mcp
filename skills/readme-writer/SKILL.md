---
description: Write or rewrite a README.md in a concise, human, first-person voice instead of generic AI-report style. Use when creating a new README, or when a README feels too formal, boilerplate, or AI-generated.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - mcp__plugin_better-readme-mcp_better-readme__get_readme_style_guide
  - mcp__plugin_better-readme-mcp_better-readme__list_reference_readmes
  - mcp__plugin_better-readme-mcp_better-readme__lint_readme
---

# README Writer

Write README files the way a real developer would describe their own project — not the way an AI summarizes one.

Before drafting or rewriting a README:

1. Call `get_readme_style_guide` and follow it. The core idea: first person, a one-line tagline, a short paragraph of what/why, single-line feature bullets, then straight to runnable install/usage code blocks. No padding, no invented features.
2. Call `list_reference_readmes` for a couple of concrete examples of what "good and terse" looks like in practice.
3. Explore the actual project (source files, manifests, entry points) before writing anything — every claim in the README must be true of the current code.
4. Write the draft.
5. Call `lint_readme` on your draft. If it flags boilerplate phrases, missing first-person voice, missing tagline, or excessive length, revise and lint again until the issues are gone or you have a good reason to keep something (e.g. a project that genuinely needs more length because it has real surface area — a monorepo, multiple sub-apps, etc.).
6. Only then write the file.

Never invent features, commands, or setup steps the code doesn't actually support. If part of the project is broken or unfinished, say so briefly and honestly instead of glossing over it.
