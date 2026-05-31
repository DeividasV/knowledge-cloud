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
      console.log("[Auth Debug] account keys:", Object.keys(account || {}));
      console.log("[Auth Debug] account.scope:", account?.scope);
      console.log("[Auth Debug] account.type:", account?.type);
      console.log("[Auth Debug] account.provider:", account?.provider);
      console.log("[Auth Debug] account.providerAccountId:", account?.providerAccountId);
      console.log("[Auth Debug] account.expires_at:", account?.expires_at);
      console.log("[Auth Debug] profile.email:", (profile as any)?.email);
      return true;
    },
    async jwt({ token, account }) {
      console.log("[Auth Debug] jwt callback - has account:", !!account);
      return token;
    },
  },
  events: {
    async signIn(message) {
      console.log("[Auth Debug] EVENT signIn:", JSON.stringify({
        userId: message.user.id,
        accountProvider: message.account?.provider,
        isNewUser: message.isNewUser,
      }));
    },
    async createUser(message) {
      console.log("[Auth Debug] EVENT createUser:", message.user.id);
    },
    async linkAccount(message) {
      console.log("[Auth Debug] EVENT linkAccount:", JSON.stringify({
        userId: message.user.id,
        provider: message.account.provider,
        providerAccountId: message.account.providerAccountId,
      }));
    },
    async session(message) {
      console.log("[Auth Debug] EVENT session:", message.session.user?.email);
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
