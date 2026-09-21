#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");

function readStdinJson() {
  try {
    const data = fs.readFileSync(0, "utf8");
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function readJsonIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    // malformed or unreadable override — treat as absent
  }
  return null;
}

const input = readStdinJson();

// Stop hooks re-fire after a blocked turn continues; bail out the second time
// around so we never loop on the same turn.
if (input.stop_hook_active) {
  process.exit(0);
}

const cwd = input.cwd || process.cwd();
const projectOverride = readJsonIfExists(path.join(cwd, ".better-readme-style.json"));
const globalOverride = readJsonIfExists(path.join(os.homedir(), ".better-readme-mcp", "style.json"));
const options = (projectOverride || globalOverride || {}).options || {};

if (!options.autoUpdateReadme) {
  process.exit(0);
}

let hasChanges = false;
try {
  const status = execSync("git status --porcelain", {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  hasChanges = status.trim().length > 0;
} catch {
  // not a git repo, or git unavailable — nothing to check a README against
  process.exit(0);
}

if (!hasChanges) {
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    decision: "block",
    reason:
      "better-readme-mcp: autoUpdateReadme is on and this turn left uncommitted changes. Before finishing, check whether README.md still accurately describes the project given these changes (get_readme_style_guide, edit if needed, then lint_readme) and update it if needed. If README.md is already accurate, say so briefly and stop.",
  })
);
process.exit(0);
