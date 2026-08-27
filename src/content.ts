import { extractOpenEmail, findOpenMessageBody } from "./extractor";
import { renderAiLoading, renderAiResult, renderAiError, highlightLinks } from "./highlighter";
import { AnalyzeAiMessage, AnalyzeAiResponse, EmailData, StoredAnalysis } from "./types";

let lastAnalyzedKey: string | null = null;

// Key of the request still awaiting a response, if any. A separate timer
// (not the MutationObserver) uses this to keep the loading banner visible
// while we wait — Outlook's own re-renders can silently remove it from the
// DOM mid-wait. This must stay decoupled from the observer: reasserting the
// banner from inside the observer's own callback would re-trigger the
// observer on our own mutation, looping forever and freezing the tab (what
// happened last time).
let awaitingKey: string | null = null;

// True once the extension has been reloaded out from under this tab's
// content script — chrome.runtime calls throw synchronously after that, and
// the tab needs a manual refresh to get a fresh script. No point retrying.
let extensionContextLost = false;

function requestAiAnalysis(bodyEl: HTMLElement, email: EmailData, key: string): void {
  awaitingKey = key;
  renderAiLoading(bodyEl);

  const message: AnalyzeAiMessage = { type: "ANALYZE_AI", email };
  try {
    chrome.runtime.sendMessage(message, (response: AnalyzeAiResponse | undefined) => {
      // Bail if the user has since opened a different email.
      if (key !== lastAnalyzedKey) return;
      awaitingKey = null;

      // Re-query rather than reuse the bodyEl captured above — by the time
      // this async response arrives, Outlook may have already replaced that
      // subtree with fresh React-rendered nodes, leaving the old reference
      // detached from the document (banner would render but never be seen).
      const currentBodyEl = findOpenMessageBody();
      if (!currentBodyEl) return;

      if (chrome.runtime.lastError) {
        renderAiError(currentBodyEl, chrome.runtime.lastError.message ?? "extension error");
        return;
      }
      if (!response || !response.ok || !response.result) {
        renderAiError(currentBodyEl, response?.error ?? "no response");
        return;
      }

      renderAiResult(currentBodyEl, response.result);
      highlightLinks(currentBodyEl, response.result.flaggedLinks);

      const stored: StoredAnalysis = {
        ...response.result,
        senderEmail: email.senderEmail,
        subject: email.subject,
        analyzedAt: Date.now(),
      };
      chrome.storage.local.set({ lastResult: stored });
    });
  } catch {
    awaitingKey = null;
    extensionContextLost = true;
    observer.disconnect();
    renderAiError(bodyEl, "extension was updated — refresh this page");
  }
}

let lastLoggedFailure = "";

function scanAndRender(): void {
  if (extensionContextLost) return;

  const bodyEl = findOpenMessageBody();
  if (!bodyEl) {
    if (lastLoggedFailure !== "no-body") {
      lastLoggedFailure = "no-body";
      console.log("[CatPhish] no message body container found on this page");
    }
    return;
  }

  const email = extractOpenEmail();
  if (!email) {
    if (lastLoggedFailure !== "no-sender") {
      lastLoggedFailure = "no-sender";
      console.log("[CatPhish] found message body, but sender/subject extraction failed", bodyEl);
    }
    return;
  }
  lastLoggedFailure = "";

  // Avoid re-analyzing the same open email on every DOM mutation.
  const key = `${email.senderEmail}::${email.subject}`;
  if (key === lastAnalyzedKey) return;
  lastAnalyzedKey = key;

  console.log("[CatPhish] extracted email, requesting AI analysis", email);
  requestAiAnalysis(bodyEl, email, key);
}

const observer = new MutationObserver(() => {
  scanAndRender();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial pass in case an email is already open on load.
scanAndRender();

// Independent of the observer on purpose — periodically re-assert the
// loading banner while a request is in flight. Since this timer isn't
// triggered by DOM mutations, it can't create a feedback loop with the
// MutationObserver above, even though it mutates the DOM itself.
setInterval(() => {
  if (!awaitingKey || extensionContextLost) return;
  const bodyEl = findOpenMessageBody();
  if (bodyEl) renderAiLoading(bodyEl);
}, 500);
