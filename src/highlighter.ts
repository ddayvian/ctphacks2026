import { AiAnalysis, FlaggedLink } from "./types";

const BANNER_ID = "phishguard-banner";

const VERDICT_LABEL: Record<AiAnalysis["verdict"], string> = {
  safe: "✓ Looks safe",
  suspicious: "⚠ Suspicious email",
  dangerous: "⛔ Likely phishing",
};

function getOrCreateBanner(bodyEl: HTMLElement): HTMLElement {
  let banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement("div");
    banner.id = BANNER_ID;
    bodyEl.parentElement?.insertBefore(banner, bodyEl);
  }
  return banner;
}

export function renderAiLoading(bodyEl: HTMLElement): void {
  const banner = getOrCreateBanner(bodyEl);
  banner.className = "phishguard-banner phishguard-loading";
  banner.textContent = "🤖 CatPhish: analyzing with AI...";
}

export function renderAiResult(bodyEl: HTMLElement, result: AiAnalysis): void {
  const banner = getOrCreateBanner(bodyEl);
  banner.className = `phishguard-banner phishguard-${result.verdict}`;
  banner.innerHTML = "";

  const header = document.createElement("div");
  header.className = "phishguard-header";
  header.textContent = `${VERDICT_LABEL[result.verdict]} — AI risk score ${result.score}/100`;
  banner.appendChild(header);

  const explanation = document.createElement("div");
  explanation.className = "phishguard-explanation";
  explanation.textContent = result.explanation;
  banner.appendChild(explanation);
}

export function renderAiError(bodyEl: HTMLElement, message: string): void {
  const banner = getOrCreateBanner(bodyEl);
  banner.className = "phishguard-banner phishguard-error";
  banner.textContent = `🤖 CatPhish: AI analysis unavailable — ${message}`;
}

export function highlightLinks(bodyEl: HTMLElement, flaggedLinks: FlaggedLink[]): void {
  const verdictByHref = new Map(flaggedLinks.map((f) => [f.href, f]));

  bodyEl.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    a.classList.remove(
      "phishguard-link-safe",
      "phishguard-link-suspicious",
      "phishguard-link-dangerous"
    );
    a.removeAttribute("title");

    const flag = verdictByHref.get(a.getAttribute("href") ?? "");
    if (!flag) return;

    a.classList.add(`phishguard-link-${flag.verdict}`);
    a.title = `CatPhish: ${flag.verdict} — ${flag.reason}`;
  });
}
