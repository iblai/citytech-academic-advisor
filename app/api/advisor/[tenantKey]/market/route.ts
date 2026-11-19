import { NextResponse, type NextRequest } from "next/server";
import { advisorCaller, isResponse } from "@/lib/advisor/access";
import { loadCatalog } from "@/lib/advisor/catalog";
import { opportunities } from "@/lib/advisor/insights";
import { loadJobMarket, roleProfiles, skillDemand } from "@/lib/advisor/jobs";

export const dynamic = "force-dynamic";

/**
 * The job market next to the curriculum: postings, target roles with the
 * skills they ask for, demand per skill with the courses that teach it, and —
 * for advisors — the microcredential / workshop opportunities.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ tenantKey: string }> }) {
  const caller = await advisorCaller(req, ctx.params);
  if (isResponse(caller)) return caller;
  const market = await loadJobMarket(req.nextUrl.searchParams.get("refresh") === "1" && caller.isAdmin);
  const catalog = loadCatalog();
  return NextResponse.json({
    source: market.source,
    sourceUrl: market.sourceUrl,
    live: market.live,
    fetchedAt: market.fetchedAt,
    postings: market.postings,
    roles: roleProfiles(market),
    demand: skillDemand(market, catalog),
    opportunities: caller.isAdmin ? opportunities(market, catalog) : [],
  });
}
