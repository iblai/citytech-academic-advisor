/**
 * The Academic Pathways Advisor — the agent students and advisors talk to.
 * This module holds its identity (name, system prompt, suggested prompts,
 * skills, knowledge documents) and the idempotent setup that creates it on
 * the ibl.ai platform, gives it the catalog and job-market knowledge, points
 * it at this app's tool server when the app has a public https URL, and
 * records its id in the organization's metadata so every member's app finds it.
 *
 * Endpoints follow the vibe skills `iblai-api-agent-create`,
 * `iblai-api-agent-prompt`, `iblai-api-agent-skill`, `iblai-api-agent-dataset`,
 * `iblai-api-agent-mcp` and `iblai-api-org`. Server-only (acts with the
 * admin's session). Relative imports on purpose: vitest resolves no `@/` alias.
 */
import { platformFetch as rawPlatformFetch, PlatformError } from "../iblai/platform";
import { mergeAdvisorSettings, readAdvisorSettings, type AdvisorSettings } from "./org-settings";
import { invalidateOrgMetadata } from "./settings-server";
import { ADVISOR_TOOLS } from "../mcp/tools";
import { loadCatalog, type LoadedCatalog } from "./catalog";
import { loadJobMarket, roleProfiles, skillDemand, type JobMarket } from "./jobs";
import { opportunities } from "./insights";
import { skillName } from "./skills";

export const AGENT_NAME = "Academic Pathways Advisor";
/** The Platform API Token setup mints for the tools (names are unique per platform). */
const TOOLS_KEY = "advisor-tools";
const MCP_NAME = "Academic Pathways Advisor tools";
export const AGENT_DESCRIPTION =
  "Knows the college catalog and the job market: tells you which courses you still need, in what order, and which electives and credentials move you toward the career you want. Every pathway is checked by a human advisor.";

export const SUGGESTED_PROMPTS = [
  "What courses do I still need to graduate?",
  "Build me a term-by-term plan toward a data science career.",
  "Which electives are most in demand with employers right now?",
  "What can I take next semester given what I've finished?",
  "Which skills am I missing for a cybersecurity analyst role?",
  "Which microcredentials or workshops should we develop this year?",
];

/** Reusable instructions the agent carries as platform skills. */
export const AGENT_SKILLS = [
  {
    slug: "advisor-build-degree-pathway",
    name: "Build a degree pathway",
    category: "Advising",
    description: "Turn a student's program, completed courses and career goal into a term-by-term plan.",
    instruction: `When a student asks what to take or how to finish their degree:
1. Establish three facts before planning: their program, the course codes they have already passed, and the role they are aiming at. Ask for whichever is missing — one question at a time.
2. Read requirements from the catalog (tool get_program_requirements, or the catalog document). Never recite requirements from memory.
3. Sequence by prerequisites: a course appears only after every prerequisite. Put the courses that unlock the most later courses first. Aim for the credit load the student asks for (default 15).
4. Present the plan as one short list per term: course code, title, credits, and a few words on why. Mark electives and choose-one courses clearly.
5. Close with what an advisor must check (elective eligibility, prerequisites the catalog words loosely, general-education choices) and tell the student to open the Pathway page to save the plan and submit it for approval.`,
  },
  {
    slug: "advisor-career-skills-alignment",
    name: "Career and skills alignment",
    category: "Advising",
    description: "Connect courses to what current job postings ask for.",
    instruction: `When the question is about careers, jobs, salaries or which courses matter:
1. Ground every claim in the job-market data (tools job_market_roles and search_job_postings, or the job-market document). Name the source and its date.
2. For a target role, list the skills its postings ask for most, then map each skill to the catalog courses that build it.
3. Say plainly which in-demand skills the student's program does not cover, and point to the microcredentials or workshops that would close the gap.
4. Give ranges and counts as reported. Do not promise a job or a salary.`,
  },
  {
    slug: "advisor-human-in-the-loop",
    name: "Advisor review (human in the loop)",
    category: "Advising",
    description: "Pathways are proposals until a human advisor approves them.",
    instruction: `Every pathway you propose is a proposal, not an approved plan.
- Say so each time: "This is a proposed pathway — an advisor needs to approve it."
- Never tell a student they are cleared to register, that a substitution or waiver is granted, or that a course definitely satisfies a requirement when the catalog is ambiguous. Flag it for the advisor instead.
- When an advisor (administrator) is talking to you, help them review: summarize the student's plan, point out prerequisite risks, overloads and unverified electives, and draft a clear note back to the student.
- Student records are protected (FERPA). Discuss a student's plan only with that student or with advisors; never speculate about a student.`,
  },
  {
    slug: "advisor-microcredentials-workshops",
    name: "Microcredentials and workshops",
    category: "Curriculum",
    description: "Find skills worth developing into microcredentials or workshops.",
    instruction: `When asked what the college should develop, or what a student can add beyond the degree:
1. Compare demand (share of postings asking for a skill) with coverage (courses that teach it) using skill_opportunities or the job-market document.
2. Rank: skills in demand that no course teaches first, then skills taught by a single course, then well-covered emerging skills that deserve a visible, stackable credential.
3. For each, propose a format — a microcredential for a substantial skill, a workshop or short series for a tool or practice — with the evidence in one line and the employers asking for it.
4. State the limits of the evidence: which postings, which part of the catalog is loaded. These are proposals for an administrator to judge.`,
  },
] as const;

/** What the agent is told about itself. Kept readable: admins may edit it in the OS. */
export function systemPrompt(institutionName = "the college", catalog?: LoadedCatalog): string {
  const programs = (catalog?.programs ?? [])
    .map((p) => {
      const lines = p.requirements.map((r) => {
        if (r.type === "all") return `  - ${r.label}: ${r.courses.join(", ")}`;
        if (r.type === "choose") return `  - ${r.label}: choose ${r.count} of ${r.courses.join(", ")}`;
        if (r.type === "elective") return `  - ${r.label}: ${r.count} course(s)`;
        return `  - ${r.label}: ${r.count} course(s)`;
      });
      return `- ${p.name} (${p.degree}), id ${p.id}, ${p.totalCredits} credits\n${lines.join("\n")}`;
    })
    .join("\n");
  return `You are the Academic Pathways Advisor for ${institutionName}. Students talk to you to learn which courses they need, in what order, and which choices move them toward the careers and emerging fields they care about. Advisors and administrators talk to you to review students' pathways and to see where the curriculum and the job market diverge.

## What you are for
- Tell a student exactly what they still need to graduate and propose a term-by-term pathway that respects prerequisites.
- Connect the curriculum to the job market: which roles are hiring, which skills they ask for, which courses build those skills, and where innovation is heading.
- Point to skills worth adding beyond the degree — microcredentials, workshops — and, for administrators, which ones the college should develop.

## How to work
- Start from data, not memory. Use your tools when you have them; otherwise use your knowledge documents (the catalog and the job-market report). If neither holds the answer, say you do not have it — never invent a course, a prerequisite, a requirement or a statistic.
- Quote the catalog's own prerequisite wording when it matters, and say when it is ambiguous.
- Ask one short question when you are missing the program, the completed courses or the goal.
- Be concise and concrete: lead with the answer, then a short list. Course codes exactly as the catalog writes them (e.g. CST 3650).
- A human is always in the loop. Every pathway is a proposal until an advisor approves it in the app. Tell students to open the Pathway page to save a plan and submit it for review. Never say a student is cleared to register.
- Student records are protected (FERPA): discuss a plan only with that student or with advisors.
- You can only speak to the part of the catalog that is loaded${catalog ? `: ${catalog.coverage}` : "."} Say so when asked about anything else.
${programs ? `\n## Programs loaded\n${programs}\n` : ""}
## Tools you have (when this app is reachable from the platform)
${ADVISOR_TOOLS.map((t) => `- ${t.name}: ${t.description.split(". ")[0]}.`).join("\n")}`;
}

/** The catalog as a document the agent can retrieve from. */
export function catalogDocument(catalog: LoadedCatalog): string {
  const out = [
    `# ${catalog.institution} — catalog (${catalog.catalog})`,
    `Source: ${catalog.source} · read ${catalog.capturedAt}`,
    `Coverage: ${catalog.coverage}`,
    "",
    "## Programs",
  ];
  for (const p of catalog.programs) {
    out.push(`### ${p.name} — ${p.degree} (program id ${p.id}, ${p.totalCredits} credits)`, p.description, "");
    for (const r of p.requirements) {
      if (r.type === "all") {
        out.push(`**${r.label}** — complete all:`);
        for (const c of r.courses) {
          const k = catalog.byCode.get(c);
          out.push(`- ${c}${k ? ` — ${k.title} (${k.credits} cr)` : ""}`);
        }
      } else if (r.type === "choose") out.push(`**${r.label}** — choose ${r.count}: ${r.courses.join(" or ")}`);
      else out.push(`**${r.label}** — ${r.count} course(s)${r.note ? `. ${r.note}` : ""}`);
      out.push("");
    }
    out.push("Rules:", ...p.notes.map((n) => `- ${n}`), "");
  }
  out.push("## Courses");
  for (const c of catalog.courses) {
    out.push(
      `### ${c.code} — ${c.title} (${c.credits} credits)`,
      `Prerequisites: ${c.prereqText || (c.prereqCaptured === false ? "not loaded — check the catalog" : "none listed")}`,
      ...(c.skills.length ? [`Skills: ${c.skills.map(skillName).join(", ")}`] : []),
      ...(c.description ? [c.description] : []),
      "",
    );
  }
  return out.join("\n");
}

/** The job market as a document the agent can retrieve from. */
export function marketDocument(market: JobMarket, catalog: LoadedCatalog): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const out = [
    "# Job market report",
    `Source: ${market.source} (${market.sourceUrl})`,
    `As of ${market.fetchedAt.slice(0, 10)} · ${market.postings.length} postings`,
    "",
    "## Target roles",
  ];
  for (const r of roleProfiles(market))
    out.push(
      `### ${r.name} (role id ${r.id})`,
      `${r.postings} postings${r.medianSalary ? ` · median annual salary midpoint $${r.medianSalary.toLocaleString("en-US")}` : ""}`,
      `Skills asked for: ${r.skills.map((s) => `${s.name} (${pct(s.share)})`).join(", ")}`,
      "",
    );
  out.push("## Skill demand and the courses that teach each skill");
  for (const d of skillDemand(market, catalog).filter((x) => x.postings > 0))
    out.push(`- ${d.name}: ${d.postings} postings (${pct(d.share)}); courses: ${d.courses.join(", ") || "none loaded"}`);
  out.push("", "## Microcredential and workshop opportunities");
  for (const o of opportunities(market, catalog)) out.push(`- ${o.title} (${o.format}): ${o.rationale}`);
  return out.join("\n");
}

export interface SetupInput {
  org: string;
  /** Platform username whose authority the setup calls run under (an org admin). */
  username: string;
  /** Public origin of this app, e.g. https://advisor.example.edu */
  appUrl: string;
  /** The org admin's session (`Token …`); the platform enforces their rights. */
  authorization: string;
  institutionName?: string;
  log?: (line: string) => void;
}

export interface SetupResult {
  agentId: string;
  /** `null` when tools were not wired (no https app URL). */
  mcpServerId: number | null;
  toolsWired: boolean;
  skills: string[];
  knowledge: string[];
  created: { agent: boolean; mcpServer: boolean; connection: boolean };
}

type Fetch = <T>(path: string, init?: Parameters<typeof rawPlatformFetch>[2]) => Promise<T>;

type MentorSettings = {
  unique_id?: string;
  tool_slugs?: string[] | null;
  mcp_servers?: Array<number | { id: number }> | null;
  can_use_tools?: boolean;
  system_prompt?: string;
  [k: string]: unknown;
};

const enc = encodeURIComponent;

/** Mint the tools' key, replacing the previous one. The tools are read-only; the key only proves the caller is the platform. */
async function mintToolsKey(platformFetch: Fetch, org: string): Promise<string> {
  // The detail route has no trailing slash.
  const tokens = "/dm/api/core/platform/api-tokens/";
  try {
    await platformFetch(`${tokens}${TOOLS_KEY}?platform_key=${enc(org)}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof PlatformError && e.status === 404)) throw e;
  }
  const minted = await platformFetch<{ key?: string }>(tokens, {
    method: "POST",
    body: { name: TOOLS_KEY, platform_key: org },
  });
  if (!minted?.key) throw new Error("The platform did not return the tools' API key");
  return minted.key;
}

/**
 * Create (or re-sync) the advisor agent for an organization. Safe to run
 * repeatedly: an existing agent id in the org's metadata is reused, the
 * prompt is refreshed, the MCP server is matched by URL, the connection is
 * matched by server, and the agent's tool lists are merged, never replaced
 * blindly (see `iblai-api-agent-mcp` — those lists are replaced on write).
 */
export async function setupAdvisor(input: SetupInput): Promise<SetupResult> {
  const { org, username, log = () => {} } = input;
  const appUrl = input.appUrl.replace(/\/+$/, "");
  if (!/^https?:\/\//.test(appUrl)) throw new Error("appUrl must be an absolute http(s) origin");
  const canWireTools = appUrl.startsWith("https://");
  const platformFetch = <T>(path: string, init: Parameters<typeof rawPlatformFetch>[2] = {}) =>
    rawPlatformFetch<T>(path, input.authorization, init);
  const mentorBase = `/dm/api/ai-mentor/orgs/${enc(org)}/users/${enc(username)}`;
  const metaPath = `/dm/api/core/orgs/${enc(org)}/metadata/`;

  // 0. Current settings.
  const metaRes = await platformFetch<{ metadata?: Record<string, unknown> }>(metaPath);
  const metadata = metaRes?.metadata ?? {};
  const settings: AdvisorSettings = readAdvisorSettings(metadata);
  const created = { agent: false, mcpServer: false, connection: false };
  const catalog = loadCatalog();

  // 1. The agent.
  let agentId = settings.agentId ?? "";
  if (agentId) {
    try {
      await platformFetch(`${mentorBase}/mentors/${enc(agentId)}/settings/`);
      log(`Agent ${agentId} exists — reusing it.`);
    } catch (e) {
      if (e instanceof PlatformError && e.status === 404) {
        log(`Agent ${agentId} no longer exists — creating a new one.`);
        agentId = "";
      } else throw e;
    }
  }
  if (!agentId) {
    const agent = await platformFetch<{ unique_id: string }>(
      `${mentorBase}/mentor-with-settings/`,
      {
        method: "POST",
        body: {
          template_name: "ai-mentor",
          new_mentor_name: AGENT_NAME,
          display_name: AGENT_NAME,
          description: AGENT_DESCRIPTION,
          system_prompt: systemPrompt(input.institutionName, catalog),
        },
      },
    );
    agentId = agent.unique_id;
    created.agent = true;
    log(`Created agent ${agentId}.`);
  }

  // 2. Prompt + greeting (send only the changed keys).
  await platformFetch(`${mentorBase}/mentors/${enc(agentId)}/settings/`, {
    method: "PUT",
    body: { system_prompt: systemPrompt(input.institutionName, catalog) },
  });
  await platformFetch(`${mentorBase}/mentors/${enc(agentId)}/settings/`, {
    method: "PUT",
    body: { description: AGENT_DESCRIPTION },
  }).catch(() => undefined);

  // 3–5. The tool server — only once the platform can actually reach it.
  let serverId: number | null = null;
  if (!canWireTools) {
    log(
      `Tools not wired: ${appUrl} is not an https origin the platform can call. Set NEXT_PUBLIC_APP_URL and re-run setup.`,
    );
  } else {
    const serverUrl = `${appUrl}/api/mcp/${enc(org)}`;
    type McpServerRow = { id: number; url?: string; name?: string };
    const existing = await platformFetch<{ results?: McpServerRow[] } | McpServerRow[]>(
      `${mentorBase}/mcp-servers/?page_size=100&search=${enc(MCP_NAME)}`,
    );
    const rows = Array.isArray(existing) ? existing : (existing?.results ?? []);
    let server =
      rows.find((r) => r.url === serverUrl) ??
      (settings.mcpServerId ? rows.find((r) => r.id === settings.mcpServerId) : undefined);
    if (server && server.url !== serverUrl) {
      await platformFetch(`${mentorBase}/mcp-servers/${server.id}/`, {
        method: "PATCH",
        body: { url: serverUrl },
      });
      log(`Updated MCP server ${server.id} URL → ${serverUrl}.`);
    }
    if (!server) {
      server = await platformFetch<McpServerRow>(`${mentorBase}/mcp-servers/`, {
        method: "POST",
        body: {
          name: MCP_NAME,
          description:
            "Read-only catalog, job-market and pathway-planning tools of the Academic Pathways Advisor.",
          url: serverUrl,
          transport: "streamable_http",
          auth_type: "token",
          auth_scope: "platform",
          is_enabled: true,
          is_featured: false,
          clean_output: false,
        },
      });
      created.mcpServer = true;
      log(`Registered MCP server ${server.id} at ${serverUrl}.`);
    }

    // 4. The platform-scoped connection carrying the tools' key.
    type ConnRow = { id: number; server?: number | { id: number }; scope?: string };
    const conns = await platformFetch<{ results?: ConnRow[] } | ConnRow[]>(
      `${mentorBase}/mcp-server-connections/?page_size=100`,
    );
    const connRows = Array.isArray(conns) ? conns : (conns?.results ?? []);
    serverId = server.id;
    const conn = connRows.find(
      (c) =>
        (typeof c.server === "object" ? c.server?.id : c.server) === serverId &&
        (c.scope ?? "platform") === "platform",
    );
    // Minted right before the write.
    const key = await mintToolsKey(platformFetch, org);
    log(`Minted the tools' API key "${TOOLS_KEY}".`);
    if (conn) {
      await platformFetch(`${mentorBase}/mcp-server-connections/${conn.id}/`, {
        method: "PATCH",
        body: { credentials: key, authorization_scheme: "Bearer", is_active: true },
      });
      log(`Refreshed connection ${conn.id}.`);
    } else {
      await platformFetch(`${mentorBase}/mcp-server-connections/`, {
        method: "POST",
        body: {
          server: serverId,
          scope: "platform",
          auth_type: "token",
          credentials: key,
          authorization_scheme: "Bearer",
        },
      });
      created.connection = true;
      log("Created the platform-scoped connection.");
    }

    // 5. Wire the server onto the agent — merge, never replace.
    const current = await platformFetch<MentorSettings>(
      `${mentorBase}/mentors/${enc(agentId)}/settings/`,
    );
    const toolSlugs = new Set<string>(Array.isArray(current.tool_slugs) ? current.tool_slugs : []);
    // The platform catalogue's MCP tool; any other slug is refused with a 400.
    toolSlugs.add("mcp");
    const mcpIds = new Set<number>(
      (Array.isArray(current.mcp_servers) ? current.mcp_servers : [])
        .map((s) => (typeof s === "object" ? s.id : s))
        .filter((n) => Number.isFinite(n)),
    );
    mcpIds.add(serverId);
    await platformFetch(`${mentorBase}/mentors/${enc(agentId)}/settings/`, {
      method: "PUT",
      body: { tool_slugs: [...toolSlugs], mcp_servers: [...mcpIds], can_use_tools: true },
    });
    log(`Agent tools: ${[...toolSlugs].join(", ")}; MCP servers: ${[...mcpIds].join(", ")}.`);
  }

  // 6. Suggested prompts (best effort; the list endpoint may already have them).
  try {
    const list = await platformFetch<
      { results?: Array<{ prompt: string }> } | Array<{ prompt: string }>
    >(
      `/dm/api/search/orgs/${enc(org)}/users/${enc(username)}/prompts/?mentor=${enc(agentId)}&limit=50`,
    );
    const have = new Set((Array.isArray(list) ? list : (list?.results ?? [])).map((p) => p.prompt));
    for (const prompt of SUGGESTED_PROMPTS) {
      if (have.has(prompt)) continue;
      await platformFetch(`/dm/api/ai-prompt/orgs/${enc(org)}/users/${enc(username)}/prompt/`, {
        method: "POST",
        body: { prompt, category: "Advising", is_system: false, mentor: agentId, platform: org },
      });
    }
    log("Suggested prompts in place.");
  } catch (e) {
    log(`Suggested prompts skipped: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 6b. Skills: reusable instructions in the org's skill catalog, assigned to the agent.
  const skillIds: Record<string, string> = { ...settings.skillIds };
  try {
    type SkillRow = { id: number; unique_id: string; slug: string };
    type Assigned = { skill?: string | { unique_id?: string } };
    const orgBase = `/dm/api/ai-mentor/orgs/${enc(org)}`;
    const assignedRes = await platformFetch<{ results?: Assigned[] } | Assigned[]>(
      `${orgBase}/agents/${enc(agentId)}/skills/?limit=100`,
    );
    const assigned = new Set(
      (Array.isArray(assignedRes) ? assignedRes : (assignedRes?.results ?? [])).map((a) =>
        typeof a.skill === "object" ? a.skill?.unique_id : a.skill,
      ),
    );
    for (const sk of AGENT_SKILLS) {
      const found = await platformFetch<{ results?: SkillRow[] } | SkillRow[]>(
        `${orgBase}/agent-skills/?search=${enc(sk.slug)}&limit=20`,
      );
      let row = (Array.isArray(found) ? found : (found?.results ?? [])).find((r) => r.slug === sk.slug);
      const body = { name: sk.name, slug: sk.slug, description: sk.description, category: sk.category, instruction: sk.instruction, version: "1.0.0", enabled: true };
      if (row) await platformFetch(`${orgBase}/agent-skills/${row.id}/`, { method: "PATCH", body });
      else row = await platformFetch<SkillRow>(`${orgBase}/agent-skills/`, { method: "POST", body });
      skillIds[sk.slug] = row.unique_id;
      if (!assigned.has(row.unique_id))
        await platformFetch(`${orgBase}/agents/${enc(agentId)}/skills/`, {
          method: "POST",
          body: { skill: row.unique_id, enabled: true },
        });
    }
    log(`Skills in place: ${AGENT_SKILLS.map((s) => s.name).join("; ")}.`);
  } catch (e) {
    log(`Skills skipped: ${e instanceof Error ? e.message : String(e)} ${e instanceof PlatformError ? JSON.stringify(e.body).slice(0, 200) : ""}`);
  }

  // 6c. Knowledge: the catalog and the job-market report as training documents,
  // so the agent can answer from them even where the tool server is unreachable.
  const knowledge: string[] = [];
  try {
    const market = await loadJobMarket();
    const docs = [
      { name: "college-catalog.md", text: catalogDocument(catalog) },
      { name: "job-market-report.md", text: marketDocument(market, catalog) },
    ];
    const listed = await platformFetch<{ results?: Array<{ document_name?: string; name?: string }> }>(
      `/dm/api/ai-index/orgs/${enc(org)}/users/${enc(username)}/documents/pathways/${enc(agentId)}/?limit=50&offset=0`,
    ).catch(() => ({ results: [] }));
    const have = new Set((listed?.results ?? []).map((d) => d.document_name ?? d.name ?? ""));
    for (const doc of docs) {
      if ([...have].some((n) => n.includes(doc.name))) {
        knowledge.push(doc.name);
        continue;
      }
      // Multipart written by hand: the body is plain text, and this does not
      // depend on which FormData implementation the server runtime hands us.
      const boundary = `----advisor${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      const part = (name: string, value: string) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
      const body =
        part("type", "file") +
        part("pathway", agentId) +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${doc.name}"\r\nContent-Type: text/markdown\r\n\r\n${doc.text}\r\n--${boundary}--\r\n`;
      await platformFetch(`/dm/api/ai-index/orgs/${enc(org)}/users/${enc(username)}/documents/train/`, {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body,
      });
      knowledge.push(doc.name);
      log(`Uploaded ${doc.name} (${Math.round(doc.text.length / 1024)} KB) as agent knowledge.`);
    }
  } catch (e) {
    log(`Knowledge upload skipped: ${e instanceof Error ? e.message : String(e)} ${e instanceof PlatformError ? JSON.stringify(e.body).slice(0, 200) : ""}`);
  }

  // 7. Remember the ids where every member's app can read them.
  const latest = await platformFetch<{ metadata?: Record<string, unknown> }>(metaPath);
  const merged = mergeAdvisorSettings(latest?.metadata ?? {}, {
    agentId,
    ...(serverId !== null && { mcpServerId: serverId }),
    skillIds,
    knowledge,
    setupCompletedAt: new Date().toISOString(),
    ...(input.institutionName && { institutionName: input.institutionName }),
  });
  await platformFetch(metaPath, { method: "PUT", body: { metadata: merged } });
  invalidateOrgMetadata(org);
  log("Saved the agent id to the organization's metadata.");

  return {
    agentId,
    mcpServerId: serverId,
    toolsWired: serverId !== null,
    skills: Object.keys(skillIds),
    knowledge,
    created,
  };
}
