import { getTagGraph } from "@/app/actions/tag-graph";
import { TagGraphClient } from "./tag-graph-client";

export default async function TagsGraphPage() {
  const graph = await getTagGraph(150, 2);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tag Graph</h1>
        <p className="text-muted-foreground mt-1">
          Explore connections between tags across your videos. Nodes are tags, edges show co-occurrence.
        </p>
      </div>

      <div className="rounded-xl border bg-card relative overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
        <TagGraphClient initialGraph={graph} />
      </div>
    </div>
  );
}
