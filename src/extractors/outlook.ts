import { EmailData, EmailLink } from "../types";

// Outlook Web (outlook.office.com / outlook.live.com / outlook.office365.com)
// doesn't have well-documented stable selectors the way Gmail does — it's a
// frequently-changing React app with hashed class names. These are
// best-effort, layered so a DOM tweak on Microsoft's end degrades gracefully
// instead of breaking extraction outright.

const BODY_SELECTORS = ['[id^="UniqueMessageBody"]', 'div[role="main"] div[aria-label="Message body"]'];

export function findOutlookBody(): HTMLElement | null {
  for (const selector of BODY_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Text of everything in readingPane that comes before bodyEl in document
// order — i.e. just the header (sender, to, subject), not the message body.
// Scoping this way matters: the body often repeats the sender's address in
// banners/signatures, and scanning the whole pane would risk picking up the
// wrong address for emails where those differ.
function getHeaderText(readingPane: HTMLElement, bodyEl: HTMLElement): string {
  const walker = document.createTreeWalker(readingPane, NodeFilter.SHOW_TEXT);
  let text = "";
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (bodyEl.contains(node)) break;
    text += node.textContent + " ";
  }
  return text;
}

function findSenderInfo(bodyEl: HTMLElement): { name: string; email: string } | null {
  // Walk up to the reading pane and search its header area — Outlook has no
  // single stable "from" attribute the way Gmail's span[email] does.
  const readingPane = bodyEl.closest<HTMLElement>('div[role="main"]') ?? document.body;

  const mailtoLink = readingPane.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
  if (mailtoLink) {
    const email = mailtoLink.getAttribute("href")?.replace(/^mailto:/, "").split("?")[0] ?? "";
    const name = mailtoLink.textContent?.trim() || email;
    if (email) return { name, email };
  }

  // Fall back to scanning title/aria-label attributes for an email address —
  // Outlook commonly puts the full address there for tooltips/accessibility.
  const candidates = readingPane.querySelectorAll<HTMLElement>("[title], [aria-label]");
  for (const el of Array.from(candidates)) {
    const attr = el.getAttribute("title") ?? el.getAttribute("aria-label") ?? "";
    const match = attr.match(EMAIL_REGEX);
    if (match) {
      const name = el.textContent?.trim() || match[0];
      return { name, email: match[0] };
    }
  }

  // Last resort: some Outlook versions render "Display Name<email>" as plain
  // visible text in the header with no attribute carrying the address at all.
  const headerText = getHeaderText(readingPane, bodyEl);
  const match = headerText.match(EMAIL_REGEX);
  if (match) {
    const before = headerText.slice(Math.max(0, match.index! - 80), match.index);
    const nameMatch = before.match(/([A-Za-z][\w .,'-]{1,60})\s*<\s*$/);
    const name = nameMatch ? nameMatch[1].trim() : match[0];
    return { name, email: match[0] };
  }

  return null;
}

function findSubject(bodyEl: HTMLElement): string {
  const readingPane = bodyEl.closest<HTMLElement>('div[role="main"]') ?? document.body;
  const heading = readingPane.querySelector<HTMLElement>('[role="heading"]');
  return heading?.textContent?.trim() ?? "";
}

export function extractOutlookEmail(): EmailData | null {
  const bodyEl = findOutlookBody();
  if (!bodyEl) return null;

  const sender = findSenderInfo(bodyEl);
  if (!sender) return null;

  const subject = findSubject(bodyEl);
  const bodyText = bodyEl.textContent ?? "";

  const links: EmailLink[] = Array.from(bodyEl.querySelectorAll("a[href]"))
    .map((a) => ({
      text: a.textContent?.trim() ?? "",
      href: a.getAttribute("href") ?? "",
    }))
    .filter((link) => link.href.startsWith("http"));

  return {
    senderName: sender.name,
    senderEmail: sender.email,
    replyTo: null,
    subject,
    bodyText,
    links,
  };
}
