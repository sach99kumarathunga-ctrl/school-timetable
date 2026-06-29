// Local regeneration using the improved JS generator.
// Does NOT depend on SOLVER_URL — runs entirely in-process.
import { generate } from "../../../lib/generator";
import { loadTimetable } from "../../../lib/mongodb";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const model = body.model;

    if (!model) {
      // Load the current data model from MongoDB or the bundled file
      const { loadDataModel } = await import("../../../lib/loadData");
      const grades = await loadDataModel();
      const result = generate({ grades: grades });
      return Response.json({ ok: true, ...result });
    }

    const result = generate({ grades: model.grades || model });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) }, { status: 500 });
  }
}
