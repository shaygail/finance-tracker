"use server";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { sendInviteEmail } from "@/lib/email/resend";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

export async function inviteAccountant(formData: FormData) {
  const session = await requireSession();

  if (session.user.role !== "owner") {
    return { error: "Only owners can invite team members", success: false };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Valid email required", success: false };
  }

  const businessId = session.user.businessId;
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (!business) return { error: "Business not found", success: false };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    const member = await db.businessMember.findUnique({
      where: { userId_businessId: { userId: existing.id, businessId } },
    });
    if (member) {
      return { error: "User is already a member of this business", success: false };
    }
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.businessInvite.upsert({
    where: { businessId_email: { businessId, email } },
    create: { businessId, email, role: "accountant", token, expiresAt },
    update: { token, expiresAt, role: "accountant" },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/${token}`;

  const result = await sendInviteEmail({
    to: email,
    businessName: business.name,
    inviteUrl,
    role: "accountant",
  });

  revalidatePath("/settings");

  return {
    error: null,
    success: true,
    devUrl: result.logged ? inviteUrl : undefined,
    sent: result.sent,
  };
}

export async function acceptInvite(formData: FormData) {
  const token = formData.get("token") as string;
  const name = (formData.get("name") as string)?.trim();
  const password = formData.get("password") as string;

  if (!token || !name || !password || password.length < 6) {
    return { error: "Name and password (min 6 chars) required", success: false };
  }

  const invite = await db.businessInvite.findUnique({ where: { token } });
  if (!invite || invite.expiresAt < new Date()) {
    return { error: "Invitation expired or invalid", success: false };
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);

  let user = await db.user.findUnique({ where: { email: invite.email } });
  if (!user) {
    user = await db.user.create({
      data: { email: invite.email, name, passwordHash },
    });
  }

  await db.businessMember.upsert({
    where: {
      userId_businessId: { userId: user.id, businessId: invite.businessId },
    },
    create: {
      userId: user.id,
      businessId: invite.businessId,
      role: invite.role,
    },
    update: { role: invite.role },
  });

  await db.businessInvite.delete({ where: { id: invite.id } });

  return { error: null, success: true, email: invite.email };
}

export async function setGstRegistered(enabled: boolean) {
  const session = await requireSession();
  if (session.user.role !== "owner") {
    return { error: "Only the owner can change GST registration status" };
  }

  await db.business.update({
    where: { id: session.user.businessId },
    data: { gstRegistered: enabled },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/reports/gst");
  revalidatePath("/transactions");
  return { ok: true };
}
