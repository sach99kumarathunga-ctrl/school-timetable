import { getDb, saveTimetable } from "../../../lib/mongodb";
import { generate } from "../../../lib/generator";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const db = await getDb();
    let grades;
    if (db) {
      const doc = await db.collection("models").findOne({}, { sort: { updatedAt: -1 } });
      if (doc) grades = doc.grades;
    }
    if (!grades) {
      const model = (await import("../../../data/data_model.json")).default;
      grades = model.grades;
    }

    const result = generate({ grades });
    const warnings = result.warnings.map(w =>
      typeof w === "string" ? w : `${w.grade} ${w.subject} (${w.teacher}) — ${w.short} period(s) short`
    );
    await saveTimetable({
      placements: result.placements,
      DAYS: result.DAYS,
      PPD: result.PPD,
      INTERVAL_AFTER: result.INTERVAL_AFTER,
      status: "FEASIBLE",
      warnings,
    });

    return Response.json({
      ok: true,
      status: "FEASIBLE",
      count: result.placements.length,
      warnings: result.warnings,
    });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) }, { status: 500 });
  }
}
