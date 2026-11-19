import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { enrich, validateCatalog } from "../lib/advisor/catalog";
import { opportunities } from "../lib/advisor/insights";
import { roleProfiles, type JobMarket } from "../lib/advisor/jobs";
import { buildPlan } from "../lib/advisor/planner";
import { parsePrereq } from "../lib/advisor/prereq";
import { detectRole, detectSkills } from "../lib/advisor/skills";
import type { Catalog } from "../lib/advisor/types";

const raw = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "catalog", "citytech.json"), "utf8"),
) as Catalog;
const catalog = enrich(raw);

const posting = (id: string, title: string, skills: string[]) => ({
  id,
  title,
  employer: "Agency",
  category: "",
  level: "",
  location: "",
  salaryFrom: 80000,
  salaryTo: 100000,
  salaryFrequency: "Annual",
  postedAt: "2026-11-01",
  url: "",
  skills,
  roleId: detectRole(title),
});
const market: JobMarket = {
  source: "test",
  sourceUrl: "",
  live: false,
  fetchedAt: "2026-11-01T00:00:00Z",
  postings: [
    posting("1", "Data Analyst", ["sql", "python", "data-viz"]),
    posting("2", "Data Scientist", ["python", "machine-learning", "sql"]),
    posting("3", "Senior Data Analyst", ["python", "risk-compliance", "data-viz"]),
    posting("4", "Security Analyst", ["cybersecurity", "risk-compliance"]),
  ],
};

describe("prerequisite parsing", () => {
  it("reads the catalog's several house styles", () => {
    expect(parsePrereq("PRE: CST 3503 OR CST 3513").groups).toEqual([["CST 3503", "CST 3513"]]);
    expect(parsePrereq("PRE_CST1201_CST1204").groups).toEqual([["CST 1201"], ["CST 1204"]]);
    expect(parsePrereq("PRE: CST 1100 & 1101").groups).toEqual([["CST 1100"], ["CST 1101"]]);
    expect(parsePrereq("PRE: CST3507 & (2405 or 2415)").groups).toEqual([
      ["CST 3507"],
      ["CST 2405", "CST 2415"],
    ]);
    expect(parsePrereq("PRE:CST 3502, CST3650,& MAT2572").groups).toEqual([
      ["CST 3502"],
      ["CST 3650"],
      ["MAT 2572"],
    ]);
  });
  it("separates corequisites and flags what it cannot model", () => {
    const p = parsePrereq("Prerequisite: CST1201 & CST 1204 Pre/Corequisite: MAT 1375");
    expect(p.groups).toEqual([["CST 1201"], ["CST 1204"]]);
    expect(p.coreqs).toEqual(["MAT 1375"]);
    expect(parsePrereq("PRE: THREE CST 35XX LEVEL COURSES OR HIGHER").needsReview).toBe(true);
    expect(parsePrereq("").groups).toEqual([]);
  });
});

describe("skills", () => {
  it("tags text and titles", () => {
    expect(detectSkills("Machine Learning Fundamentals")).toContain("machine-learning");
    expect(detectSkills("Structured Query Language (SQL)")).toContain("sql");
    expect(detectRole("Senior DevOps Engineer, Infrastructure")).toBe("cloud-devops");
  });
});

describe("planner", () => {
  const roles = roleProfiles(market);
  const plan = buildPlan(catalog, roles, { programId: "DSCI-BS", goalRoleId: "data-scientist", startTerm: "Fall 2027" });
  const termOf = new Map<string, number>();
  for (const t of plan.terms) for (const i of t.items) if (i.kind !== "gened") termOf.set(i.code, t.index);

  it("schedules every required course exactly once", () => {
    const major = raw.programs[0].requirements.find((r) => r.id === "major");
    for (const code of major && "courses" in major ? major.courses : []) expect(termOf.has(code)).toBe(true);
    expect(plan.terms[0].label).toBe("Fall 2027");
  });
  it("never places a course before its prerequisites", () => {
    for (const [code, term] of termOf) {
      for (const group of catalog.byCode.get(code)!.prereq.groups) {
        const planned = group.filter((g) => termOf.has(g));
        if (planned.length) expect(Math.min(...planned.map((g) => termOf.get(g)!))).toBeLessThan(term);
      }
    }
  });
  it("respects the credit cap and skips completed courses", () => {
    for (const t of plan.terms) expect(t.credits).toBeLessThanOrEqual(16);
    const later = buildPlan(catalog, roles, { programId: "DSCI-BS", completed: ["cst1100", "CST 1101"] });
    const codes = later.terms.flatMap((t) => t.items.map((i) => i.code));
    expect(codes).not.toContain("CST 1100");
    expect(later.remainingCredits).toBeLessThan(plan.remainingCredits);
  });
  it("flags electives and reports coverage for the goal role", () => {
    const electives = plan.terms.flatMap((t) => t.items).filter((i) => i.kind === "elective");
    expect(electives.length).toBeGreaterThan(0);
    for (const e of electives) expect(e.flag).toMatch(/advisor/);
    expect(plan.coverage.map((c) => c.id)).toContain("sql");
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
  it("rejects an unknown program", () => {
    expect(() => buildPlan(catalog, roles, { programId: "NOPE" })).toThrow(/Unknown program/);
  });
});

describe("opportunities and import validation", () => {
  it("surfaces in-demand skills no course teaches", () => {
    const gaps = opportunities(market, catalog).filter((o) => o.kind === "gap").map((o) => o.skillId);
    expect(gaps).toContain("python");
  });
  it("validates a catalog file", () => {
    expect(validateCatalog(raw)).toEqual([]);
    expect(validateCatalog({ institution: "X", courses: [], programs: [] }).length).toBeGreaterThan(0);
  });
});

describe("courses whose prerequisites were not loaded", () => {
  it("are kept in number order, one per term within a subject", () => {
    const plan = buildPlan(catalog, [], { programId: "DSCI-BS" });
    const term = (code: string) => plan.terms.find((t) => t.items.some((i) => i.code === code))!.index;
    expect(term("MAT 1475")).toBeLessThan(term("MAT 1575"));
    expect(term("MAT 1575")).toBeLessThan(term("MAT 2440"));
    expect(term("MAT 1475")).toBe(1);
  });
});
