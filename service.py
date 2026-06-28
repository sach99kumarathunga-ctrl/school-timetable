"""
Solver service (deploy free on Render). OR-Tools can't run on Vercel's Node runtime,
so the CP-SAT solver lives here.

Endpoints:
  GET  /health    -> ok
  POST /generate  -> read the latest editable data model from MongoDB (collection
                     'models'), solve, save the timetable to 'timetables'. Falls back
                     to the bundled data_model.json if no model is in the DB.
"""
import os, datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from solver import build_and_solve, load

app = FastAPI(title="Timetable Solver")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DATA = os.path.join(os.path.dirname(__file__), "data_model.json")

def _db():
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        return None
    from pymongo import MongoClient
    return MongoClient(uri)[os.environ.get("MONGODB_DB", "school_timetable")]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/generate")
def generate(time_limit: int = 45):
    db = _db()
    model = None
    if db is not None:
        doc = db.models.find_one({}, sort=[("updatedAt", -1)])
        if doc:
            model = {"grades": doc["grades"]}
    if model is None:
        model = load(DATA)
    res = build_and_solve(model, time_limit=time_limit)
    if db is not None:
        db.timetables.insert_one({**res, "createdAt": datetime.datetime.utcnow(), "source": "solver"})
    return {"status": res["status"], "objective": res["objective"], "count": len(res["placements"])}
