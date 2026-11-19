/**
 * The college catalog, loaded once per server process from
 * `data/catalog/<id>.json` (the file Settings → Catalog imports replace), with
 * each course tagged with the skills it teaches. Server-only.
 */
import fs from "node:fs";
import path from "node:path";
import { detectSkills } from "./skills";
import { parsePrereq, type ParsedPrereq } from "./prereq";
import type { Catalog, Course, Program } from "./types";

export interface CatalogCourse extends Course {
  skills: string[];
  level: number;
  prereq: ParsedPrereq;
}

export interface LoadedCatalog extends Omit<Catalog, "courses"> {
  courses: CatalogCourse[];
  byCode: Map<string, CatalogCourse>;
}

const DATA_DIR = path.join(process.cwd(), "data", "catalog");
const DEFAULT_ID = "citytech";
let cache: { mtime: number; value: LoadedCatalog } | null = null;

export function catalogPath(): string {
  return path.join(DATA_DIR, `${process.env.ADVISOR_CATALOG ?? DEFAULT_ID}.json`);
}

export function levelOf(code: string): number {
  const m = /(\d{4})/.exec(code);
  return m ? Number(m[1]) : 0;
}

export function enrich(raw: Catalog): LoadedCatalog {
  const courses = raw.courses.map((c) => ({
    ...c,
    skills: detectSkills(`${c.title}. ${c.description}`),
    level: levelOf(c.code),
    prereq: parsePrereq(c.prereqText, c.code),
  }));
  return { ...raw, courses, byCode: new Map(courses.map((c) => [c.code, c])) };
}

export function loadCatalog(): LoadedCatalog {
  const file = catalogPath();
  const mtime = fs.statSync(file).mtimeMs;
  if (cache && cache.mtime === mtime) return cache.value;
  const value = enrich(JSON.parse(fs.readFileSync(file, "utf8")) as Catalog);
  cache = { mtime, value };
  return value;
}

/** Shape check for an imported catalog file; returns the problems found. */
export function validateCatalog(input: unknown): string[] {
  const errors: string[] = [];
  const c = input as Partial<Catalog> | null;
  if (!c || typeof c !== "object") return ["The file is not a JSON object."];
  if (!c.institution) errors.push("`institution` is missing.");
  if (!Array.isArray(c.courses) || !c.courses.length) errors.push("`courses` must be a non-empty list.");
  if (!Array.isArray(c.programs) || !c.programs.length) errors.push("`programs` must be a non-empty list.");
  const codes = new Set<string>();
  for (const [i, k] of (c.courses ?? []).entries()) {
    if (!k?.code || !k?.title || typeof k?.credits !== "number")
      errors.push(`courses[${i}] needs code, title and numeric credits.`);
    else codes.add(k.code);
    if (errors.length > 20) break;
  }
  for (const p of c.programs ?? []) {
    if (!p?.id || !p?.name || !Array.isArray(p?.requirements)) {
      errors.push(`Program "${p?.id ?? "?"}" needs id, name and requirements.`);
      continue;
    }
    for (const r of p.requirements)
      if ("courses" in r)
        for (const code of r.courses)
          if (!codes.has(code)) errors.push(`Program ${p.id} lists ${code}, which is not in courses.`);
  }
  return errors.slice(0, 25);
}

export function saveCatalog(input: Catalog): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(catalogPath(), JSON.stringify(input, null, 1));
  cache = null;
}

export function findProgram(cat: LoadedCatalog, id: string): Program | undefined {
  return cat.programs.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

/** A course without the server-only parse, for the wire. */
export function publicCourse(c: CatalogCourse) {
  return {
    code: c.code,
    title: c.title,
    credits: c.credits,
    subject: c.subject,
    department: c.department,
    description: c.description,
    liberalArts: !!c.liberalArts,
    writingIntensive: !!c.writingIntensive,
    prereqText: c.prereqText,
    prereqCaptured: c.prereqCaptured !== false,
    prereqCodes: c.prereq.groups,
    coreqCodes: c.prereq.coreqs,
    prereqNeedsReview: c.prereq.needsReview,
    skills: c.skills,
    level: c.level,
  };
}
export type PublicCourse = ReturnType<typeof publicCourse>;
