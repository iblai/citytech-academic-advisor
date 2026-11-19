/**
 * The app's namespace inside the organization's public metadata object
 * (`GET/PUT …/dm/api/core/orgs/{org}/metadata/`): `metadata.apps.advisor`.
 *
 * It holds everything the Academic Pathways Advisor needs once per organization and that is
 * safe to be public — the advisor agent id, the registered MCP server
 * id, the institution's display settings. PUT replaces the
 * whole object, so every writer GETs, merges with `mergeAdvisorSettings`, and
 * PUTs. Pure module: no React, no SDK; shared by the browser hook, the route
 * handlers and the CLI scripts.
 */
import { APP_SLUG } from "./vocabulary";

export interface AdvisorSettings {
  /** The advisor agent (`unique_id`) members chat with. */
  agentId?: string;
  /** The MCP server record on the platform that points back at this app. */
  mcpServerId?: number;
  /** When an admin last ran the setup. */
  setupCompletedAt?: string;
  /** Catalog skills created for the agent (slug → unique id). */
  skillIds?: Record<string, string>;
  /** Knowledge documents setup uploaded, by name. */
  knowledge?: string[];
  /** The institution's name as students should see it. */
  institutionName?: string;
  /** Logo (https URL). */
  logoUrl?: string;
  /** Accent color (hex). */
  accentColor?: string;
  /** Advising office contact. */
  contactEmail?: string;
  [key: string]: unknown;
}

export type OrgMetadata = Record<string, unknown>;

export function readAdvisorSettings(metadata: unknown): AdvisorSettings {
  const apps = (metadata as { apps?: Record<string, unknown> } | null | undefined)?.apps;
  const mine = apps?.[APP_SLUG];
  return mine && typeof mine === "object" ? (mine as AdvisorSettings) : {};
}

/**
 * Merge `patch` into `metadata.apps.advisor` (dropping `remove` keys) without
 * touching the OS's own keys or other apps' namespaces.
 */
export function mergeAdvisorSettings(
  metadata: unknown,
  patch: Partial<AdvisorSettings>,
  remove: string[] = [],
): OrgMetadata {
  const root: OrgMetadata =
    metadata && typeof metadata === "object" ? { ...(metadata as OrgMetadata) } : {};
  const apps = { ...(root.apps as Record<string, unknown> | undefined) };
  const mine: AdvisorSettings = { ...readAdvisorSettings(root), ...patch };
  for (const k of remove) delete mine[k];
  apps[APP_SLUG] = mine;
  root.apps = apps;
  return root;
}

/** The institution's branding, with the org-level metadata keys as fallback. */
export function institutionBranding(metadata: unknown, orgKey: string) {
  const mine = readAdvisorSettings(metadata);
  const root = (metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
  return {
    name: str(mine.institutionName) || str(root.platform_name) || str(root.name) || orgKey,
    logoUrl: str(mine.logoUrl) || str(root.logo) || str(root.light_logo) || "",
    accentColor: /^#[0-9a-f]{6}$/i.test(str(mine.accentColor)) ? str(mine.accentColor) : "#0058cc",
    contactEmail: str(mine.contactEmail) || str(root.support_email) || "",
  };
}
