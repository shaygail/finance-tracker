export function isGmailOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export function getGmailRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/gmail/callback`;
}

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

/** Search query for supplier invoices / receipts with attachments */
export const GMAIL_INVOICE_QUERY =
  process.env.GMAIL_SEARCH_QUERY ??
  "has:attachment (subject:invoice OR subject:receipt OR \"tax invoice\" OR filename:pdf) newer_than:2y";
