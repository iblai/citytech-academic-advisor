import { NextResponse, type NextRequest } from "next/server";
import { advisorCaller, forbidden, isResponse } from "@/lib/advisor/access";
import { listPathways, savePathway } from "@/lib/advisor/pathway-store";
import type { Plan } from "@/lib/advisor/types";
import { jsonBody } from "@/lib/iblai/platform";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ tenantKey: string }> };

/** A student's own pathways; `?scope=all` is the advisors' review queue. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const caller = await advisorCaller(req, ctx.params);
  if (isResponse(caller)) return caller;
  if (req.nextUrl.searchParams.get("scope") === "all") {
    if (!caller.isAdmin) return forbidden();
    return NextResponse.json({ pathways: listPathways(caller.org).filter((p) => p.status !== "draft") });
  }
  return NextResponse.json({ pathways: listPathways(caller.org, caller.username) });
}

/** Save the caller's pathway as a draft, or submit it for an advisor's review. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const caller = await advisorCaller(req, ctx.params);
  if (isResponse(caller)) return caller;
  const body = await jsonBody(req);
  const plan = body.plan as Plan | undefined;
  if (!plan?.programId || !Array.isArray(plan.terms))
    return NextResponse.json({ error: "A plan is required" }, { status: 400 });
  const row = savePathway({
    org: caller.org,
    student: caller.username,
    studentName: typeof body.studentName === "string" ? body.studentName.slice(0, 120) : caller.username,
    plan,
    studentNote: typeof body.studentNote === "string" ? body.studentNote.slice(0, 2000) : undefined,
    submit: body.submit === true,
    id: typeof body.id === "string" ? body.id : undefined,
  });
  return NextResponse.json(row, { status: 201 });
}
