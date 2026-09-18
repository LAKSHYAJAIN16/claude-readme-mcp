# better-readme-mcp

> A Claude Code plugin that stops your READMEs from reading like AI reports.

I kept generating READMEs across my repos that were technically accurate but sounded like nobody — third-person, padded with corporate-speak, structured the same way every time. This plugin fixes that: it gives Claude a style guide, a few real terse READMEs (fd, yargs, httpie) to reference, and a linter that catches boilerplate phrasing and third-person drift before you commit.

## What's in it

- A skill (`readme-writer`) that guides Claude through writing a README the way an actual person would describe their own project.
- An MCP server with three tools: `get_readme_style_guide`, `list_reference_readmes`, `lint_readme`.
- No network calls, no API keys — everything's bundled into one file.

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
