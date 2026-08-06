import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  GMAIL_SCOPES,
  getGmailRedirectUri,
  isGmailOAuthConfigured,
} from "./config";

function getSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-gmail-oauth-secret"
  );
}

export type OAuthStatePayload = {
  businessId: string;
  nonce: string;
  ts: number;
};

export function createOAuthState(businessId: string): string {
  const payload: OAuthStatePayload = {
    businessId,
    nonce: randomUUID(),
    ts: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function parseOAuthState(state: string): OAuthStatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as OAuthStatePayload;
    // 15 minute expiry
    if (!payload.businessId || Date.now() - payload.ts > 15 * 60 * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getGoogleAuthUrl(state: string): string {
  if (!isGmailOAuthConfigured()) {
    throw new Error("Google OAuth is not configured");
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getGmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getGmailRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  return res.json() as Promise<GoogleTokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }

  return res.json() as Promise<GoogleTokenResponse>;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch Google account email");
  }

  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("Google account has no email");
  return data.email.toLowerCase();
}
