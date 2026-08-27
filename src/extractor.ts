import { EmailData } from "./types";
import { findGmailBody, extractGmailEmail } from "./extractors/gmail";
import { findOutlookBody, extractOutlookEmail } from "./extractors/outlook";

type MailClient = "gmail" | "outlook" | "unknown";

function detectClient(): MailClient {
  const host = location.hostname;
  if (host === "mail.google.com") return "gmail";
  if (
    host.endsWith("outlook.live.com") ||
    host.endsWith("outlook.office.com") ||
    host.endsWith("outlook.office365.com")
  ) {
    return "outlook";
  }
  return "unknown";
}

export function findOpenMessageBody(): HTMLElement | null {
  switch (detectClient()) {
    case "gmail":
      return findGmailBody();
    case "outlook":
      return findOutlookBody();
    default:
      return null;
  }
}

export function extractOpenEmail(): EmailData | null {
  switch (detectClient()) {
    case "gmail":
      return extractGmailEmail();
    case "outlook":
      return extractOutlookEmail();
    default:
      return null;
  }
}
