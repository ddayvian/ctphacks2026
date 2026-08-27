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

export type Verdict = "safe" | "suspicious" | "dangerous";

export interface FlaggedLink {
  href: string;
  verdict: Verdict;
  reason: string;
}

export interface AiAnalysis {
  verdict: Verdict;
  score: number;
  explanation: string;
  flaggedLinks: FlaggedLink[];
}

export interface StoredAnalysis extends AiAnalysis {
  senderEmail: string;
  subject: string;
  analyzedAt: number;
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
