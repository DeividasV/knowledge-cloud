"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { YouTubeIcon } from "@/components/youtube-icon";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategorySidebarFilter } from "@/components/category-sidebar-filter";
import { CommandPalette } from "@/components/command-palette";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

export function Sidebar({
  user,
  categories,
  selectedCategory,
  tags,
  appVersion,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  categories: Category[];
  selectedCategory: string | null;
  tags: Tag[];
  appVersion: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r bg-card lg:flex">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2 px-2">
          <YouTubeIcon className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">YT Tracker</span>
          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
            v{appVersion}
          </span>
        </div>
      </div>
      <div className="px-4 pb-3">
        <CommandPalette tags={tags} />
      </div>
      <Separator />
      <nav className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-4">
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
        </div>

        {categories.length > 0 && (
          <div className="sticky bottom-0 border-t bg-card p-4">
            <CategorySidebarFilter
              categories={categories}
              selectedCategory={selectedCategory}
            />
          </div>
        )}
      </nav>
      <Separator />
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <Separator />
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || undefined} />
            <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email || ""}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
