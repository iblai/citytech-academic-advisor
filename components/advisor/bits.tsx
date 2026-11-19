"use client";

import type { ReactNode } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_LABEL } from "@/lib/advisor/vocabulary";
import type { PathwayStatus } from "@/lib/advisor/types";
import { cn } from "@/lib/utils";

/** A white card, the surface every advisor page lays content on. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--border-color,#e5e7eb)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {description ? <p className="text-muted-foreground mt-0.5 text-xs">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SkillChip({ name, emerging, muted }: { name: string; emerging?: boolean; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        muted ? "bg-gray-100 text-gray-600" : emerging ? "bg-violet-50 text-violet-700" : "bg-[#eef6fc] text-[#0058cc]",
      )}
      title={emerging ? "Emerging skill" : undefined}
    >
      {emerging ? <TrendingUp className="size-3" /> : null}
      {name}
    </span>
  );
}

const STATUS_TONE: Record<PathwayStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  changes_requested: "bg-rose-50 text-rose-700",
};

export function StatusBadge({ status }: { status: PathwayStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span>{children}</span>
    </p>
  );
}

export function PageSkeleton() {
  return (
    <div className="grid gap-4 p-4 md:p-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

/** A thin horizontal bar for a 0–1 share. */
export function ShareBar({ share, tone = "brand" }: { share: number; tone?: "brand" | "violet" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
      <div
        className={cn("h-full rounded-full", tone === "violet" ? "bg-violet-500" : "bg-[#0058cc]")}
        style={{ width: `${Math.max(2, Math.min(100, Math.round(share * 100)))}%` }}
      />
    </div>
  );
}

export const money = (n: number | null | undefined) =>
  typeof n === "number" ? `$${Math.round(n).toLocaleString("en-US")}` : "—";

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
