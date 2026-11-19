"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Inbox,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shell/page-header";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { EmptyState } from "@/components/shell/empty-state";
import { StatCard } from "@/components/shell/stat-card";
import { ErrorNote, PageSkeleton, Panel, StatusBadge, shortDate } from "@/components/advisor/bits";
import { PlanView } from "@/components/advisor/plan-view";
import { useSession } from "@/hooks/use-session";
import { useAdvisorApi, useAdvisorData } from "@/lib/advisor/use-advisor-api";
import type { Pathway, PathwayReview, PathwayStatus } from "@/lib/advisor/types";
import { cn } from "@/lib/utils";

type Filter = "submitted" | "changes_requested" | "approved" | "all";
type Decision = PathwayReview["decision"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "submitted", label: "Awaiting advisor" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "all", label: "All" },
];

const DECISION_LABEL: Record<Decision, string> = {
  approved: "Approved",
  changes_requested: "Requested changes",
  comment: "Commented",
};

const DECISION_TONE: Record<Decision, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  changes_requested: "bg-rose-50 text-rose-700",
  comment: "bg-gray-100 text-gray-700",
};

export default function ReviewQueuePage() {
  useBreadcrumbs([{ label: "Review queue" }]);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReviewQueue />
    </Suspense>
  );
}

function ReviewQueue() {
  const { isAdmin } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  const { data, error, loading } = useAdvisorData<{ pathways: Pathway[] }>(isAdmin ? "/pathways?scope=all" : null);
  const [rows, setRows] = useState<Pathway[]>([]);
  const [filter, setFilter] = useState<Filter>("submitted");

  useEffect(() => {
    if (data) setRows(data.pathways);
  }, [data]);

  const select = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("id", id);
      else params.delete("id");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { submitted: 0, changes_requested: 0, approved: 0, all: rows.length };
    for (const p of rows) if (p.status in c) c[p.status as Exclude<PathwayStatus, "draft">] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const list = filter === "all" ? rows : rows.filter((p) => p.status === filter);
    const when = (p: Pathway) => p.submittedAt ?? p.updatedAt;
    return [...list].sort((a, b) => (when(b) > when(a) ? 1 : when(b) < when(a) ? -1 : 0));
  }, [rows, filter]);

  const selected = selectedId ? (rows.find((p) => p.id === selectedId) ?? null) : null;

  const onUpdated = useCallback((row: Pathway) => {
    setRows((prev) => prev.map((p) => (p.id === row.id ? row : p)));
  }, []);

  const header = (
    <PageHeader
      icon={<ClipboardCheck />}
      title="Review queue"
      count={data ? counts.submitted : null}
      description="Validate the pathways students submit. Nothing is final until an advisor signs off."
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
            description="The review queue is available to organization administrators."
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
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="No pathways submitted yet"
            description="When a student submits a pathway for review, it appears here."
          />
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Awaiting review"
                value={counts.submitted}
                tone="warning"
                icon={<Inbox />}
                info="Submitted pathways no advisor has decided on since the student last submitted."
                labelText="Awaiting review"
              />
              <StatCard label="Approved" value={counts.approved} tone="success" icon={<CheckCircle2 />} />
              <StatCard
                label="Changes requested"
                value={counts.changes_requested}
                tone="danger"
                icon={<RotateCcw />}
              />
            </div>

            <div className={cn("grid min-w-0 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]")}>
              {/* Master list — hidden on phones while a pathway is open. */}
              <div className={cn("min-w-0", selected ? "hidden lg:block" : "block")}>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                  <div className="-mx-1 overflow-x-auto px-1 pb-1">
                    <TabsList className="w-max">
                      {FILTERS.map((f) => (
                        <TabsTrigger key={f.value} value={f.value} className="px-2 text-[13px]">
                          {f.label}
                          <span className="rounded-full bg-gray-200/70 px-1.5 text-[11px] font-semibold text-gray-700">
                            {counts[f.value]}
                          </span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                </Tabs>
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border-color,#e5e7eb)] bg-white">
                  {visible.length === 0 ? (
                    <p className="text-muted-foreground px-4 py-10 text-center text-[13px]">
                      No pathways in this view.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {visible.map((p) => (
                        <li key={p.id}>
                          <PathwayRow pathway={p} active={p.id === selected?.id} onSelect={() => select(p.id)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Detail */}
              <div className={cn("min-w-0", selected ? "block" : "hidden lg:block")}>
                {selected ? (
                  <PathwayDetail
                    key={selected.id}
                    pathway={selected}
                    onBack={() => select(null)}
                    onUpdated={onUpdated}
                  />
                ) : selectedId ? (
                  <EmptyState
                    icon={<AlertTriangle />}
                    title="Pathway not found"
                    description="It may have been withdrawn, or it is still a draft."
                    action={
                      <Button variant="outline" size="sm" onClick={() => select(null)}>
                        Back to the queue
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<ClipboardCheck />}
                    title="Select a pathway"
                    description="Open a submitted pathway to check the plan and record your decision."
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function PathwayRow({ pathway: p, active, onSelect }: { pathway: Pathway; active: boolean; onSelect: () => void }) {
  const checks = p.plan.warnings.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-gray-50",
        active && "bg-[#eef6fc] hover:bg-[#eef6fc]",
      )}
    >
      <div className="flex w-full min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-gray-900">{p.studentName || p.student}</span>
        <StatusBadge status={p.status} />
      </div>
      <p className="truncate text-[13px] text-gray-700">{p.plan.programName}</p>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        <span className="truncate">{p.plan.goalRoleName ? `Goal: ${p.plan.goalRoleName}` : "No goal role"}</span>
        <span>Submitted {shortDate(p.submittedAt)}</span>
        {checks > 0 ? (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <AlertTriangle className="size-3" />
            {checks} advisor {checks === 1 ? "check" : "checks"}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function PathwayDetail({
  pathway: p,
  onBack,
  onUpdated,
}: {
  pathway: Pathway;
  onBack: () => void;
  onUpdated: (row: Pathway) => void;
}) {
  const { send } = useAdvisorApi();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const hasNote = note.trim().length > 0;

  const decide = async (decision: Decision) => {
    if (decision !== "approved" && !hasNote) return;
    setBusy(decision);
    try {
      const row = await send<Pathway>(`/pathways/${encodeURIComponent(p.id)}`, "PATCH", {
        decision,
        note: note.trim(),
      });
      onUpdated(row);
      setNote("");
      toast.success(
        decision === "approved"
          ? "Pathway approved"
          : decision === "changes_requested"
            ? "Changes requested — the student will see your note"
            : "Comment added",
      );
    } catch (e) {
      toast.error((e as Error).message || "Could not record the decision");
    } finally {
      setBusy(null);
    }
  };

  const reviews = [...p.reviews].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return (
    <div className="grid min-w-0 gap-4">
      <Button variant="ghost" size="sm" className="w-fit lg:hidden" onClick={onBack}>
        <ArrowLeft />
        Back to the queue
      </Button>

      <Panel
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.studentName || p.student}
            <StatusBadge status={p.status} />
          </span>
        }
        description={`@${p.student} · submitted ${shortDate(p.submittedAt)} · updated ${shortDate(p.updatedAt)}`}
      >
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="Program" value={p.plan.programName} />
          <Fact label="Goal role" value={p.plan.goalRoleName ?? "None chosen"} />
          <Fact label="Remaining credits" value={String(p.plan.remainingCredits)} />
          <Fact label="Terms" value={String(p.plan.terms.length)} />
        </dl>
        <div className="mt-4">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Student&apos;s note</p>
          {p.studentNote ? (
            <p className="mt-1 rounded-lg bg-[#eef6fc] px-3 py-2 text-[13px] whitespace-pre-wrap text-gray-800">
              {p.studentNote}
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-[13px]">The student did not add a note.</p>
          )}
        </div>
      </Panel>

      <PlanView plan={p.plan} />

      <Panel title="Review history" description="Every decision recorded on this pathway.">
        {reviews.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">No advisor has reviewed this pathway yet.</p>
        ) : (
          <ol className="grid gap-3">
            {reviews.map((r, i) => (
              <li key={`${r.at}-${i}`} className="border-l-2 border-gray-200 pl-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold", DECISION_TONE[r.decision])}>
                    {DECISION_LABEL[r.decision]}
                  </span>
                  <span className="font-medium text-gray-900">{r.by}</span>
                  <span className="text-muted-foreground">{shortDate(r.at)}</span>
                </div>
                {r.note ? (
                  <p className="mt-1 text-[13px] whitespace-pre-wrap text-gray-700">{r.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel
        title="Your decision"
        description={
          p.status === "approved"
            ? "This pathway is approved. You can still comment, or request changes if something needs another look."
            : "Check the plan and the advisor checks above, then record your decision."
        }
      >
        <label htmlFor={`note-${p.id}`} className="text-[13px] font-medium text-gray-900">
          Note to the student
        </label>
        <Textarea
          id={`note-${p.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What looks good, what to change, who to talk to…"
          rows={4}
          maxLength={4000}
          className="mt-1.5 text-[13px]"
        />
        <p className="text-muted-foreground mt-1.5 text-xs">
          {hasNote
            ? "The student sees this note with your decision."
            : "A note is required to request changes or comment. It is optional when approving."}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            className="ibl-button-primary"
            disabled={busy !== null}
            onClick={() => decide("approved")}
          >
            <ShieldCheck />
            {busy === "approved" ? "Approving…" : p.status === "approved" ? "Approve again" : "Approve"}
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null || !hasNote}
            title={hasNote ? undefined : "Write a note telling the student what to change"}
            onClick={() => decide("changes_requested")}
          >
            <RotateCcw />
            {busy === "changes_requested" ? "Sending…" : "Request changes"}
          </Button>
          <Button
            variant="ghost"
            disabled={busy !== null || !hasNote}
            title={hasNote ? undefined : "Write a note to comment"}
            onClick={() => decide("comment")}
          >
            <MessageSquare />
            {busy === "comment" ? "Sending…" : "Comment only"}
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 flex items-start gap-1.5 text-xs">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-[#0058cc]" />
          Approving records you as the advisor who validated this pathway.
        </p>
      </Panel>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate font-medium text-gray-900" title={value}>
        {value}
      </dd>
    </div>
  );
}
