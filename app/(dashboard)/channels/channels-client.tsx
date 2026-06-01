"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LS_KEY = "yt-tracker-channels-category";

interface Category {
  id: string;
  name: string;
  count: number;
}

export function CategoryFilter({
  categories,
  totalChannels,
  currentCategory,
}: {
  categories: Category[];
  totalChannels: number;
  currentCategory: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // On mount: if no category in URL but saved in LS, redirect
  useEffect(() => {
    const hasCategoryInUrl = searchParams.has("category");
    if (hasCategoryInUrl) return;

    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === "string" && parsed) {
          // Only redirect if the category still exists
          if (categories.some((c) => c.name === parsed)) {
            router.replace(`/channels?category=${encodeURIComponent(parsed)}`);
          } else {
            localStorage.removeItem(LS_KEY);
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [searchParams, categories, router]);

  // Save to LS when URL changes
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) {
      localStorage.setItem(LS_KEY, JSON.stringify(cat));
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }, [searchParams]);

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/channels"
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          !currentCategory
            ? "bg-primary text-primary-foreground border-primary"
            : "border-input bg-background text-foreground hover:bg-accent"
        )}
      >
        All ({totalChannels})
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/channels?category=${encodeURIComponent(cat.name)}`}
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            currentCategory === cat.name
              ? "bg-primary text-primary-foreground border-primary"
              : "border-input bg-background text-foreground hover:bg-accent"
          )}
        >
          {cat.name} ({cat.count})
        </Link>
      ))}
    </div>
  );
}
