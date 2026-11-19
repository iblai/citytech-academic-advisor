"use client";

import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import { Panel, ShareBar, SkillChip } from "@/components/advisor/bits";
import { skillById, skillName } from "@/lib/advisor/skills";
import type { Plan, PlanItem } from "@/lib/advisor/types";
import { cn } from "@/lib/utils";

const KIND: Record<PlanItem["kind"], { label: string; cls: string }> = {
  required: { label: "Required", cls: "bg-gray-100 text-gray-700" },
  choice: { label: "Choose one", cls: "bg-sky-50 text-sky-700" },
  elective: { label: "Elective", cls: "bg-violet-50 text-violet-700" },
  gened: { label: "Gen ed", cls: "bg-amber-50 text-amber-700" },
};

/**
 * A pathway as students and advisors both read it: one card per term, then
 * how it lines up with the goal role, then everything a human has to check.
 */
export function PlanView({ plan }: { plan: Plan }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {plan.terms.map((t) => (
          <section
            key={t.index}
            className="rounded-xl border border-[var(--border-color,#e5e7eb)] bg-white"
            aria-label={`${t.label}, ${t.credits} credits`}
          >
            <header className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">{t.label}</h3>
              <span className="text-muted-foreground text-xs">{t.credits} cr</span>
            </header>
            <ul className="divide-y divide-gray-100">
              {t.items.map((i, n) => (
                <li key={`${i.code}-${n}`} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-[13px] leading-5 text-gray-900">
                      {i.kind !== "gened" ? <span className="font-semibold">{i.code} </span> : null}
                      {i.title}
                    </p>
                    <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px] font-semibold", KIND[i.kind].cls)}>
                      {KIND[i.kind].label}
                    </span>
                  </div>
                  {i.kind !== "gened" && i.reason ? (
                    <p className="text-muted-foreground mt-0.5 text-[11px] leading-4">{i.reason}</p>
                  ) : null}
                  {i.flag ? (
                    <p className="mt-1 flex items-start gap-1 text-[11px] leading-4 text-amber-700">
                      <AlertTriangle className="mt-px size-3 shrink-0" /> {i.flag}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={plan.goalRoleName ? `Skills for ${plan.goalRoleName}` : "Skills"}
          description={
            plan.goalRoleName
              ? "What that role's postings ask for, and where this pathway builds it"
              : "Pick a career goal to see how the pathway lines up with employers"
          }
        >
          {plan.goalRoleName ? (
            <ul className="grid gap-2.5">
              {plan.coverage.map((c) => (
                <li key={c.id} className="grid gap-1">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-1.5 text-gray-900">
                      <CheckCircle2 className="size-3.5 text-emerald-600" /> {c.name}
                      {c.emerging ? <SkillChip name="emerging" emerging /> : null}
                    </span>
                    <span className="text-muted-foreground text-xs">{Math.round(c.share * 100)}% of postings</span>
                  </div>
                  <ShareBar share={c.share} />
                  <p className="text-muted-foreground text-[11px]">{c.courses.slice(0, 6).join(" · ")}</p>
                </li>
              ))}
              {plan.gaps.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <CircleDashed className="size-3.5 text-rose-500" /> {g.name}
                    <span className="text-muted-foreground text-[11px]">not in this pathway</span>
                  </span>
                  <span className="text-muted-foreground text-xs">{Math.round(g.share * 100)}% of postings</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No goal selected.</p>
          )}
          {plan.gaps.length ? (
            <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
              Not covered by courses: {plan.gaps.map((g) => skillName(g.id)).join(", ")}. Look for a
              microcredential or workshop — or ask the advisor what is available.
            </p>
          ) : null}
        </Panel>
        <Panel
          title="For the advisor to check"
          description="This pathway is a proposal until a human advisor approves it"
        >
          <ul className="grid gap-2 text-[13px] text-gray-700">
            {plan.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" /> {w}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/** Skills a plan's courses build, most common first. */
export function planSkills(plan: Plan): { id: string; name: string; emerging: boolean }[] {
  const counts = new Map<string, number>();
  for (const t of plan.terms) for (const i of t.items) for (const s of i.skills) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => ({ id, name: skillName(id), emerging: !!skillById(id)?.emerging }));
}
