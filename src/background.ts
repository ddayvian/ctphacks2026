import { AnalyzeAiMessage, AnalyzeAiResponse } from "./types";

const BACKEND_URL = "http://localhost:8000";

chrome.runtime.onInstalled.addListener(() => {
  console.log("CatPhish installed");
});

chrome.runtime.onMessage.addListener((message: AnalyzeAiMessage, _sender, sendResponse) => {
  if (message.type !== "ANALYZE_AI") return undefined;

  console.log("[CatPhish background] received ANALYZE_AI, fetching backend", message.email);

  fetch(`${BACKEND_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.email),
  })
    .then(async (res) => {
      const data = await res.json();
      console.log("[CatPhish background] backend responded", res.status, data);
      if (!res.ok) {
        sendResponse({ ok: false, error: data.error ?? `Request failed (${res.status})` } satisfies AnalyzeAiResponse);
        return;
      }
      sendResponse({ ok: true, result: data } satisfies AnalyzeAiResponse);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Network error";
      console.log("[CatPhish background] fetch failed", message);
      sendResponse({ ok: false, error: message } satisfies AnalyzeAiResponse);
    });

  return true; // keep the message channel open for the async response
});
