# Academic Pathways Advisor

An advising app on the [ibl.ai](https://ibl.ai) platform. It reads a college catalog,
tells students which courses they still need and in what order, lines those choices up
with what employers are hiring for, and puts a human advisor's approval between a
proposed pathway and a student acting on it.

Built with the [iblai/vibe](https://github.com/iblai/vibe) toolkit, on the shell and UX
of [iblai/recruit](https://github.com/iblai/recruit), with the multi-organization
sign-in of [iblai/os](https://github.com/iblai/os). The bundled data is for New York
City College of Technology (City Tech, CUNY).

## What it does

| Screen | Who | What |
| --- | --- | --- |
| **Advisor** (home) | everyone | A conversation with the Pathways Advisor agent, with your pathway's status (students) or the review queue (advisors) beside it |
| **My pathway** | students | Pick a program, tick completed courses, choose a career goal → a term-by-term plan in prerequisite order → save and submit for review |
| **Catalog** | everyone | Programs and their requirements; every course with the catalog's own prerequisite wording and the skills it builds |
| **Careers & skills** | everyone | Live job postings grouped into target roles, the skills each role asks for, and which courses teach them |
| **Review queue** | advisors | Submitted pathways; approve, request changes, or comment. Nothing is approved without a person |
| **Opportunities** | advisors | Skills in demand that the curriculum does not teach, or teaches once — candidates for microcredentials and workshops |
| **Settings** | advisors | One-click agent setup; catalog import |

Advisors are the organization's admins on the platform. The User / Admin switch in the
top bar lets an advisor see the app as a student does.

## How the agent works

The Pathways Advisor is an ordinary ibl.ai agent that this app creates and equips. The
app never runs a model itself: the chat on the home page is the platform's own `Chat`
component from `@iblai/iblai-js`, talking to that agent.

```
 student / advisor
        │  chat (SDK <Chat>, over the platform's websocket)
        ▼
 ┌─────────────────────────── ibl.ai platform ───────────────────────────┐
 │  Academic Pathways Advisor (agent)                                    │
 │   ├─ system prompt        who it is, how to work, the loaded programs │
 │   ├─ 4 skills             reusable instructions (below)               │
 │   ├─ 2 knowledge docs     college-catalog.md, job-market-report.md    │
 │   ├─ suggested prompts    6 conversation starters                     │
 │   └─ MCP connection ──────────────┐  only when the app is on https    │
 └───────────────────────────────────┼───────────────────────────────────┘
                                     ▼
 ┌──────────────────────────── this app ─────────────────────────────────┐
 │  /api/mcp/<org>   tool server (read-only)                             │
 │        │                                                              │
 │        ├─ catalog.ts   data/catalog/<id>.json + skills + prerequisites│
 │        ├─ jobs.ts      NYC Open Data postings → roles, skill demand   │
 │        ├─ planner.ts   term-by-term pathway                           │
 │        └─ insights.ts  demand vs. coverage → opportunities            │
 │                                                                       │
 │  /api/advisor/<org>/…   the same libraries, for the screens           │
 │  pathway-store.ts       draft → submitted → approved / changes        │
 └───────────────────────────────────────────────────────────────────────┘
```

### 1. Setup creates it

An advisor clicks **Set up the Pathways Advisor** in Settings. `POST /api/admin/agent`
runs `setupAdvisor()` in [`lib/advisor/agent.ts`](lib/advisor/agent.ts) with the
advisor's own session, so the platform enforces their rights. It is idempotent — run
it again after changing the catalog or the prompt:

1. **Agent** — creates "Academic Pathways Advisor" (or reuses the id saved in the
   organization's metadata) and writes its system prompt and description.
2. **Tool server** — only if `NEXT_PUBLIC_APP_URL` is a public `https` origin: registers
   `<app>/api/mcp/<org>` as an MCP server, mints a platform API key named `advisor-tools`
   for the connection, and adds the server to the agent's tools.
3. **Suggested prompts** — six starters ("What courses do I still need to graduate?" …).
4. **Skills** — four entries in the organization's skill catalog, assigned to the agent.
5. **Knowledge** — renders the loaded catalog and a job-market report to Markdown and
   uploads both as training documents.
6. **Remembers** the agent id, skill ids and document names under
   `metadata.apps.advisor` in the organization's metadata, where every member's app
   reads it.

### 2. What it is told

The **system prompt** (`systemPrompt()` in `agent.ts`) sets three rules that shape every
answer:

- *Start from data, not memory.* Use the tools when present, otherwise the knowledge
  documents; if neither has the answer, say so. Never invent a course, a prerequisite,
  a requirement or a statistic. Quote the catalog's prerequisite wording.
- *A human is always in the loop.* Every pathway is a proposal until an advisor approves
  it in the app. Never tell a student they are cleared to register.
- *Know your limits.* It carries the catalog's coverage note and says so when asked
  about anything not loaded.

The prompt also lists each loaded program's requirement groups, so the basics are
always in context.

The **skills** are longer, situational instructions the platform attaches to the agent:

| Skill | When it applies | What it makes the agent do |
| --- | --- | --- |
| Build a degree pathway | "what should I take", "how do I finish" | Get program, completed courses and goal first; sequence by prerequisites; one short list per term; end with what an advisor must check |
| Career and skills alignment | careers, jobs, salaries | Ground claims in the job data and name its source and date; map a role's skills to courses; name the gaps; promise nothing |
| Advisor review (human in the loop) | always | Label proposals as proposals; never grant waivers or substitutions; help advisors review and draft notes; respect FERPA |
| Microcredentials and workshops | "what should we develop" | Compare demand with coverage; rank gaps, then single-course skills, then emerging skills; propose a format with evidence and limits |

### 3. What it knows

Two **knowledge documents**, retrieved by the platform when relevant:

- `college-catalog.md` — every loaded program with its requirement groups and rules, and
  every course with credits, the verbatim prerequisite text and skill tags.
- `job-market-report.md` — target roles with posting counts, median salary and top
  skills; demand per skill with the courses that teach it; the opportunities list.

These are what the agent answers from when the tool server is unreachable — which is
always the case on `localhost`. They are a snapshot from the last setup run.

### 4. What it can do (tools)

When the app is deployed on https, the agent calls eight read-only tools on
[`/api/mcp/<org>`](app/api/mcp/%5BtenantKey%5D/route.ts), defined in
[`lib/mcp/tools.ts`](lib/mcp/tools.ts). They run the same code as the screens, so the
agent and the app can never disagree:

| Tool | Returns |
| --- | --- |
| `list_programs` | Programs in the loaded catalog, and the coverage note |
| `get_program_requirements` | One program's requirement groups and graduation rules |
| `search_courses` | Courses by code, words, subject or skill |
| `get_course` | One course: description, requisites, skills, what it unlocks |
| `job_market_roles` | Roles in current postings with counts, salary and top skills |
| `search_job_postings` | Postings by role or title words |
| `build_pathway` | A term-by-term proposal, skill coverage, gaps and advisor checks |
| `skill_opportunities` | In-demand skills the curriculum misses or covers thinly |

The route accepts a call only if the bearer key the platform presents verifies against
the platform. There are no write tools by design: the agent proposes, the student
submits from the app, an advisor decides.

### 5. How a pathway is built

`buildPlan()` in [`lib/advisor/planner.ts`](lib/advisor/planner.ts) is deterministic —
no model involved:

1. **What is left** — required courses not yet completed; for "choose one" groups, the
   option most relevant to the goal role; for elective slots, eligible courses ranked by
   how often the goal role's postings ask for the skills they build, with emerging
   skills weighted up. Every elective pick is flagged for an advisor to confirm.
2. **Order** — a course is placed only after its prerequisites. Courses that unlock the
   most later work go first; general education is spread across terms.
3. **Report** — skills covered for the goal role, skills not covered, and a list of
   checks: prerequisites the catalog words loosely, courses whose prerequisites were not
   loaded, placeholder gen-ed slots.

Prerequisites come from the catalog's free text ("PRE: CST 3503 OR CST 3513",
"PRE_CST1201_CST1204", "CST3507 & (2405 or 2415)") parsed by
[`lib/advisor/prereq.ts`](lib/advisor/prereq.ts) into AND-of-OR groups. What the parser
cannot model is flagged rather than guessed, and the original wording is always shown.

### 6. The human in the loop

```
 draft ──submit──▶ submitted ──approve──────────▶ approved
   ▲                   │                             │
   │                   └──request changes──▶ changes_requested
   └────────────── student edits and saves ◀─────────┘
```

Only an advisor's decision moves a pathway to `approved`, and the server checks with the
platform that the caller administers the organization
([`lib/advisor/access.ts`](lib/advisor/access.ts)) — a role claimed by the browser is
never trusted. Requesting changes requires a note. Saving an edited plan resets it to a
draft, because approval is for one exact plan.

### 7. Where the curriculum meets the job market

One skills taxonomy ([`lib/advisor/skills.ts`](lib/advisor/skills.ts)) tags both sides:
a skill is detected in a course's title and description and in a posting's title,
description and qualifications. That shared vocabulary is what lets the app say "41% of
postings ask for this and no loaded course teaches it".

## Run it

```bash
pnpm install --ignore-scripts
```

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

Open `http://localhost:3000/platform/<your-org-key>` and sign in with ibl.ai. As an
organization admin, go to **Settings → Set up the Pathways Advisor**.

Checks: `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Data

- **Catalog** — [`data/catalog/citytech.json`](data/catalog/citytech.json): 94 Computer
  Systems Technology courses with their prerequisite text and the Data Science BS
  requirements, read from City Tech's public catalog
  (<https://citytech.catalog.cuny.edu>) on 19 Nov 2026. Course and program information
  belongs to the college; check the official catalog before relying on it. To load more,
  import a JSON file of the same shape from Settings.
- **Job postings** — NYC Open Data, *Jobs NYC Postings*, category "Technology, Data &
  Innovation", fetched live and cached for six hours;
  [`data/jobs/nyc-snapshot.json`](data/jobs/nyc-snapshot.json) is served when the feed
  is unreachable. These are New York City government postings only.

## Limits

- The bundled catalog is one department and one program, and course descriptions are
  truncated to about 110 characters, so skill tags lean on course titles. Some reported
  "gaps" may be courses whose full description was not loaded.
- Courses outside the loaded catalog (for example the math sequence's prerequisites) are
  ordered by course number and flagged.
- Pathways are stored in a local JSON file (`.data/pathways.json`). Replace
  [`lib/advisor/pathway-store.ts`](lib/advisor/pathway-store.ts) for a shared deployment.
- The agent's live tools need a public https URL. On localhost it answers from its
  knowledge documents.
- The pinned Next.js version reports a security advisory at build time; upgrade before
  deploying.

## License

MIT. See [LICENSE](LICENSE).
