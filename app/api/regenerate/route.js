// Local regeneration using the improved JS generator.
// Does NOT depend on SOLVER_URL — runs entirely in-process.
import { generate } from "../../../lib/generator";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request) {
  try {
    let grades;
    try {
      const body = await request.json();
      const model = body.model;
      if (model && model.grades) grades = model.grades;
      else if (model && Array.isArray(model)) grades = model;
    } catch (_) { /* no body or invalid JSON */ }

    if (!grades) {
      const { loadDataModel } = await import("../../../lib/loadData");
      grades = await loadDataModel();
    }

    const result = generate({ grades });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { loadDataModel } = await import("../../../lib/loadData");
    const grades = await loadDataModel();
    return Response.json({ ok: true, gradeCount: grades.length });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) }, { status: 500 });
  }
}
