"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const SIZES = [50, 200, 500];

export function PageSizeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSize = parseInt(searchParams.get("size") || "50", 10);

  function setSize(size: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("size", String(size));
    params.delete("page"); // reset to page 1
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Show:</span>
      {SIZES.map((size) => (
        <Button
          key={size}
          variant={currentSize === size ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setSize(size)}
          className="h-6 px-2 text-xs"
        >
          {size}
        </Button>
      ))}
    </div>
  );
}
