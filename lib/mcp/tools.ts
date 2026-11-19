/**
 * The advisor agent's tools — how it reads the catalog and the job market and
 * proposes pathways instead of answering from memory. Read-only on purpose:
 * the agent proposes, the student submits from the app, an advisor approves.
 * Results are small JSON documents the model can quote back.
 */
import { loadCatalog, publicCourse } from "../advisor/catalog";
import { opportunities } from "../advisor/insights";
import { loadJobMarket, roleProfiles, skillDemand } from "../advisor/jobs";
import { buildPlan } from "../advisor/planner";
import { skillName } from "../advisor/skills";
import { McpServer, type ToolDefinition } from "./protocol";

export interface ToolContext {
  org: string;
  /** Public origin of this app, for links back to the pathway builder. */
  appUrl: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const pct = (n: number) => Math.round(n * 100);

export const ADVISOR_TOOLS: ToolDefinition<ToolContext>[] = [
  {
    name: "list_programs",
    description:
      "List the degree programs in the loaded college catalog with their id, degree, credits and catalog coverage note. Call this first when a student has not named a program.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    handler: async () => {
      const cat = loadCatalog();
      return {
        institution: cat.institution,
        catalog: cat.catalog,
        coverage: cat.coverage,
        programs: cat.programs.map((p) => ({
          id: p.id,
          name: p.name,
          degree: p.degree,
          total_credits: p.totalCredits,
          department: p.department,
        })),
      };
    },
  },
  {
    name: "get_program_requirements",
    description:
      "The full requirements of one program: required courses, choose-one groups, elective slots, general education and graduation rules. Use the program id from list_programs.",
    inputSchema: {
      type: "object",
      properties: { program_id: { type: "string", description: "e.g. DSCI-BS" } },
      required: ["program_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    handler: async (a) => {
      const cat = loadCatalog();
      const p = cat.programs.find((x) => x.id.toLowerCase() === str(a.program_id).toLowerCase());
      if (!p) throw new Error(`No program "${str(a.program_id)}". Call list_programs.`);
      return {
        ...p,
        requirements: p.requirements.map((r) => ({
          ...r,
          ...("courses" in r && {
            courses: r.courses.map((c) => {
              const k = cat.byCode.get(c);
              return k ? `${k.code} — ${k.title} (${k.credits} cr)` : c;
            }),
          }),
        })),
      };
    },
  },
  {
    name: "search_courses",
    description:
      "Search catalog courses by code, title words, subject (e.g. CST) or a skill name. Returns code, title, credits, the catalog's own prerequisite text and the skills each course builds.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words, a course code, or a skill such as 'machine learning'" },
        subject: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    handler: async (a) => {
      const cat = loadCatalog();
      const q = str(a.query).toLowerCase();
      const subject = str(a.subject).toUpperCase();
      const limit = Math.min(40, Math.max(1, typeof a.limit === "number" ? a.limit : 15));
      const hits = cat.courses.filter(
        (c) =>
          (!subject || c.subject === subject) &&
          (!q ||
            `${c.code} ${c.title} ${c.description} ${c.skills.map(skillName).join(" ")}`
              .toLowerCase()
              .includes(q)),
      );
      return {
        total: hits.length,
        courses: hits.slice(0, limit).map((c) => ({
          code: c.code,
          title: c.title,
          credits: c.credits,
          prerequisites: c.prereqText || (c.prereqCaptured === false ? "not loaded" : "none listed"),
          skills: c.skills.map(skillName),
        })),
      };
    },
  },
  {
    name: "get_course",
    description: "Everything the catalog says about one course, by code (e.g. 'CST 3650').",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string" } },
      required: ["code"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    handler: async (a) => {
      const cat = loadCatalog();
      const code = str(a.code).toUpperCase().replace(/^([A-Z]{2,5})\s*(\d)/, "$1 $2");
      const c = cat.byCode.get(code);
      if (!c) throw new Error(`No course "${code}" in the loaded catalog.`);
      const unlocks = cat.courses.filter((x) => x.prereq.groups.some((g) => g.includes(c.code))).map((x) => x.code);
      return { ...publicCourse(c), skills: c.skills.map(skillName), unlocks };
    },
  },
  {
    name: "job_market_roles",
    description:
      "Target roles seen in current job postings, with posting counts, median salary and the skills each role asks for most. Use it to help a student choose a goal role or to explain why a course matters.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async () => {
      const market = await loadJobMarket();
      return {
        source: market.source,
        live: market.live,
        as_of: market.fetchedAt.slice(0, 10),
        postings: market.postings.length,
        roles: roleProfiles(market).map((r) => ({
          id: r.id,
          name: r.name,
          postings: r.postings,
          median_salary: r.medianSalary,
          top_skills: r.skills.slice(0, 8).map((s) => `${s.name} (${pct(s.share)}%)`),
        })),
      };
    },
  },
  {
    name: "search_job_postings",
    description: "Current job postings filtered by role id and/or words in the title. Returns title, employer, salary range and skills.",
    inputSchema: {
      type: "object",
      properties: { role_id: { type: "string" }, query: { type: "string" }, limit: { type: "number" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async (a) => {
      const market = await loadJobMarket();
      const q = str(a.query).toLowerCase();
      const role = str(a.role_id);
      const hits = market.postings.filter(
        (p) => (!role || p.roleId === role) && (!q || p.title.toLowerCase().includes(q)),
      );
      return {
        total: hits.length,
        postings: hits.slice(0, Math.min(25, typeof a.limit === "number" ? a.limit : 10)).map((p) => ({
          title: p.title,
          employer: p.employer,
          salary: p.salaryFrom && p.salaryTo ? `$${p.salaryFrom}–$${p.salaryTo} ${p.salaryFrequency}` : null,
          posted: p.postedAt,
          skills: p.skills.map(skillName),
          url: p.url,
        })),
      };
    },
  },
  {
    name: "build_pathway",
    description:
      "Propose a term-by-term pathway to finish a program: remaining courses in prerequisite order, electives chosen by job-market demand for the goal role, skill coverage, gaps, and the checks an advisor must make. It is a PROPOSAL — tell the student to open the Pathway page to save it and submit it for advisor approval.",
    inputSchema: {
      type: "object",
      properties: {
        program_id: { type: "string" },
        completed_courses: { type: "array", items: { type: "string" }, description: "Course codes already passed" },
        goal_role_id: { type: "string", description: "A role id from job_market_roles" },
        credits_per_term: { type: "number" },
        start_term: { type: "string", description: "e.g. 'Fall 2027'" },
        gen_ed_completed: { type: "number", description: "How many general-education courses are done" },
      },
      required: ["program_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    handler: async (a, ctx) => {
      const plan = buildPlan(loadCatalog(), roleProfiles(await loadJobMarket()), {
        programId: str(a.program_id),
        completed: Array.isArray(a.completed_courses) ? a.completed_courses.map(String) : [],
        goalRoleId: str(a.goal_role_id) || null,
        creditsPerTerm: typeof a.credits_per_term === "number" ? a.credits_per_term : undefined,
        startTerm: str(a.start_term) || undefined,
        genEdCompleted: typeof a.gen_ed_completed === "number" ? a.gen_ed_completed : undefined,
      });
      return {
        program: plan.programName,
        goal_role: plan.goalRoleName,
        remaining_credits: plan.remainingCredits,
        terms: plan.terms.map((t) => ({
          term: t.label,
          credits: t.credits,
          courses: t.items.map((i) => ({
            course: i.code === "GEN ED" ? i.title : `${i.code} — ${i.title}`,
            credits: i.credits,
            kind: i.kind,
            why: i.reason,
            ...(i.flag && { advisor_check: i.flag }),
          })),
        })),
        skills_covered: plan.coverage.map((c) => `${c.name} (${pct(c.share)}% of postings) via ${c.courses.join(", ")}`),
        skills_not_covered: plan.gaps.map((g) => `${g.name} (${pct(g.share)}% of postings)`),
        advisor_checks: plan.warnings,
        status: "proposal — not approved",
        next_step: `Open ${ctx.appUrl}/platform/${encodeURIComponent(ctx.org)}/pathway to save this plan and submit it for advisor approval.`,
      };
    },
  },
  {
    name: "skill_opportunities",
    description:
      "Skills employers ask for that the loaded curriculum does not teach, or teaches in a single course — candidates for a microcredential or workshop. For students: what to learn beyond the degree. For administrators: what to develop.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    handler: async (a) => {
      const market = await loadJobMarket();
      const cat = loadCatalog();
      return {
        basis: `${market.postings.length} postings vs ${cat.courses.length} loaded courses. ${cat.coverage}`,
        opportunities: opportunities(market, cat)
          .slice(0, Math.min(20, typeof a.limit === "number" ? a.limit : 10))
          .map((o) => ({ title: o.title, format: o.format, kind: o.kind, why: o.rationale, employers: o.sampleEmployers })),
        top_demand: skillDemand(market, cat)
          .slice(0, 10)
          .map((d) => `${d.name}: ${d.postings} postings, ${d.courses.length} courses`),
      };
    },
  },
];

export function createAdvisorServer() {
  const server = new McpServer<ToolContext>({
    name: "academic-pathways-advisor",
    version: "0.1.0",
    title: "Academic Pathways Advisor tools",
    instructions:
      "Catalog, job-market and pathway-planning tools. All read-only: pathways are proposals until an advisor approves them in the app.",
  });
  for (const t of ADVISOR_TOOLS) server.tool(t);
  return server;
}
