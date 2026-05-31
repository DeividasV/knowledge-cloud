import { prisma } from "./prisma";

export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) {
    throw new Error("No Google account linked. Please sign in again.");
  }

  // Check if token is expired (with 60s buffer)
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at ?? 0;

  if (expiresAt > now + 60) {
    return account.access_token;
  }

  // Token expired — refresh it
  if (!account.refresh_token) {
    throw new Error(
      "Google access token expired and no refresh token available. Please sign out and sign in again."
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Google token: ${response.status} ${error}`);
  }

  const data = await response.json();
  const newAccessToken = data.access_token as string;
  const newExpiresIn = data.expires_in as number;
  const newExpiresAt = now + newExpiresIn;

  // Update database with new token
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: newAccessToken,
      expires_at: newExpiresAt,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    },
  });

  return newAccessToken;
}
