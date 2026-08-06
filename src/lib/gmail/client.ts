import { db } from "@/lib/db";
import { refreshAccessToken } from "./oauth";
import { GMAIL_INVOICE_QUERY } from "./config";

type GmailHeader = { name: string; value: string };

type GmailMessageList = {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
};

type GmailMessage = {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: GmailHeader[];
    parts?: { filename?: string; mimeType?: string; body?: { attachmentId?: string } }[];
    filename?: string;
    mimeType?: string;
  };
};

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  return (
    headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

function parseFrom(from: string): { email: string; vendor: string } {
  const match = from.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
  if (!match) {
    return { email: from.trim().toLowerCase(), vendor: from.trim() };
  }
  const name = (match[1] ?? "").trim();
  const email = match[2].trim().toLowerCase();
  return { email, vendor: name || email.split("@")[0] };
}

function parseAmount(text: string): number | null {
  const patterns = [
    /(?:total|amount|due|invoice)\s*[:=]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /\$\s*([\d,]+(?:\.\d{2})?)/,
    /NZD\s*([\d,]+(?:\.\d{2})?)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (!Number.isNaN(n) && n > 0 && n < 1_000_000) return n;
    }
  }
  return null;
}

function hasAttachment(message: GmailMessage): boolean {
  const parts = message.payload?.parts ?? [];
  if (parts.some((p) => p.filename)) return true;
  if (message.payload?.filename) return true;
  return false;
}

async function getValidAccessToken(connectionId: string): Promise<string> {
  const connection = await db.gmailConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  // Refresh 60s before expiry
  if (connection.expiresAt.getTime() > Date.now() + 60_000) {
    return connection.accessToken;
  }

  const tokens = await refreshAccessToken(connection.refreshToken);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await db.gmailConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: tokens.access_token,
      expiresAt,
      ...(tokens.refresh_token
        ? { refreshToken: tokens.refresh_token }
        : {}),
    },
  });

  return tokens.access_token;
}

async function gmailFetch<T>(
  accessToken: string,
  path: string
): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function listInvoiceMessages(
  connectionId: string,
  maxResults = 50
): Promise<
  {
    externalId: string;
    subject: string;
    fromEmail: string;
    vendor: string;
    receivedAt: Date;
    amount: number | null;
    hasAttachment: boolean;
  }[]
> {
  const connection = await db.gmailConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });
  const accessToken = await getValidAccessToken(connectionId);

  const list = await gmailFetch<GmailMessageList>(
    accessToken,
    `/users/me/messages?${new URLSearchParams({
      q: GMAIL_INVOICE_QUERY,
      maxResults: String(maxResults),
    })}`
  );

  const messages = list.messages ?? [];
  const results = [];

  for (const item of messages) {
    const full = await gmailFetch<GmailMessage>(
      accessToken,
      `/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
    );

    const headers = full.payload?.headers;
    const subject = headerValue(headers, "Subject") || "(no subject)";
    const fromRaw = headerValue(headers, "From");
    const { email: fromEmail, vendor } = parseFrom(fromRaw);
    const receivedAt = full.internalDate
      ? new Date(Number(full.internalDate))
      : new Date();
    const amount = parseAmount(`${subject} ${full.snippet ?? ""}`);

    results.push({
      externalId: `gmail:${connection.email}:${item.id}`,
      subject,
      fromEmail,
      vendor,
      receivedAt,
      amount,
      hasAttachment: hasAttachment(full),
    });
  }

  return results;
}
