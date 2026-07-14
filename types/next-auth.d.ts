import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: "admin" | "affiliate";
      affiliateId?: string | null;
    } & DefaultSession["user"];
  }
  interface User {
    role?: "admin" | "affiliate";
    affiliateId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "affiliate";
    affiliateId?: string | null;
  }
}
