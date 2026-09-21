#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import styleGuide from "../data/style-guide.json" with { type: "json" };
import examples from "../data/examples.json" with { type: "json" };

const server = new McpServer({
  name: "better-readme-mcp",
  version: "0.1.0",
});

const PROJECT_STYLE_PATH = path.join(process.cwd(), ".better-readme-style.json");
const GLOBAL_STYLE_PATH = path.join(os.homedir(), ".better-readme-mcp", "style.json");

function readJsonIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    // ignore unreadable/invalid override files and fall back to defaults
  }
  return null;
}

function loadEffectiveStyleGuide() {
  const projectOverride = readJsonIfExists(PROJECT_STYLE_PATH);
  if (projectOverride) {
    return { style: { ...styleGuide, ...projectOverride }, source: "project", path: PROJECT_STYLE_PATH };
  }
  const globalOverride = readJsonIfExists(GLOBAL_STYLE_PATH);
  if (globalOverride) {
    return { style: { ...styleGuide, ...globalOverride }, source: "global", path: GLOBAL_STYLE_PATH };
  }
  return { style: styleGuide, source: "default", path: null };
}

server.registerTool(
  "get_readme_style_guide",
  {
    title: "Get README style guide",
    description:
      "Returns the README style guide this plugin enforces: the user's own saved style if one exists (project-level .better-readme-style.json, or global ~/.better-readme-mcp/style.json), otherwise the built-in concise/human/first-person default. Call this before drafting or rewriting any README.md.",
    inputSchema: {},
  },
  async () => {
    const { style, source, path: overridePath } = loadEffectiveStyleGuide();
    const note =
      source === "default"
        ? "Using the built-in default style guide. No custom style saved (use set_readme_style or infer_style_from_github to create one)."
        : `Using a custom style guide saved at ${source} scope (${overridePath}).`;
    return {
      content: [{ type: "text", text: `${note}\n\n${JSON.stringify(style, null, 2)}` }],
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
      }).filter(([, v]) => v !== undefined)
    );
    const mergedOptions = { ...(existing.options || {}), ...optionUpdates };

    const merged = { ...existing, ...updates };
    if (Object.keys(mergedOptions).length > 0) merged.options = mergedOptions;

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(merged, null, 2));

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

function readJsonFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    // malformed package.json etc. — ignore and fall through to other heuristics
  }
  return null;
}

server.registerTool(
  "detect_project_kind",
  {
    title: "Guess what kind of project this is",
    description:
      "Inspects the current project directory for heuristics (package.json bin/dependencies, static-site files, hackathon markers) and guesses whether it's a devtool, CLI tool, library, website, hackathon project, or something else. This is a best-effort guess, not ground truth — confirm with the user if the confidence is low, and prefer what they say. The result is meant to inform projectKind and larpScale when calling set_readme_style.",
    inputSchema: {},
  },
  async () => {
    const cwd = process.cwd();
    const pkg = readJsonFileIfExists(path.join(cwd, "package.json"));
    const signals = [];
    const scores = {};
    const bump = (kind, amount, reason) => {
      scores[kind] = (scores[kind] || 0) + amount;
      signals.push(`${kind} +${amount}: ${reason}`);
    };

    const hackathonMarkers = ["devpost.md", "DEVPOST.md", ".devpost", "HACKATHON.md", "hackathon.md", "PITCH.md"];
    if (hackathonMarkers.some((f) => fs.existsSync(path.join(cwd, f)))) {
      bump("hackathon-project", 3, "found a devpost/hackathon/pitch marker file");
    }
    if (pkg && /hackathon/i.test(`${pkg.description || ""} ${(pkg.keywords || []).join(" ")}`)) {
      bump("hackathon-project", 2, "package.json description/keywords mention 'hackathon'");
    }

    if (pkg && pkg.bin) {
      bump("cli-tool", 3, "package.json has a 'bin' field");
    }

    const frontendDeps = ["react", "next", "vue", "nuxt", "svelte", "@sveltejs/kit", "astro", "vite"];
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
    const matchedFrontendDeps = frontendDeps.filter((d) => deps[d]);
    if (matchedFrontendDeps.length > 0) {
      bump("website", 2, `frontend framework dependencies found: ${matchedFrontendDeps.join(", ")}`);
    }
    if (["index.html", "public/index.html", "vercel.json", "netlify.toml"].some((f) => fs.existsSync(path.join(cwd, f)))) {
      bump("website", 2, "found a static-site/deploy config marker (index.html, vercel.json, or netlify.toml)");
    }

    if (pkg && pkg.main && !pkg.bin && matchedFrontendDeps.length === 0) {
      bump("library", 2, "package.json has a 'main' entry point but no 'bin' and no frontend framework");
    }
    if (fs.existsSync(path.join(cwd, "mcp-server")) || (pkg && /\bmcp\b/i.test(pkg.name || ""))) {
      bump("devtool", 2, "looks like an MCP server / developer tool (mcp-server dir or name mentions mcp)");
    }
    if (pkg && pkg.name && /(cli|tool|plugin|sdk)/i.test(pkg.name)) {
      bump("devtool", 1, "package.json name suggests a developer tool");
    }

    if (Object.keys(scores).length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                guess: "unknown",
                confidence: "low",
                signals: ["No strong heuristics matched — no package.json, or nothing distinctive found."],
                suggestion: "Ask the user what kind of project this is, or infer it from README/source content directly.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topKind, topScore] = ranked[0];
    const runnerUpScore = ranked[1]?.[1] ?? 0;
    const confidence = topScore >= 4 && topScore - runnerUpScore >= 2 ? "high" : topScore - runnerUpScore >= 1 ? "medium" : "low";

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              guess: topKind,
              confidence,
              scores: Object.fromEntries(ranked),
              signals,
              suggestion:
                confidence === "low"
                  ? "Confidence is low — confirm with the user before setting projectKind."
                  : `Reasonably confident this is a ${topKind}. Consider calling set_readme_style with projectKind: "${topKind}".`,
            },
            null,
            2
          ),
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
