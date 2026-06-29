"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TagGraph } from "@/components/tag-graph";
import { TagGraphData, getTagGraph } from "@/app/actions/tag-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Network } from "lucide-react";

const LS_KEY = "yt-tracker-tag-graph-categories";

export function TagGraphClient({
  initialGraph,
  categories,
  initialSelectedCategories = [],
}: {
  initialGraph: TagGraphData;
  categories: string[];
  initialSelectedCategories?: string[];
}) {
  const router = useRouter();
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (initialSelectedCategories.length > 0) return initialSelectedCategories;
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Only keep categories that still exist
          const valid = parsed.filter((c) => categories.includes(c));
          if (valid.length > 0) return valid;
        }
      }
    } catch {
      // ignore parse errors
    }
    return [];
  });
  const [fetchedGraph, setFetchedGraph] = useState<TagGraphData | null>(null);
  const [lastFetchedKey, setLastFetchedKey] = useState<string | null>(null);

  const graph =
    selectedCategories.length === 0 ? initialGraph : (fetchedGraph ?? initialGraph);
  const isLoading =
    selectedCategories.length > 0 &&
    lastFetchedKey !== selectedCategories.join(",");

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
    if (selectedCategories.length === 0) return;
    const key = selectedCategories.join(",");
    if (key === lastFetchedKey) return;

    getTagGraph(150, 2, selectedCategories).then((newGraph) => {
      setFetchedGraph(newGraph);
      setLastFetchedKey(key);
    });
  }, [selectedCategories, lastFetchedKey]);

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
      const tag = graph.nodes.find((n) => n.id === tagId);
      if (tag) {
        router.push(`/tags/${encodeURIComponent(tag.name)}`);
      }
    },
    [graph.nodes, router]
  );

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
          <TagGraph
            nodes={graph.nodes}
            edges={graph.edges}
            onNodeClick={handleNodeClick}
          />
        )}
      </div>
    </div>
  );
}
