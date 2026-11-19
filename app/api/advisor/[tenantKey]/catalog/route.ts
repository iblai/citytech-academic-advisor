import { NextResponse, type NextRequest } from "next/server";
import { advisorCaller, forbidden, isResponse } from "@/lib/advisor/access";
import { loadCatalog, publicCourse, saveCatalog, validateCatalog } from "@/lib/advisor/catalog";
import type { Catalog } from "@/lib/advisor/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ tenantKey: string }> };

/** The loaded catalog: programs, and every course with its skills and requisites. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const caller = await advisorCaller(req, ctx.params);
  if (isResponse(caller)) return caller;
  const cat = loadCatalog();
  return NextResponse.json({
    institution: cat.institution,
    catalog: cat.catalog,
    source: cat.source,
    capturedAt: cat.capturedAt,
    coverage: cat.coverage,
    programs: cat.programs,
    courses: cat.courses.map(publicCourse),
  });
}

/** Replace the catalog with an uploaded file (advisors only). Validated first. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const caller = await advisorCaller(req, ctx.params);
  if (isResponse(caller)) return caller;
  if (!caller.isAdmin) return forbidden();
  const body = (await req.json().catch(() => null)) as Catalog | null;
  const errors = validateCatalog(body);
  if (errors.length) return NextResponse.json({ error: "The catalog file has problems", errors }, { status: 422 });
  saveCatalog({ ...(body as Catalog), capturedAt: body?.capturedAt || new Date().toISOString().slice(0, 10) });
  const cat = loadCatalog();
  return NextResponse.json({ ok: true, courses: cat.courses.length, programs: cat.programs.length });
}
