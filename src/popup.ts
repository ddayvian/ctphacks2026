import { StoredAnalysis } from "./types";

function render(result: StoredAnalysis | undefined): void {
  const el = document.getElementById("content");
  if (!el) return;

  if (!result) {
    el.innerHTML = '<p class="empty">Open an email in Gmail to see its AI risk analysis.</p>';
    return;
  }

  const verdictLabel = {
    safe: "✓ Looks safe",
    suspicious: "⚠ Suspicious",
    dangerous: "⛔ Likely phishing",
  }[result.verdict];

  const linksHtml = result.flaggedLinks.length
    ? `<ul>${result.flaggedLinks
        .map((f) => `<li class="link-${f.verdict}">${escapeHtml(f.href)}</li>`)
        .join("")}</ul>`
    : '<p class="empty">No links in this email.</p>';

  el.innerHTML = `
    <div class="verdict ${result.verdict}">${verdictLabel} — ${result.score}/100</div>
    <div class="meta">${escapeHtml(result.senderEmail)}<br/>${escapeHtml(result.subject)}</div>
    <p class="explanation">${escapeHtml(result.explanation)}</p>
    ${linksHtml}
  `;
}

function escapeHtml(input: string): string {
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}

chrome.storage.local.get("lastResult", (data) => {
  render(data.lastResult as StoredAnalysis | undefined);
});
