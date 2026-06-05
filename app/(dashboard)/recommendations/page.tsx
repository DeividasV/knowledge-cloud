import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendations } from "@/app/actions/recommendations";
import { VideoCard } from "@/components/video-card";
import { VideoStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sparkles, Filter } from "lucide-react";
import Link from "next/link";

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;
  const { category: categoryFilter } = await searchParams;

  const recommendations = await getRecommendations({
    category: categoryFilter,
    limit: 12,
  });

  // Get categories for filter
  const categories = await prisma.category.findMany({
    where: { channels: { some: { users: { some: { id: userId } } } } },
    include: { _count: { select: { channels: true } } },
    orderBy: { name: "asc" },
  });

  const returnUrl = `/recommendations${categoryFilter ? `?category=${encodeURIComponent(categoryFilter)}` : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          Recommendations
        </h1>
        <p className="text-muted-foreground mt-1">
          Top picks based on your interests, recent uploads, tag completion, and
          diversity.
        </p>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Link
            href="/recommendations"
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              !categoryFilter
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/recommendations?category=${encodeURIComponent(cat.name)}`}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                categoryFilter === cat.name
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {recommendations.length === 0 ? (
        <Card className="p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">No recommendations yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Add more channels and videos, watch some content, and generate tags.
            Recommendations appear once we have enough data about your interests.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recommendations.map((video) => (
              <div key={video.id} className="space-y-1.5">
                <VideoCard
                  video={{
                    id: video.id,
                    title: video.title,
                    thumbnail: video.thumbnail,
                    publishedAt: video.publishedAt,
                    durationSec: video.durationSec,
                    transcript: null,
                    videoTags: video.videoTags,
                    status: video.status as VideoStatus,
                  }}
                  href={`/videos/${video.id}?from=${encodeURIComponent(returnUrl)}`}
                  subtitle={
                    <>
                      {video.channel?.title ?? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Standalone
                        </span>
                      )}
                      · {new Date(video.publishedAt).toLocaleDateString()}
                      {video.durationSec ? (
                        <span className="ml-2">
                          {Math.floor(video.durationSec / 60)}:
                          {String(video.durationSec % 60).padStart(2, "0")}
                        </span>
                      ) : null}
                    </>
                  }
                />
                {/* Recommendation reasons */}
                {video.reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1">
                    {video.reasons.map((reason) => (
                      <Badge
                        key={reason}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-primary/5 border-primary/20"
                      >
                        {reason}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
