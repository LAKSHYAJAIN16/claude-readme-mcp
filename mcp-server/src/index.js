#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import styleGuide from "../data/style-guide.json" with { type: "json" };
import examples from "../data/examples.json" with { type: "json" };

const server = new McpServer({
  name: "better-readme-mcp",
  version: "0.1.0",
});

server.registerTool(
  "get_readme_style_guide",
  {
    title: "Get README style guide",
    description:
      "Returns the concise, human, first-person README style guide this plugin enforces. Call this before drafting or rewriting any README.md.",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(styleGuide, null, 2) }],
  })
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

const BOILERPLATE = styleGuide.avoidBoilerplatePhrases;

server.registerTool(
  "lint_readme",
  {
    title: "Lint a README draft",
    description:
      "Runs deterministic checks on a README draft against the concise/human style guide: length, boilerplate AI-report phrases, first-person voice, tagline presence, and code-block presence. Call this after drafting a README to self-check before finalizing.",
    inputSchema: {
      content: z.string().describe("The full README markdown text to lint."),
    },
  },
  async ({ content }) => {
    const lines = content.split(/\r?\n/);
    const lineCount = lines.length;
    const lowerContent = content.toLowerCase();

    const boilerplateHits = BOILERPLATE.filter((phrase) =>
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
    if (firstPersonMarkers === 0)
      issues.push(
        "No first-person language detected (I/my/we). This reads like a third-person report, not the owner's own voice."
      );
    if (thirdPersonMarkers > firstPersonMarkers)
      issues.push(
        'Third-person phrases ("this project", "this repository") outnumber first-person ones — rewrite in the owner\'s voice.'
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
