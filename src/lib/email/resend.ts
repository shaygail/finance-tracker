import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Finance Tracker <onboarding@resend.dev>";

export async function sendInviteEmail(params: {
  to: string;
  businessName: string;
  inviteUrl: string;
  role: string;
}): Promise<{ sent: boolean; logged?: boolean }> {
  const { to, businessName, inviteUrl, role } = params;
  const subject = `You've been invited to ${businessName} on Finance Tracker`;

  const html = `
    <h2>You're invited</h2>
    <p>You've been invited as <strong>${role}</strong> for <strong>${businessName}</strong>.</p>
    <p><a href="${inviteUrl}">Accept invitation and set up your account</a></p>
    <p>This link expires in 7 days.</p>
    <p style="color:#64748b;font-size:12px;">STLL HAUS Finance Tracker — confidential financial data.</p>
  `;

  if (!resend) {
    console.log("[Resend dev mode] Invite email:");
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  URL: ${inviteUrl}`);
    return { sent: false, logged: true };
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });

  return { sent: true };
}
