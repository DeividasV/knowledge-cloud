import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getChannelsNeedingSyncForUser,
  syncChannelVideosInternal,
} from "@/app/actions/sync";

interface SyncResult {
  channelId: string;
  title: string | null;
  status: "success" | "error";
  error?: string;
}

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token || token !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const hoursAgo = 24;
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      maxVideosPerChannelSync: true,
      minVideoDurationSec: true,
    },
  });

  const results: SyncResult[] = [];

  for (const user of users) {
    const channels = await getChannelsNeedingSyncForUser(user.id, hoursAgo);
    const maxVideos = user.maxVideosPerChannelSync ?? 500;
    const minDuration = user.minVideoDurationSec ?? 300;

    for (const channel of channels) {
      try {
        await syncChannelVideosInternal(channel.id, maxVideos, minDuration);
        results.push({ channelId: channel.id, title: channel.title, status: "success" });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        results.push({
          channelId: channel.id,
          title: channel.title,
          status: "error",
          error: message,
        });
      }
    }
  }

  const staleChannels = await prisma.channel.count({
    where: {
      OR: [{ lastSyncedAt: { lt: cutoff } }, { lastSyncedAt: null }],
    },
  });

  revalidatePath("/");
  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  revalidatePath("/settings");

  return NextResponse.json({
    success: true,
    synced: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "error").length,
    staleRemaining: staleChannels,
    results,
  });
}
