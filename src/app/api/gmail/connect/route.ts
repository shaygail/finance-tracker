import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGmailOAuthConfigured } from "@/lib/gmail/config";
import { createOAuthState, getGoogleAuthUrl } from "@/lib/gmail/oauth";

function appUrl(path: string): URL {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return new URL(path, base);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.userId || !session.user.businessId) {
    return NextResponse.redirect(appUrl("/login"));
  }

  if (session.user.role !== "owner") {
    return NextResponse.redirect(appUrl("/invoices?gmail=forbidden"));
  }

  if (!isGmailOAuthConfigured()) {
    return NextResponse.redirect(appUrl("/invoices?gmail=not_configured"));
  }

  const state = createOAuthState(session.user.businessId);
  const url = getGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
