import fs from "node:fs";
import path from "node:path";

function readJsonFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    // malformed package.json etc. — ignore and fall through to other heuristics
  }
  return null;
}

export function detectProjectKind(cwd = process.cwd()) {
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
  if (
    ["index.html", "public/index.html", "vercel.json", "netlify.toml"].some((f) => fs.existsSync(path.join(cwd, f)))
  ) {
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
      guess: "unknown",
      confidence: "low",
      signals: ["No strong heuristics matched — no package.json, or nothing distinctive found."],
      suggestion: "Ask the user what kind of project this is, or infer it from README/source content directly.",
    };
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topKind, topScore] = ranked[0];
  const runnerUpScore = ranked[1]?.[1] ?? 0;
  const confidence =
    topScore >= 4 && topScore - runnerUpScore >= 2 ? "high" : topScore - runnerUpScore >= 1 ? "medium" : "low";

  return {
    guess: topKind,
    confidence,
    scores: Object.fromEntries(ranked),
    signals,
    suggestion:
      confidence === "low"
        ? "Confidence is low — confirm with the user before setting projectKind."
        : `Reasonably confident this is a ${topKind}. Consider calling set_readme_style with projectKind: "${topKind}".`,
  };
}
