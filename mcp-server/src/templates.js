import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const TEMPLATES_DIR = path.join(os.homedir(), ".better-readme-mcp", "templates");

export const BLOCK_CATALOG = [
  {
    type: "title-tagline",
    label: "Title + Tagline",
    instruction: "Title, then a one-line tagline (a `>` blockquote works well).",
  },
  {
    type: "badges",
    label: "Badges / buttons row",
    instruction: "A row of badges/buttons right under the tagline (configure the actual buttons separately).",
  },
  {
    type: "description",
    label: "What it is / why it exists",
    instruction: "A short 2-4 sentence paragraph: what it is and why it exists. No filler.",
  },
  {
    type: "features",
    label: "Features list",
    instruction: "A features list where each bullet is ONE line, not a paragraph.",
  },
  {
    type: "install",
    label: "Install",
    instruction: "An Install section with a fenced, runnable install command.",
  },
  {
    type: "usage",
    label: "Usage",
    instruction: "A Usage section with a fenced, runnable usage example.",
  },
  {
    type: "screenshots",
    label: "Screenshots / demo",
    instruction: "A Screenshots section with a real screenshot or demo image.",
    options: { requireScreenshots: true },
  },
  {
    type: "configuration",
    label: "Configuration",
    instruction: "A Configuration section covering any options/env vars the project actually supports.",
  },
  {
    type: "api-reference",
    label: "API / reference",
    instruction: "An API or reference section documenting the actual public interface.",
  },
  {
    type: "contributing",
    label: "Contributing",
    instruction: "A short Contributing section.",
  },
  {
    type: "license",
    label: "License",
    instruction: "A License section naming the actual license.",
    options: { requireLicenseSection: true },
  },
  {
    type: "roadmap",
    label: "Roadmap",
    instruction: "A Roadmap section listing genuinely planned work, not aspirational filler.",
  },
  {
    type: "custom",
    label: "Custom section",
    instruction: "",
  },
];

export const BLOCK_TYPES = BLOCK_CATALOG.map((b) => b.type);

function slugify(name) {
  return (
    String(name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "template"
  );
}

function templatePath(name) {
  return path.join(TEMPLATES_DIR, `${slugify(name)}.json`);
}

export function listTemplates() {
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) return [];
    return fs
      .readdirSync(TEMPLATES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf8"));
          return { name: data.name || f.replace(/\.json$/, ""), blocks: data.blocks || [] };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function readTemplate(name) {
  try {
    const p = templatePath(name);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function writeTemplate(name, blocks) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  const p = templatePath(name);
  fs.writeFileSync(p, JSON.stringify({ name, blocks }, null, 2));
  return p;
}

export function deleteTemplate(name) {
  const p = templatePath(name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return p;
}

export function blockInstruction(block) {
  if (block.type === "custom") return (block.text && block.text.trim()) || "Custom section.";
  const preset = BLOCK_CATALOG.find((b) => b.type === block.type);
  return (block.text && block.text.trim()) || (preset ? preset.instruction : block.type);
}

export function blocksToStructure(blocks) {
  return (blocks || []).map(blockInstruction);
}

export function blocksToOptions(blocks) {
  const options = {};
  for (const block of blocks || []) {
    const preset = BLOCK_CATALOG.find((b) => b.type === block.type);
    if (preset && preset.options) Object.assign(options, preset.options);
  }
  return options;
}
