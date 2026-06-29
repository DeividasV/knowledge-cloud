import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecommendations } from "@/app/actions/recommendations";
import { RecommendationList } from "./_components/recommendation-list";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default async function RecommendationsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { selectedCategory: true },
  });
  const selectedCategory = user?.selectedCategory;

  const recommendations = await getRecommendations({
    category: selectedCategory ?? undefined,
    limit: 50,
  });

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
          {selectedCategory && (
            <span className="ml-1 text-primary font-medium">
              · filtered by &quot;{selectedCategory}&quot;
            </span>
          )}
        </p>
      </div>

      {recommendations.length === 0 ? (
        <Card className="p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">No recommendations yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {selectedCategory
              ? `No unwatched recommendations in the "${selectedCategory}" category. Try selecting a different category in the sidebar or clearing the filter.`
              : "Add more channels and videos, watch some content, and generate tags. Recommendations appear once we have enough data about your interests."}
          </p>
        </Card>
      ) : (
        <RecommendationList
          recommendations={recommendations}
          selectedCategory={selectedCategory}
        />
      )}
    </div>
  );
}
