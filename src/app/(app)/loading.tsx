import { Skeleton } from "@/components/ui";

/**
 * Route-level loading state. Every (app) page is an async server component
 * doing several Supabase round-trips; without this, navigation froze the
 * previous screen with no feedback at all.
 */
export default function AppLoading() {
  return (
    <div dir="rtl" className="animate-pulse">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <span className="sr-only">טוען…</span>
    </div>
  );
}
