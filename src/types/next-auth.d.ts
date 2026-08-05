import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      businessId: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    businessId: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    businessId: string;
    role: string;
  }
}
