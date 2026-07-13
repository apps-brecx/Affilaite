// lib/auth.ts — Auth.js v5 config. Two roles share auth, differ by role claim:
// affiliates sign in with an email magic-link, admins with credentials.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        // Replace with a real lookup + hashed-password check against `users`.
        const email = String(creds?.email ?? "");
        const password = String(creds?.password ?? "");
        if (
          email === (process.env.ADMIN_EMAIL ?? "bu@brecx.com") &&
          password === (process.env.ADMIN_PASSWORD ?? "changeme")
        ) {
          return { id: "admin", email, name: "Administrator", role: "admin" } as any;
        }
        return null;
      },
    }),
    // Add an Email (magic-link) provider here for affiliates once Resend is wired:
    // Resend({ from: process.env.EMAIL_FROM })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role ?? "affiliate";
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role ?? "affiliate";
      return session;
    },
  },
});

export const isAdmin = (session: any) => session?.user?.role === "admin";
