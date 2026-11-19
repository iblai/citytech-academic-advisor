import { NextResponse, type NextRequest } from "next/server";
import { advisorCaller, forbidden, isResponse } from "@/lib/advisor/access";
import { deletePathway, getPathway, reviewPathway } from "@/lib/advisor/pathway-store";
import { jsonBody } from "@/lib/iblai/platform";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ tenantKey: string; id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const caller = await advisorCaller(req, ctx.params);
  if (isResponse(caller)) return caller;
  const row = getPathway(caller.org, (await ctx.params).id);
  if (!row || (!caller.isAdmin && row.student !== caller.username))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

/** An advisor's decision on a submitted pathway: approve, request changes, or comment. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const caller = await advisorCaller(req, ctx.params);
  if (isResponse(caller)) return caller;
  if (!caller.isAdmin) return forbidden();
  const body = await jsonBody(req);
  const decision = body.decision;
  if (decision !== "approved" && decision !== "changes_requested" && decision !== "comment")
    return NextResponse.json({ error: "decision must be approved, changes_requested or comment" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
  if (decision !== "approved" && !note)
    return NextResponse.json({ error: "Tell the student what to change" }, { status: 400 });
  const row = reviewPathway(caller.org, (await ctx.params).id, { by: caller.username, decision, note });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const caller = await advisorCaller(req, ctx.params);
  if (isResponse(caller)) return caller;
  const ok = deletePathway(caller.org, (await ctx.params).id, caller.username);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
