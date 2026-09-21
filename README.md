# better-readme-mcp

> A Claude Code plugin that stops your READMEs from reading like AI reports.

I kept generating READMEs across my repos that were technically accurate but sounded like nobody — third-person, padded with corporate-speak, structured the same way every time. This plugin fixes that: it gives Claude a style guide, a few real terse READMEs (fd, yargs, httpie) to reference, and a linter that catches boilerplate phrasing and third-person drift before you commit.

## What's in it

- A skill (`readme-writer`) that guides Claude through writing a README the way an actual person would describe their own project.
- An MCP server with five tools: `get_readme_style_guide`, `set_readme_style`, `infer_style_from_github`, `list_reference_readmes`, `lint_readme`.
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
