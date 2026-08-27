import { extractOpenEmail, findOpenMessageBody } from "./extractor";
import { analyzeEmail } from "./scorer";
import { renderBanner, highlightLinks, renderAiLoading, renderAiResult, renderAiError } from "./highlighter";
import { AnalysisResult, AnalyzeAiMessage, AnalyzeAiResponse, EmailData } from "./types";

let lastAnalyzedKey: string | null = null;

function requestAiAnalysis(email: EmailData, key: string): void {
  renderAiLoading();

  const message: AnalyzeAiMessage = { type: "ANALYZE_AI", email };
  chrome.runtime.sendMessage(message, (response: AnalyzeAiResponse | undefined) => {
    // Bail if the user has since opened a different email.
    if (key !== lastAnalyzedKey) return;

    if (chrome.runtime.lastError) {
      renderAiError(chrome.runtime.lastError.message ?? "extension error");
      return;
    }
    if (!response || !response.ok || !response.result) {
      renderAiError(response?.error ?? "no response");
      return;
    }
    renderAiResult(response.result);
  });
}

function scanAndRender(): void {
  const bodyEl = findOpenMessageBody();
  if (!bodyEl) return;

  const email = extractOpenEmail();
  if (!email) return;

  // Avoid re-analyzing the same open email on every DOM mutation.
  const key = `${email.senderEmail}::${email.subject}`;
  if (key === lastAnalyzedKey) return;
  lastAnalyzedKey = key;

  const result: AnalysisResult = analyzeEmail(email);

  renderBanner(bodyEl, result);

  const flaggedHrefs = new Set<string>();
  for (const finding of result.findings) {
    finding.relatedHrefs?.forEach((href) => flaggedHrefs.add(href));
  }
  highlightLinks(bodyEl, flaggedHrefs);

  chrome.storage.local.set({ lastResult: result });

  requestAiAnalysis(email, key);
}

const observer = new MutationObserver(() => {
  scanAndRender();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial pass in case an email is already open on load.
scanAndRender();
