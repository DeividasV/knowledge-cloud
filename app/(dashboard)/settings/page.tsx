import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  getTranscriptStats,
  getMaxTagsSetting,
  getMaxVideosSetting,
  getMinDurationSetting,
  getTagExtractionMethodSetting,
  getTagBatchModeSetting,
  getGeminiModelSetting,
  getOllamaMaxChunksSetting,
  getTagLanguageSetting,
} from "@/app/actions/videos";
import { getUserChannels, removeChannel } from "@/app/actions/channels";
import { syncChannelVideos } from "@/app/actions/sync";
import { TranscriptBulkFetch } from "@/components/transcript-bulk-fetch";
import { PendingButton } from "@/components/pending-button";
import { TagSettings } from "@/components/tag-settings";
import { TagExtractionSettings } from "@/components/tag-extraction-settings";
import { SyncSettings } from "@/components/sync-settings";
import { DurationSettings } from "@/components/duration-settings";
import { AddChannelForm } from "@/components/add-channel-form";
import { AddVideoForm } from "@/components/add-video-form";
import { userVideosWhere } from "@/lib/video-access";
import {
  RefreshCw,
  FileText,
  Sparkles,
  CheckCircle,
  Trash2,
  Clock,
} from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: { videoStates: true },
      },
    },
  });

  const channels = await getUserChannels();
  const transcriptStats = await getTranscriptStats();
  const maxTags = await getMaxTagsSetting();
  const maxVideos = await getMaxVideosSetting();
  const minDuration = await getMinDurationSetting();
  const tagExtractionMethod = await getTagExtractionMethodSetting();
  const tagBatchMode = await getTagBatchModeSetting();
  const geminiModel = await getGeminiModelSetting();
  const ollamaMaxChunks = await getOllamaMaxChunksSetting();
  const tagLanguage = await getTagLanguageSetting();

  const videosWithoutTranscript = await prisma.video.findMany({
    where: {
      ...userVideosWhere(userId),
      transcript: null,
    },
    select: { id: true },
    take: 500,
  });
  const missingTranscriptIds = videosWithoutTranscript.map((v) => v.id);

  if (!user) return null;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your channels, videos, and app preferences.
        </p>
      </div>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Channels
          </CardTitle>
          <CardDescription>
            Add YouTube channels to track their videos. Paste a channel URL, @handle, or channel ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddChannelForm />

          {channels.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Your channels ({channels.length})</h4>
              <div className="space-y-1">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {ch.thumbnail ? (
                        <img src={ch.thumbnail} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ch.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {ch._count.videos} videos
                          {ch.lastSyncedAt && (
                            <span className="ml-2 flex items-center gap-1 inline-flex">
                              <Clock className="h-3 w-3" />
                              {new Date(ch.lastSyncedAt).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <form action={syncChannelVideos.bind(null, ch.id)}>
                        <PendingButton size="sm" variant="ghost" className="h-7 px-2">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </PendingButton>
                      </form>
                      <form action={removeChannel.bind(null, ch.id)}>
                        <PendingButton size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </PendingButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SyncSettings initialMaxVideos={maxVideos} />
          <DurationSettings initialMinDuration={minDuration} />
        </CardContent>
      </Card>

      {/* Videos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Videos
          </CardTitle>
          <CardDescription>
            Add individual YouTube videos by URL or video ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddVideoForm />
        </CardContent>
      </Card>

      {/* Transcripts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcripts
          </CardTitle>
          <CardDescription>
            Fetch video transcripts (captions) for search and reference. Not all videos have captions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">With transcript</span>
            <span className="font-medium">{transcriptStats.withTranscript}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Without transcript</span>
            <span className="font-medium">{transcriptStats.withoutTranscript}</span>
          </div>

          {missingTranscriptIds.length > 0 ? (
            <TranscriptBulkFetch videoIds={missingTranscriptIds} />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              All transcripts fetched
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Auto Tags
          </CardTitle>
          <CardDescription>
            Generate tags from title, description, and transcript using lightweight NLP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TagExtractionSettings
            initialMethod={tagExtractionMethod}
            initialGeminiModel={geminiModel}
            initialOllamaMaxChunks={ollamaMaxChunks}
            initialTagLanguage={tagLanguage}
          />
          <TagSettings initialMaxTags={maxTags} initialBatchMode={tagBatchMode} />
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subscribed channels</span>
            <span className="font-medium">{channels.length}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Video status entries</span>
            <span className="font-medium">{user._count.videoStates}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
