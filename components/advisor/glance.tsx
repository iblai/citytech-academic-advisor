"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ClipboardCheck, Route } from "lucide-react";
import { useAdminMode } from "@/components/shell/admin-mode";
import { StatusBadge, shortDate } from "@/components/advisor/bits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { useAdvisorData, type MarketData } from "@/lib/advisor/use-advisor-api";
import type { Pathway } from "@/lib/advisor/types";

/**
 * Beside the conversation: where the student's pathway stands — or, for an
 * advisor, what is waiting for their decision — and what employers ask for.
 */
export function Glance() {
  const { href } = useSession();
  const { adminMode } = useAdminMode();
  const mine = useAdvisorData<{ pathways: Pathway[] }>(adminMode ? null : "/pathways");
  const queue = useAdvisorData<{ pathways: Pathway[] }>(adminMode ? "/pathways?scope=all" : null);
  const market = useAdvisorData<MarketData>("/market");
  const latest = mine.data?.pathways[0];
  const waiting = (queue.data?.pathways ?? []).filter((p) => p.status === "submitted");

  return (
    <div className="grid gap-5 p-4">
      {adminMode ? (
        <section>
          <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            <ClipboardCheck className="size-3.5" /> Awaiting your review
          </h2>
          {queue.loading ? (
            <Skeleton className="mt-2 h-16 w-full rounded-lg" />
          ) : waiting.length ? (
            <ul className="mt-2 grid gap-1.5">
              {waiting.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`${href("/review")}?id=${p.id}`}
                    className="block rounded-lg border border-[var(--border-color,#e5e7eb)] bg-white px-3 py-2 hover:bg-gray-50"
                  >
                    <p className="truncate text-[13px] font-medium text-gray-900">{p.studentName}</p>
                    <p className="text-muted-foreground truncate text-[11px]">
                      {p.plan.programName} · submitted {shortDate(p.submittedAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-2 text-[13px]">No pathways are waiting for a decision.</p>
          )}
          <Button variant="outline" size="sm" className="mt-2" render={<Link href={href("/review")} />}>
            Review queue <ArrowRight data-icon="inline-end" />
          </Button>
        </section>
      ) : (
        <section>
          <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            <Route className="size-3.5" /> My pathway
          </h2>
          {mine.loading ? (
            <Skeleton className="mt-2 h-16 w-full rounded-lg" />
          ) : latest ? (
            <div className="mt-2 rounded-lg border border-[var(--border-color,#e5e7eb)] bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-medium text-gray-900">{latest.plan.programName}</p>
                <StatusBadge status={latest.status} />
              </div>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {latest.plan.terms.length} terms · {latest.plan.remainingCredits} credits to go
                {latest.plan.goalRoleName ? ` · toward ${latest.plan.goalRoleName}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-[13px]">
              You have not built a pathway yet. It takes a minute, and an advisor reviews it.
            </p>
          )}
          <Button variant="outline" size="sm" className="mt-2" render={<Link href={href("/pathway")} />}>
            {latest ? "Open my pathway" : "Build my pathway"} <ArrowRight data-icon="inline-end" />
          </Button>
        </section>
      )}

      <section>
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-500 uppercase">
          <BriefcaseBusiness className="size-3.5" /> Hiring now
        </h2>
        {market.loading ? (
          <Skeleton className="mt-2 h-28 w-full rounded-lg" />
        ) : market.data ? (
          <>
            <ul className="mt-2 grid gap-1">
              {[...market.data.roles]
                .sort((a, b) => b.postings - a.postings)
                .slice(0, 5)
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate text-gray-800">{r.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{r.postings} postings</span>
                  </li>
                ))}
            </ul>
            <p className="text-muted-foreground mt-2 text-[11px]">
              {market.data.postings.length} postings · {market.data.live ? "live" : "saved snapshot"} ·{" "}
              {shortDate(market.data.fetchedAt)}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground mt-2 text-[13px]">Job data is unavailable right now.</p>
        )}
        <Button variant="outline" size="sm" className="mt-2" render={<Link href={href("/careers")} />}>
          Careers & skills <ArrowRight data-icon="inline-end" />
        </Button>
      </section>
    </div>
  );
}
