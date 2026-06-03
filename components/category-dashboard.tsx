import { getCategoryDashboardStats } from "@/app/actions/videos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen } from "lucide-react";

const PALETTES = [
  { bg: "bg-sky-50", darkBg: "dark:bg-sky-950/30", text: "text-sky-700", darkText: "dark:text-sky-300", bar: "bg-sky-500", barBg: "bg-sky-200" },
  { bg: "bg-rose-50", darkBg: "dark:bg-rose-950/30", text: "text-rose-700", darkText: "dark:text-rose-300", bar: "bg-rose-500", barBg: "bg-rose-200" },
  { bg: "bg-amber-50", darkBg: "dark:bg-amber-950/30", text: "text-amber-700", darkText: "dark:text-amber-300", bar: "bg-amber-500", barBg: "bg-amber-200" },
  { bg: "bg-emerald-50", darkBg: "dark:bg-emerald-950/30", text: "text-emerald-700", darkText: "dark:text-emerald-300", bar: "bg-emerald-500", barBg: "bg-emerald-200" },
  { bg: "bg-violet-50", darkBg: "dark:bg-violet-950/30", text: "text-violet-700", darkText: "dark:text-violet-300", bar: "bg-violet-500", barBg: "bg-violet-200" },
  { bg: "bg-orange-50", darkBg: "dark:bg-orange-950/30", text: "text-orange-700", darkText: "dark:text-orange-300", bar: "bg-orange-500", barBg: "bg-orange-200" },
  { bg: "bg-cyan-50", darkBg: "dark:bg-cyan-950/30", text: "text-cyan-700", darkText: "dark:text-cyan-300", bar: "bg-cyan-500", barBg: "bg-cyan-200" },
  { bg: "bg-pink-50", darkBg: "dark:bg-pink-950/30", text: "text-pink-700", darkText: "dark:text-pink-300", bar: "bg-pink-500", barBg: "bg-pink-200" },
  { bg: "bg-lime-50", darkBg: "dark:bg-lime-950/30", text: "text-lime-700", darkText: "dark:text-lime-300", bar: "bg-lime-500", barBg: "bg-lime-200" },
  { bg: "bg-indigo-50", darkBg: "dark:bg-indigo-950/30", text: "text-indigo-700", darkText: "dark:text-indigo-300", bar: "bg-indigo-500", barBg: "bg-indigo-200" },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getPalette(name: string) {
  return PALETTES[hashString(name) % PALETTES.length];
}

export async function CategoryDashboard() {
  const categories = await getCategoryDashboardStats();

  if (categories.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          Categories ({categories.length})
        </CardTitle>
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((cat) => {
            const palette = getPalette(cat.name);
            const total = cat.totalVideos;
            const watchedPct = total > 0 ? Math.round((cat.watched / total) * 100) : 0;

            return (
              <div
                key={cat.name}
                className={`rounded-lg border p-3 ${palette.bg} ${palette.darkBg}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${palette.text} ${palette.darkText}`}>
                    {cat.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {total}
                  </span>
                </div>

                {/* Stacked bar */}
                <div className={`h-2 w-full rounded-full ${palette.barBg} overflow-hidden`}>
                  <div
                    className={`h-full ${palette.bar} rounded-full transition-all`}
                    style={{ width: `${watchedPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-1.5 text-[10px]">
                  <span className="text-emerald-600 font-medium">
                    {cat.watched} watched
                  </span>
                  <span className="text-slate-500">
                    {cat.unwatched} left
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
