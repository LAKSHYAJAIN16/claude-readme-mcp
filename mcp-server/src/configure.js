import http from "node:http";
import { spawn } from "node:child_process";
import {
  DEFAULT_STYLE,
  PROJECT_STYLE_PATH,
  GLOBAL_STYLE_PATH,
  readJsonIfExists,
  writeStyleOverride,
} from "./style.js";
import { detectProjectKind } from "./detect.js";

function openBrowser(url) {
  try {
    if (process.platform === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    } else if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true, windowsHide: true }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
  } catch {
    // best-effort only — the URL is printed regardless, the user can open it by hand
  }
}

function cleanStyleObject(input) {
  const out = {};
  for (const key of ["voice", "length", "groundedness", "notes"]) {
    if (typeof input[key] === "string" && input[key].trim() !== "") out[key] = input[key].trim();
  }
  for (const key of ["structure", "checklist", "avoidBoilerplatePhrases"]) {
    if (Array.isArray(input[key]) && input[key].length > 0) out[key] = input[key];
  }

  const opts = input.options || {};
  const cleanedOptions = {};
  for (const key of [
    "noEnDashes",
    "noFirstPerson",
    "noThirdPerson",
    "requireScreenshots",
    "requireAudioSamples",
    "requireLicenseSection",
    "autoUpdateReadme",
  ]) {
    if (opts[key] === true) cleanedOptions[key] = true;
  }
  if (Array.isArray(opts.requiredSections) && opts.requiredSections.length > 0) {
    cleanedOptions.requiredSections = opts.requiredSections.filter((s) => typeof s === "string" && s.trim() !== "");
  }
  if (typeof opts.projectKind === "string" && opts.projectKind.trim() !== "") {
    cleanedOptions.projectKind = opts.projectKind.trim();
  }
  if (typeof opts.larpScale === "number" && !Number.isNaN(opts.larpScale)) {
    cleanedOptions.larpScale = Math.max(0, Math.min(10, opts.larpScale));
  }
  if (Array.isArray(opts.buttons) && opts.buttons.length > 0) {
    const cleanedButtons = opts.buttons
      .filter((b) => b && typeof b.preset === "string")
      .map((b) => {
        const button = { preset: b.preset };
        for (const key of ["url", "label", "text", "color", "logo", "style", "badgeUrl"]) {
          if (typeof b[key] === "string" && b[key].trim() !== "") button[key] = b[key].trim();
        }
        return button;
      });
    if (cleanedButtons.length > 0) cleanedOptions.buttons = cleanedButtons;
  }
  if (Object.keys(cleanedOptions).length > 0) out.options = cleanedOptions;

  return out;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function renderPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>better-readme-mcp — style config</title>
<style>
  :root {
    --bg: #ffffff; --fg: #1a1a1a; --muted: #666; --border: #ddd; --card: #f7f7f7; --accent: #2563eb;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14161a; --fg: #eaeaea; --muted: #9aa0a6; --border: #333; --card: #1c1f24; --accent: #5b9dff; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 16px 80px; background: var(--bg); color: var(--fg);
    font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  main { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 24px; font-size: 13px; }
  fieldset {
    border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin: 0 0 16px; background: var(--card);
  }
  legend { padding: 0 6px; font-weight: bold; }
  label { display: block; margin: 10px 0 4px; font-size: 13px; }
  label.inline { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
  label.inline input[type="checkbox"] { width: 16px; height: 16px; }
  .hint { color: var(--muted); font-size: 12px; margin: 2px 0 0; }
  input[type="text"], input[type="number"], textarea, select {
    width: 100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg); color: var(--fg); font: inherit;
  }
  textarea { resize: vertical; min-height: 44px; }
  .row { display: flex; gap: 12px; }
  .row > div { flex: 1; }
  .scope-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 20px; }
  .scope-bar select { width: auto; flex: 0 0 auto; }
  .scope-bar .file { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
  button {
    font: inherit; padding: 8px 16px; border-radius: 6px; border: 1px solid var(--accent);
    background: var(--accent); color: white; cursor: pointer;
  }
  button.secondary { background: transparent; color: var(--fg); border-color: var(--border); }
  .actions { display: flex; gap: 8px; align-items: center; position: sticky; bottom: 0; background: var(--bg); padding: 12px 0; }
  #status { font-size: 13px; }
  #status.ok { color: #1a7f37; }
  #status.err { color: #c0392b; }
  .range-row { display: flex; align-items: center; gap: 10px; }
  .range-row input[type="range"] { flex: 1; }
  #detectNote { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .button-row {
    border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin: 0 0 10px; background: var(--bg);
  }
  .button-row .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .button-row .grid > div { margin-top: 6px; }
  .button-row .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .button-row button.remove { border-color: #c0392b; color: #c0392b; background: transparent; padding: 4px 10px; }
  .button-row label { margin: 0 0 2px; font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
<main>
  <h1>better-readme-mcp</h1>
  <p class="sub">Configure the README style this project (or all your projects) will be written and linted against.</p>

  <div class="scope-bar">
    <label for="scope" style="margin:0;">Editing:</label>
    <select id="scope">
      <option value="project">Project (this repo)</option>
      <option value="global">Global (all projects)</option>
    </select>
    <span class="file" id="scopeFile"></span>
  </div>

  <fieldset>
    <legend>Voice &amp; content</legend>
    <label for="voice">Voice / tone</label>
    <textarea id="voice" placeholder="e.g. First person, casual, contractions welcome."></textarea>

    <label for="length">Length guidance</label>
    <input type="text" id="length" placeholder="e.g. Roughly 15-40 lines." />

    <label for="notes">Notes</label>
    <textarea id="notes" placeholder="Anything else — recurring sections, quirks, house style."></textarea>
  </fieldset>

  <fieldset>
    <legend>Project kind</legend>
    <div class="row">
      <div>
        <label for="projectKind">Kind</label>
        <input list="kindOptions" type="text" id="projectKind" placeholder="devtool, website, hackathon-project…" />
        <datalist id="kindOptions">
          <option value="devtool"></option>
          <option value="cli-tool"></option>
          <option value="library"></option>
          <option value="website"></option>
          <option value="hackathon-project"></option>
          <option value="app"></option>
          <option value="api"></option>
        </datalist>
      </div>
      <div style="flex: 0 0 auto; align-self: flex-end;">
        <button type="button" class="secondary" id="detectBtn">Detect from repo</button>
      </div>
    </div>
    <p id="detectNote"></p>
  </fieldset>

  <fieldset>
    <legend>Larp scale</legend>
    <p class="hint">How much hype/showmanship is acceptable, 0 (deadpan, zero embellishment) to 10 (full hackathon-pitch energy). lint_readme flags drafts that read hypier than this.</p>
    <div class="range-row">
      <input type="range" id="larpScale" min="0" max="10" step="1" value="0" />
      <span id="larpScaleValue">off</span>
    </div>
  </fieldset>

  <fieldset>
    <legend>Voice &amp; punctuation rules</legend>
    <label class="inline"><input type="checkbox" id="noEnDashes" /> No en/em dashes (–/—)</label>
    <label class="inline"><input type="checkbox" id="noFirstPerson" /> No first-person language (I/my/we)</label>
    <label class="inline"><input type="checkbox" id="noThirdPerson" /> No third-person language ("this project"/"this repository")</label>
  </fieldset>

  <fieldset>
    <legend>Required content</legend>
    <label class="inline"><input type="checkbox" id="requireScreenshots" /> Require a screenshot/demo image</label>
    <label class="inline"><input type="checkbox" id="requireAudioSamples" /> Require an audio sample link</label>
    <label class="inline"><input type="checkbox" id="requireLicenseSection" /> Require a license mention</label>
    <label for="requiredSections">Other required sections (comma-separated)</label>
    <input type="text" id="requiredSections" placeholder="Contributing, Roadmap" />
  </fieldset>

  <fieldset>
    <legend>Automation</legend>
    <label class="inline"><input type="checkbox" id="autoUpdateReadme" /> Auto-check README.md after every prompt that changes files</label>
    <p class="hint">Needs the bundled Stop hook to be active for this plugin. Only fires when there are uncommitted git changes.</p>
  </fieldset>

  <fieldset>
    <legend>Buttons / badges</legend>
    <p class="hint">Rendered as a shields.io row under the title. Links are yours to provide — nothing here is invented, and "status" text is whatever you say, since this project has no real uptime monitoring.</p>
    <div id="buttonsList"></div>
    <button type="button" class="secondary" id="addButtonBtn">+ Add button</button>
  </fieldset>

  <div class="actions">
    <button type="button" id="saveBtn">Save</button>
    <span id="status"></span>
  </div>
</main>

<script>
(function () {
  var state = null;
  var scopeEl = document.getElementById("scope");
  var scopeFileEl = document.getElementById("scopeFile");
  var statusEl = document.getElementById("status");
  var detectNoteEl = document.getElementById("detectNote");
  var larpEl = document.getElementById("larpScale");
  var larpValueEl = document.getElementById("larpScaleValue");
  var buttonsListEl = document.getElementById("buttonsList");
  var BUTTON_PRESETS = ["buy-me-a-coffee", "ko-fi", "github-sponsors", "report-bug", "status", "custom"];

  function escapeAttr(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function makeButtonRow(button) {
    button = button || { preset: "custom" };
    var row = document.createElement("div");
    row.className = "button-row";
    var presetOptions = BUTTON_PRESETS.map(function (p) {
      return '<option value="' + p + '"' + (p === button.preset ? " selected" : "") + ">" + p + "</option>";
    }).join("");
    row.innerHTML =
      '<div class="top">' +
        '<select class="btn-preset">' + presetOptions + "</select>" +
        '<button type="button" class="remove">Remove</button>' +
      "</div>" +
      '<div class="grid">' +
        '<div><label>URL</label><input type="text" class="btn-url" placeholder="https://…" value="' + escapeAttr(button.url) + '" /></div>' +
        '<div><label>Label (optional)</label><input type="text" class="btn-label" placeholder="preset default" value="' + escapeAttr(button.label) + '" /></div>' +
        '<div><label>Status text (status preset only)</label><input type="text" class="btn-text" placeholder="e.g. maintained" value="' + escapeAttr(button.text) + '" /></div>' +
        '<div><label>Color (optional)</label><input type="text" class="btn-color" placeholder="preset default" value="' + escapeAttr(button.color) + '" /></div>' +
      "</div>";
    row.querySelector(".remove").addEventListener("click", function () { row.remove(); });
    return row;
  }

  function renderButtonsList(buttons) {
    buttonsListEl.innerHTML = "";
    (buttons || []).forEach(function (b) { buttonsListEl.appendChild(makeButtonRow(b)); });
  }

  function collectButtons() {
    var buttons = [];
    buttonsListEl.querySelectorAll(".button-row").forEach(function (row) {
      var button = { preset: row.querySelector(".btn-preset").value };
      var url = row.querySelector(".btn-url").value.trim();
      var label = row.querySelector(".btn-label").value.trim();
      var text = row.querySelector(".btn-text").value.trim();
      var color = row.querySelector(".btn-color").value.trim();
      if (url) button.url = url;
      if (label) button.label = label;
      if (text) button.text = text;
      if (color) button.color = color;
      buttons.push(button);
    });
    return buttons;
  }

  document.getElementById("addButtonBtn").addEventListener("click", function () {
    buttonsListEl.appendChild(makeButtonRow({ preset: "custom" }));
  });

  function fillForm(scope) {
    var data = state[scope] && state[scope].value ? state[scope].value : {};
    var opts = data.options || {};
    document.getElementById("voice").value = data.voice || "";
    document.getElementById("length").value = data.length || "";
    document.getElementById("notes").value = data.notes || "";
    document.getElementById("projectKind").value = opts.projectKind || "";
    document.getElementById("noEnDashes").checked = !!opts.noEnDashes;
    document.getElementById("noFirstPerson").checked = !!opts.noFirstPerson;
    document.getElementById("noThirdPerson").checked = !!opts.noThirdPerson;
    document.getElementById("requireScreenshots").checked = !!opts.requireScreenshots;
    document.getElementById("requireAudioSamples").checked = !!opts.requireAudioSamples;
    document.getElementById("requireLicenseSection").checked = !!opts.requireLicenseSection;
    document.getElementById("requiredSections").value = (opts.requiredSections || []).join(", ");
    document.getElementById("autoUpdateReadme").checked = !!opts.autoUpdateReadme;
    larpEl.value = typeof opts.larpScale === "number" ? opts.larpScale : 0;
    larpValueEl.textContent = typeof opts.larpScale === "number" ? String(opts.larpScale) : "off";
    renderButtonsList(opts.buttons || []);
    scopeFileEl.textContent = (state[scope] && state[scope].path) || "";
  }

  function collectForm() {
    var sections = document.getElementById("requiredSections").value
      .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    return {
      scope: scopeEl.value,
      voice: document.getElementById("voice").value,
      length: document.getElementById("length").value,
      notes: document.getElementById("notes").value,
      options: {
        projectKind: document.getElementById("projectKind").value,
        larpScale: Number(larpEl.value),
        noEnDashes: document.getElementById("noEnDashes").checked,
        noFirstPerson: document.getElementById("noFirstPerson").checked,
        noThirdPerson: document.getElementById("noThirdPerson").checked,
        requireScreenshots: document.getElementById("requireScreenshots").checked,
        requireAudioSamples: document.getElementById("requireAudioSamples").checked,
        requireLicenseSection: document.getElementById("requireLicenseSection").checked,
        requiredSections: sections,
        autoUpdateReadme: document.getElementById("autoUpdateReadme").checked,
        buttons: collectButtons()
      }
    };
  }

  larpEl.addEventListener("input", function () {
    larpValueEl.textContent = larpEl.value === "0" ? "off" : larpEl.value;
  });

  scopeEl.addEventListener("change", function () { fillForm(scopeEl.value); });

  document.getElementById("detectBtn").addEventListener("click", function () {
    if (!state || !state.detected) return;
    var d = state.detected;
    document.getElementById("projectKind").value = d.guess === "unknown" ? "" : d.guess;
    detectNoteEl.textContent = "Guess: " + d.guess + " (" + d.confidence + " confidence) — " + (d.signals[0] || "");
  });

  document.getElementById("saveBtn").addEventListener("click", function () {
    statusEl.textContent = "Saving…";
    statusEl.className = "";
    fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collectForm())
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.ok) {
          statusEl.textContent = "Saved to " + json.path;
          statusEl.className = "ok";
        } else {
          statusEl.textContent = "Error: " + json.error;
          statusEl.className = "err";
        }
      })
      .catch(function (err) {
        statusEl.textContent = "Error: " + err.message;
        statusEl.className = "err";
      });
  });

  fetch("/api/state")
    .then(function (r) { return r.json(); })
    .then(function (json) {
      state = json;
      fillForm(scopeEl.value);
      if (state.detected) {
        var d = state.detected;
        detectNoteEl.textContent = "Detected: " + d.guess + " (" + d.confidence + " confidence)";
      }
    })
    .catch(function (err) {
      statusEl.textContent = "Failed to load current settings: " + err.message;
      statusEl.className = "err";
    });
})();
</script>
</body>
</html>`;
}

export function runConfigureServer({ autoOpen = true } = {}) {
  return new Promise(() => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost");

        if (req.method === "GET" && url.pathname === "/") {
          const html = renderPage();
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
          return;
        }

        if (req.method === "GET" && url.pathname === "/api/state") {
          sendJson(res, 200, {
            default: DEFAULT_STYLE,
            project: { path: PROJECT_STYLE_PATH, value: readJsonIfExists(PROJECT_STYLE_PATH) },
            global: { path: GLOBAL_STYLE_PATH, value: readJsonIfExists(GLOBAL_STYLE_PATH) },
            detected: detectProjectKind(),
          });
          return;
        }

        if (req.method === "POST" && url.pathname === "/api/save") {
          const raw = await readBody(req);
          let body;
          try {
            body = JSON.parse(raw);
          } catch {
            sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
            return;
          }
          const scope = body.scope === "global" ? "global" : "project";
          const cleaned = cleanStyleObject(body);
          const savedPath = writeStyleOverride(scope, cleaned);
          sendJson(res, 200, { ok: true, path: savedPath, saved: cleaned });
          return;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}/`;
      console.log(`better-readme-mcp config page: ${url}`);
      console.log("Press Ctrl+C to stop.");
      if (autoOpen) openBrowser(url);
    });

    process.on("SIGINT", () => {
      console.log("\nStopping config server.");
      process.exit(0);
    });
  });
}
