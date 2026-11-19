/**
 * The skills taxonomy — the bridge between the curriculum and the job market.
 * A skill is detected in free text (a course description, a job posting) by
 * its `match` phrases, so the same list tags both sides and makes them
 * comparable. `emerging` marks innovation-facing skills.
 *
 * This is the app's own working taxonomy, kept deliberately small and
 * readable: add a skill here and it shows up in course tags, role profiles,
 * pathway coverage and the opportunities report.
 */
import type { Role, Skill } from "./types";

export const SKILLS: Skill[] = [
  // Data & AI
  { id: "python", name: "Python", group: "Data & AI", match: ["python"] },
  { id: "sql", name: "SQL", group: "Data & AI", match: ["\\bsql\\b", "structured query language"] },
  {
    id: "databases",
    name: "Database design & administration",
    group: "Data & AI",
    match: ["database", "oracle", "postgres", "sql server", "data warehous"],
  },
  { id: "nosql", name: "NoSQL", group: "Data & AI", match: ["nosql", "non-relational", "mongodb"] },
  {
    id: "data-analysis",
    name: "Data analysis",
    group: "Data & AI",
    match: ["data analy", "analytics", "quantitative analysis", "data science"],
  },
  {
    id: "data-viz",
    name: "Data visualization",
    group: "Data & AI",
    match: ["visualiz", "tableau", "power bi", "dashboard"],
  },
  {
    id: "statistics",
    name: "Statistics",
    group: "Data & AI",
    match: ["statistic", "probability", "\\bsas\\b", "\\bspss\\b", "\\bstata\\b"],
  },
  {
    id: "machine-learning",
    name: "Machine learning",
    group: "Data & AI",
    emerging: true,
    match: ["machine learning", "machine-learning", "predictive model", "deep learning"],
  },
  {
    id: "data-mining",
    name: "Data mining",
    group: "Data & AI",
    match: ["data mining", "extracting knowledge from data"],
  },
  {
    id: "nlp",
    name: "Natural language processing",
    group: "Data & AI",
    emerging: true,
    match: ["natural language", "\\bnlp\\b", "information retrieval", "text mining"],
  },
  {
    id: "gen-ai",
    name: "Generative AI",
    group: "Data & AI",
    emerging: true,
    match: ["generative ai", "\\bllm", "large language model", "artificial intelligence", "\\bai\\b"],
  },
  {
    id: "responsible-ai",
    name: "Responsible AI & data ethics",
    group: "Data & AI",
    emerging: true,
    match: ["fairness", "ethic", "privacy", "data governance", "bias"],
  },
  {
    id: "data-engineering",
    name: "Data engineering",
    group: "Data & AI",
    emerging: true,
    match: ["\\betl\\b", "data pipeline", "data engineer", "data integration", "data management"],
  },
  { id: "gis", name: "GIS", group: "Data & AI", match: ["\\bgis\\b", "geospatial", "arcgis"] },
  // Software
  { id: "java", name: "Java", group: "Software", match: ["\\bjava\\b", "\\bjsp\\b", "servlet"] },
  { id: "cpp", name: "C / C++", group: "Software", match: ["c\\+\\+", "\\bc#", "\\.net"] },
  {
    id: "web-dev",
    name: "Web development",
    group: "Software",
    match: ["web program", "web application", "javascript", "html", "web site", "web development"],
  },
  {
    id: "mobile-dev",
    name: "Mobile development",
    group: "Software",
    match: ["mobile app", "android", "\\bios\\b", "mobile device programming"],
  },
  {
    id: "oop",
    name: "Object-oriented programming",
    group: "Software",
    match: ["object-oriented", "object oriented"],
  },
  {
    id: "algorithms",
    name: "Data structures & algorithms",
    group: "Software",
    match: ["data structure", "algorithm"],
  },
  {
    id: "software-engineering",
    name: "Software engineering (SDLC)",
    group: "Software",
    match: ["software development", "software engineer", "sdlc", "systems analysis", "application development"],
  },
  {
    id: "apis",
    name: "APIs & web services",
    group: "Software",
    match: ["\\bapi", "web service", "\\brest\\b", "microservice"],
  },
  {
    id: "devops",
    name: "DevOps & CI/CD",
    group: "Software",
    emerging: true,
    match: ["devops", "ci/cd", "continuous integration", "\\bgit\\b", "jenkins", "terraform"],
  },
  // Security
  {
    id: "cybersecurity",
    name: "Cybersecurity",
    group: "Security",
    emerging: true,
    match: ["cybersecurity", "cyber security", "information security", "computer security", "security issues"],
  },
  {
    id: "network-security",
    name: "Network security",
    group: "Security",
    match: ["network security", "firewall", "intrusion", "security technologies"],
  },
  {
    id: "pen-testing",
    name: "Penetration testing",
    group: "Security",
    emerging: true,
    match: ["penetration test", "vulnerabilit", "ethical hack"],
  },
  { id: "forensics", name: "Digital forensics", group: "Security", match: ["forensic"] },
  { id: "cryptography", name: "Cryptography", group: "Security", match: ["cryptograph", "encryption"] },
  {
    id: "cloud-security",
    name: "Cloud security",
    group: "Security",
    emerging: true,
    match: ["cloud security", "secure data, infrastructure"],
  },
  {
    id: "risk-compliance",
    name: "Risk & compliance",
    group: "Security",
    match: ["\\bnist\\b", "compliance", "risk assessment", "risk management", "\\baudit"],
  },
  // Infrastructure
  {
    id: "cloud",
    name: "Cloud platforms",
    group: "Infrastructure",
    emerging: true,
    match: ["cloud", "\\baws\\b", "azure", "\\bgcp\\b"],
  },
  {
    id: "networking",
    name: "Networking",
    group: "Infrastructure",
    match: ["networking", "\\blan\\b", "\\bwan\\b", "tcp/ip", "cisco", "interconnectivity", "network administration"],
  },
  {
    id: "linux",
    name: "Linux / UNIX administration",
    group: "Infrastructure",
    match: ["linux", "unix"],
  },
  {
    id: "windows-admin",
    name: "Windows administration",
    group: "Infrastructure",
    match: ["windows server", "active directory", "system administration \\(windows\\)", "microsoft 365"],
  },
  {
    id: "virtualization",
    name: "Virtualization & containers",
    group: "Infrastructure",
    emerging: true,
    match: ["virtualiz", "vmware", "docker", "kubernetes", "container"],
  },
  {
    id: "automation",
    name: "Scripting & automation",
    group: "Infrastructure",
    match: ["shell script", "powershell", "automation", "scripting"],
  },
  {
    id: "it-service",
    name: "IT service management",
    group: "Infrastructure",
    match: ["service management", "\\bitil\\b", "help desk", "service desk", "technical support"],
  },
  {
    id: "hpc",
    name: "High-performance computing",
    group: "Infrastructure",
    emerging: true,
    match: ["high performance computing", "parallel programming"],
  },
  // Professional
  {
    id: "project-management",
    name: "Project management",
    group: "Professional",
    match: ["project manag", "\\bpmp\\b", "agile", "scrum"],
  },
  {
    id: "tech-writing",
    name: "Technical documentation",
    group: "Professional",
    match: ["technical documentation", "technical writing", "documentation"],
  },
  {
    id: "business-analysis",
    name: "Business & systems analysis",
    group: "Professional",
    match: ["business analy", "requirements gathering", "business intelligence", "information systems"],
  },
];

/** Target roles, recognized from posting titles (first match wins, in order). */
export const ROLES: Role[] = [
  {
    id: "ai-ml",
    name: "AI / Machine Learning Engineer",
    match: ["machine learning", "\\bai\\b", "artificial intelligence", "\\bml\\b"],
    blurb: "Builds and ships models and AI-powered products.",
  },
  {
    id: "data-scientist",
    name: "Data Scientist / Analyst",
    match: ["data scien", "data analy", "analytics", "\\bdata\\b.*(analyst|specialist|manager)", "statistic", "\\bgis\\b", "business intelligence"],
    blurb: "Turns data into decisions: analysis, modeling, visualization.",
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity Analyst",
    match: ["security", "cyber", "\\bsoc\\b", "threat", "forensic"],
    blurb: "Protects systems and data; monitors, tests and responds.",
  },
  {
    id: "cloud-devops",
    name: "Cloud / DevOps Engineer",
    match: ["devops", "cloud", "site reliability", "infrastructure", "platform engineer"],
    blurb: "Runs cloud infrastructure and automates delivery.",
  },
  {
    id: "data-engineer",
    name: "Database / Data Engineer",
    match: ["database", "\\bdba\\b", "data engineer", "\\betl\\b", "data architect"],
    blurb: "Designs and operates databases and data pipelines.",
  },
  {
    id: "software-dev",
    name: "Software Developer",
    match: ["developer", "software", "programmer", "application", "full stack", "web"],
    blurb: "Designs and builds applications and services.",
  },
  {
    id: "network-sysadmin",
    name: "Network / Systems Administrator",
    match: ["network", "system administrator", "systems administrator", "sysadmin", "lan/wan", "telecom", "administrator"],
    blurb: "Keeps networks, servers and endpoints running.",
  },
  {
    id: "it-pm",
    name: "IT Project / Product Manager",
    match: ["project manager", "product manager", "program manager", "scrum", "business analyst", "project"],
    blurb: "Leads technology projects from requirements to delivery.",
  },
  {
    id: "it-support",
    name: "IT Support Specialist",
    match: ["support", "help desk", "service desk", "technician", "desktop"],
    blurb: "Supports users, devices and day-to-day IT operations.",
  },
];

const compiled = new Map<string, RegExp[]>();
function patterns(s: Skill): RegExp[] {
  let p = compiled.get(s.id);
  if (!p) {
    p = s.match.map((m) => new RegExp(m, "i"));
    compiled.set(s.id, p);
  }
  return p;
}

/** Skill ids detected in a piece of text. */
export function detectSkills(text: string): string[] {
  if (!text) return [];
  return SKILLS.filter((s) => patterns(s).some((re) => re.test(text))).map((s) => s.id);
}

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function skillName(id: string): string {
  return skillById(id)?.name ?? id;
}

/** The role a posting title belongs to, or null. */
export function detectRole(title: string): string | null {
  for (const r of ROLES) if (r.match.some((m) => new RegExp(m, "i").test(title))) return r.id;
  return null;
}
