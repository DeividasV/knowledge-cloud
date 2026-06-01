"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { TagGraphNode, TagGraphEdge } from "@/app/actions/tag-graph";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface TagGraphProps {
  nodes: TagGraphNode[];
  edges: TagGraphEdge[];
  onNodeClick?: (tagId: string) => void;
}

// Discrete colors for watch status
function getNodeColor(watchedCount: number, unwatchedCount: number): string {
  if (watchedCount === 0) return "#3b82f6"; // all unwatched → blue
  if (unwatchedCount === 0) return "#22c55e"; // all watched → green
  return "#f59e0b"; // mixed → amber
}

export function TagGraph({ nodes, edges, onNodeClick }: TagGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(500, entry.contentRect.height),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const g = svg.append("g");

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom as any);

    // Scales
    const maxWeight = Math.max(...edges.map((e) => e.weight), 1);
    const maxCount = Math.max(...nodes.map((n) => n.videoCount), 1);
    const radiusScale = d3
      .scaleSqrt()
      .domain([1, maxCount])
      .range([5, 25]);
    const strokeScale = d3
      .scaleLinear()
      .domain([1, maxWeight])
      .range([0.5, 4]);
    const opacityScale = d3
      .scaleLinear()
      .domain([1, maxWeight])
      .range([0.15, 0.6]);

    // Simulation
    const simulation = d3
      .forceSimulation<TagGraphNode & d3.SimulationNodeDatum>(nodes as any)
      .force(
        "link",
        d3
          .forceLink<TagGraphNode & d3.SimulationNodeDatum, any>(edges as any)
          .id((d: any) => d.id)
          .distance((d: any) => 150 - Math.min(d.weight * 3, 100))
          .strength((d: any) => Math.min(d.weight / maxWeight, 0.5))
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => radiusScale(d.videoCount) + 5));

    // Edges
    const link = g
      .append("g")
      .attr("stroke", "#94a3b8")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke-width", (d) => strokeScale(d.weight))
      .attr("stroke-opacity", (d) => opacityScale(d.weight));

    // Nodes group
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<any, any>()
          .on("start", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Background circle (interpolated color)
    node
      .append("circle")
      .attr("r", (d) => radiusScale(d.videoCount))
      .attr("fill", (d) => getNodeColor(d.watchedCount, d.unwatchedCount))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.9);

    // Pie chart overlay for mixed status
    node.each(function (d: TagGraphNode) {
      const ratio = d.watchedCount / d.videoCount;
      if (ratio > 0 && ratio < 1) {
        const r = radiusScale(d.videoCount) * 0.88;
        const pie = d3.pie<[number, string]>()
          .value((v) => v[0])
          .sort(null);
        const arc = d3.arc<d3.PieArcDatum<[number, string]>>()
          .innerRadius(r * 0.35)
          .outerRadius(r);

        const data: [number, string][] = [
          [d.watchedCount, "#22c55e"],
          [d.unwatchedCount, "#3b82f6"],
        ];

        d3.select(this)
          .append("g")
          .selectAll("path")
          .data(pie(data))
          .join("path")
          .attr("d", arc as any)
          .attr("fill", (p: any) => p.data[1])
          .attr("stroke", "rgba(255,255,255,0.6)")
          .attr("stroke-width", 0.75);
      }
    });

    // Labels (only for larger nodes)
    node
      .append("text")
      .attr("dy", (d) => radiusScale(d.videoCount) + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => Math.min(10 + d.videoCount / 5, 13))
      .attr("fill", "currentColor")
      .attr("class", "select-none")
      .text((d) => d.name);

    // Click handler
    node.on("click", (_event, d) => {
      onNodeClick?.(d.id);
    });

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges, dimensions, onNodeClick]);

  useEffect(() => {
    const cleanup = draw();
    return cleanup;
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 text-xs shadow-sm">
        <div className="font-medium mb-1.5 text-muted-foreground">Watch status</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
            <span>Unwatched</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
            <span>Watched</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
            <span>Mixed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TagDetailPanelProps {
  tag: TagGraphNode | null;
  videos: Array<{
    id: string;
    title: string;
    thumbnail: string | null;
    channel: { title: string };
    videoTags: Array<{ score: number }>;
    userStates: Array<{ status: string }>;
  }>;
  onClose: () => void;
}

export function TagDetailPanel({ tag, videos, onClose }: TagDetailPanelProps) {
  if (!tag) return null;

  const ratio = tag.videoCount > 0 ? tag.watchedCount / tag.videoCount : 0;
  const isAllWatched = ratio === 1;
  const isAllUnwatched = ratio === 0;

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[80vh] overflow-y-auto rounded-xl border bg-card shadow-lg p-4 z-10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">{tag.name}</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="secondary">{tag.videoCount} videos</Badge>
        <Badge variant="outline">score {tag.totalScore.toFixed(1)}</Badge>
        <Badge
          variant="outline"
          className={
            isAllWatched
              ? "bg-green-600/15 text-green-700 border-green-300 dark:text-green-400 dark:border-green-700"
              : isAllUnwatched
              ? "bg-blue-600/15 text-blue-700 border-blue-300 dark:text-blue-400 dark:border-blue-700"
              : "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700"
          }
        >
          {isAllWatched
            ? "All watched"
            : isAllUnwatched
            ? "All unwatched"
            : `${Math.round(ratio * 100)}% watched`}
        </Badge>
      </div>

      {/* Mini bar chart */}
      {ratio > 0 && ratio < 1 && (
        <div className="mb-4">
          <div className="flex h-2 rounded-full overflow-hidden">
            <div
              className="bg-green-500"
              style={{ width: `${ratio * 100}%` }}
            />
            <div
              className="bg-blue-500"
              style={{ width: `${(1 - ratio) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-green-600 font-medium">{tag.watchedCount} watched</span>
            <span className="text-blue-600 font-medium">{tag.unwatchedCount} unwatched</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {videos.map((video) => {
          const status = video.userStates[0]?.status ?? "UNWATCHED";
          const isWatched = status === "WATCHED" || status === "NOT_INTERESTED";
          return (
            <a
              key={video.id}
              href={`https://youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 p-2 rounded-lg hover:bg-muted transition-colors group"
            >
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt=""
                  className="w-20 h-12 object-cover rounded shrink-0"
                />
              ) : (
                <div className="w-20 h-12 bg-muted rounded shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate group-hover:underline">
                  {video.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">{video.channel.title}</p>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      isWatched ? "bg-green-500" : "bg-blue-500"
                    }`}
                    title={isWatched ? "Watched" : "Unwatched"}
                  />
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
