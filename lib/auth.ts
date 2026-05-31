import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/youtube.readonly",
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        (session.user as any).id = user.id;
      }
      return session;
    },
    async signIn({ account, profile }) {
      try {
        console.log("[Auth Debug] signIn callback fired");
        console.log("[Auth Debug] account:", JSON.stringify({
          provider: account?.provider,
          type: account?.type,
          scope: account?.scope,
          has_access_token: !!account?.access_token,
          has_refresh_token: !!account?.refresh_token,
          expires_at: account?.expires_at,
        }));
        console.log("[Auth Debug] profile email:", (profile as any)?.email);
        return true;
      } catch (err: any) {
        console.error("[Auth Debug] signIn callback ERROR:", err.message);
        return false;
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
