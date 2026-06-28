import { loadTimetable } from "../../../lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const tt = await loadTimetable();
  return Response.json({
    placements: tt.placements,
    status: tt.status || "loaded",
    createdAt: tt.createdAt,
    source: tt.source || "db",
    warnings: tt.warnings || [],
  });
}
