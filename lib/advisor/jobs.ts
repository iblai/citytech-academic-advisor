/**
 * The job market connector. Reads live technology postings from NYC Open
 * Data's "Jobs NYC Postings" dataset (Socrata, public, no key), tags each one
 * with the skills taxonomy and a target role, and caches the result. When the
 * feed cannot be reached the bundled snapshot (`data/jobs/nyc-snapshot.json`)
 * is served instead and the response says so. Server-only.
 *
 * To add a source, write another `fetch…()` returning `RawPosting[]` and add
 * it to `SOURCES`.
 */
import fs from "node:fs";
import path from "node:path";
import { ROLES, SKILLS, detectRole, detectSkills } from "./skills";
import type { JobPosting, RoleProfile, SkillDemand } from "./types";
import type { LoadedCatalog } from "./catalog";

type RawPosting = Record<string, string | undefined>;

const FEED = "https://data.cityofnewyork.us/resource/kpav-sd4t.json";
const SNAPSHOT = path.join(process.cwd(), "data", "jobs", "nyc-snapshot.json");
const TTL_MS = 6 * 60 * 60 * 1000;

export interface JobMarket {
  source: string;
  sourceUrl: string;
  live: boolean;
  fetchedAt: string;
  postings: JobPosting[];
}

let cache: { at: number; value: JobMarket } | null = null;

async function fetchNyc(): Promise<RawPosting[]> {
  const q = new URLSearchParams({
    $select:
      "job_id,agency,business_title,job_category,career_level,salary_range_from,salary_range_to,salary_frequency,work_location,job_description,minimum_qual_requirements,preferred_skills,posting_date,posting_type",
    $where: "job_category like '%Technology, Data%' AND posting_type='External'",
    $order: "posting_date DESC",
    $limit: "400",
  });
  const res = await fetch(`${FEED}?${q}`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!res.ok) throw new Error(`NYC Open Data answered ${res.status}`);
  return (await res.json()) as RawPosting[];
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b(It|Dba|Gis|Lan|Wan|Ii|Iii|Iv|Nyc|Hr|Qa|Ai)\b/g, (m) => m.toUpperCase());

function normalize(r: RawPosting): JobPosting {
  const text = [r.business_title, r.job_description, r.minimum_qual_requirements, r.preferred_skills]
    .filter(Boolean)
    .join("\n");
  const num = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : null);
  const title = (r.business_title ?? "").trim();
  return {
    id: r.job_id ?? "",
    title: title === title.toUpperCase() ? titleCase(title) : title,
    employer: titleCase(r.agency ?? "City of New York"),
    category: r.job_category ?? "",
    level: r.career_level ?? "",
    location: titleCase(r.work_location ?? "New York, NY"),
    salaryFrom: num(r.salary_range_from),
    salaryTo: num(r.salary_range_to),
    salaryFrequency: r.salary_frequency ?? "",
    postedAt: (r.posting_date ?? "").slice(0, 10),
    url: r.job_id ? `https://cityjobs.nyc.gov/job/${r.job_id}` : "https://cityjobs.nyc.gov",
    skills: detectSkills(text),
    roleId: detectRole(title),
  };
}

export async function loadJobMarket(force = false): Promise<JobMarket> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let raw: RawPosting[];
  let live = true;
  let fetchedAt = new Date().toISOString();
  try {
    raw = await fetchNyc();
    if (!raw.length) throw new Error("empty feed");
  } catch {
    live = false;
    raw = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")) as RawPosting[];
    fetchedAt = fs.statSync(SNAPSHOT).mtime.toISOString();
  }
  const seen = new Set<string>();
  const postings = raw.map(normalize).filter((p) => p.id && !seen.has(p.id) && seen.add(p.id));
  const value: JobMarket = {
    source: "NYC Open Data — Jobs NYC Postings (Technology, Data & Innovation)",
    sourceUrl: "https://data.cityofnewyork.us/City-Government/Jobs-NYC-Postings/kpav-sd4t",
    live,
    fetchedAt,
    postings,
  };
  cache = { at: Date.now(), value };
  return value;
}

const annual = (p: JobPosting) =>
  p.salaryFrequency === "Annual" && p.salaryFrom && p.salaryTo ? (p.salaryFrom + p.salaryTo) / 2 : null;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);
}

/** Target roles with the skills their postings ask for most. */
export function roleProfiles(market: JobMarket): RoleProfile[] {
  return ROLES.map((role) => {
    const mine = market.postings.filter((p) => p.roleId === role.id);
    const counts = new Map<string, number>();
    for (const p of mine) for (const s of p.skills) counts.set(s, (counts.get(s) ?? 0) + 1);
    const skills = SKILLS.filter((s) => counts.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        share: (counts.get(s.id) ?? 0) / Math.max(1, mine.length),
        emerging: !!s.emerging,
      }))
      .filter((s) => s.share >= 0.15)
      .sort((a, b) => b.share - a.share)
      .slice(0, 12);
    return {
      ...role,
      postings: mine.length,
      medianSalary: median(mine.map(annual).filter((n): n is number => n !== null)),
      skills,
    };
  }).filter((r) => r.postings > 0);
}

/** Every skill: how many postings ask for it and which courses teach it. */
export function skillDemand(market: JobMarket, catalog: LoadedCatalog): SkillDemand[] {
  const total = Math.max(1, market.postings.length);
  return SKILLS.map((s) => {
    const postings = market.postings.filter((p) => p.skills.includes(s.id)).length;
    return {
      id: s.id,
      name: s.name,
      group: s.group,
      emerging: !!s.emerging,
      postings,
      share: postings / total,
      courses: catalog.courses.filter((c) => c.skills.includes(s.id)).map((c) => c.code),
    };
  }).sort((a, b) => b.postings - a.postings);
}
