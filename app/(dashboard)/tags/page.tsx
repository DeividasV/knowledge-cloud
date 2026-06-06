import { getTagGraph, getUserCategories } from "@/app/actions/tag-graph";
import { getSelectedCategory } from "@/app/actions/videos";
import { TagGraphClient } from "./tag-graph-client";

export default async function TagsGraphPage() {
  const [graph, categories, selectedCategory] = await Promise.all([
    getTagGraph(150, 2),
    getUserCategories(),
    getSelectedCategory(),
  ]);

  const initialCategories = selectedCategory && categories.includes(selectedCategory)
    ? [selectedCategory]
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tag Graph</h1>
        <p className="text-muted-foreground mt-1">
          Explore connections between tags across your videos. Nodes are tags, edges show co-occurrence.
        </p>
      </div>

      <TagGraphClient
        initialGraph={graph}
        categories={categories}
        initialSelectedCategories={initialCategories}
      />
    </div>
  );
}
