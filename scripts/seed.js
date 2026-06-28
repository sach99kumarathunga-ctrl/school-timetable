// Seed MongoDB Atlas with the editable data model AND a generated timetable.
// Usage: MONGODB_URI="..." node scripts/seed.js
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error("Set MONGODB_URI first."); process.exit(1); }
  const dbName = process.env.MONGODB_DB || "school_timetable";
  const model = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/data_model.json"), "utf8"));
  const sol = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/solution.json"), "utf8"));
  const client = await new MongoClient(uri).connect();
  const db = client.db(dbName);
  await db.collection("models").insertOne({ grades: model.grades, updatedAt: new Date(), source: "seed" });
  await db.collection("timetables").insertOne({ ...sol, createdAt: new Date(), source: "seed" });
  console.log("Seeded model (", model.grades.length, "grades ) and timetable (", sol.placements.length, "placements ) into", dbName);
  await client.close();
})();
