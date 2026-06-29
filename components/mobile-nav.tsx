"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Tag, Check } from "lucide-react";
import { YouTubeIcon } from "@/components/youtube-icon";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { CommandPalette } from "@/components/command-palette";
import { setSelectedCategory } from "@/app/actions/videos";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";

interface Category {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

export function MobileNav({
  categories,
  selectedCategory,
  tags,
  appVersion,
}: {
  categories: Category[];
  selectedCategory: string | null;
  tags: Tag[];
  appVersion: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="lg:hidden flex flex-col gap-2 border-b bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <YouTubeIcon className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">YT Tracker</span>
          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
            v{appVersion}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted h-8 w-8">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <nav className="mt-6 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/tags"
                    ? pathname === "/tags"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {categories.length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Category
                    </span>
                    {isPending && (
                      <span className="text-xs text-muted-foreground animate-pulse">
                        saving…
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        startTransition(() => setSelectedCategory(null));
                      }}
                      disabled={isPending}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors text-left",
                        !selectedCategory
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span>All</span>
                      {!selectedCategory && <Check className="h-3.5 w-3.5" />}
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          startTransition(() => setSelectedCategory(cat.name));
                        }}
                        disabled={isPending}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors text-left",
                          selectedCategory === cat.name
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <span className="truncate">{cat.name}</span>
                        {selectedCategory === cat.name && (
                          <Check className="h-3.5 w-3.5 shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
    <CommandPalette tags={tags} />
  </div>
  );
}
