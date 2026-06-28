import { getDb } from "../../../lib/mongodb";

export const dynamic = "force-dynamic";

// GET: latest editable model (from DB, else bundled). PUT: save edited model.
export async function GET() {
  const db = await getDb();
  if (db) {
    const doc = await db.collection("models").findOne({}, { sort: { updatedAt: -1 } });
    if (doc) return Response.json({ grades: doc.grades, source: "db", updatedAt: doc.updatedAt });
  }
  const model = (await import("../../../data/data_model.json")).default;
  return Response.json({ grades: model.grades, source: "bundled" });
}

export async function PUT(req) {
  const db = await getDb();
  if (!db) return Response.json({ saved: false, reason: "No MONGODB_URI configured" }, { status: 400 });
  const body = await req.json();
  if (!body?.grades) return Response.json({ saved: false, reason: "Missing grades" }, { status: 400 });
  await db.collection("models").insertOne({ grades: body.grades, updatedAt: new Date() });
  return Response.json({ saved: true });
}
