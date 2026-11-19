/**
 * Who is calling an advisor route, and may they act as an advisor
 * (administrator) of the organization in the URL. The browser forwards the
 * signed-in user's session token; the platform says who that is, and whether
 * they administer the organization — the app never trusts a role the browser
 * claims. Server-only.
 */
import { NextResponse } from "next/server";
import { platformFetch, verifyCaller, type Caller } from "../iblai/platform";

export interface AdvisorCaller extends Caller {
  org: string;
  isAdmin: boolean;
}

const adminCache = new Map<string, { at: number; value: boolean }>();

type PlatformUser = { username?: string; is_admin?: boolean };

/** Asked as the caller: the platform's user list is readable by org admins only. */
async function isOrgAdmin(org: string, caller: Caller): Promise<boolean> {
  const key = `${org}:${caller.username}`;
  const hit = adminCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const q = new URLSearchParams({ platform_key: org, platform_org: org, query: caller.username, page: "1", page_size: "10" });
  let value = false;
  try {
    const data = await platformFetch<{ results?: PlatformUser[] }>(
      `/dm/api/core/platform/users/?${q}`,
      `Token ${caller.token}`,
    );
    const me = data?.results?.find((u) => u.username === caller.username);
    value = !!me?.is_admin;
  } catch {
    value = false;
  }
  adminCache.set(key, { at: Date.now(), value });
  return value;
}

export async function advisorCaller(
  req: Request,
  params: Promise<{ tenantKey: string }>,
): Promise<AdvisorCaller | NextResponse> {
  const org = decodeURIComponent((await params).tenantKey ?? "");
  if (!org) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  const caller = await verifyCaller(req);
  if (!caller) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return { ...caller, org, isAdmin: await isOrgAdmin(org, caller) };
}

export const isResponse = (x: unknown): x is NextResponse => x instanceof NextResponse;

export const forbidden = () =>
  NextResponse.json({ error: "Only advisors (organization admins) can do this" }, { status: 403 });
