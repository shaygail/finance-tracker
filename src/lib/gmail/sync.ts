import { db } from "@/lib/db";
import { isGmailOAuthConfigured } from "./config";
import { listInvoiceMessages } from "./client";

export type GmailSyncResult = {
  ok: boolean;
  error?: string;
  connections: number;
  imported: number;
  updated: number;
};

export async function getGmailStatus(businessId: string) {
  const connections = await db.gmailConnection.findMany({
    where: { businessId },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      lastSyncedAt: true,
      createdAt: true,
    },
  });

  return {
    oauthConfigured: isGmailOAuthConfigured(),
    connections,
  };
}

export async function syncGmailInvoices(
  businessId: string
): Promise<GmailSyncResult> {
  if (!isGmailOAuthConfigured()) {
    return {
      ok: false,
      error:
        "Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env",
      connections: 0,
      imported: 0,
      updated: 0,
    };
  }

  const connections = await db.gmailConnection.findMany({
    where: { businessId },
  });

  if (connections.length === 0) {
    return {
      ok: false,
      error: "No Gmail accounts connected. Connect at least one inbox first.",
      connections: 0,
      imported: 0,
      updated: 0,
    };
  }

  let imported = 0;
  let updated = 0;

  try {
    for (const connection of connections) {
      const messages = await listInvoiceMessages(connection.id);

      for (const msg of messages) {
        const existing = await db.invoice.findUnique({
          where: {
            businessId_externalId: {
              businessId,
              externalId: msg.externalId,
            },
          },
        });

        if (existing) {
          await db.invoice.update({
            where: { id: existing.id },
            data: {
              subject: msg.subject,
              fromEmail: msg.fromEmail,
              vendor: msg.vendor,
              receivedAt: msg.receivedAt,
              amount: msg.amount ?? existing.amount,
              gmailEmail: connection.email,
              attachmentUrl: msg.hasAttachment
                ? existing.attachmentUrl ?? "gmail-attachment"
                : existing.attachmentUrl,
            },
          });
          updated += 1;
        } else {
          await db.invoice.create({
            data: {
              businessId,
              externalId: msg.externalId,
              subject: msg.subject,
              fromEmail: msg.fromEmail,
              vendor: msg.vendor,
              receivedAt: msg.receivedAt,
              amount: msg.amount,
              status: "unmatched",
              gmailEmail: connection.email,
              attachmentUrl: msg.hasAttachment ? "gmail-attachment" : null,
            },
          });
          imported += 1;
        }
      }

      await db.gmailConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date() },
      });
    }

    return {
      ok: true,
      connections: connections.length,
      imported,
      updated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync failed";
    return {
      ok: false,
      error: message,
      connections: connections.length,
      imported,
      updated,
    };
  }
}

export async function disconnectGmail(
  businessId: string,
  connectionId: string
): Promise<{ ok: boolean; error?: string }> {
  const connection = await db.gmailConnection.findFirst({
    where: { id: connectionId, businessId },
  });

  if (!connection) {
    return { ok: false, error: "Gmail connection not found" };
  }

  await db.gmailConnection.delete({ where: { id: connectionId } });
  return { ok: true };
}
