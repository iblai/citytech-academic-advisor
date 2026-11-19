/**
 * The advisor's domain model: the college catalog (courses, programs), the
 * job market (postings, roles), the skills that connect them, and the
 * pathways students build and advisors validate. Pure types — shared by the
 * server libs, the route handlers, the agent's tools and the screens.
 */

export interface Course {
  code: string;
  title: string;
  credits: number;
  subject: string;
  department: string;
  description: string;
  liberalArts?: boolean;
  writingIntensive?: boolean;
  /** The catalog's own requisite wording, shown verbatim to advisors. */
  prereqText: string;
  /** `false` when the catalog page for this course was not read. */
  prereqCaptured?: boolean;
}

export type Requirement =
  | { id: string; label: string; type: "all"; courses: string[]; note?: string }
  | { id: string; label: string; type: "choose"; count: number; courses: string[]; note?: string }
  | {
      id: string;
      label: string;
      type: "elective";
      count: number;
      credits: number;
      subjects: string[];
      minLevel: number;
      note?: string;
    }
  | { id: string; label: string; type: "gened"; count: number; credits: number; note?: string };

export interface Program {
  id: string;
  name: string;
  degree: string;
  department: string;
  totalCredits: number;
  catalogUrl?: string;
  description: string;
  notes: string[];
  requirements: Requirement[];
}

export interface Catalog {
  institution: string;
  catalog: string;
  source: string;
  capturedAt: string;
  coverage: string;
  courses: Course[];
  programs: Program[];
}

export interface Skill {
  id: string;
  name: string;
  group: "Data & AI" | "Software" | "Security" | "Infrastructure" | "Professional";
  /** Emerging, innovation-facing skill — weighted up when ranking electives. */
  emerging?: boolean;
  /** Lower-cased phrases / regex sources that signal the skill in free text. */
  match: string[];
}

export interface JobPosting {
  id: string;
  title: string;
  employer: string;
  category: string;
  level: string;
  location: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryFrequency: string;
  postedAt: string;
  url: string;
  skills: string[];
  roleId: string | null;
}

export interface Role {
  id: string;
  name: string;
  /** Regex sources matched against posting titles. */
  match: string[];
  blurb: string;
}

export interface RoleProfile extends Role {
  postings: number;
  medianSalary: number | null;
  /** Skills ranked by the share of this role's postings that ask for them. */
  skills: { id: string; name: string; share: number; emerging: boolean }[];
}

export interface SkillDemand {
  id: string;
  name: string;
  group: Skill["group"];
  emerging: boolean;
  postings: number;
  share: number;
  /** Catalog courses that teach it. */
  courses: string[];
}

export type PlanItemKind = "required" | "choice" | "elective" | "gened";

export interface PlanItem {
  code: string;
  title: string;
  credits: number;
  kind: PlanItemKind;
  requirementId: string;
  /** Why this course is here, in a sentence a student can read. */
  reason: string;
  skills: string[];
  prereqText?: string;
  /** Something an advisor should look at before approving. */
  flag?: string;
}

export interface PlanTerm {
  index: number;
  label: string;
  credits: number;
  items: PlanItem[];
}

export interface Plan {
  programId: string;
  programName: string;
  goalRoleId: string | null;
  goalRoleName: string | null;
  completed: string[];
  creditsPerTerm: number;
  terms: PlanTerm[];
  totalCredits: number;
  remainingCredits: number;
  /** How the plan's courses cover the goal role's skills. */
  coverage: { id: string; name: string; share: number; emerging: boolean; courses: string[] }[];
  /** Goal-role skills no course in the plan teaches. */
  gaps: { id: string; name: string; share: number; emerging: boolean }[];
  /** Checks an advisor must make; the reason a human signs off. */
  warnings: string[];
}

export type PathwayStatus = "draft" | "submitted" | "approved" | "changes_requested";

export interface PathwayReview {
  by: string;
  at: string;
  decision: "approved" | "changes_requested" | "comment";
  note: string;
}

export interface Pathway {
  id: string;
  org: string;
  student: string;
  studentName: string;
  status: PathwayStatus;
  plan: Plan;
  studentNote: string;
  reviews: PathwayReview[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface Opportunity {
  skillId: string;
  skill: string;
  group: Skill["group"];
  emerging: boolean;
  postings: number;
  share: number;
  coveredBy: string[];
  /** `gap` = no course teaches it; `thin` = one course; `reinforce` = taught, high demand. */
  kind: "gap" | "thin" | "reinforce";
  format: "Microcredential" | "Workshop" | "Workshop series";
  title: string;
  rationale: string;
  sampleEmployers: string[];
}
