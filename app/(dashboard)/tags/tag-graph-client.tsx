"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { TagGraph, TagDetailPanel } from "@/components/tag-graph";
import { TagGraphData, getTagGraph, getVideosForTag } from "@/app/actions/tag-graph";
import { TagGraphNode } from "@/app/actions/tag-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Network } from "lucide-react";

const LS_KEY = "yt-tracker-tag-graph-categories";

export function TagGraphClient({
  initialGraph,
  categories,
}: {
  initialGraph: TagGraphData;
  categories: string[];
}) {
  const [graph, setGraph] = useState<TagGraphData>(initialGraph);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TagGraphNode | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();

  // Load saved selection from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Only keep categories that still exist
          const valid = parsed.filter((c) => categories.includes(c));
          if (valid.length > 0) {
            setSelectedCategories(valid);
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [categories]);

  // Save to localStorage when selection changes
  useEffect(() => {
    if (selectedCategories.length > 0) {
      localStorage.setItem(LS_KEY, JSON.stringify(selectedCategories));
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }, [selectedCategories]);

  // Refetch graph when categories change
  useEffect(() => {
    if (selectedCategories.length === 0) {
      setGraph(initialGraph);
      return;
    }

    setIsLoading(true);
    getTagGraph(150, 2, selectedCategories)
      .then((newGraph) => {
        setGraph(newGraph);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [selectedCategories, initialGraph]);

  const toggleCategory = useCallback((name: string) => {
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedCategories((prev) =>
      prev.length === categories.length ? [] : [...categories]
    );
  }, [categories]);

  const handleNodeClick = useCallback(
    (tagId: string) => {
      const tag = graph.nodes.find((n) => n.id === tagId) ?? null;
      setSelectedTag(tag);
      startTransition(async () => {
        const result = await getVideosForTag(
          tagId,
          20,
          selectedCategories.length > 0 ? selectedCategories : undefined
        );
        setVideos(result);
      });
    },
    [graph.nodes, selectedCategories]
  );

  const handleClose = useCallback(() => {
    setSelectedTag(null);
    setVideos([]);
  }, []);

  const allSelected = categories.length > 0 && selectedCategories.length === categories.length;

  return (
    <div className="space-y-4">
      {/* Category filter bar */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={selectedCategories.length === 0 ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategories([])}
            className="h-7 text-xs"
          >
            All
          </Button>
          <Button
            variant={allSelected ? "default" : "outline"}
            size="sm"
            onClick={selectAll}
            className="h-7 text-xs"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          {categories.map((name) => {
            const isActive = selectedCategories.includes(name);
            return (
              <Badge
                key={name}
                variant={isActive ? "default" : "outline"}
                className="cursor-pointer text-xs px-2.5 py-0.5 select-none"
                onClick={() => toggleCategory(name)}
              >
                {name}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Graph container */}
      <div
        className="rounded-xl border bg-card relative overflow-hidden"
        style={{ height: "calc(100vh - 280px)" }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading graph...</span>
            </div>
          </div>
        )}

        {graph.nodes.length === 0 && !isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Network className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground text-sm">
                No tags found for the selected categories.
              </p>
            </div>
          </div>
        ) : (
          <>
            <TagGraph
              nodes={graph.nodes}
              edges={graph.edges}
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
          </>
        )}
      </div>
    </div>
  );
}
