import { AnalysisResult } from "./types";

function render(result: AnalysisResult | undefined): void {
  const el = document.getElementById("content");
  if (!el) return;

  if (!result) {
    el.innerHTML = '<p class="empty">Open an email in Gmail to see its risk analysis.</p>';
    return;
  }

  const verdictLabel = {
    safe: "✓ Looks safe",
    suspicious: "⚠ Suspicious",
    dangerous: "⛔ Likely phishing",
  }[result.verdict];

  const findingsHtml = result.findings.length
    ? `<ul>${result.findings.map((f) => `<li>${escapeHtml(f.label)}</li>`).join("")}</ul>`
    : '<p class="empty">No issues found.</p>';

  el.innerHTML = `
    <div class="verdict ${result.verdict}">${verdictLabel} — ${result.score}/100</div>
    <div class="meta">${escapeHtml(result.senderEmail)}<br/>${escapeHtml(result.subject)}</div>
    ${findingsHtml}
  `;
}

function escapeHtml(input: string): string {
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}

chrome.storage.local.get("lastResult", (data) => {
  render(data.lastResult as AnalysisResult | undefined);
});
