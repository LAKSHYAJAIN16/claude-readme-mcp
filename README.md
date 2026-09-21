# better-readme-mcp

> A Claude Code plugin that stops your READMEs from reading like AI reports.

I kept generating READMEs across my repos that were technically accurate but sounded like nobody — third-person, padded with corporate-speak, structured the same way every time. This plugin fixes that: it gives Claude a style guide, a few real terse READMEs (fd, yargs, httpie) to reference, and a linter that catches boilerplate phrasing and third-person drift before you commit.

## What's in it

- A skill (`readme-writer`) that guides Claude through writing a README the way an actual person would describe their own project.
- An MCP server with six tools: `get_readme_style_guide`, `set_readme_style`, `infer_style_from_github`, `detect_project_kind`, `list_reference_readmes`, `lint_readme`.
- A default style guide bundled in, but you can override it with your own (per-project or global), or have it inferred from your existing GitHub repos.

## Install

As a Claude Code plugin (bundles the skill too):
```bash
/plugin marketplace add LAKSHYAJAIN16/better-readme-mcp
/plugin install better-readme-mcp@better-readme-mcp-marketplace
```

Then just ask Claude to write or clean up a README — the skill kicks in automatically.

Or as a plain MCP server, in any MCP client's config:
```json
{
  "mcpServers": {
    "better-readme": { "command": "npx", "args": ["-y", "better-readme-mcp"] }
  }
}
```

## Try it locally without installing

```bash
cd mcp-server
npm install
npm run build
node dist/index.js   # speaks MCP over stdio
```

## How the linter scores a README

`lint_readme` checks line count, first-person vs. third-person language, a list of overused corporate phrases, and whether there's a tagline and a runnable code block near the top. It's not trying to be clever — just catching the tells of an AI-report README. (The full phrase list is in `mcp-server/data/style-guide.json`.)

## Using your own style instead of the default

`get_readme_style_guide` checks for a saved override before falling back to the bundled default: first `.better-readme-style.json` in the current project, then `~/.better-readme-mcp/style.json` globally. Two ways to set one:

- Tell Claude your preferences directly ("I always add a screenshots section") and it'll call `set_readme_style` to save them.
- Ask Claude to match your existing repos ("write this like my other READMEs, I'm LAKSHYAJAIN16 on GitHub") — `infer_style_from_github` pulls a few of your real READMEs via the public GitHub API and derives voice, length, and common sections from them. Set `GITHUB_TOKEN` in your environment if you hit the 60-req/hour unauthenticated rate limit.

There's also a longer list of explicit options `set_readme_style` accepts, all checked by `lint_readme`:

- `noEnDashes` — flag en dashes (–) and em dashes (—) in the body.
- `noFirstPerson` — flag any I/my/we language instead of requiring it.
- `noThirdPerson` — flag any "this project"/"this repository" phrasing outright.
- `requireScreenshots` — flag a missing screenshot/demo image.
- `requireAudioSamples` — flag a missing audio sample link (.mp3/.wav/.ogg/.m4a/.flac).
- `requireLicenseSection` — flag a missing license mention (names the LICENSE file if one exists but isn't referenced).
- `requiredSections` — an array of other heading names that must be present (e.g. `["Contributing", "Roadmap"]`).
- `projectKind` — free text describing what this is (`devtool`, `website`, `hackathon-project`, etc.). Call `detect_project_kind` to get a heuristic guess from the repo (package.json fields, static-site files, hackathon markers) instead of guessing blind.
- `larpScale` — 0 (deadpan, zero hype) to 10 (full hackathon-pitch energy). `lint_readme` measures the draft's actual hype level (superlatives, exclamation marks) and flags it if it exceeds this.
- `autoUpdateReadme` — see below.

## Configuring without chatting through it

If you'd rather click through settings than describe them, run:

```bash
npx better-readme-mcp configure
```

(or `npm run configure` from `mcp-server/` if you're working in this repo). It starts a local page — every option above as a form, a "detect from repo" button for `projectKind`, a slider for `larpScale` — scoped to this project or global, and opens it in your browser. Saves go through the same code path as `set_readme_style`, so it's equivalent either way.

## Auto-updating the README every prompt

Setting `autoUpdateReadme: true` (via chat, or the config page) turns on a bundled Stop hook (`hooks/check-readme-hook.js`). After any turn that leaves uncommitted git changes in the project, it prompts Claude to check README.md against what actually changed and update it if it's gone stale — this is a real hook, not just a stored preference, because "do X after every prompt" isn't something a skill can make itself do on its own. It no-ops outside a git repo, when nothing changed, or when `autoUpdateReadme` isn't set.

## Screenshots

If `requireScreenshots` is on and the project has something visual (a website, a UI), the skill uses gstack's `/browse` skill to actually run it and capture a real screenshot instead of describing one from imagination.
