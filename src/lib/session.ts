import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function getSession() {
  return auth();
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.userId) {
    redirect("/login");
  }
  return session;
}

export async function getBusinessId(): Promise<string> {
  const session = await requireSession();
  return session.user.businessId;
}
