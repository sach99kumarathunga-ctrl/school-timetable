// MongoDB connection (Atlas free tier). Reuses the client across hot reloads.
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "school_timetable";

let cached = global._mongo;
if (!cached) cached = global._mongo = { client: null, promise: null };

export async function getDb() {
  if (!uri) return null; // allows local/demo mode without a DB
  if (cached.client) return cached.client.db(dbName);
  if (!cached.promise) {
    cached.promise = new MongoClient(uri, { maxPoolSize: 5 }).connect();
  }
  cached.client = await cached.promise;
  return cached.client.db(dbName);
}

// Load the latest saved timetable, or fall back to the bundled solution.json.
export async function loadTimetable() {
  const db = await getDb();
  if (db) {
    const doc = await db.collection("timetables").findOne({}, { sort: { createdAt: -1 } });
    if (doc) return doc;
  }
  // fallback bundled solution
  const data = (await import("../data/solution.json")).default;
  return { ...data, createdAt: null, source: "bundled" };
}

export async function saveTimetable(solution) {
  const db = await getDb();
  if (!db) return { saved: false, reason: "No MONGODB_URI configured" };
  const doc = { ...solution, createdAt: new Date() };
  const res = await db.collection("timetables").insertOne(doc);
  return { saved: true, id: res.insertedId };
}
