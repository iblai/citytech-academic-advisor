"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Briefcase, ExternalLink, Search, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { EmptyState } from "@/components/shell/empty-state";
import { SimpleSelect } from "@/components/shell/simple-select";
import { ErrorNote, PageSkeleton, Panel, ShareBar, SkillChip, money, shortDate } from "@/components/advisor/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAdvisorData, type MarketData } from "@/lib/advisor/use-advisor-api";
import type { JobPosting, RoleProfile, SkillDemand } from "@/lib/advisor/types";
import { skillById, skillName } from "@/lib/advisor/skills";
import { cn } from "@/lib/utils";

const pct = (share: number) => `${Math.round(share * 100)}%`;
const PAGE = 25;

export default function CareersPage() {
  useBreadcrumbs([{ label: "Careers & skills" }]);
  const { data, error, loading, reload } = useAdvisorData<MarketData>("/market");

  return (
    <>
      <PageHeader
        icon={<Briefcase />}
        title="Careers & skills"
        count={data ? data.postings.length : null}
        description={
          data ? `Job postings from ${data.source}` : "What employers ask for, and which courses teach it"
        }
      />
      {loading && !data ? (
        <PageSkeleton />
      ) : (
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {error ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <ErrorNote>{error}</ErrorNote>
              <Button variant="outline" size="sm" onClick={reload}>
                Try again
              </Button>
            </div>
          ) : null}
          {data ? (
            <div className="mx-auto grid max-w-6xl gap-6">
              <SourceStrip data={data} />
              <RolesSection roles={data.roles} />
              <DemandSection demand={data.demand} />
              <PostingsSection postings={data.postings} roles={data.roles} />
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

function SourceStrip({ data }: { data: MarketData }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[var(--border-color,#e5e7eb)] bg-white px-4 py-3 text-[13px] text-gray-700">
      <span className="min-w-0">
        <span className="text-muted-foreground">Source: </span>
        {data.sourceUrl ? (
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#0058cc] hover:underline"
          >
            {data.source}
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          data.source
        )}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
          data.live ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600",
        )}
      >
        <span className={cn("size-1.5 rounded-full", data.live ? "bg-emerald-500" : "bg-gray-400")} />
        {data.live ? "Live" : "Saved snapshot"}
      </span>
      <span>
        <span className="text-muted-foreground">Fetched: </span>
        {shortDate(data.fetchedAt)}
      </span>
      <span>
        <span className="text-muted-foreground">Postings: </span>
        {data.postings.length.toLocaleString("en-US")}
      </span>
    </div>
  );
}

function SectionTitle({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description ? <p className="text-muted-foreground mt-0.5 text-xs">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/* ------------------------------ Roles ------------------------------ */

function RolesSection({ roles }: { roles: RoleProfile[] }) {
  return (
    <section>
      <SectionTitle
        title="Target roles"
        description="Each skill's share is the percent of that role's postings that ask for it."
      />
      {roles.length === 0 ? (
        <EmptyState icon={<Briefcase />} title="No roles yet" description="No postings matched a target role." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <Panel key={r.id} title={r.name} description={r.blurb}>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                <span>
                  <span className="font-semibold text-gray-900 tabular-nums">{r.postings}</span>{" "}
                  <span className="text-muted-foreground">postings</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Median </span>
                  <span className="font-semibold text-gray-900 tabular-nums">{money(r.medianSalary)}</span>
                </span>
              </div>
              {r.skills.length ? (
                <ul className="grid gap-2">
                  {r.skills.slice(0, 6).map((s) => (
                    <li key={s.id} className="grid gap-1">
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex min-w-0 items-center gap-1 truncate text-gray-800">
                          {s.emerging ? (
                            <TrendingUp className="size-3 shrink-0 text-violet-600" aria-label="Emerging skill" />
                          ) : null}
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{pct(s.share)}</span>
                      </div>
                      <ShareBar share={s.share} tone={s.emerging ? "violet" : "brand"} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-[13px]">No skills detected in these postings.</p>
              )}
            </Panel>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Demand ------------------------------ */

function DemandSection({ demand }: { demand: SkillDemand[] }) {
  const [emergingOnly, setEmergingOnly] = useState(false);
  const rows = useMemo(
    () => demand.filter((d) => d.postings > 0 && (!emergingOnly || d.emerging)),
    [demand, emergingOnly],
  );

  return (
    <section>
      <SectionTitle
        title="Skills employers ask for"
        description="Share of all postings that mention each skill, and the catalog courses that teach it."
        actions={
          <label className="flex items-center gap-2 text-[13px] text-gray-700">
            <Switch checked={emergingOnly} onCheckedChange={(v) => setEmergingOnly(!!v)} size="sm" />
            Emerging only
          </label>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<TrendingUp />}
          title="No skills to show"
          description={emergingOnly ? "No emerging skill appears in these postings." : "No skill appears in these postings."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-color,#e5e7eb)] bg-white">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="text-muted-foreground border-b border-gray-100 text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Skill</th>
                <th className="px-3 py-2 font-medium">Group</th>
                <th className="px-3 py-2 text-right font-medium">Postings</th>
                <th className="w-40 px-3 py-2 font-medium">Share</th>
                <th className="px-3 py-2 font-medium">Taught in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((d) => (
                <tr key={d.id} className="align-top">
                  <td className="px-3 py-2">
                    <SkillChip name={d.name} emerging={d.emerging} />
                  </td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">{d.group}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.postings}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <ShareBar share={d.share} tone={d.emerging ? "violet" : "brand"} />
                      <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
                        {pct(d.share)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {d.courses.length ? (
                      <span className="text-gray-700">{d.courses.join(", ")}</span>
                    ) : (
                      <span className="font-medium text-rose-600">No course loaded</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Postings ------------------------------ */

function salaryText(p: JobPosting) {
  if (p.salaryFrom == null && p.salaryTo == null) return null;
  const range =
    p.salaryFrom != null && p.salaryTo != null && p.salaryFrom !== p.salaryTo
      ? `${money(p.salaryFrom)}–${money(p.salaryTo)}`
      : money(p.salaryFrom ?? p.salaryTo);
  return p.salaryFrequency ? `${range} ${p.salaryFrequency.toLowerCase()}` : range;
}

function PostingsSection({ postings, roles }: { postings: JobPosting[]; roles: RoleProfile[] }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [shown, setShown] = useState(PAGE);

  const roleName = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return postings.filter((p) => {
      if (role && p.roleId !== role) return false;
      if (!needle) return true;
      return `${p.title} ${p.employer}`.toLowerCase().includes(needle);
    });
  }, [postings, q, role]);

  return (
    <section>
      <SectionTitle title="Recent postings" description={`${rows.length.toLocaleString("en-US")} shown by the filters`} />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(PAGE);
            }}
            placeholder="Search title or employer"
            className="bg-white pl-8"
            aria-label="Search postings"
          />
        </div>
        <SimpleSelect
          value={role}
          onChange={(v) => {
            setRole(v);
            setShown(PAGE);
          }}
          options={roles.map((r) => ({ value: r.id, label: r.name }))}
          allowEmpty
          emptyLabel="All roles"
          placeholder="All roles"
          className="bg-white sm:w-56"
          aria-label="Filter by role"
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={postings.length ? "No postings match" : "No postings loaded"}
          description={postings.length ? "Try a different search or role." : "The job source returned no postings."}
        />
      ) : (
        <>
          <ul className="divide-y divide-gray-100 rounded-xl border border-[var(--border-color,#e5e7eb)] bg-white">
            {rows.slice(0, shown).map((p) => {
              const salary = salaryText(p);
              return (
                <li key={p.id} className="grid gap-1.5 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 text-[13px] font-semibold text-gray-900 hover:text-[#0058cc] hover:underline"
                    >
                      <span className="break-words">{p.title}</span>
                      <ExternalLink className="size-3 shrink-0 text-gray-400" />
                    </a>
                    <span className="text-muted-foreground shrink-0 text-xs">{shortDate(p.postedAt)}</span>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span className="text-gray-700">{p.employer}</span>
                    {salary ? <span>{salary}</span> : null}
                    {p.roleId && roleName.get(p.roleId) ? <span>{roleName.get(p.roleId)}</span> : null}
                  </div>
                  {p.skills.length ? (
                    <div className="flex flex-wrap gap-1">
                      {p.skills.map((id) => (
                        <SkillChip key={id} name={skillName(id)} emerging={!!skillById(id)?.emerging} />
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {rows.length > shown ? (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({rows.length - shown} left)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
