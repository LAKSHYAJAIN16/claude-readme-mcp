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
  - mcp__plugin_better-readme-mcp_better-readme__detect_project_kind
  - mcp__plugin_better-readme-mcp_better-readme__get_readme_buttons
  - mcp__plugin_better-readme-mcp_better-readme__list_readme_template_blocks
  - mcp__plugin_better-readme-mcp_better-readme__list_readme_templates
  - mcp__plugin_better-readme-mcp_better-readme__save_readme_template
  - mcp__plugin_better-readme-mcp_better-readme__apply_readme_template
  - mcp__plugin_better-readme-mcp_better-readme__list_reference_readmes
  - mcp__plugin_better-readme-mcp_better-readme__lint_readme
---

# README Writer

Write README files the way a real developer would describe their own project — not the way an AI summarizes one.

Before drafting or rewriting a README:

1. Decide which style to write in:
   - If the user names a saved template ("use my OSS library template"), call `apply_readme_template` (ask project vs. global scope if unclear) — it merges the template's section order and any implied options into the effective style. Call `list_readme_templates` if you need to check what's saved, or `list_readme_template_blocks` to see the available block types before building a new one via `save_readme_template`.
   - If the user has a GitHub username in mind and wants the README to match how they normally write (e.g. "make it sound like my other repos", "check my GitHub"), call `infer_style_from_github` with their username first. If they want it remembered for next time, call `set_readme_style` with the returned `inferredStyle` (ask project vs. global scope if unclear).
   - Otherwise, call `get_readme_style_guide`. It automatically returns the user's own saved style if one exists (from a prior `set_readme_style` call), otherwise the built-in default. Follow whichever it returns.
   - The built-in default: first person, a one-line tagline, a short paragraph of what/why, single-line feature bullets, then straight to runnable install/usage code blocks. No padding, no invented features.
   - If the user just states a style preference directly (e.g. "always include a screenshots section", "use emoji in headings", "no em dashes", "don't write in first person"), call `set_readme_style` with that instead of guessing. Voice/punctuation toggles: `noEnDashes` (forbid –/—), `noFirstPerson` (forbid I/my/we), `noThirdPerson` (forbid "this project"/"this repository" phrasing) — don't set both `noFirstPerson` and `noThirdPerson` unless the user clearly wants a purely neutral/imperative voice. Content toggles: `requireScreenshots`, `requireAudioSamples`, `requireLicenseSection`, `requiredSections` (array of other section names).
2. Project kind (devtool, CLI tool, library, website, hackathon project, etc.) is auto-detected by default: if no `projectKind` is saved, `get_readme_style_guide`'s response already includes a `detectedProjectKind` guess (from repo signals — package.json bin/deps, static-site files, hackathon markers), so you don't need a separate call for the common case. It's a heuristic, not ground truth — trust what the user says over it, and don't state a low-confidence guess as fact. Use it to inform tone and content: a hackathon-project README typically leads with what it does and who built it and links a demo; a devtool/library README leads with install/usage. If it's genuinely useful going forward, call `set_readme_style` with `projectKind` set to the confirmed kind. Call `detect_project_kind` directly only when you want a fresh check or the auto-detected guess looks wrong.
3. If the style has (or the user wants) a `larpScale` tolerance — how much hype/showmanship the README is allowed — calibrate to `projectKind`: a hackathon pitch can run higher (more energy, more "look what we built"), a serious devtool should stay near 0 (deadpan, no superlatives, let the code speak). `lint_readme` measures the actual hype level of the draft and flags it if it exceeds the configured max.
4. If the style has `buttons` configured (or the user asks for a Buy Me a Coffee / Ko-fi / Sponsor / Report Bug / status badge), call `get_readme_buttons` and paste the returned markdown row right under the title/tagline. Presets: `buy-me-a-coffee`, `ko-fi`, `github-sponsors`, `report-bug`, `status`, `custom`. Every link (Buy Me a Coffee URL, etc.) must come from the user — never invent or guess one, and never fill a blank slot with a placeholder link. For `status`, the right-hand text is whatever the user says (e.g. "maintained", "active development") — this project has no real uptime monitoring, so never default it to something like "all systems operational." If they want one added but haven't given the details yet, ask, then call `set_readme_style` with the new `buttons` entry.
5. Call `list_reference_readmes` for a couple of concrete examples of what "good and terse" looks like in practice.
6. Explore the actual project (source files, manifests, entry points) before writing anything — every claim in the README must be true of the current code.
7. If the effective style has `requireScreenshots` on (or the user just asked for screenshots) and the project has something visual to show (a website, a UI, a rendered CLI output), use the `/browse` skill to actually run/view it and capture a real screenshot — never invent what it looks like, and never call the raw `mcp__claude-in-chrome__*` tools directly. Save the image into the repo (e.g. `docs/screenshot.png`) and reference it from a Screenshots section. If there's nothing visual to screenshot (a library, a backend service), don't force one — say so instead of faking it.
8. Write the draft, following whichever style guide was resolved above, including any `options` it sets.
9. Call `lint_readme` on your draft. It checks against the same effective style (including `options`), so it will flag first/third-person or dash usage, missing screenshots/audio/license/sections/buttons, and larp-scale overshoot according to whatever the active style requires. Revise and lint again until the issues are gone or you have a good reason to keep something (e.g. a project that genuinely needs more length because it has real surface area, or the user's own style explicitly differs from the default).
10. Only then write the file.

Never invent features, commands, or setup steps the code doesn't actually support. If part of the project is broken or unfinished, say so briefly and honestly instead of glossing over it.

## Settings beyond chat

Typing out every option by hand isn't the only way to configure this:

- Running `npx better-readme-mcp configure` (or `npm run configure` from `mcp-server/`) starts a local page with every option as a form — voice, project kind (with a "detect from repo" button), larp scale slider, all the toggles, and `autoUpdateReadme` — scoped to this project or globally. Point the user at it if they'd rather click through settings than describe them.
- The same server's `/builder` tab is a visual template builder: add section blocks, reorder them, save the layout under a name, and apply it to a project — all writing to the same `structure`/`options` fields `apply_readme_template` uses. Point the user there if they want to compose a template by clicking instead of describing it in chat.
- If `autoUpdateReadme` is on, a bundled Stop hook prompts a README accuracy check after any turn that leaves uncommitted changes in the project. When you're invoked because of that hook's reason (it names `better-readme-mcp: autoUpdateReadme is on...`), check README.md against what actually changed — via git status/diff — and only touch it if something is now stale or missing; don't rewrite it from scratch every time.
