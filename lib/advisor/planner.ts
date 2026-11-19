/**
 * The pathway planner: given a program, what the student has finished, and
 * the role they are aiming at, lay the remaining courses out term by term —
 * prerequisites first, the longest chains earliest — and choose electives by
 * what the job market asks for, weighting emerging skills up. It then reports
 * how the plan covers the target role's skills, what it leaves uncovered, and
 * every assumption an advisor has to check. The plan is a proposal: nothing
 * here is final until a human approves it.
 *
 * Pure: takes the loaded catalog and role profiles, touches no I/O.
 */
import type { CatalogCourse, LoadedCatalog } from "./catalog";
import { prereqsMet } from "./prereq";
import { skillById, skillName } from "./skills";
import type { Plan, PlanItem, PlanTerm, Program, RoleProfile } from "./types";

export interface PlanInput {
  programId: string;
  completed?: string[];
  goalRoleId?: string | null;
  creditsPerTerm?: number;
  /** e.g. "Spring 2027"; defaults to the next term. */
  startTerm?: string;
  /** How many general-education courses are already done. */
  genEdCompleted?: number;
}

export function nextTerm(now = new Date()): string {
  const m = now.getMonth();
  const y = now.getFullYear();
  // Registration for spring opens in the fall and vice versa.
  return m >= 8 ? `Spring ${y + 1}` : m <= 1 ? `Spring ${y}` : `Fall ${y}`;
}

function termLabels(start: string, n: number): string[] {
  const m = /^(Fall|Spring)\s+(\d{4})$/i.exec(start.trim());
  let season = m ? (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) : "Fall";
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

const normCode = (c: string) =>
  c
    .trim()
    .toUpperCase()
    .replace(/^([A-Z]{2,5})\s*(\d{4}\w*)$/, "$1 $2");

export function buildPlan(
  catalog: LoadedCatalog,
  roles: RoleProfile[],
  input: PlanInput,
): Plan {
  const program = catalog.programs.find(
    (p) => p.id.toLowerCase() === input.programId.toLowerCase(),
  ) as Program | undefined;
  if (!program) throw new Error(`Unknown program "${input.programId}"`);
  const role = roles.find((r) => r.id === input.goalRoleId) ?? null;
  const cap = Math.min(21, Math.max(6, Math.round(input.creditsPerTerm ?? 15)));
  const completed = new Set((input.completed ?? []).map(normCode));
  const known = new Set(catalog.byCode.keys());
  const warnings: string[] = [];

  const roleWeight = new Map((role?.skills ?? []).map((s) => [s.id, s.share]));
  const relevance = (c: CatalogCourse) =>
    c.skills.reduce(
      (sum, s) => sum + (roleWeight.get(s) ?? 0) + (skillById(s)?.emerging ? 0.25 : 0),
      0,
    );
  const why = (c: CatalogCourse) => {
    const hits = c.skills.filter((s) => roleWeight.has(s)).map(skillName);
    if (role && hits.length) return `Builds ${hits.slice(0, 3).join(", ")} — asked for in ${role.name} postings.`;
    const emerging = c.skills.filter((s) => skillById(s)?.emerging).map(skillName);
    if (emerging.length) return `Builds ${emerging.slice(0, 3).join(", ")}, an emerging skill area.`;
    return "";
  };

  // 1. What is still needed.
  const items: PlanItem[] = [];
  const planned = new Set<string>();
  const add = (c: CatalogCourse, kind: PlanItem["kind"], requirementId: string, reason: string, flag?: string) => {
    if (planned.has(c.code) || completed.has(c.code)) return;
    planned.add(c.code);
    const flags = [flag];
    if (c.prereqCaptured === false)
      flags.push("Prerequisites were not loaded from the catalog; placed by course number.");
    else if (c.prereq.needsReview)
      flags.push(`Prerequisite needs a manual check: "${c.prereqText}".`);
    items.push({
      code: c.code,
      title: c.title,
      credits: c.credits,
      kind,
      requirementId,
      reason,
      skills: c.skills,
      prereqText: c.prereqText || undefined,
      flag: flags.filter(Boolean).join(" ") || undefined,
    });
  };

  for (const r of program.requirements) {
    if (r.type === "all") {
      for (const code of r.courses) {
        const c = catalog.byCode.get(code);
        if (c) add(c, "required", r.id, why(c) || `Required for the ${program.name} major.`);
        else if (!completed.has(code)) warnings.push(`${code} is required but is not in the loaded catalog.`);
      }
    }
  }
  for (const r of program.requirements) {
    if (r.type === "choose") {
      const done = r.courses.filter((c) => completed.has(c)).length;
      const options = r.courses
        .map((c) => catalog.byCode.get(c))
        .filter((c): c is CatalogCourse => !!c && !completed.has(c.code))
        .sort((a, b) => relevance(b) - relevance(a));
      for (const c of options.slice(0, Math.max(0, r.count - done)))
        add(
          c,
          "choice",
          r.id,
          `${r.label}: one of ${r.courses.join(" / ")}. ${why(c)}`.trim(),
          `Chosen from ${r.courses.join(" or ")} — confirm the option with the student.`,
        );
    }
  }
  for (const r of program.requirements) {
    if (r.type !== "elective") continue;
    const requiredElsewhere = new Set(
      program.requirements.flatMap((x) => ("courses" in x ? x.courses : [])),
    );
    const have = new Set([...completed, ...planned]);
    const candidates = catalog.courses
      .filter(
        (c) =>
          r.subjects.includes(c.subject) &&
          c.level >= r.minLevel &&
          c.credits >= r.credits &&
          !requiredElsewhere.has(c.code) &&
          !completed.has(c.code) &&
          !/internship|special topics|^topics in/i.test(c.title) &&
          c.prereq.groups.length > 0 &&
          !c.prereq.needsReview &&
          c.prereq.groups.every((g) => g.some((code) => have.has(code))),
      )
      .map((c) => ({ c, score: relevance(c) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.c.level - b.c.level);
    for (const { c } of candidates.slice(0, r.count))
      add(
        c,
        "elective",
        r.id,
        `${r.label}. ${why(c)}`.trim(),
        `Suggested for "${r.label}" from market demand — an advisor must confirm it counts.`,
      );
    const short = r.count - candidates.slice(0, r.count).length;
    if (short > 0) warnings.push(`${short} "${r.label}" slot(s) could not be filled automatically.`);
    if (r.note) warnings.push(r.note);
  }

  // General education: placeholders the advisor and student fill from the gen-ed lists.
  let genEdSkip = Math.max(0, Math.round(input.genEdCompleted ?? 0));
  const genEd: PlanItem[] = [];
  for (const r of program.requirements) {
    if (r.type !== "gened" || r.credits <= 0) continue;
    for (let i = 1; i <= r.count; i++) {
      if (genEdSkip > 0) {
        genEdSkip--;
        continue;
      }
      genEd.push({
        code: "GEN ED",
        title: r.count > 1 ? `${r.label} (${i} of ${r.count})` : r.label,
        credits: r.credits,
        kind: "gened",
        requirementId: r.id,
        reason: r.note ?? "General education requirement — pick the course from the approved list.",
        skills: [],
      });
    }
  }

  // 2. Lay it out. Courses with the most work waiting on them go first.
  const dependents = new Map<string, number>();
  const downstream = (code: string, seen = new Set<string>()): number => {
    if (dependents.has(code)) return dependents.get(code)!;
    let n = 0;
    for (const it of items) {
      if (seen.has(it.code)) continue;
      const c = catalog.byCode.get(it.code);
      const self = catalog.byCode.get(code);
      // Where prerequisites were not loaded, later courses of the same subject
      // are assumed to wait on earlier ones, so the sequence starts early.
      const assumed =
        !!c && !!self && self.prereqCaptured === false && c.prereqCaptured === false &&
        c.subject === self.subject && c.level > self.level;
      if (assumed || c?.prereq.groups.some((g) => g.includes(code))) {
        seen.add(it.code);
        n += 1 + downstream(it.code, seen);
      }
    }
    dependents.set(code, n);
    return n;
  };
  const queue = [...items].sort(
    (a, b) =>
      downstream(b.code) - downstream(a.code) ||
      (catalog.byCode.get(a.code)?.level ?? 0) - (catalog.byCode.get(b.code)?.level ?? 0) ||
      a.code.localeCompare(b.code),
  );
  const done = new Set(completed);
  const terms: PlanTerm[] = [];
  // Leave room for general education each term so it is not stacked at the end.
  const maxMajor = Math.max(2, Math.floor(cap / 3) - 2);
  const labels = termLabels(input.startTerm || nextTerm(), 16);
  while ((queue.length || genEd.length) && terms.length < 16) {
    const term: PlanTerm = { index: terms.length + 1, label: labels[terms.length], credits: 0, items: [] };
    const taking = new Set<string>();
    let major = 0;
    for (let i = 0; i < queue.length; ) {
      const it = queue[i];
      const c = catalog.byCode.get(it.code)!;
      // Without captured prerequisites, keep same-subject courses in number order.
      const waitsOn = (code: string) => {
        const o = catalog.byCode.get(code);
        return !!o && o.prereqCaptured === false && o.subject === c.subject && o.level < c.level;
      };
      const earlier =
        c.prereqCaptured === false &&
        (queue.some((o) => o !== it && waitsOn(o.code)) || [...taking].some(waitsOn));
      const ok =
        !earlier &&
        prereqsMet(c.prereq, done, known) &&
        c.prereq.coreqs.every((k) => !known.has(k) || done.has(k) || taking.has(k) || !planned.has(k)) &&
        term.credits + it.credits <= cap &&
        (major < maxMajor || !genEd.length);
      if (ok) {
        term.items.push(it);
        term.credits += it.credits;
        taking.add(it.code);
        major++;
        queue.splice(i, 1);
      } else i++;
    }
    while (genEd.length && term.credits + genEd[0].credits <= cap + 1) {
      const g = genEd.shift()!;
      term.items.push(g);
      term.credits += g.credits;
    }
    if (!term.items.length) {
      // Nothing fits: a prerequisite chain the catalog data cannot resolve.
      const stuck = queue.shift() ?? genEd.shift()!;
      stuck.flag = `${stuck.flag ?? ""} Could not be sequenced from the catalog's prerequisite text — place by hand.`.trim();
      term.items.push(stuck);
      term.credits += stuck.credits;
      taking.add(stuck.code);
    }
    for (const code of taking) done.add(code);
    terms.push(term);
  }
  if (queue.length) warnings.push(`${queue.length} course(s) did not fit in 16 terms.`);

  // 3. What the plan adds up to.
  const all = [...items, ...terms.flatMap((t) => t.items.filter((i) => i.kind === "gened"))];
  const remainingCredits = terms.reduce((n, t) => n + t.credits, 0);
  const taught = new Map<string, string[]>();
  for (const code of [...completed, ...planned]) {
    const c = catalog.byCode.get(code);
    for (const s of c?.skills ?? []) taught.set(s, [...(taught.get(s) ?? []), code]);
  }
  const coverage = (role?.skills ?? [])
    .filter((s) => taught.has(s.id))
    .map((s) => ({ ...s, courses: taught.get(s.id)! }));
  const gaps = (role?.skills ?? []).filter((s) => !taught.has(s.id));

  for (const it of all) if (it.flag && it.kind === "required") warnings.push(`${it.code}: ${it.flag}`);
  for (const n of program.notes.slice(0, 2)) warnings.push(n);
  if (terms.some((t) => t.items.some((i) => i.kind === "gened")))
    warnings.push("General-education slots are placeholders: choose the actual courses from the approved lists.");
  const unknown = [...completed].filter((c) => !known.has(c));
  if (unknown.length)
    warnings.push(`Completed courses not in the loaded catalog were not checked: ${unknown.slice(0, 8).join(", ")}.`);

  return {
    programId: program.id,
    programName: `${program.name} (${program.degree.split(" - ")[0]})`,
    goalRoleId: role?.id ?? null,
    goalRoleName: role?.name ?? null,
    completed: [...completed],
    creditsPerTerm: cap,
    terms,
    totalCredits: program.totalCredits,
    remainingCredits,
    coverage,
    gaps,
    warnings: [...new Set(warnings)].slice(0, 14),
  };
}
