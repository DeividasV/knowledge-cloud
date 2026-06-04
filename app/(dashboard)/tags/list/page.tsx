import Link from "next/link";
import { getAllTags } from "@/app/actions/tags";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Tag,
  Eye,
  EyeOff,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Hash,
} from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { Pagination } from "@/components/pagination";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [100, 200, 500, 1000];
const SORT_OPTIONS = [
  { value: "score", label: "Total Score" },
  { value: "videos", label: "Video Count" },
  { value: "watchedScore", label: "Watched Score" },
  { value: "watched", label: "Watched Count" },
  { value: "completion", label: "Completion %" },
  { value: "name", label: "Name" },
];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "complete", label: "Complete" },
  { value: "in_progress", label: "In Progress" },
  { value: "not_started", label: "Not Started" },
];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    sort?: string;
    order?: string;
    q?: string;
    filter?: string;
  }>;
}

export default async function TagListPage({ searchParams }: PageProps) {
  const {
    page: pageStr,
    size: sizeStr,
    sort: sortBy,
    order: sortOrder,
    q: query,
    filter: filterValue,
  } = await searchParams;

  const page = Math.max(1, parseInt(pageStr || "1", 10));
  const pageSize = PAGE_SIZES.includes(parseInt(sizeStr || "100", 10))
    ? parseInt(sizeStr || "100", 10)
    : 100;
  const sort = SORT_OPTIONS.find((s) => s.value === sortBy)?.value || "score";
  const order = sortOrder === "asc" ? "asc" : "desc";
  const filter = FILTERS.find((f) => f.value === filterValue)?.value || "all";

  const { tags, total } = await getAllTags({
    page,
    pageSize,
    sortBy: sort,
    sortOrder: order,
    query,
    filter: filter === "all" ? undefined : filter,
  });

  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/tags"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded-md hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tag graph
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">All Tags</h1>
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString()} tag{total !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <SearchInput placeholder="Search tags by name..." />

      {/* Filters */}
      <TagFilterBar activeFilter={filter} />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <TagSortControls currentSort={sort} currentOrder={order} />
        <TagPageSizeSelector currentSize={pageSize} />
      </div>

      {/* Results info */}
      <p className="text-xs text-muted-foreground">
        Showing {startIndex.toLocaleString()}–{endIndex.toLocaleString()} of{" "}
        {total.toLocaleString()}
      </p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-right">#</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="text-right">Videos</TableHead>
                <TableHead className="text-right">Watched</TableHead>
                <TableHead className="text-right">Unwatched</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Watched Σ</TableHead>
                <TableHead className="text-right">Remaining Σ</TableHead>
                <TableHead className="w-32">Completion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    {query
                      ? `No tags matching "${query}".`
                      : "No tags found."}
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag, idx) => {
                  const rank = startIndex + idx;
                  return (
                    <TableRow key={tag.id} className="group">
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {rank}
                      </TableCell>
                      <TableCell>
                        <Link href={`/tags/${encodeURIComponent(tag.name)}`}>
                          <Badge
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors font-medium"
                          >
                            {tag.name}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tag.totalVideos}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {tag.watchedCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-500">
                        {tag.unwatchedCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {tag.notInterestedCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {tag.totalScore.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {tag.watchedScore.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-500">
                        {tag.remainingScore.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={tag.completion}
                            className="h-1.5 flex-1"
                          />
                          <span
                            className={cn(
                              "text-xs font-medium tabular-nums w-8 text-right",
                              tag.completion === 100
                                ? "text-emerald-600"
                                : tag.completion >= 50
                                ? "text-amber-500"
                                : "text-slate-400"
                            )}
                          >
                            {tag.completion}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/tags/list"
        />
      )}
    </div>
  );
}

function TagFilterBar({ activeFilter }: { activeFilter: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => (
        <FilterLink key={f.value} value={f.value} label={f.label} isActive={activeFilter === f.value} />
      ))}
    </div>
  );
}

function FilterLink({
  value,
  label,
  isActive,
}: {
  value: string;
  label: string;
  isActive: boolean;
}) {
  const href = value === "all" ? "/tags/list" : `/tags/list?filter=${value}`;
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      )}
    >
      {label}
    </Link>
  );
}

function TagSortControls({
  currentSort,
  currentOrder,
}: {
  currentSort: string;
  currentOrder: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Sort:</span>
      {SORT_OPTIONS.map((opt) => {
        const isActive = currentSort === opt.value;
        const nextOrder = isActive && currentOrder === "desc" ? "asc" : "desc";
        const href = `/tags/list?sort=${opt.value}&order=${nextOrder}`;
        return (
          <Link
            key={opt.value}
            href={href}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {opt.label}
            {isActive &&
              (currentOrder === "asc" ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              ))}
          </Link>
        );
      })}
    </div>
  );
}

function TagPageSizeSelector({ currentSize }: { currentSize: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Per page:</span>
      {PAGE_SIZES.map((size) => (
        <Link
          key={size}
          href={`/tags/list?size=${size}`}
          className={cn(
            "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors",
            currentSize === size
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {size}
        </Link>
      ))}
    </div>
  );
}
