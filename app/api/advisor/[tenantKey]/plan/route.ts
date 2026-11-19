import { NextResponse, type NextRequest } from "next/server";
import { advisorCaller, isResponse } from "@/lib/advisor/access";
import { loadCatalog } from "@/lib/advisor/catalog";
import { loadJobMarket, roleProfiles } from "@/lib/advisor/jobs";
import { buildPlan } from "@/lib/advisor/planner";
import { jsonBody } from "@/lib/iblai/platform";

export const dynamic = "force-dynamic";

/** Propose a term-by-term pathway. Saves nothing. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ tenantKey: string }> }) {
  const caller = await advisorCaller(req, ctx.params);
  if (isResponse(caller)) return caller;
  const body = await jsonBody(req);
  try {
    const plan = buildPlan(loadCatalog(), roleProfiles(await loadJobMarket()), {
      programId: String(body.programId ?? ""),
      completed: Array.isArray(body.completed) ? body.completed.map(String) : [],
      goalRoleId: typeof body.goalRoleId === "string" ? body.goalRoleId : null,
      creditsPerTerm: typeof body.creditsPerTerm === "number" ? body.creditsPerTerm : undefined,
      startTerm: typeof body.startTerm === "string" ? body.startTerm : undefined,
      genEdCompleted: typeof body.genEdCompleted === "number" ? body.genEdCompleted : undefined,
    });
    return NextResponse.json(plan);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not build a plan" }, { status: 400 });
  }
}
