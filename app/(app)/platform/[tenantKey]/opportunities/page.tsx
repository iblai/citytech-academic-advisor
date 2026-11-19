"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpenCheck,
  ExternalLink,
  Eye,
  Lightbulb,
  RefreshCw,
  SearchX,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { EmptyState } from "@/components/shell/empty-state";
import { StatCard } from "@/components/shell/stat-card";
import { SimpleSelect } from "@/components/shell/simple-select";
import { ErrorNote, PageSkeleton, Panel, ShareBar, shortDate } from "@/components/advisor/bits";
import { useSession } from "@/hooks/use-session";
import { useAdvisorApi, useAdvisorData, type MarketData } from "@/lib/advisor/use-advisor-api";
import type { Opportunity } from "@/lib/advisor/types";
import { cn } from "@/lib/utils";

type Kind = Opportunity["kind"];
type Format = Opportunity["format"];

const KIND: Record<Kind, { label: string; tone: string }> = {
  gap: { label: "No course teaches it", tone: "bg-rose-50 text-rose-700" },
  thin: { label: "One course", tone: "bg-amber-50 text-amber-700" },
  reinforce: { label: "Make it visible", tone: "bg-[#eef6fc] text-[#0058cc]" },
};

const KIND_OPTIONS = [
  { value: "", label: "All kinds" },
  { value: "gap", label: "Gaps — no course" },
  { value: "thin", label: "Thin — one course" },
  { value: "reinforce", label: "Reinforce — make it visible" },
];

const FORMAT_OPTIONS = [
  { value: "", label: "All formats" },
  { value: "Microcredential", label: "Microcredential" },
  { value: "Workshop", label: "Workshop" },
  { value: "Workshop series", label: "Workshop series" },
];

const pct = (share: number) => `${Math.round(share * 100)}%`;

export default function OpportunitiesPage() {
  useBreadcrumbs([{ label: "Opportunities" }]);
  const { isAdmin } = useSession();
  const { get } = useAdvisorApi();
  const { data, error, loading, reload } = useAdvisorData<MarketData>(isAdmin ? "/market" : null);
  const [kind, setKind] = useState<"" | Kind>("");
  const [format, setFormat] = useState<"" | Format>("");
  const [emergingOnly, setEmergingOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const opportunities = useMemo(() => data?.opportunities ?? [], [data]);
  const counts = useMemo(() => {
    const c: Record<Kind, number> = { gap: 0, thin: 0, reinforce: 0 };
    for (const o of opportunities) c[o.kind] += 1;
    return c;
  }, [opportunities]);
  const visible = useMemo(
    () =>
      opportunities.filter(
        (o) => (!kind || o.kind === kind) && (!format || o.format === format) && (!emergingOnly || o.emerging),
      ),
    [opportunities, kind, format, emergingOnly],
  );
  const demand = useMemo(() => [...(data?.demand ?? [])].sort((a, b) => b.postings - a.postings), [data]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await get<MarketData>("/market?refresh=1");
      reload();
      toast.success("Job data refreshed");
    } catch (e) {
      toast.error((e as Error).message || "Could not refresh the job data");
    } finally {
      setRefreshing(false);
    }
  };

  const header = (
    <PageHeader
      icon={<Lightbulb />}
      title="Opportunities"
      count={data ? opportunities.length : null}
      description="Microcredentials and workshops worth developing, from what employers ask for."
      actions={
        isAdmin ? (
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || loading}>
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh job data"}</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
        ) : null
      }
    />
  );

  if (!isAdmin) {
    return (
      <>
        {header}
        <div className="flex flex-1 overflow-auto p-4 md:p-6">
          <EmptyState
            icon={<ShieldCheck />}
            title="Advisors only"
            description="Curriculum opportunities are available to organization administrators."
          />
        </div>
      </>
    );
  }

  if (loading && !data) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {error && !data ? (
          <ErrorNote>{error}</ErrorNote>
        ) : data ? (
          <div className="grid min-w-0 gap-4">
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <div className="grid gap-1.5">
              <p className="text-muted-foreground text-[13px]">
                Derived by comparing the skills job postings ask for with the skills the loaded courses teach.
                These are proposals for an administrator to judge, not decisions.
              </p>
              <SourceStrip data={data} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Gaps"
                value={counts.gap}
                tone="danger"
                icon={<SearchX />}
                hint="No loaded course teaches the skill"
              />
              <StatCard
                label="Thin coverage"
                value={counts.thin}
                tone="warning"
                icon={<BookOpenCheck />}
                hint="Only one course teaches it"
              />
              <StatCard
                label="Reinforce"
                value={counts.reinforce}
                tone="brand"
                icon={<Eye />}
                hint="Taught, in high demand — make it visible"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <SimpleSelect
                value={kind}
                onChange={(v) => setKind(v as "" | Kind)}
                options={KIND_OPTIONS}
                size="sm"
                className="sm:w-56"
                aria-label="Filter by kind"
              />
              <SimpleSelect
                value={format}
                onChange={(v) => setFormat(v as "" | Format)}
                options={FORMAT_OPTIONS}
                size="sm"
                className="sm:w-48"
                aria-label="Filter by format"
              />
              <label className="flex items-center gap-2 text-[13px] text-gray-700">
                <Switch checked={emergingOnly} onCheckedChange={(v) => setEmergingOnly(v)} />
                Emerging skills only
              </label>
              <span className="text-muted-foreground text-xs sm:ml-auto">
                {visible.length} of {opportunities.length} shown
              </span>
            </div>

            {opportunities.length === 0 ? (
              <EmptyState
                icon={<Lightbulb />}
                title="No opportunities found"
                description="The current job data did not surface any skill gaps or under-taught skills."
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<SearchX />}
                title="Nothing matches these filters"
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setKind("");
                      setFormat("");
                      setEmergingOnly(false);
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {visible.map((o) => (
                  <OpportunityCard key={`${o.skillId}-${o.format}`} o={o} />
                ))}
              </div>
            )}

            <Panel
              title="Skill demand"
              description="Every skill found in the postings, with how many loaded courses teach it."
            >
              {demand.length === 0 ? (
                <p className="text-muted-foreground text-[13px]">No skills were found in the postings.</p>
              ) : (
                <div className="-mx-4 -my-4 overflow-x-auto">
                  <Table className="text-[13px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Skill</TableHead>
                        <TableHead className="text-right">Postings</TableHead>
                        <TableHead className="w-40">Share</TableHead>
                        <TableHead className="pr-4 text-right">Courses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demand.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="pl-4">
                            <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                              {d.name}
                              {d.emerging ? (
                                <TrendingUp className="size-3 text-violet-600" aria-label="Emerging skill" />
                              ) : null}
                            </span>
                            <span className="text-muted-foreground block text-xs">{d.group}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{d.postings}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-20">
                                <ShareBar share={d.share} tone={d.emerging ? "violet" : "brand"} />
                              </div>
                              <span className="tabular-nums text-gray-700">{pct(d.share)}</span>
                            </div>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "pr-4 text-right tabular-nums",
                              d.courses.length === 0 && "font-semibold text-rose-700",
                            )}
                            title={d.courses.join(", ") || undefined}
                          >
                            {d.courses.length}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}

function SourceStrip({ data }: { data: MarketData }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--border-color,#e5e7eb)] bg-white px-3 py-2 text-xs text-gray-700">
      {data.sourceUrl ? (
        <a
          href={data.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 font-medium text-[#0058cc] hover:underline"
        >
          <span className="truncate">{data.source}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <span className="font-medium">{data.source}</span>
      )}
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
          data.live ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-700",
        )}
      >
        {data.live ? "Live" : "Saved snapshot"}
      </span>
      <span>Fetched {shortDate(data.fetchedAt)}</span>
      <span>{data.postings.length.toLocaleString("en-US")} postings</span>
    </div>
  );
}

function OpportunityCard({ o }: { o: Opportunity }) {
  const k = KIND[o.kind];
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border-color,#e5e7eb)] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
            {o.format}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", k.tone)}>{k.label}</span>
          {o.emerging ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              <TrendingUp className="size-3" />
              Emerging
            </span>
          ) : null}
        </div>
        <h3 className="text-sm leading-snug font-semibold text-gray-900">{o.title}</h3>
        <p className="text-muted-foreground text-xs">
          {o.skill} · {o.group}
        </p>
      </div>

      <div className="grid gap-1">
        <div className="flex items-center justify-between text-xs text-gray-700">
          <span>
            {o.postings.toLocaleString("en-US")} {o.postings === 1 ? "posting" : "postings"}
          </span>
          <span className="tabular-nums">{pct(o.share)} of postings</span>
        </div>
        <ShareBar share={o.share} tone={o.emerging ? "violet" : "brand"} />
      </div>

      <p className="text-[13px] text-gray-700">{o.rationale}</p>

      <div className="mt-auto grid gap-1.5 border-t border-gray-100 pt-3 text-xs">
        <p className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground">Covered by:</span>
          {o.coveredBy.length ? (
            o.coveredBy.map((c) => (
              <span key={c} className="rounded bg-gray-100 px-1.5 py-px font-mono text-[11px] text-gray-800">
                {c}
              </span>
            ))
          ) : (
            <span className="font-medium text-rose-700">No course loaded</span>
          )}
        </p>
        {o.sampleEmployers.length ? (
          <p className="text-gray-700">
            <span className="text-muted-foreground">Asked for by </span>
            {o.sampleEmployers.join(", ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
