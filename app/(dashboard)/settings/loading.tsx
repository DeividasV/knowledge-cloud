import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-80 max-w-full mt-1" />
      </div>

      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border">
          <div className="p-6 space-y-2 border-b">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            {i < 2 && (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-10 w-40" />
              </>
            )}
            {i === 2 && (
              <>
                <div className="flex justify-between text-sm">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between text-sm">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-10 w-48" />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
