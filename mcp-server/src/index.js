#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import examples from "../data/examples.json" with { type: "json" };
import {
  DEFAULT_STYLE as styleGuide,
  PROJECT_STYLE_PATH,
  GLOBAL_STYLE_PATH,
  readJsonIfExists,
  loadEffectiveStyleGuide,
  writeStyleOverride,
} from "./style.js";
import { detectProjectKind } from "./detect.js";
import { BUTTON_PRESETS, renderButtonsMarkdown } from "./buttons.js";
import {
  BLOCK_CATALOG,
  BLOCK_TYPES,
  listTemplates,
  readTemplate,
  writeTemplate,
  blocksToStructure,
  blocksToOptions,
} from "./templates.js";

if (process.argv[2] === "configure") {
  const { runConfigureServer } = await import("./configure.js");
  await runConfigureServer();
}

const server = new McpServer({
  name: "better-readme-mcp",
  version: "0.1.0",
});

server.registerTool(
  "get_readme_style_guide",
  {
    title: "Get README style guide",
    description:
      "Returns the README style guide this plugin enforces: the user's own saved style if one exists (project-level .better-readme-style.json, or global ~/.better-readme-mcp/style.json), otherwise the built-in concise/human/first-person default. If no projectKind is set, this also auto-runs project-kind detection and includes it as detectedProjectKind — no separate detect_project_kind call needed unless you want a fresh/explicit check. Call this before drafting or rewriting any README.md.",
    inputSchema: {},
  },
  async () => {
    const { style, source, path: overridePath } = loadEffectiveStyleGuide();
    const note =
      source === "default"
        ? "Using the built-in default style guide. No custom style saved (use set_readme_style or infer_style_from_github to create one)."
        : `Using a custom style guide saved at ${source} scope (${overridePath}).`;

    const hasProjectKind = Boolean(style.options && style.options.projectKind);
    const detectedProjectKind = hasProjectKind ? null : detectProjectKind();
    const detectionNote = detectedProjectKind
      ? `\n\nNo projectKind is set — auto-detected: ${detectedProjectKind.guess} (${detectedProjectKind.confidence} confidence). See detectedProjectKind below; call set_readme_style with projectKind to lock it in, or detect_project_kind again for fresh signals.`
      : "";

    return {
      content: [
        {
          type: "text",
          text: `${note}${detectionNote}\n\n${JSON.stringify({ ...style, detectedProjectKind }, null, 2)}`,
        },
      ],
    };
  }
);

server.registerTool(
  "set_readme_style",
  {
    title: "Save a custom README style",
    description:
      "Persists a custom README style that overrides the built-in default for future get_readme_style_guide calls. Save at 'project' scope (this repo only, .better-readme-style.json) or 'global' scope (every project, ~/.better-readme-mcp/style.json). Pass only the fields you want to override — omitted fields keep the built-in default. Typically called with the profile returned by infer_style_from_github, or with fields the user states directly (e.g. 'I always use emoji in headings').",
    inputSchema: {
      scope: z
        .enum(["project", "global"])
        .default("project")
        .describe("Where to save: 'project' (this repo only) or 'global' (all projects for this user)."),
      voice: z.string().optional().describe("Description of the voice/tone to write in."),
      structure: z.array(z.string()).optional().describe("Ordered list of structural conventions to follow."),
      length: z.string().optional().describe("Guidance on typical README length."),
      groundedness: z.string().optional().describe("Rules about only stating verifiable facts."),
      avoidBoilerplatePhrases: z
        .array(z.string())
        .optional()
        .describe("Phrases to flag/avoid. Replaces the built-in list entirely if provided."),
      checklist: z.array(z.string()).optional().describe("Self-review checklist items."),
      notes: z.string().optional().describe("Any other freeform style notes, e.g. recurring sections or quirks."),
      noEnDashes: z
        .boolean()
        .optional()
        .describe("If true, lint_readme flags en dashes (–) and em dashes (—) in the body text."),
      noFirstPerson: z
        .boolean()
        .optional()
        .describe("If true, lint_readme flags any first-person language (I/my/we) instead of requiring it."),
      noThirdPerson: z
        .boolean()
        .optional()
        .describe(
          'If true, lint_readme flags any third-person language ("this project", "this repository", etc.) outright, rather than only when it outnumbers first-person language.'
        ),
      requireScreenshots: z
        .boolean()
        .optional()
        .describe("If true, lint_readme flags a missing screenshot/demo image (no `![...](...)` markdown found)."),
      requireAudioSamples: z
        .boolean()
        .optional()
        .describe("If true, lint_readme flags a missing audio sample link (no .mp3/.wav/.ogg/.m4a/.flac link found)."),
      requireLicenseSection: z
        .boolean()
        .optional()
        .describe(
          "If true, lint_readme flags a missing mention of a license. If a LICENSE file exists in the project but isn't referenced, the flag names it."
        ),
      requiredSections: z
        .array(z.string())
        .optional()
        .describe(
          "Other heading names that must appear somewhere in the README (matched case-insensitively as a substring of an actual heading), e.g. ['Contributing', 'Roadmap']. Replaces the list entirely if provided."
        ),
      projectKind: z
        .string()
        .optional()
        .describe(
          "What kind of project this is, in a few words — e.g. 'devtool', 'cli-tool', 'library', 'website', 'hackathon-project', 'app', 'api'. Free text, not a fixed enum. Sets the tolerance baseline larpScale is measured against; use detect_project_kind to guess it from the repo."
        ),
      larpScale: z
        .number()
        .min(0)
        .max(10)
        .optional()
        .describe(
          "How much hype/showmanship is acceptable in the README, 0 (deadpan, zero embellishment — a serious devtool) to 10 (full hackathon-pitch energy). lint_readme measures the README's actual hype level and flags it if it exceeds this."
        ),
      autoUpdateReadme: z
        .boolean()
        .optional()
        .describe(
          "If true, a bundled Stop hook prompts Claude to check whether README.md is still accurate after any turn that left uncommitted changes in this project, and update it (via this same skill/tools) if needed. Doesn't affect lint_readme directly."
        ),
      buttons: z
        .array(
          z.object({
            preset: z
              .enum(["buy-me-a-coffee", "ko-fi", "github-sponsors", "report-bug", "status", "custom"])
              .describe("Which kind of button/badge this is."),
            url: z
              .string()
              .optional()
              .describe(
                "Link the badge opens when clicked. Required (the user's own link) for buy-me-a-coffee/ko-fi/github-sponsors/report-bug/custom; optional for status."
              ),
            label: z
              .string()
              .optional()
              .describe("Badge text. Defaults to a sensible preset label; required for 'custom'."),
            text: z
              .string()
              .optional()
              .describe(
                "Right-hand value for the 'status' preset only, e.g. 'maintained', 'active development', 'beta'. This project has no real uptime monitoring, so never default this to something like 'all systems operational' — only set what the user explicitly states."
              ),
            color: z
              .string()
              .optional()
              .describe("shields.io color, e.g. 'brightgreen' or a hex code like 'FFDD00'. Defaults to a preset color."),
            logo: z.string().optional().describe("shields.io/simple-icons logo name, overriding the preset default."),
            style: z
              .enum(["flat", "flat-square", "for-the-badge", "plastic", "social"])
              .optional()
              .describe("shields.io badge style. Defaults to 'flat'."),
            badgeUrl: z
              .string()
              .optional()
              .describe("Full custom badge image URL, bypassing all the auto-generation above, for total control."),
          })
        )
        .optional()
        .describe(
          "Buttons/badges rendered as a shields.io row under the title (e.g. Buy Me a Coffee, Ko-fi, GitHub Sponsors, Report Bug, a status badge, or a fully custom one). Replaces the list entirely if provided. Use get_readme_buttons to render the current list to markdown."
        ),
    },
  },
  async ({
    scope,
    noEnDashes,
    noFirstPerson,
    noThirdPerson,
    requireScreenshots,
    requireAudioSamples,
    requireLicenseSection,
    requiredSections,
    projectKind,
    larpScale,
    autoUpdateReadme,
    buttons,
    ...fields
  }) => {
    const targetPath = scope === "global" ? GLOBAL_STYLE_PATH : PROJECT_STYLE_PATH;
    const existing = readJsonIfExists(targetPath) || {};
    const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    const optionUpdates = Object.fromEntries(
      Object.entries({
        noEnDashes,
        noFirstPerson,
        noThirdPerson,
        requireScreenshots,
        requireAudioSamples,
        requireLicenseSection,
        requiredSections,
        projectKind,
        larpScale,
        autoUpdateReadme,
        buttons,
      }).filter(([, v]) => v !== undefined)
    );
    const mergedOptions = { ...(existing.options || {}), ...optionUpdates };

    const merged = { ...existing, ...updates };
    if (Object.keys(mergedOptions).length > 0) merged.options = mergedOptions;

    writeStyleOverride(scope, merged);

    return {
      content: [
        {
          type: "text",
          text: `Saved custom style at ${scope} scope: ${targetPath}\n\n${JSON.stringify(merged, null, 2)}`,
        },
      ],
    };
  }
);

server.registerTool(
  "detect_project_kind",
  {
    title: "Guess what kind of project this is",
    description:
      "Inspects the current project directory for heuristics (package.json bin/dependencies, static-site files, hackathon markers) and guesses whether it's a devtool, CLI tool, library, website, hackathon project, or something else. This is a best-effort guess, not ground truth — confirm with the user if the confidence is low, and prefer what they say. The result is meant to inform projectKind and larpScale when calling set_readme_style.",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(detectProjectKind(), null, 2) }],
  })
);

server.registerTool(
  "get_readme_buttons",
  {
    title: "Render configured README buttons/badges",
    description:
      "Renders the shields.io badge row for the `buttons` configured via set_readme_style (presets: buy-me-a-coffee, ko-fi, github-sponsors, report-bug, status, custom). Returns a note (not markdown) if none are configured. Place the returned markdown line right under the title/tagline.",
    inputSchema: {},
  },
  async () => {
    const { style } = loadEffectiveStyleGuide();
    const buttons = (style.options && style.options.buttons) || [];
    if (buttons.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No buttons configured. Available presets: ${Object.keys(BUTTON_PRESETS).join(", ")}. Add some via set_readme_style's \`buttons\` array — ask the user for links (e.g. their Buy Me a Coffee URL) rather than inventing placeholders.`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `${renderButtonsMarkdown(buttons)}\n\n(${buttons.length} button(s) — paste the line above directly under the README's title/tagline.)`,
        },
      ],
    };
  }
);

server.registerTool(
  "list_readme_template_blocks",
  {
    title: "List available README template block types",
    description:
      "Returns the catalog of section block types (title-tagline, badges, description, features, install, usage, screenshots, configuration, api-reference, contributing, license, roadmap, custom) usable when building or saving a README template. Each block maps to a `structure` instruction; some also imply a style option (e.g. 'screenshots' implies requireScreenshots).",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(BLOCK_CATALOG, null, 2) }],
  })
);

server.registerTool(
  "list_readme_templates",
  {
    title: "List saved README templates",
    description:
      "Returns README structure templates saved globally (via the visual builder — `npx better-readme-mcp configure`, Builder tab — or save_readme_template). Each is a named, ordered list of section blocks.",
    inputSchema: {},
  },
  async () => {
    const templates = listTemplates();
    return {
      content: [
        {
          type: "text",
          text:
            templates.length === 0
              ? "No templates saved yet. Use save_readme_template, or the visual builder (npx better-readme-mcp configure, Builder tab)."
              : JSON.stringify(templates, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  "save_readme_template",
  {
    title: "Save a README structure template",
    description:
      "Saves a named, ordered list of section blocks as a reusable README template (global, shared across projects). Call list_readme_template_blocks first to see valid block types. Overwrites any existing template with the same name.",
    inputSchema: {
      name: z.string().describe("Template name, e.g. 'OSS library' or 'hackathon pitch'."),
      blocks: z
        .array(
          z.object({
            type: z.enum(BLOCK_TYPES).describe("Block type from list_readme_template_blocks."),
            text: z
              .string()
              .optional()
              .describe("Required for 'custom' blocks (the section instruction); optionally overrides any other block's default instruction."),
          })
        )
        .min(1)
        .describe("Ordered list of blocks — the order here is the order sections will appear in."),
    },
  },
  async ({ name, blocks }) => {
    const savedPath = writeTemplate(name, blocks);
    return {
      content: [
        {
          type: "text",
          text: `Saved template "${name}" to ${savedPath}.\n\nResulting structure:\n${blocksToStructure(blocks)
            .map((s, i) => `${i + 1}. ${s}`)
            .join("\n")}`,
        },
      ],
    };
  }
);

server.registerTool(
  "apply_readme_template",
  {
    title: "Apply a saved README template to this project",
    description:
      "Loads a saved template and merges its block order into the effective style's `structure` (and any implied options, like requireScreenshots) at project or global scope — same code path as set_readme_style, so get_readme_style_guide picks it up immediately. Other style fields (voice, notes, etc.) are left untouched.",
    inputSchema: {
      name: z.string().describe("Name of a template from list_readme_templates."),
      scope: z
        .enum(["project", "global"])
        .default("project")
        .describe("Where to apply it: 'project' (this repo only) or 'global' (all projects)."),
    },
  },
  async ({ name, scope }) => {
    const template = readTemplate(name);
    if (!template) {
      return {
        content: [
          { type: "text", text: `No template named "${name}" found. Call list_readme_templates to see what's saved.` },
        ],
        isError: true,
      };
    }

    const targetPath = scope === "global" ? GLOBAL_STYLE_PATH : PROJECT_STYLE_PATH;
    const existing = readJsonIfExists(targetPath) || {};
    const structure = blocksToStructure(template.blocks);
    const optionSideEffects = blocksToOptions(template.blocks);
    const mergedOptions = { ...(existing.options || {}), ...optionSideEffects };

    const merged = { ...existing, structure };
    if (Object.keys(mergedOptions).length > 0) merged.options = mergedOptions;
    writeStyleOverride(scope, merged);

    return {
      content: [
        {
          type: "text",
          text: `Applied template "${template.name}" at ${scope} scope (${targetPath}).\n\nstructure:\n${structure
            .map((s, i) => `${i + 1}. ${s}`)
            .join("\n")}\n\noptions merged: ${JSON.stringify(optionSideEffects)}`,
        },
      ],
    };
  }
);

function extractHeadings(content) {
  return (content.match(/^#{1,3}\s+.+$/gm) || []).map((h) =>
    h.replace(/^#+\s*/, "").replace(/[^\w\s/&-]/g, "").trim()
  );
}

function analyzeReadmeText(content) {
  const lines = content.split(/\r?\n/);
  const lineCount = lines.length;
  const firstPersonMarkers = (content.match(/\b(I|I'm|I've|I'll|my|we're|we've)\b/g) || []).length;
  const thirdPersonMarkers = (
    content.match(/\b(this project|this repository|this repo|the application|users can)\b/gi) || []
  ).length;
  const hasTagline = /^>\s*.+/m.test(lines.slice(0, 6).join("\n"));
  const hasCodeBlock = /```/.test(content);
  const hasEmoji = /\p{Extended_Pictographic}/u.test(content);
  const hasBadges = /\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)|!\[[^\]]*\]\(https:\/\/img\.shields\.io/.test(content);
  const headings = extractHeadings(content);
  return { lineCount, firstPersonMarkers, thirdPersonMarkers, hasTagline, hasCodeBlock, hasEmoji, hasBadges, headings };
}

server.registerTool(
  "infer_style_from_github",
  {
    title: "Infer a README style from a GitHub user's own repos",
    description:
      "Fetches READMEs from a GitHub user's public, non-fork repositories and derives a style profile (voice, typical length, tagline/emoji/badge usage, common section headings) from how they actually write. Use this when the user wants their README to match their own established style rather than the built-in default. Set the GITHUB_TOKEN env var to raise the unauthenticated GitHub API rate limit (60 requests/hour without it). Returns a profile in the same shape set_readme_style accepts — pass it there to persist it.",
    inputSchema: {
      username: z.string().describe("GitHub username to sample repositories from."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(5)
        .describe("Max number of repos to sample, most recently updated first (default 5, max 10)."),
    },
  },
  async ({ username, limit }) => {
    const headers = {
      "User-Agent": "better-readme-mcp",
      Accept: "application/vnd.github+json",
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    let repos;
    try {
      const reposRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`,
        { headers }
      );
      if (!reposRes.ok) {
        return {
          content: [
            {
              type: "text",
              text: `GitHub API returned ${reposRes.status} for user "${username}". ${
                reposRes.status === 403
                  ? "Likely rate-limited — set the GITHUB_TOKEN env var to raise the limit."
                  : "Check the username."
              }`,
            },
          ],
          isError: true,
        };
      }
      repos = await reposRes.json();
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to reach GitHub API: ${err.message}` }],
        isError: true,
      };
    }

    const candidates = repos.filter((r) => !r.fork && !r.archived).slice(0, limit);
    if (candidates.length === 0) {
      return {
        content: [{ type: "text", text: `No non-fork repos found for "${username}".` }],
        isError: true,
      };
    }

    const samples = [];
    for (const repo of candidates) {
      try {
        const readmeRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/readme`,
          { headers }
        );
        if (!readmeRes.ok) continue;
        const data = await readmeRes.json();
        const content = Buffer.from(data.content, data.encoding || "base64").toString("utf8");
        samples.push({ repo: repo.name, ...analyzeReadmeText(content) });
      } catch {
        // skip repos whose README couldn't be fetched/decoded
      }
    }

    if (samples.length === 0) {
      return {
        content: [
          { type: "text", text: `Sampled ${candidates.length} repo(s) for "${username}" but none had a readable README.` },
        ],
        isError: true,
      };
    }

    const n = samples.length;
    const avgLines = Math.round(samples.reduce((s, r) => s + r.lineCount, 0) / n);
    const pctFirstPerson = samples.filter((r) => r.firstPersonMarkers > r.thirdPersonMarkers).length / n;
    const pctTagline = samples.filter((r) => r.hasTagline).length / n;
    const pctCodeBlock = samples.filter((r) => r.hasCodeBlock).length / n;
    const pctEmoji = samples.filter((r) => r.hasEmoji).length / n;
    const pctBadges = samples.filter((r) => r.hasBadges).length / n;

    const headingCounts = new Map();
    for (const r of samples) {
      for (const h of r.headings) {
        const key = h.toLowerCase();
        headingCounts.set(key, (headingCounts.get(key) || 0) + 1);
      }
    }
    const commonHeadings = [...headingCounts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([heading]) => heading);

    const inferredStyle = {
      voice:
        pctFirstPerson >= 0.5
          ? "First person — this matches how the user's other READMEs are written."
          : "Mostly third-person/neutral in the user's existing READMEs, though first-person is still generally more human. Confirm with the user before matching third-person voice.",
      structure: [
        pctTagline >= 0.5 ? "Include a one-line tagline near the top (blockquote or bold line)." : "Tagline is inconsistent across their repos — optional.",
        pctCodeBlock >= 0.5 ? "Include a runnable install/usage code block." : "Code blocks are inconsistent across their repos.",
        commonHeadings.length
          ? `Recurring section headings across their repos: ${commonHeadings.join(", ")}.`
          : "No strongly recurring section headings found.",
        pctEmoji >= 0.5 ? "They use emoji in READMEs — okay to include sparingly." : "They rarely use emoji — avoid it.",
        pctBadges >= 0.5 ? "They use badges/shields near the top." : "They rarely use badges.",
      ],
      length: `Roughly ${avgLines} lines on average across their sampled repos (sample size ${n}).`,
      groundedness: styleGuide.groundedness,
      avoidBoilerplatePhrases: styleGuide.avoidBoilerplatePhrases,
      notes: `Inferred from ${n} of ${candidates.length} sampled repo(s): ${samples.map((s) => s.repo).join(", ")}.`,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              inferredStyle,
              stats: { sampledRepos: samples.map((s) => s.repo), sampleSize: n, avgLines, pctFirstPerson, pctTagline, pctCodeBlock, pctEmoji, pctBadges, commonHeadings },
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  "list_reference_readmes",
  {
    title: "List reference README excerpts",
    description:
      "Returns curated excerpts from real, well-regarded open-source READMEs (fd, yargs, httpie) to use as concrete style references. Optionally filter by project kind.",
    inputSchema: {
      kind: z
        .enum(["cli-tool", "library"])
        .optional()
        .describe(
          "Filter to a specific kind of project, e.g. 'cli-tool' or 'library'. Omit to get all examples."
        ),
    },
  },
  async ({ kind }) => {
    const filtered = kind ? examples.filter((e) => e.kind === kind) : examples;
    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
    };
  }
);

const HYPE_WORDS = [
  "revolutionary",
  "revolutionize",
  "game-changing",
  "game-changer",
  "groundbreaking",
  "next-generation",
  "next-gen",
  "world-class",
  "industry-leading",
  "award-winning",
  "unprecedented",
  "supercharged",
  "supercharge",
  "blazing fast",
  "insanely fast",
  "mind-blowing",
  "unbelievable",
  "life-changing",
  "disrupt",
  "disruptive",
  "unicorn",
  "10x",
  "best in the world",
  "changes everything",
];

function measureLarpScale(content) {
  const lower = content.toLowerCase();
  const hypeWordHits = HYPE_WORDS.filter((w) => lower.includes(w));
  const exclamationCount = (content.match(/!/g) || []).length;
  const extraExclamations = Math.max(0, exclamationCount - 1);
  const raw = hypeWordHits.length * 2 + extraExclamations;
  const measured = Math.max(0, Math.min(10, Math.round(raw)));
  const label =
    measured <= 1
      ? "Grounded"
      : measured <= 3
        ? "Mostly honest"
        : measured <= 6
          ? "Some larping"
          : measured <= 8
            ? "Heavy larp"
            : "Total larp — this is cosplay, not a README";
  return { measured, label, hypeWordHits, exclamationCount };
}

server.registerTool(
  "lint_readme",
  {
    title: "Lint a README draft",
    description:
      "Runs deterministic checks on a README draft against the effective style guide (the user's saved override if one exists, otherwise the built-in default): length, boilerplate AI-report phrases, voice (first/third person, per noFirstPerson/noThirdPerson), en/em dash usage (per noEnDashes), tagline presence, code-block presence, screenshots/audio/license/requiredSections (when required), and a 'larp scale' measuring how much the README oversells itself (hype words, exclamation marks) against the style's configured larpScale tolerance. Call this after drafting a README to self-check before finalizing.",
    inputSchema: {
      content: z.string().describe("The full README markdown text to lint."),
    },
  },
  async ({ content }) => {
    const { style } = loadEffectiveStyleGuide();
    const boilerplateList = style.avoidBoilerplatePhrases || [];
    const options = style.options || {};

    const lines = content.split(/\r?\n/);
    const lineCount = lines.length;
    const lowerContent = content.toLowerCase();

    const boilerplateHits = boilerplateList.filter((phrase) =>
      lowerContent.includes(phrase.toLowerCase())
    );

    const firstPersonMarkers = (
      content.match(/\b(I|I'm|I've|I'll|my|we're|we've)\b/g) || []
    ).length;
    const thirdPersonMarkers = (
      content.match(
        /\b(this project|this repository|this repo|the application|users can)\b/gi
      ) || []
    ).length;
    const dashMatches = content.match(/[–—]/g) || [];
    const headings = extractHeadings(content);
    const lowerHeadings = headings.map((h) => h.toLowerCase());
    const hasImage = /!\[[^\]]*\]\([^)]+\)/.test(content);
    const hasAudioLink = /\.(mp3|wav|ogg|m4a|flac)(\?[^)\s]*)?/i.test(content);
    const mentionsLicense = /\blicense\b/i.test(content);

    const hasTagline = /^>\s*.+/m.test(lines.slice(0, 6).join("\n"));
    const hasCodeBlock = /```/.test(content);
    const hasH1 = /^#\s+.+/m.test(content);

    const issues = [];
    if (lineCount > 60)
      issues.push(
        `README is ${lineCount} lines — that's long unless the project genuinely has that much surface area. Consider trimming.`
      );
    if (boilerplateHits.length > 0)
      issues.push(
        `Found AI-report boilerplate phrases: ${boilerplateHits.join(", ")}. Cut or replace these.`
      );
    if (options.noFirstPerson && firstPersonMarkers > 0)
      issues.push(
        `Found ${firstPersonMarkers} first-person marker(s) (I/my/we) — this style forbids first-person language.`
      );
    if (options.noThirdPerson && thirdPersonMarkers > 0)
      issues.push(
        `Found ${thirdPersonMarkers} third-person marker(s) ("this project", "this repository", etc.) — this style forbids third-person language.`
      );
    if (!options.noFirstPerson && !options.noThirdPerson) {
      if (firstPersonMarkers === 0)
        issues.push(
          "No first-person language detected (I/my/we). This reads like a third-person report, not the owner's own voice."
        );
      if (thirdPersonMarkers > firstPersonMarkers)
        issues.push(
          'Third-person phrases ("this project", "this repository") outnumber first-person ones — rewrite in the owner\'s voice.'
        );
    }
    if (options.noEnDashes && dashMatches.length > 0)
      issues.push(
        `Found ${dashMatches.length} en/em dash character(s) (–/—) — this style avoids them. Rewrite with a period, comma, or parentheses instead.`
      );
    if (options.requireScreenshots && !hasImage)
      issues.push(
        "No screenshot/demo image found (no `![...](...)` markdown). Add one showing the project in use."
      );
    if (options.requireAudioSamples && !hasAudioLink)
      issues.push(
        "No audio sample link found (.mp3/.wav/.ogg/.m4a/.flac). Add a link to an audio demo."
      );
    if (options.requireLicenseSection && !mentionsLicense) {
      const licenseFile = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"].find((f) =>
        fs.existsSync(path.join(process.cwd(), f))
      );
      issues.push(
        licenseFile
          ? `No mention of a license, but a ${licenseFile} file exists in the project. Add a "License" section that references it.`
          : 'No mention of a license. Add a "License" section (and a LICENSE file if the project doesn\'t have one).'
      );
    }
    const missingSections = (options.requiredSections || []).filter(
      (section) => !lowerHeadings.some((h) => h.includes(section.toLowerCase()))
    );
    if (missingSections.length > 0)
      issues.push(`Missing required section(s): ${missingSections.join(", ")}.`);
    const larpScale = measureLarpScale(content);
    if (typeof options.larpScale === "number" && larpScale.measured > options.larpScale)
      issues.push(
        `Reads hypier than allowed: measured larp scale ${larpScale.measured}/10 ("${larpScale.label}") vs. your configured max of ${options.larpScale}/10. Hype words found: ${larpScale.hypeWordHits.join(", ") || "none — mostly exclamation marks"}.`
      );
    const configuredButtons = options.buttons || [];
    if (configuredButtons.length > 0 && !lowerContent.includes("shields.io")) {
      issues.push(
        `${configuredButtons.length} button(s)/badge(s) are configured but none appear in the README. Call get_readme_buttons and paste the row under the title.`
      );
    }
    if (!hasTagline)
      issues.push(
        "No one-line tagline/blockquote near the top. Consider adding a `> tagline` right under the title."
      );
    if (!hasCodeBlock)
      issues.push(
        "No fenced code block found. Most READMEs should show a runnable install/usage snippet."
      );
    if (!hasH1) issues.push("No H1 title (`# Title`) found.");

    const score = Math.max(0, 100 - issues.length * 15 - boilerplateHits.length * 5);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              lineCount,
              score,
              hasTagline,
              hasCodeBlock,
              hasH1,
              boilerplateHits,
              firstPersonMarkers,
              thirdPersonMarkers,
              dashCount: dashMatches.length,
              hasImage,
              hasAudioLink,
              mentionsLicense,
              headings,
              larpScale,
              optionsApplied: options,
              issues: issues.length ? issues : ["No issues found — looks tight and human."],
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
