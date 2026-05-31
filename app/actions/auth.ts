"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function forceReauth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Delete the Google account record to force a full re-consent on next sign-in
  await prisma.account.deleteMany({
    where: {
      userId: session.user.id,
      provider: "google",
    },
  });

  revalidatePath("/settings");
}
