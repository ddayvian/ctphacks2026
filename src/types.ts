export interface EmailLink {
  text: string;
  href: string;
}

export interface EmailData {
  senderName: string;
  senderEmail: string;
  replyTo: string | null;
  subject: string;
  bodyText: string;
  links: EmailLink[];
}

export type Severity = "info" | "warning" | "danger";

export interface RuleFinding {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
  points: number;
  relatedHrefs?: string[];
}

export type Verdict = "safe" | "suspicious" | "dangerous";

export interface AnalysisResult {
  score: number;
  verdict: Verdict;
  findings: RuleFinding[];
  subject: string;
  senderEmail: string;
  analyzedAt: number;
}

export interface AiAnalysis {
  verdict: Verdict;
  score: number;
  explanation: string;
}

export interface AnalyzeAiMessage {
  type: "ANALYZE_AI";
  email: EmailData;
}

export interface AnalyzeAiResponse {
  ok: boolean;
  result?: AiAnalysis;
  error?: string;
}
