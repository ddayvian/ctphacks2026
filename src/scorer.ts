import { AnalysisResult, EmailData, Verdict } from "./types";
import { runRules } from "./rules";

function verdictForScore(score: number): Verdict {
  if (score >= 50) return "dangerous";
  if (score >= 20) return "suspicious";
  return "safe";
}

export function analyzeEmail(email: EmailData): AnalysisResult {
  const findings = runRules(email);
  const score = Math.min(
    100,
    findings.reduce((sum, f) => sum + f.points, 0)
  );

  return {
    score,
    verdict: verdictForScore(score),
    findings,
    subject: email.subject,
    senderEmail: email.senderEmail,
    analyzedAt: Date.now(),
  };
}
