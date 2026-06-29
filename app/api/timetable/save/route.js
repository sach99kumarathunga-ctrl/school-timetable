import { saveTimetable } from "../../../../lib/mongodb";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.placements) {
      return Response.json({ saved: false, reason: "Missing placements" }, { status: 400 });
    }
    const result = await saveTimetable(body);
    return Response.json(result);
  } catch (e) {
    return Response.json({ saved: false, reason: String(e) }, { status: 500 });
  }
}
