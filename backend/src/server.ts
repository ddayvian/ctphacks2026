import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface EmailLink {
  text: string;
  href: string;
}

interface AnalyzeRequestBody {
  senderName: string;
  senderEmail: string;
  subject: string;
  bodyText: string;
  links: EmailLink[];
}

const SYSTEM_INSTRUCTION =
  "You are a phishing detection assistant. Analyze the given email and judge how likely it is to be a phishing attempt.";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["safe", "suspicious", "dangerous"] },
    score: { type: "integer" },
    explanation: { type: "string" },
  },
  required: ["verdict", "score", "explanation"],
};

// Gemini's free tier returns 503 "high demand" fairly often. Retry a couple
// times with backoff, then fall back to the lite model (a separate capacity
// pool) before giving up.
const MODELS_IN_ORDER = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const RETRY_DELAYS_MS = [500, 1500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /503|504|UNAVAILABLE|DEADLINE_EXCEEDED|deadline|high demand|overloaded|timeout|timed out|aborted|ETIMEDOUT/i.test(
    message
  );
}

async function generateWithFallback(userContent: string) {
  let lastError: unknown;

  for (const model of MODELS_IN_ORDER) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await ai.models.generateContent({
          model,
          contents: userContent,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            httpOptions: { timeout: 15000 },
          },
        });
      } catch (error) {
        lastError = error;
        if (!isTransient(error)) throw error;
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  throw lastError;
}

app.post("/analyze", async (req, res) => {
  const body = req.body as Partial<AnalyzeRequestBody>;

  if (!body || typeof body.senderEmail !== "string" || typeof body.bodyText !== "string") {
    res.status(400).json({ error: "Missing required email fields" });
    return;
  }

  const linksSummary =
    (body.links ?? []).map((l) => `- text: "${l.text}" href: "${l.href}"`).join("\n") ||
    "(no links)";

  const userContent = [
    `Sender name: ${body.senderName ?? ""}`,
    `Sender email: ${body.senderEmail}`,
    `Subject: ${body.subject ?? ""}`,
    `Body:\n${body.bodyText.slice(0, 4000)}`,
    `Links:\n${linksSummary}`,
  ].join("\n");

  try {
    const response = await generateWithFallback(userContent);

    const text = response.text;
    if (!text) {
      res.status(502).json({ error: "Model returned no text" });
      return;
    }

    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      res.status(502).json({ error: "Model returned invalid JSON" });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(error);

    if (/api key|api_key|unauthorized|permission/i.test(message)) {
      res.status(500).json({ error: "Invalid API key" });
    } else if (/rate limit|quota|resource_exhausted/i.test(message)) {
      res.status(429).json({ error: "Rate limited, try again shortly" });
    } else if (isTransient(error)) {
      res.status(503).json({ error: "Gemini is overloaded right now — retried and gave up, try again shortly" });
    } else {
      res.status(502).json({ error: `Gemini API error: ${message}` });
    }
  }
});

const PORT = Number(process.env.PORT ?? 8000);
app.listen(PORT, () => {
  console.log(`PhishGuard AI backend listening on http://localhost:${PORT}`);
});
