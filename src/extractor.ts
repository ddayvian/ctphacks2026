import { EmailData, EmailLink } from "./types";

// Gmail's DOM uses unstable, obfuscated class names, but these have been
// stable identifiers across Gmail's web UI for a long time.
const SENDER_SELECTOR = "span.gD";
const SUBJECT_SELECTOR = "h2.hP";
const BODY_SELECTOR = "div.a3s";

export function findOpenMessageBody(): HTMLElement | null {
  return document.querySelector(BODY_SELECTOR);
}

export function extractOpenEmail(): EmailData | null {
  const senderEl = document.querySelector<HTMLElement>(SENDER_SELECTOR);
  const subjectEl = document.querySelector<HTMLElement>(SUBJECT_SELECTOR);
  const bodyEl = findOpenMessageBody();

  if (!senderEl || !bodyEl) return null;

  const senderEmail = senderEl.getAttribute("email") ?? "";
  const senderName = senderEl.getAttribute("name") ?? senderEl.textContent ?? "";
  const subject = subjectEl?.textContent?.trim() ?? "";
  const bodyText = bodyEl.textContent ?? "";

  const links: EmailLink[] = Array.from(bodyEl.querySelectorAll("a[href]"))
    .map((a) => ({
      text: a.textContent?.trim() ?? "",
      href: a.getAttribute("href") ?? "",
    }))
    .filter((link) => link.href.startsWith("http"));

  if (!senderEmail) return null;

  return {
    senderName: senderName.trim(),
    senderEmail: senderEmail.trim(),
    replyTo: null,
    subject,
    bodyText,
    links,
  };
}
