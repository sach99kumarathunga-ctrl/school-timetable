// Triggers the Python CP-SAT solver service (on Render) to regenerate the timetable
// from the latest saved model. Configure SOLVER_URL in env (e.g. https://xxx.onrender.com).
export const dynamic = "force-dynamic";

export async function POST() {
  const base = process.env.SOLVER_URL;
  if (!base) {
    return Response.json(
      { ok: false, reason: "SOLVER_URL not configured. Set it to your Render solver service URL." },
      { status: 400 }
    );
  }
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/generate`, { method: "POST" });
    const data = await r.json();
    return Response.json({ ok: true, ...data });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) }, { status: 502 });
  }
}
