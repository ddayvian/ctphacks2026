import { AiAnalysis, AnalysisResult } from "./types";

const BANNER_ID = "phishguard-banner";
const AI_SECTION_ID = "phishguard-ai-section";

const VERDICT_LABEL: Record<AnalysisResult["verdict"], string> = {
  safe: "✓ Looks safe",
  suspicious: "⚠ Suspicious email",
  dangerous: "⛔ Likely phishing",
};

function buildBanner(result: AnalysisResult): HTMLElement {
  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.className = `phishguard-banner phishguard-${result.verdict}`;

  const header = document.createElement("div");
  header.className = "phishguard-header";
  header.textContent = `${VERDICT_LABEL[result.verdict]} — risk score ${result.score}/100`;
  banner.appendChild(header);

  if (result.findings.length > 0) {
    const list = document.createElement("ul");
    list.className = "phishguard-findings";
    for (const finding of result.findings) {
      const item = document.createElement("li");
      item.className = `phishguard-finding phishguard-severity-${finding.severity}`;
      item.textContent = `${finding.label} — ${finding.detail}`;
      list.appendChild(item);
    }
    banner.appendChild(list);
  }

  return banner;
}

export function renderBanner(bodyEl: HTMLElement, result: AnalysisResult): void {
  document.getElementById(BANNER_ID)?.remove();
  const banner = buildBanner(result);
  bodyEl.parentElement?.insertBefore(banner, bodyEl);
}

function getAiSection(): HTMLElement | null {
  return document.getElementById(AI_SECTION_ID);
}

export function renderAiLoading(): void {
  const banner = document.getElementById(BANNER_ID);
  if (!banner) return;

  let section = getAiSection();
  if (!section) {
    section = document.createElement("div");
    section.id = AI_SECTION_ID;
    section.className = "phishguard-ai-section";
    banner.appendChild(section);
  }
  section.textContent = "🤖 AI analysis: checking...";
}

export function renderAiResult(result: AiAnalysis): void {
  const section = getAiSection();
  if (!section) return;
  section.textContent = `🤖 AI analysis: ${result.verdict} (${result.score}/100) — ${result.explanation}`;
  section.className = `phishguard-ai-section phishguard-ai-${result.verdict}`;
}

export function renderAiError(message: string): void {
  const section = getAiSection();
  if (!section) return;
  section.textContent = `🤖 AI analysis unavailable: ${message}`;
  section.className = "phishguard-ai-section phishguard-ai-error";
}

export function highlightLinks(bodyEl: HTMLElement, flaggedHrefs: Set<string>): void {
  bodyEl.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    a.classList.remove("phishguard-flagged-link");
    if (flaggedHrefs.has(a.getAttribute("href") ?? "")) {
      a.classList.add("phishguard-flagged-link");
      a.title = "PhishGuard: this link looks suspicious";
    }
  });
}
