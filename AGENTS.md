# AGENTS.md — Academic Pathways Advisor

Guidance for AI assistants working in this repository.

## What this is

A web app on the ibl.ai platform, built with the [iblai/vibe](https://github.com/iblai/vibe)
toolkit, with the shell and UX of [iblai/recruit](https://github.com/iblai/recruit) and
the multi-organization sign-in of [iblai/os](https://github.com/iblai/os).

1. **The Pathways Advisor** — an ibl.ai agent students and advisors both talk to.
   Home is the conversation; a side panel offers it on every other page. Setup
   (`lib/advisor/agent.ts`) creates it with a system prompt, suggested prompts,
   four platform skills and two knowledge documents (catalog, job-market report),
   and — when the app has a public https URL — wires this app's MCP tool server
   (`app/api/mcp/[tenantKey]/route.ts` → `lib/mcp/tools.ts`).
2. **The catalog** — `data/catalog/<id>.json`, loaded by `lib/advisor/catalog.ts`,
   each course tagged with skills and its prerequisite text parsed
   (`lib/advisor/prereq.ts`). Advisors replace it from Settings → Import.
3. **The job market** — `lib/advisor/jobs.ts` reads live postings (NYC Open Data),
   tags them with the same skills taxonomy (`lib/advisor/skills.ts`) and groups
   them into target roles. A bundled snapshot is served when the feed is down.
4. **Pathways** — `lib/advisor/planner.ts` proposes a term-by-term plan;
   students save and submit it; advisors approve or request changes
   (`lib/advisor/pathway-store.ts`, `/review`). Nothing is approved without a human.
5. **Opportunities** — `lib/advisor/insights.ts` compares skill demand with
   curriculum coverage and proposes microcredentials and workshops.

## Decisions (from /iblai-vibe-start)

- Project: new
- Architecture: multi-org — the organization is in the URL (`/platform/[tenantKey]/…`)
- Access: members; organization admins are the advisors
- Focus: agents, users

## Rules

1. **Organization from the URL.** `useSession().tenantKey`; links via `useSession().href(path)`.
2. **SDK components first** (`@iblai/iblai-js`), then shadcn/ui (`components/ui`, Base UI —
   `render` prop, not `asChild`), custom last. Never restyle or remount the SDK `Chat`
   except through its `key` (`components/advisor/chat.tsx`).
3. **The server holds no credential.** Routes act with the caller's session token;
   `lib/advisor/access.ts` asks the platform who is calling and whether they administer
   the organization. Never trust a role the browser claims; never log a token.
4. **Human in the loop.** The planner and the agent only propose. Status changes to
   `approved` only through an advisor's PATCH. Saving an edited plan resets it to draft.
5. **No invented catalog facts.** Courses, requirements and prerequisites come from the
   loaded catalog file; the verbatim prerequisite text is always kept and shown. What the
   parser cannot model is flagged for the advisor.
6. **Org settings = `metadata.apps.advisor`** (agent id, MCP server id, skill ids). Public
   read, admin write, PUT replaces: always GET → `mergeAdvisorSettings` → PUT.
7. **Pages** are client components: `<PageHeader/>` then `<div className="flex-1 overflow-auto">`.
   Brand primary `#0058cc`, tint `#eef6fc`, CTA `className="ibl-button-primary"`.
8. **Verify:** `pnpm typecheck && pnpm test && pnpm build`, then the page in a real browser.

## Where things are

| Concern | File |
| --- | --- |
| Domain types | `lib/advisor/types.ts` |
| Catalog load / import / validation | `lib/advisor/catalog.ts`, `data/catalog/` |
| Prerequisite parsing | `lib/advisor/prereq.ts` |
| Skills taxonomy and roles | `lib/advisor/skills.ts` |
| Job market connector | `lib/advisor/jobs.ts`, `data/jobs/` |
| Planner | `lib/advisor/planner.ts` |
| Skills-gap opportunities | `lib/advisor/insights.ts` |
| Pathway storage (local JSON file) | `lib/advisor/pathway-store.ts` → `.data/pathways.json` |
| Caller / advisor check | `lib/advisor/access.ts` |
| Agent identity + setup | `lib/advisor/agent.ts`, `app/api/admin/agent/route.ts` |
| Agent tools (MCP) | `lib/mcp/tools.ts`, `lib/mcp/protocol.ts` |
| API routes | `app/api/advisor/[tenantKey]/{catalog,market,plan,pathways}` |
| Screens | `app/(app)/platform/[tenantKey]/{page,pathway,catalog,careers,review,opportunities,settings}` |
| Shell | `components/shell/*`, `app/(app)/platform/[tenantKey]/layout.tsx` |

## Known limits

- The bundled catalog covers City Tech's Computer Systems Technology courses and the
  Data Science BS only, with course descriptions truncated. Load the rest with an import.
- Pathways are stored in a local file; replace `pathway-store.ts` for a shared deployment.
- The agent's live tools need a public https `NEXT_PUBLIC_APP_URL`; on localhost it
  answers from its knowledge documents.
