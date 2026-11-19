"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, BookOpen, ExternalLink, GraduationCap, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { EmptyState } from "@/components/shell/empty-state";
import { SimpleSelect } from "@/components/shell/simple-select";
import { ErrorNote, PageSkeleton, Panel, SkillChip, shortDate } from "@/components/advisor/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdvisorData, type CatalogData } from "@/lib/advisor/use-advisor-api";
import type { PublicCourse } from "@/lib/advisor/catalog";
import type { Program, Requirement } from "@/lib/advisor/types";
import { skillById, skillName } from "@/lib/advisor/skills";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function CatalogPage() {
  useBreadcrumbs([{ label: "Catalog" }]);
  const { data, error, loading, reload } = useAdvisorData<CatalogData>("/catalog");

  const byCode = useMemo(
    () => new Map((data?.courses ?? []).map((c) => [c.code, c])),
    [data],
  );
  const [selected, setSelectedCourse] = useState<PublicCourse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const setSelected = (c: PublicCourse | null) => {
    if (c) setSelectedCourse(c);
    setDialogOpen(!!c);
  };

  return (
    <>
      <PageHeader
        icon={<BookOpen />}
        title="Catalog"
        count={data ? data.courses.length : null}
        description={data ? `${data.institution} · ${data.catalog}` : "Programs and courses from the college catalog"}
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
            <div className="mx-auto grid max-w-6xl gap-4">
              <SourceStrip data={data} />
              <Tabs defaultValue="programs">
                <TabsList>
                  <TabsTrigger value="programs" className="px-3">
                    Programs ({data.programs.length})
                  </TabsTrigger>
                  <TabsTrigger value="courses" className="px-3">
                    Courses ({data.courses.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="programs" className="mt-2">
                  <ProgramsTab programs={data.programs} byCode={byCode} onOpen={setSelected} />
                </TabsContent>
                <TabsContent value="courses" className="mt-2">
                  <CoursesTab courses={data.courses} onOpen={setSelected} />
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </div>
      )}
      <CourseDialog
        course={selected}
        open={dialogOpen}
        courses={data?.courses ?? []}
        byCode={byCode}
        onClose={() => setSelected(null)}
        onOpen={setSelected}
      />
    </>
  );
}

function SourceStrip({ data }: { data: CatalogData }) {
  const isUrl = /^https?:\/\//i.test(data.source);
  return (
    <div className="rounded-xl border border-[var(--border-color,#e5e7eb)] bg-white px-4 py-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-700">
        <span className="min-w-0">
          <span className="text-muted-foreground">Source: </span>
          {isUrl ? (
            <a
              href={data.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 break-all text-[#0058cc] hover:underline"
            >
              {data.catalog || data.source}
              <ExternalLink className="size-3 shrink-0" />
            </a>
          ) : (
            <span className="break-words">{data.source}</span>
          )}
        </span>
        <span>
          <span className="text-muted-foreground">Captured: </span>
          {shortDate(data.capturedAt)}
        </span>
      </div>
      {data.coverage ? <p className="text-muted-foreground mt-1.5 text-xs">{data.coverage}</p> : null}
    </div>
  );
}

/* ------------------------------ Programs ------------------------------ */

function ProgramsTab({
  programs,
  byCode,
  onOpen,
}: {
  programs: Program[];
  byCode: Map<string, PublicCourse>;
  onOpen: (c: PublicCourse) => void;
}) {
  if (!programs.length)
    return <EmptyState icon={<GraduationCap />} title="No programs loaded" description="The catalog has no programs yet." />;
  return (
    <div className="grid gap-4">
      {programs.map((p) => (
        <Panel
          key={p.id}
          title={p.name}
          description={[p.degree, p.department, p.totalCredits ? `${p.totalCredits} credits` : ""]
            .filter(Boolean)
            .join(" · ")}
          actions={
            p.catalogUrl ? (
              <a
                href={p.catalogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0058cc] hover:underline"
              >
                Catalog page <ExternalLink className="size-3" />
              </a>
            ) : null
          }
        >
          {p.description ? <p className="mb-4 text-[13px] text-gray-700">{p.description}</p> : null}
          <div className="grid gap-3">
            {p.requirements.map((r) => (
              <RequirementBlock key={r.id} req={r} byCode={byCode} onOpen={onOpen} />
            ))}
          </div>
          {p.notes?.length ? (
            <ul className="text-muted-foreground mt-4 list-disc space-y-1 pl-5 text-xs">
              {p.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}

function RequirementBlock({
  req,
  byCode,
  onOpen,
}: {
  req: Requirement;
  byCode: Map<string, PublicCourse>;
  onOpen: (c: PublicCourse) => void;
}) {
  let summary = "";
  if (req.type === "all") summary = "All of";
  else if (req.type === "choose") summary = `Choose ${req.count} of`;
  else if (req.type === "elective")
    summary = `${plural(req.count, "course")}${req.credits ? ` · ${req.credits} credits` : ""}${
      req.subjects?.length ? ` · ${req.subjects.join(", ")}` : ""
    }${req.minLevel ? ` · level ${req.minLevel}+` : ""}`;
  else summary = `${plural(req.count, "course")}${req.credits ? ` · ${req.credits} credits` : ""}`;

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-[13px] font-semibold text-gray-900">{req.label}</h3>
        <span className="text-muted-foreground text-xs">{summary}</span>
      </div>
      {"courses" in req && req.courses.length ? (
        <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-100 bg-white">
          {req.courses.map((code) => {
            const c = byCode.get(code);
            return (
              <li key={code}>
                <button
                  type="button"
                  disabled={!c}
                  onClick={() => c && onOpen(c)}
                  className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-[13px] hover:bg-[#eef6fc] disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="w-20 shrink-0 font-medium text-[#0058cc]">{code}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-800">
                    {c?.title ?? <span className="text-muted-foreground">Not in loaded catalog</span>}
                  </span>
                  {c ? <span className="text-muted-foreground shrink-0 text-xs">{c.credits} cr</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {req.note ? <p className="text-muted-foreground mt-2 text-xs">{req.note}</p> : null}
    </div>
  );
}

/* ------------------------------ Courses ------------------------------ */

function CoursesTab({ courses, onOpen }: { courses: PublicCourse[]; onOpen: (c: PublicCourse) => void }) {
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [skill, setSkill] = useState("");

  const subjects = useMemo(
    () => [...new Set(courses.map((c) => c.subject).filter(Boolean))].sort(),
    [courses],
  );
  const skills = useMemo(
    () =>
      [...new Set(courses.flatMap((c) => c.skills))]
        .map((id) => ({ value: id, label: skillName(id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [courses],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return courses.filter((c) => {
      if (subject && c.subject !== subject) return false;
      if (skill && !c.skills.includes(skill)) return false;
      if (!needle) return true;
      const hay = [c.code, c.title, c.description, ...c.skills.map(skillName)].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [courses, q, subject, skill]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, title, description or skill"
            className="bg-white pl-8"
            aria-label="Search courses"
          />
        </div>
        <SimpleSelect
          value={subject}
          onChange={setSubject}
          options={subjects.map((s) => ({ value: s, label: s }))}
          allowEmpty
          emptyLabel="All subjects"
          placeholder="All subjects"
          className="bg-white sm:w-44"
          aria-label="Filter by subject"
        />
        <SimpleSelect
          value={skill}
          onChange={setSkill}
          options={skills}
          allowEmpty
          emptyLabel="All skills"
          placeholder="All skills"
          className="bg-white sm:w-52"
          aria-label="Filter by skill"
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {rows.length === courses.length ? plural(courses.length, "course") : `${rows.length} of ${courses.length} courses`}
      </p>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={courses.length ? "No courses match" : "No courses loaded"}
          description={courses.length ? "Try a different search or clear the filters." : "The catalog has no courses yet."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-color,#e5e7eb)] bg-white">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-muted-foreground border-b border-gray-100 text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 text-right font-medium">Credits</th>
                <th className="px-3 py-2 font-medium">Prerequisites</th>
                <th className="px-3 py-2 font-medium">Skills</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c) => (
                <tr
                  key={c.code}
                  onClick={() => onOpen(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(c);
                    }
                  }}
                  tabIndex={0}
                  className="cursor-pointer align-top outline-none hover:bg-[#eef6fc] focus-visible:bg-[#eef6fc]"
                >
                  <td className="px-3 py-2 font-medium whitespace-nowrap text-[#0058cc]">{c.code}</td>
                  <td className="px-3 py-2 text-gray-900">{c.title}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.credits}</td>
                  <td className="max-w-xs px-3 py-2">
                    <PrereqCell course={c} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {c.skills.map((id) => (
                        <SkillChip key={id} name={skillName(id)} emerging={!!skillById(id)?.emerging} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReviewMarker() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-px text-[11px] font-medium text-amber-700">
      <AlertTriangle className="size-3" /> needs advisor check
    </span>
  );
}

function PrereqCell({ course }: { course: PublicCourse }) {
  if (!course.prereqCaptured) return <span className="text-muted-foreground">Not loaded</span>;
  return (
    <div className="grid gap-1">
      <span className="text-gray-700">{course.prereqText || <span className="text-muted-foreground">None</span>}</span>
      {course.prereqNeedsReview ? (
        <span>
          <ReviewMarker />
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------ Detail ------------------------------ */

function CourseDialog({
  course,
  open,
  courses,
  byCode,
  onClose,
  onOpen,
}: {
  course: PublicCourse | null;
  open: boolean;
  courses: PublicCourse[];
  byCode: Map<string, PublicCourse>;
  onClose: () => void;
  onOpen: (c: PublicCourse) => void;
}) {
  const unlocks = useMemo(
    () => (course ? courses.filter((c) => c.prereqCodes.some((g) => g.includes(course.code))) : []),
    [course, courses],
  );

  const codeLink = (code: string) => {
    const c = byCode.get(code);
    return c ? (
      <button
        key={code}
        type="button"
        onClick={() => onOpen(c)}
        className="font-medium text-[#0058cc] hover:underline"
        title={c.title}
      >
        {code}
      </button>
    ) : (
      <span key={code} className="font-medium text-gray-700" title="Not in loaded catalog">
        {code}
      </span>
    );
  };

  return (
    <Dialog open={open && !!course} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        {course ? (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8 text-base font-semibold">
                {course.code} · {course.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {[course.subject, course.department, `${course.credits} credits`].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>

            {course.description ? <p className="text-[13px] text-gray-700">{course.description}</p> : null}

            <Section title="Prerequisites (catalog wording)">
              {course.prereqCaptured ? (
                <div className="grid gap-1.5">
                  <p className="text-[13px] text-gray-700">
                    {course.prereqText || <span className="text-muted-foreground">None</span>}
                  </p>
                  {course.prereqNeedsReview ? (
                    <span>
                      <ReviewMarker />
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground text-[13px]">Not loaded</p>
              )}
            </Section>

            {course.prereqCodes.length ? (
              <Section title="Parsed prerequisites">
                <ul className="grid gap-1 text-[13px]">
                  {course.prereqCodes.map((group, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-x-1.5">
                      {i > 0 ? <span className="text-muted-foreground text-xs font-medium">and</span> : null}
                      {group.length > 1 ? <span className="text-muted-foreground text-xs">one of</span> : null}
                      {group.map((code, j) => (
                        <span key={code} className="inline-flex items-center gap-1.5">
                          {j > 0 ? <span className="text-muted-foreground text-xs">or</span> : null}
                          {codeLink(code)}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {course.coreqCodes.length ? (
              <Section title="Corequisites">
                <div className="flex flex-wrap gap-x-2 text-[13px]">{course.coreqCodes.map(codeLink)}</div>
              </Section>
            ) : null}

            {course.liberalArts || course.writingIntensive ? (
              <div className="flex flex-wrap gap-1.5">
                {course.liberalArts ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    Liberal arts
                  </span>
                ) : null}
                {course.writingIntensive ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    Writing intensive
                  </span>
                ) : null}
              </div>
            ) : null}

            <Section title="Skills">
              {course.skills.length ? (
                <div className="flex flex-wrap gap-1">
                  {course.skills.map((id) => (
                    <SkillChip key={id} name={skillName(id)} emerging={!!skillById(id)?.emerging} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-[13px]">No skills detected in the description.</p>
              )}
            </Section>

            <Section title="Unlocks">
              {unlocks.length ? (
                <ul className="grid gap-0.5 text-[13px]">
                  {unlocks.map((c) => (
                    <li key={c.code} className="flex gap-2">
                      {codeLink(c.code)}
                      <span className="min-w-0 truncate text-gray-700">{c.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-[13px]">No loaded course lists it as a prerequisite.</p>
              )}
            </Section>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </div>
  );
}
