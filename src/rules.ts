import { EmailData, RuleFinding } from "./types";

const KNOWN_BRANDS = [
  "paypal", "google", "microsoft", "apple", "amazon", "netflix", "bank",
  "chase", "wellsfargo", "bankofamerica", "facebook", "instagram", "linkedin",
  "irs", "usps", "fedex", "ups", "dhl", "coinbase", "binance", "docusign",
];

const URL_SHORTENERS = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly",
];

const URGENCY_PHRASES = [
  "verify your account", "account suspended", "act now", "immediate action",
  "urgent", "confirm your identity", "unusual activity", "click here immediately",
  "your account will be closed", "limited time", "verify immediately",
  "suspended", "restricted access", "unauthorized login", "password expires",
  "final notice", "failure to comply",
];

function extractDomain(input: string): string | null {
  const emailMatch = input.match(/@([\w.-]+)/);
  if (emailMatch) return emailMatch[1].toLowerCase();
  try {
    const url = new URL(input.includes("://") ? input : `http://${input}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function isLookalikeDomain(domain: string): string | null {
  const root = domain.split(".").slice(-2, -1)[0] ?? domain;
  for (const brand of KNOWN_BRANDS) {
    if (root === brand) continue;
    const distance = levenshtein(root, brand);
    if (distance > 0 && distance <= 2 && Math.abs(root.length - brand.length) <= 2) {
      return brand;
    }
  }
  return null;
}

function isIpAddress(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

export function runRules(email: EmailData): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const senderDomain = extractDomain(email.senderEmail);

  // Sender display name impersonates a known brand not matching the domain
  const senderNameLower = email.senderName.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (senderNameLower.includes(brand) && senderDomain && !senderDomain.includes(brand)) {
      findings.push({
        id: "sender-brand-mismatch",
        label: "Sender name impersonates a known brand",
        detail: `Display name mentions "${brand}" but the email domain is "${senderDomain}"`,
        severity: "danger",
        points: 35,
      });
      break;
    }
  }

  // Reply-To differs from From
  if (email.replyTo) {
    const replyDomain = extractDomain(email.replyTo);
    if (replyDomain && senderDomain && replyDomain !== senderDomain) {
      findings.push({
        id: "reply-to-mismatch",
        label: "Reply-To address differs from sender",
        detail: `From domain "${senderDomain}" but replies go to "${replyDomain}"`,
        severity: "warning",
        points: 15,
      });
    }
  }

  // Sender domain lookalike of a known brand
  if (senderDomain) {
    const lookalike = isLookalikeDomain(senderDomain);
    if (lookalike) {
      findings.push({
        id: "sender-lookalike-domain",
        label: "Sender domain looks like a spoofed brand domain",
        detail: `"${senderDomain}" closely resembles "${lookalike}"`,
        severity: "danger",
        points: 30,
      });
    }
  }

  // Urgency / pressure language
  const bodyLower = email.bodyText.toLowerCase();
  const matchedPhrases = URGENCY_PHRASES.filter((p) => bodyLower.includes(p));
  if (matchedPhrases.length > 0) {
    findings.push({
      id: "urgency-language",
      label: "Uses urgency or pressure language",
      detail: `Found phrase(s): ${matchedPhrases.slice(0, 3).join(", ")}`,
      severity: matchedPhrases.length >= 2 ? "danger" : "warning",
      points: Math.min(10 * matchedPhrases.length, 25),
    });
  }

  // Link-level checks — accumulate offending hrefs per issue type, then
  // emit one finding per issue type covering every link that triggered it.
  const linkIssueHrefs: Record<string, Set<string>> = {
    "link-text-mismatch": new Set(),
    "ip-link": new Set(),
    "punycode-link": new Set(),
    "url-shortener": new Set(),
    "insecure-link": new Set(),
    "link-lookalike": new Set(),
    "excessive-subdomains": new Set(),
  };
  const lookalikeBrandByHref = new Map<string, string>();

  for (const link of email.links) {
    let linkHost: string | null = null;
    try {
      linkHost = new URL(link.href).hostname.toLowerCase();
    } catch {
      continue;
    }

    const textDomain = extractDomain(link.text);
    if (textDomain && linkHost && !linkHost.endsWith(textDomain) && !textDomain.endsWith(linkHost)) {
      linkIssueHrefs["link-text-mismatch"].add(link.href);
    }
    if (isIpAddress(linkHost)) {
      linkIssueHrefs["ip-link"].add(link.href);
    }
    if (linkHost.includes("xn--")) {
      linkIssueHrefs["punycode-link"].add(link.href);
    }
    if (URL_SHORTENERS.includes(linkHost)) {
      linkIssueHrefs["url-shortener"].add(link.href);
    }
    if (link.href.startsWith("http://")) {
      linkIssueHrefs["insecure-link"].add(link.href);
    }
    const linkLookalike = isLookalikeDomain(linkHost);
    if (linkLookalike) {
      linkIssueHrefs["link-lookalike"].add(link.href);
      lookalikeBrandByHref.set(link.href, linkLookalike);
    }
    if (linkHost.split(".").length >= 5) {
      linkIssueHrefs["excessive-subdomains"].add(link.href);
    }
  }

  const pushLinkFinding = (
    id: keyof typeof linkIssueHrefs,
    label: string,
    detail: (hrefs: string[]) => string,
    severity: RuleFinding["severity"],
    points: number
  ) => {
    const hrefs = Array.from(linkIssueHrefs[id]);
    if (hrefs.length === 0) return;
    findings.push({ id, label, detail: detail(hrefs), severity, points, relatedHrefs: hrefs });
  };

  pushLinkFinding(
    "link-text-mismatch",
    "Link text doesn't match its destination",
    (hrefs) => `${hrefs.length} link(s) show one destination but point elsewhere`,
    "danger",
    30
  );
  pushLinkFinding(
    "ip-link",
    "Link points to a raw IP address",
    (hrefs) => `${hrefs.length} link(s) use an IP address instead of a domain name`,
    "danger",
    25
  );
  pushLinkFinding(
    "punycode-link",
    "Link uses punycode encoding",
    (hrefs) => `${hrefs.length} link(s) may visually spoof a trusted domain`,
    "danger",
    25
  );
  pushLinkFinding(
    "url-shortener",
    "Link uses a URL shortener",
    (hrefs) => `${hrefs.length} link(s) hide their true destination`,
    "warning",
    10
  );
  pushLinkFinding(
    "insecure-link",
    "Link uses insecure HTTP",
    (hrefs) => `${hrefs.length} link(s) do not use HTTPS`,
    "warning",
    8
  );
  pushLinkFinding(
    "link-lookalike",
    "Link domain looks like a spoofed brand domain",
    (hrefs) => {
      const brand = lookalikeBrandByHref.get(hrefs[0]);
      return `${hrefs.length} link(s) closely resemble "${brand}"`;
    },
    "danger",
    30
  );
  pushLinkFinding(
    "excessive-subdomains",
    "Link uses an unusually long subdomain chain",
    (hrefs) => `${hrefs.length} link(s) use an unusually long subdomain chain — often used to bury the real domain`,
    "warning",
    12
  );

  return findings;
}
