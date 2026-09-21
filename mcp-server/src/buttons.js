export const BUTTON_PRESETS = {
  "buy-me-a-coffee": { label: "Buy Me A Coffee", color: "FFDD00", logo: "buymeacoffee", logoColor: "black" },
  "ko-fi": { label: "Ko-fi", color: "FF5E5B", logo: "kofi", logoColor: "white" },
  "github-sponsors": { label: "Sponsor", color: "EA4AAA", logo: "githubsponsors", logoColor: "white" },
  "report-bug": { label: "Report Bug", color: "d73a4a", logo: "github", logoColor: "white" },
  status: { label: "Status", color: "brightgreen" },
  custom: {},
};

function shieldsEncode(value) {
  return String(value ?? "")
    .trim()
    .replace(/-/g, "--")
    .replace(/_/g, "__")
    .replace(/ /g, "_");
}

export function renderButtonBadge(button) {
  const preset = BUTTON_PRESETS[button.preset] || BUTTON_PRESETS.custom;
  const label = button.label || preset.label || button.preset || "Link";
  const color = button.color || preset.color || "informational";
  const logo = button.logo || preset.logo;
  const logoColor = button.logoColor || preset.logoColor;
  const isStatus = button.preset === "status";

  let badgeUrl = button.badgeUrl;
  if (!badgeUrl) {
    const segments = isStatus
      ? `${shieldsEncode(label)}-${shieldsEncode(button.text || "maintained")}-${color}`
      : `${shieldsEncode(label)}-${color}`;
    const params = new URLSearchParams();
    params.set("style", button.style || "flat");
    if (logo) params.set("logo", logo);
    if (logoColor) params.set("logoColor", logoColor);
    badgeUrl = `https://img.shields.io/badge/${segments}?${params.toString()}`;
  }

  const image = `![${label}](${badgeUrl})`;
  return button.url ? `[${image}](${button.url})` : image;
}

export function renderButtonsMarkdown(buttons) {
  if (!Array.isArray(buttons) || buttons.length === 0) return "";
  return buttons.map(renderButtonBadge).join(" ");
}
