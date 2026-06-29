import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  PlaySquare,
  Calendar,
  Clock,
  User,
  Tag,
  FileText,
  Trash2,
  Eye,
  ThumbsUp,
  MessageCircle,
} from "lucide-react";
import { VideoStatusToggle } from "@/components/video-status-toggle";
import { VideoStatus } from "@/lib/types";
import { removeVideo } from "@/app/actions/videos";
import { VideoTagGenerate } from "@/components/video-tag-generate";
import { VideoCategoryEditor } from "@/components/video-category-editor";
import { TagReportClient } from "@/components/tag-report-client";
import { VideoTranscriptStatic } from "@/components/video-transcript-static";
import { userVideosWhere, userVideosWhereWithCategory } from "@/lib/video-access";

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface PageProps {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function VideoDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user!.id!;
  const { videoId } = await params;
  const { from: returnUrl } = await searchParams;

  const backHref = returnUrl || "/videos";
  const backLabel = backHref.startsWith("/channels/")
    ? "Back to channel"
    : backHref.startsWith("/tags/")
    ? "Back to tag"
    : "Back to videos";

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      ...(await userVideosWhere(userId)),
    },
    include: {
      channel: true,
      videoTags: {
        include: { tag: true },
        orderBy: { score: "desc" },
      },
      userStates: {
        where: { userId },
      },
    },
  });

  if (!video) notFound();

  const currentStatus =
    (video.userStates[0]?.status as VideoStatus) || "UNWATCHED";

  const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;

  const durationText = video.durationSec
    ? `${Math.floor(video.durationSec / 60)}:${String(
        video.durationSec % 60
      ).padStart(2, "0")}`
    : null;

  const publishedText = new Date(video.publishedAt).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  const tags = video.videoTags.map((vt) => ({
    id: vt.tag.id,
    name: vt.tag.name,
    score: vt.score,
  }));

  // Count other videos with same tag (from user's visible videos)
  const tagIds = tags.map((t) => t.id);
  const tagCounts: Map<string, number> = new Map();

  if (tagIds.length > 0) {
    const tagCountRows = await prisma.videoTag.groupBy({
      by: ["tagId"],
      where: {
        tagId: { in: tagIds },
        videoId: { not: videoId },
        video: await userVideosWhereWithCategory(userId),
      },
      _count: { videoId: true },
    });

    for (const row of tagCountRows) {
      tagCounts.set(row.tagId, row._count.videoId);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded-md hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>

      {/* Video header card */}
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden group">
          {video.thumbnail ? (
            <>
              <Image
                src={video.thumbnail}
                alt={video.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 60vw"
              />
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors"
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full font-medium text-sm">
                  <ExternalLink className="h-4 w-4" />
                  Open on YouTube
                </div>
              </a>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <PlaySquare className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold leading-snug">{video.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-2">
              {video.channel ? (
                <Link
                  href={`/channels/${video.channel.id}`}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  {video.channel.title}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <User className="h-3.5 w-3.5" />
                  Standalone
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {publishedText}
              </span>
              {durationText && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {durationText}
                </span>
              )}
              {video.viewCount != null && (
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {formatNumber(video.viewCount)} views
                </span>
              )}
              {video.likeCount != null && (
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {formatNumber(video.likeCount)}
                </span>
              )}
              {video.commentCount != null && (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {formatNumber(video.commentCount)}
                </span>
              )}
              <VideoCategoryEditor videoId={videoId} category={video.category} />
            </div>
          </div>

          <VideoStatusToggle
            videoId={video.id}
            currentStatus={currentStatus}
          />

          <div className="flex gap-2 flex-wrap">
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground text-sm font-medium h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              YouTube
            </a>
            {tags.length === 0 && <VideoTagGenerate videoId={videoId} />}
            <form
              action={async () => {
                "use server";
                await removeVideo(videoId);
              }}
            >
              <Button size="sm" variant="ghost" type="submit" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Remove
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Tag report */}
      {tags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Tag Report
              <Badge variant="outline" className="ml-auto text-xs font-normal">
                {tags.length} tags
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TagReportClient
              videoId={videoId}
              tags={tags}
              tagCounts={Object.fromEntries(tagCounts)}
            />
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {video.description && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {video.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* YouTube Tags */}
      {video.youtubeTags && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              YouTube Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(() => {
                try {
                  const ytTags = JSON.parse(video.youtubeTags) as string[];
                  return ytTags.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">
                      {t}
                    </Badge>
                  ));
                } catch {
                  return null;
                }
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VideoTranscriptStatic
            videoId={video.id}
            transcript={video.transcript}
          />
        </CardContent>
      </Card>
    </div>
  );
}
