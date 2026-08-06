import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
  parseOAuthState,
} from "@/lib/gmail/oauth";

function appUrl(path: string): URL {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return new URL(path, base);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      appUrl(`/invoices?gmail=denied&error=${encodeURIComponent(oauthError)}`)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(appUrl("/invoices?gmail=invalid"));
  }

  const payload = parseOAuthState(state);
  if (!payload) {
    return NextResponse.redirect(appUrl("/invoices?gmail=invalid_state"));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await fetchGoogleEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existing = await db.gmailConnection.findUnique({
      where: {
        businessId_email: {
          businessId: payload.businessId,
          email,
        },
      },
    });

    const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
    if (!refreshToken) {
      return NextResponse.redirect(appUrl("/invoices?gmail=no_refresh"));
    }

    await db.gmailConnection.upsert({
      where: {
        businessId_email: {
          businessId: payload.businessId,
          email,
        },
      },
      create: {
        businessId: payload.businessId,
        email,
        accessToken: tokens.access_token,
        refreshToken,
        expiresAt,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken,
        expiresAt,
      },
    });

    return NextResponse.redirect(
      appUrl(`/invoices?gmail=connected&email=${encodeURIComponent(email)}`)
    );
  } catch (err) {
    console.error("[gmail callback]", err);
    return NextResponse.redirect(appUrl("/invoices?gmail=error"));
  }
}
