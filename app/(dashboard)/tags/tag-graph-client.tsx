"use client";

import { useState, useTransition, useCallback } from "react";
import { TagGraph, TagDetailPanel } from "@/components/tag-graph";
import { TagGraphData, getVideosForTag } from "@/app/actions/tag-graph";
import { TagGraphNode } from "@/app/actions/tag-graph";

export function TagGraphClient({ initialGraph }: { initialGraph: TagGraphData }) {
  const [selectedTag, setSelectedTag] = useState<TagGraphNode | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleNodeClick = useCallback(
    (tagId: string) => {
      const tag = initialGraph.nodes.find((n) => n.id === tagId) ?? null;
      setSelectedTag(tag);
      startTransition(async () => {
        const result = await getVideosForTag(tagId, 20);
        setVideos(result);
      });
    },
    [initialGraph.nodes]
  );

  const handleClose = useCallback(() => {
    setSelectedTag(null);
    setVideos([]);
  }, []);

  return (
    <div className="relative w-full h-full">
      <TagGraph
        nodes={initialGraph.nodes}
        edges={initialGraph.edges}
        onNodeClick={handleNodeClick}
      />
      {isPending && !selectedTag && (
        <div className="absolute top-4 right-4 text-sm text-muted-foreground">
          Loading...
        </div>
      )}
      <TagDetailPanel
        tag={selectedTag}
        videos={videos}
        onClose={handleClose}
      />
    </div>
  );
}
