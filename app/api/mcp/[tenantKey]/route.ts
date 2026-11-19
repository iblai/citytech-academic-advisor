import type { NextRequest } from "next/server";
import config from "@/lib/iblai/config";
import { platformBase } from "@/lib/iblai/platform";
import { bearerToken } from "@/lib/mcp/protocol";
import { createAdvisorServer, type ToolContext } from "@/lib/mcp/tools";

/**
 * The advisor agent's tool server — an MCP endpoint (Streamable HTTP, JSON
 * mode) the ibl.ai agent runtime calls when the agent decides to use a tool.
 *
 * Auth: the platform presents `Authorization: Bearer <key>`, the
 * `advisor-tools` Platform API Token agent setup minted and stored in the
 * organization's MCP connection. The route asks the platform whether that key
 * is valid before answering; the tools themselves are read-only.
 */
export const dynamic = "force-dynamic";

const server = createAdvisorServer();
const verified = new Map<string, number>();

async function keyIsValid(key: string): Promise<boolean> {
  if (!key) return false;
  const at = verified.get(key);
  if (at && Date.now() - at < 5 * 60_000) return true;
  const res = await fetch(`${platformBase()}/dm/api/core/token/verify/`, {
    headers: { Authorization: `Api-Token ${key}`, Accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return false;
  verified.set(key, Date.now());
  return true;
}

type Ctx = { params: Promise<{ tenantKey: string }> };

async function handle(req: NextRequest, { params }: Ctx) {
  const org = decodeURIComponent((await params).tenantKey ?? "");
  const ok = !!org && (await keyIsValid(bearerToken(req)));
  const ctx: ToolContext = { org, appUrl: config.publicOrigin() || req.nextUrl.origin };
  return server.handleHttp(req, ctx, () => ok);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
