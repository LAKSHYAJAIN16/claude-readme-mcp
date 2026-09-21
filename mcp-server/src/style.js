import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import defaultStyle from "../data/style-guide.json" with { type: "json" };

export const DEFAULT_STYLE = defaultStyle;
export const PROJECT_STYLE_PATH = path.join(process.cwd(), ".better-readme-style.json");
export const GLOBAL_STYLE_PATH = path.join(os.homedir(), ".better-readme-mcp", "style.json");

export function readJsonIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    // ignore unreadable/invalid override files and fall back to defaults
  }
  return null;
}

export function loadEffectiveStyleGuide() {
  const projectOverride = readJsonIfExists(PROJECT_STYLE_PATH);
  if (projectOverride) {
    return {
      style: { ...DEFAULT_STYLE, ...projectOverride },
      source: "project",
      path: PROJECT_STYLE_PATH,
      override: projectOverride,
    };
  }
  const globalOverride = readJsonIfExists(GLOBAL_STYLE_PATH);
  if (globalOverride) {
    return {
      style: { ...DEFAULT_STYLE, ...globalOverride },
      source: "global",
      path: GLOBAL_STYLE_PATH,
      override: globalOverride,
    };
  }
  return { style: DEFAULT_STYLE, source: "default", path: null, override: null };
}

export function writeStyleOverride(scope, overrideObj) {
  const targetPath = scope === "global" ? GLOBAL_STYLE_PATH : PROJECT_STYLE_PATH;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(overrideObj, null, 2));
  return targetPath;
}
