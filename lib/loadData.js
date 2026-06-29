// Load the data model (grades) from MongoDB or bundled JSON.
import { getDb } from "./mongodb";

export async function loadDataModel() {
  const db = await getDb();
  if (db) {
    const doc = await db.collection("models").findOne({}, { sort: { updatedAt: -1 } });
    if (doc && doc.grades) return doc.grades;
  }
  const model = (await import("../data/data_model.json")).default;
  return model.grades;
}
