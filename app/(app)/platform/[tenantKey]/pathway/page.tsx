"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  FileText,
  Hammer,
  MessageSquare,
  MessageSquareWarning,
  Route,
  Search,
  Send,
  Save,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { EmptyState } from "@/components/shell/empty-state";
import { SimpleSelect } from "@/components/shell/simple-select";
import { ErrorNote, PageSkeleton, Panel, StatusBadge, shortDate } from "@/components/advisor/bits";
import { PlanView } from "@/components/advisor/plan-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/hooks/use-session";
import { nextTerm } from "@/lib/advisor/planner";
import {
  useAdvisorApi,
  useAdvisorData,
  type CatalogData,
  type MarketData,
} from "@/lib/advisor/use-advisor-api";
import type { Pathway, PathwayReview, Plan, Program } from "@/lib/advisor/types";
import { cn } from "@/lib/utils";

const DECISION_LABEL: Record<PathwayReview["decision"], string> = {
  approved: "Approved",
  changes_requested: "Asked for changes",
  comment: "Commented",
};

/** The next `n` Fall/Spring terms starting at `start` (e.g. "Spring 2027"). */
function termOptions(start: string, n: number): string[] {
  const m = /^(Fall|Spring)\s+(\d{4})$/.exec(start);
  let season = m ? m[1] : "Fall";
  let year = m ? Number(m[2]) : new Date().getFullYear();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${season} ${year}`);
    if (season === "Fall") {
      season = "Spring";
      year += 1;
    } else season = "Fall";
  }
  return out;
}

const clamp = (raw: string, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && raw.trim() !== "" ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Course codes a student can tick off: every `all` and `choose` group of the program. */
function courseGroups(program: Program | undefined) {
  if (!program) return [];
  return program.requirements.flatMap((r) =>
    r.type === "all" || r.type === "choose" ? [{ id: r.id, label: r.label, courses: r.courses }] : [],
  );
}

export default function PathwayPage() {
  const { displayName, username, href } = useSession();
  useBreadcrumbs([{ label: "My pathway", href: href("/pathway") }]);
  const { send } = useAdvisorApi();

  const catalog = useAdvisorData<CatalogData>("/catalog");
  const market = useAdvisorData<MarketData>("/market");
  const mine = useAdvisorData<{ pathways: Pathway[] }>("/pathways");

  const terms = useMemo(() => termOptions(nextTerm(), 6), []);

  // The student's saved pathway (the most recent) and an unsaved proposal.
  const [current, setCurrent] = useState<Pathway | null>(null);
  const [proposal, setProposal] = useState<Plan | null>(null);

  // Builder form.
  const [programId, setProgramId] = useState("");
  const [goalRoleId, setGoalRoleId] = useState("");
  const [credits, setCredits] = useState("15");
  const [startTerm, setStartTerm] = useState(terms[0]);
  const [genEd, setGenEd] = useState("0");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState<"build" | "save" | "submit" | null>(null);
  const [actionError, setActionError] = useState("");
  const [confirm, setConfirm] = useState<null | { submit: boolean }>(null);
  const [initialized, setInitialized] = useState(false);

  // Prefill once from the latest pathway (or the only program).
  useEffect(() => {
    if (initialized || !catalog.data || !mine.data) return;
    const latest = mine.data.pathways[0] ?? null;
    setCurrent(latest);
    if (latest) {
      const p = latest.plan;
      setProgramId(p.programId);
      setGoalRoleId(p.goalRoleId ?? "");
      setCredits(String(p.creditsPerTerm));
      setCompleted(new Set(p.completed));
      setNote(latest.studentNote ?? "");
      const first = p.terms[0]?.label;
      if (first && terms.includes(first)) setStartTerm(first);
    } else if (catalog.data.programs.length === 1) {
      setProgramId(catalog.data.programs[0].id);
    }
    setInitialized(true);
  }, [initialized, catalog.data, mine.data, terms]);

  const programs = catalog.data?.programs ?? [];
  const program = programs.find((p) => p.id === programId);
  const titles = useMemo(
    () => new Map((catalog.data?.courses ?? []).map((c) => [c.code, c.title])),
    [catalog.data],
  );
  const groups = useMemo(() => courseGroups(program), [program]);
  const q = query.trim().toLowerCase();
  const visibleGroups = groups
    .map((g) => ({
      ...g,
      courses: g.courses.filter(
        (code) => !q || code.toLowerCase().includes(q) || (titles.get(code) ?? "").toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.courses.length > 0);

  const roles = market.data?.roles ?? [];
  const plan = proposal ?? current?.plan ?? null;
  const unsaved = !!proposal;
  const status = current?.status;
  const reviews = current?.reviews ?? [];
  const lastApproval = [...reviews].reverse().find((r) => r.decision === "approved");
  const lastChangeRequest = [...reviews].reverse().find((r) => r.decision === "changes_requested");

  const toggle = (code: string, on: boolean) =>
    setCompleted((prev) => {
      const next = new Set(prev);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });

  const changeProgram = (id: string) => {
    if (id === programId) return;
    setProgramId(id);
    setCompleted(new Set());
    setQuery("");
  };

  async function build() {
    if (!programId) {
      setActionError("Choose your program first.");
      return;
    }
    setBusy("build");
    setActionError("");
    try {
      const next = await send<Plan>("/plan", "POST", {
        programId,
        completed: [...completed],
        goalRoleId: goalRoleId || null,
        creditsPerTerm: clamp(credits, 6, 21, 15),
        startTerm,
        genEdCompleted: clamp(genEd, 0, 13, 0),
      });
      setProposal(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not build a pathway";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function save(submit: boolean) {
    const toSave = proposal ?? current?.plan;
    if (!toSave) return;
    setBusy(submit ? "submit" : "save");
    setActionError("");
    try {
      const row = await send<Pathway>("/pathways", "POST", {
        plan: toSave,
        studentName: displayName || username,
        studentNote: note,
        submit,
        ...(current ? { id: current.id } : {}),
      });
      setCurrent(row);
      setProposal(null);
      toast.success(submit ? "Sent to an advisor for review" : "Draft saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save your pathway";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  /** Saving over an approved (or under-review) pathway resets it — ask first. */
  function requestSave(submit: boolean) {
    if (status === "approved" || (status === "submitted" && !submit)) setConfirm({ submit });
    else void save(submit);
  }

  const header = (
    <PageHeader
      icon={<Route />}
      title="My pathway"
      description="Plan your remaining courses term by term, then send the plan to an advisor."
      actions={current ? <StatusBadge status={current.status} /> : null}
    />
  );

  if (catalog.loading || market.loading || mine.loading || (!initialized && !catalog.error && !mine.error)) {
    return (
      <>
        {header}
        <div className="flex-1 overflow-auto">
          <PageSkeleton />
        </div>
      </>
    );
  }

  const loadError = catalog.error || mine.error;
  if (loadError) {
    return (
      <>
        {header}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="grid max-w-xl gap-3">
            <ErrorNote>{loadError}</ErrorNote>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  catalog.reload();
                  mine.reload();
                }}
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const canSubmit = !!plan && (unsaved || status === "draft" || status === "changes_requested");
  const inFlight = busy !== null;

  return (
    <>
      {header}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          {/* Builder */}
          <Panel title="Build your pathway" description="Tell us where you are; we propose the rest.">
            <form
              className="grid gap-4 text-[13px]"
              onSubmit={(e) => {
                e.preventDefault();
                void build();
              }}
            >
              <Field label="Program">
                {programs.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No programs are loaded in the catalog yet.</p>
                ) : (
                  <SimpleSelect
                    aria-label="Program"
                    value={programId}
                    onChange={changeProgram}
                    placeholder="Choose your program"
                    options={programs.map((p) => ({ value: p.id, label: `${p.name} (${p.degree})` }))}
                  />
                )}
              </Field>

              <Field label="Career goal">
                <SimpleSelect
                  aria-label="Career goal"
                  value={goalRoleId}
                  onChange={setGoalRoleId}
                  allowEmpty
                  emptyLabel="No specific goal"
                  placeholder="No specific goal"
                  options={roles.map((r) => ({
                    value: r.id,
                    label: `${r.name} · ${r.postings} ${r.postings === 1 ? "posting" : "postings"}`,
                  }))}
                />
                {market.error ? (
                  <p className="text-xs text-rose-700">Job-market roles could not be loaded: {market.error}</p>
                ) : null}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Credits per term" htmlFor="pw-credits">
                  <Input
                    id="pw-credits"
                    type="number"
                    inputMode="numeric"
                    min={6}
                    max={21}
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    onBlur={() => setCredits(String(clamp(credits, 6, 21, 15)))}
                  />
                </Field>
                <Field label="Start term">
                  <SimpleSelect
                    aria-label="Start term"
                    value={startTerm}
                    onChange={(v) => setStartTerm(v || terms[0])}
                    options={terms.map((t) => ({ value: t, label: t }))}
                  />
                </Field>
              </div>

              <Field label="General-education courses already completed" htmlFor="pw-gened">
                <Input
                  id="pw-gened"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={13}
                  value={genEd}
                  onChange={(e) => setGenEd(e.target.value)}
                  onBlur={() => setGenEd(String(clamp(genEd, 0, 13, 0)))}
                />
              </Field>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-700">Courses I&apos;ve completed</span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{completed.size} selected</span>
                    {completed.size > 0 ? (
                      <button
                        type="button"
                        className="font-medium text-[#0058cc] hover:underline"
                        onClick={() => setCompleted(new Set())}
                      >
                        Clear all
                      </button>
                    ) : null}
                  </span>
                </div>
                {!program ? (
                  <p className="text-muted-foreground rounded-lg bg-gray-50 px-3 py-2 text-xs">
                    Choose a program to see its courses.
                  </p>
                ) : groups.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg bg-gray-50 px-3 py-2 text-xs">
                    This program lists no specific required courses.
                  </p>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                      <Input
                        aria-label="Search courses"
                        placeholder="Search by code or title"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-8"
                      />
                      {query ? (
                        <button
                          type="button"
                          aria-label="Clear search"
                          className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 hover:text-gray-900"
                          onClick={() => setQuery("")}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border-color,#e5e7eb)]">
                      {visibleGroups.length === 0 ? (
                        <p className="text-muted-foreground px-3 py-4 text-center text-xs">
                          No course matches &ldquo;{query}&rdquo;.
                        </p>
                      ) : (
                        visibleGroups.map((g) => (
                          <fieldset key={g.id} className="border-b border-gray-100 last:border-b-0">
                            <legend className="sr-only">{g.label}</legend>
                            <p className="sticky top-0 z-10 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-gray-600 uppercase">
                              {g.label}
                            </p>
                            <ul>
                              {g.courses.map((code) => (
                                <li key={`${g.id}-${code}`}>
                                  <label className="flex cursor-pointer items-start gap-2.5 px-3 py-1.5 hover:bg-[#eef6fc]">
                                    <Checkbox
                                      className="mt-0.5"
                                      checked={completed.has(code)}
                                      onCheckedChange={(on) => toggle(code, on)}
                                    />
                                    <span className="min-w-0 text-[13px] leading-5 text-gray-900">
                                      <span className="font-semibold">{code}</span>
                                      {titles.get(code) ? (
                                        <span className="text-gray-600"> {titles.get(code)}</span>
                                      ) : null}
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </fieldset>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <Button
                type="submit"
                className="ibl-button-primary w-full"
                disabled={inFlight || !programId}
              >
                <Hammer />
                {busy === "build" ? "Building…" : plan ? "Rebuild pathway" : "Build pathway"}
              </Button>
            </form>
          </Panel>

          {/* Plan */}
          <div className="grid min-w-0 gap-4">
            {current && !unsaved ? <StatusBanner pathway={current} approval={lastApproval} change={lastChangeRequest} /> : null}
            {unsaved && current?.status === "changes_requested" && lastChangeRequest ? (
              <AdvisorNote review={lastChangeRequest} />
            ) : null}

            {actionError ? <ErrorNote>{actionError}</ErrorNote> : null}

            {!plan ? (
              <EmptyState
                icon={<Route />}
                title="No pathway yet"
                description="Pick your program, tick the courses you have finished and a career goal, then press Build pathway."
                action={
                  <Button variant="outline" size="sm" render={<Link href={href("")} />}>
                    <MessageSquare />
                    Ask the advisor
                  </Button>
                }
              />
            ) : (
              <>
                <Panel
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {plan.programName}
                      {unsaved ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Unsaved proposal
                        </span>
                      ) : current ? (
                        <StatusBadge status={current.status} />
                      ) : null}
                    </span>
                  }
                  description={<PlanSummary plan={plan} />}
                  actions={
                    <Button variant="ghost" size="sm" render={<Link href={href("")} />}>
                      <MessageSquare />
                      Ask the advisor about this plan
                    </Button>
                  }
                >
                  {unsaved || canSubmit ? (
                    <div className="grid gap-3">
                      {unsaved && status === "approved" ? (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Your current pathway is approved. Saving this new plan sends it back for review.
                        </p>
                      ) : null}
                      <div className="grid gap-1.5">
                        <Label htmlFor="pw-note" className="text-[13px]">
                          Note for your advisor <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Textarea
                          id="pw-note"
                          rows={3}
                          maxLength={2000}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Anything they should know: work hours, courses you want to take, transfer plans…"
                          className="text-[13px]"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {unsaved ? (
                          <>
                            <Button variant="ghost" size="sm" disabled={inFlight} onClick={() => setProposal(null)}>
                              Discard
                            </Button>
                            <Button variant="outline" disabled={inFlight} onClick={() => requestSave(false)}>
                              <Save />
                              {busy === "save" ? "Saving…" : "Save draft"}
                            </Button>
                          </>
                        ) : null}
                        <Button
                          className="ibl-button-primary"
                          disabled={inFlight}
                          onClick={() => requestSave(true)}
                        >
                          <Send />
                          {busy === "submit" ? "Submitting…" : "Submit for advisor review"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-[13px]">
                      {status === "submitted"
                        ? "This plan is with an advisor. Change the form and rebuild if you want to propose something different."
                        : "This plan is approved. Rebuild from the form if your situation changes."}
                    </p>
                  )}
                </Panel>

                <PlanView plan={plan} />
              </>
            )}

            {reviews.length > 0 ? <ReviewHistory reviews={reviews} /> : null}
          </div>
        </div>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {status === "approved" ? "Replace your approved pathway?" : "Withdraw it from review?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {status === "approved"
                ? confirm?.submit
                  ? "Your advisor approved the current plan. Submitting a new plan replaces it and sends it back for review — it will not be approved until an advisor looks again."
                  : "Your advisor approved the current plan. Saving a new plan replaces it and turns it back into a draft — you will need to submit it for review again."
                : "Your pathway is with an advisor. Saving a draft takes it out of their review queue until you submit again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.submit ? "ibl-button-primary" : undefined}
              onClick={() => {
                const submit = !!confirm?.submit;
                setConfirm(null);
                void save(submit);
              }}
            >
              {confirm?.submit ? "Submit new plan" : "Save draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      {htmlFor ? (
        <Label htmlFor={htmlFor} className="text-[13px]">
          {label}
        </Label>
      ) : (
        <span className="text-[13px] leading-none font-medium text-gray-700">{label}</span>
      )}
      {children}
    </div>
  );
}

function PlanSummary({ plan }: { plan: Plan }) {
  const last = plan.terms[plan.terms.length - 1]?.label;
  const parts = [
    plan.goalRoleName ? `Goal: ${plan.goalRoleName}` : "No specific goal",
    `${plan.remainingCredits} credits remaining`,
    `${plan.terms.length} ${plan.terms.length === 1 ? "term" : "terms"}`,
    last ? `Finishing ${last}` : null,
  ].filter(Boolean);
  return <span>{parts.join(" · ")}</span>;
}

function StatusBanner({
  pathway,
  approval,
  change,
}: {
  pathway: Pathway;
  approval?: PathwayReview;
  change?: PathwayReview;
}) {
  if (pathway.status === "changes_requested") {
    return change ? (
      <AdvisorNote review={change} />
    ) : (
      <Banner tone="rose" icon={<MessageSquareWarning />} title="Your advisor asked for changes">
        Update the form, rebuild and submit again.
      </Banner>
    );
  }
  if (pathway.status === "approved")
    return (
      <Banner tone="emerald" icon={<CheckCircle2 />} title="Approved">
        {approval
          ? `Approved by ${approval.by} on ${shortDate(approval.at)}.`
          : "An advisor approved this pathway."}
        {approval?.note ? <span className="mt-1 block text-gray-700">&ldquo;{approval.note}&rdquo;</span> : null}
      </Banner>
    );
  if (pathway.status === "submitted")
    return (
      <Banner tone="amber" icon={<Clock />} title="With an advisor">
        You will see their decision here.
        {pathway.submittedAt ? ` Submitted ${shortDate(pathway.submittedAt)}.` : ""}
      </Banner>
    );
  return (
    <Banner tone="gray" icon={<FileText />} title="Not submitted yet">
      Only you can see it. Submit it when you are ready for an advisor to look.
    </Banner>
  );
}

function AdvisorNote({ review }: { review: PathwayReview }) {
  return (
    <Banner
      tone="rose"
      icon={<MessageSquareWarning />}
      title={`${review.by} asked for changes · ${shortDate(review.at)}`}
    >
      <span className="block text-sm whitespace-pre-wrap text-rose-900">{review.note}</span>
      <span className="mt-1 block text-xs">Update the form, rebuild and submit again.</span>
    </Banner>
  );
}

const TONE = {
  gray: "border-gray-200 bg-gray-50 text-gray-700 [&_.banner-icon]:text-gray-500",
  amber: "border-amber-200 bg-amber-50 text-amber-800 [&_.banner-icon]:text-amber-600",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 [&_.banner-icon]:text-emerald-600",
  rose: "border-rose-200 bg-rose-50 text-rose-800 [&_.banner-icon]:text-rose-600",
} as const;

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof TONE;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", TONE[tone])} role="status">
      <span className="banner-icon mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 text-[13px] leading-5">
        <p className="font-semibold">{title}</p>
        <div>{children}</div>
      </div>
    </div>
  );
}

function ReviewHistory({ reviews }: { reviews: PathwayReview[] }) {
  return (
    <Panel title="Review history" description="Every advisor decision on this pathway.">
      <ol className="grid gap-3">
        {[...reviews].reverse().map((r, i) => (
          <li key={`${r.at}-${i}`} className="grid gap-0.5 border-l-2 border-[#eef6fc] pl-3">
            <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
              <span className="font-semibold text-gray-900">{r.by}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-px text-[11px] font-semibold",
                  r.decision === "approved"
                    ? "bg-emerald-50 text-emerald-700"
                    : r.decision === "changes_requested"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-gray-100 text-gray-700",
                )}
              >
                {DECISION_LABEL[r.decision]}
              </span>
              <span className="text-muted-foreground text-xs">{shortDate(r.at)}</span>
            </p>
            {r.note ? <p className="text-[13px] whitespace-pre-wrap text-gray-700">{r.note}</p> : null}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
