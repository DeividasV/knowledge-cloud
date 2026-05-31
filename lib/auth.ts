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
      console.log("[Auth Debug] signIn callback");
      console.log("[Auth Debug] account.scope:", account?.scope);
      console.log("[Auth Debug] account.access_token exists:", !!account?.access_token);
      console.log("[Auth Debug] account.refresh_token exists:", !!account?.refresh_token);
      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
});
