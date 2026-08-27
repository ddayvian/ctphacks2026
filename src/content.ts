import { extractOpenEmail, findOpenMessageBody } from "./extractor";
import { renderAiLoading, renderAiResult, renderAiError, highlightLinks } from "./highlighter";
import { AnalyzeAiMessage, AnalyzeAiResponse, EmailData, StoredAnalysis } from "./types";

let lastAnalyzedKey: string | null = null;

// True once the extension has been reloaded out from under this tab's
// content script — chrome.runtime calls throw synchronously after that, and
// the tab needs a manual refresh to get a fresh script. No point retrying.
let extensionContextLost = false;

function requestAiAnalysis(bodyEl: HTMLElement, email: EmailData, key: string): void {
  renderAiLoading(bodyEl);

  const message: AnalyzeAiMessage = { type: "ANALYZE_AI", email };
  try {
    chrome.runtime.sendMessage(message, (response: AnalyzeAiResponse | undefined) => {
      // Bail if the user has since opened a different email.
      if (key !== lastAnalyzedKey) return;

      if (chrome.runtime.lastError) {
        renderAiError(bodyEl, chrome.runtime.lastError.message ?? "extension error");
        return;
      }
      if (!response || !response.ok || !response.result) {
        renderAiError(bodyEl, response?.error ?? "no response");
        return;
      }

      renderAiResult(bodyEl, response.result);
      highlightLinks(bodyEl, response.result.flaggedLinks);

      const stored: StoredAnalysis = {
        ...response.result,
        senderEmail: email.senderEmail,
        subject: email.subject,
        analyzedAt: Date.now(),
      };
      chrome.storage.local.set({ lastResult: stored });
    });
  } catch {
    extensionContextLost = true;
    observer.disconnect();
    renderAiError(bodyEl, "extension was updated — refresh this page");
  }
}

function scanAndRender(): void {
  if (extensionContextLost) return;

  const bodyEl = findOpenMessageBody();
  if (!bodyEl) return;

  const email = extractOpenEmail();
  if (!email) return;

  // Avoid re-analyzing the same open email on every DOM mutation.
  const key = `${email.senderEmail}::${email.subject}`;
  if (key === lastAnalyzedKey) return;
  lastAnalyzedKey = key;

  requestAiAnalysis(bodyEl, email, key);
}

const observer = new MutationObserver(() => {
  scanAndRender();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial pass in case an email is already open on load.
scanAndRender();
