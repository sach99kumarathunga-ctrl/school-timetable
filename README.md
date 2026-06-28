# School Timetable Generator (Grades 6–10)

Whole-school automatic timetable generator. Produces clash-free schedules for every
class/stream and every teacher, reconciling core subjects, choice **buckets**,
**religion blocks**, **combined/merged classes**, and **whole-school teachers**.
Includes an **editor** to change periods, add teachers/classes, and remove
assignments — then regenerate without clashes.

Free hosting: Next.js on **Vercel** + **MongoDB Atlas** (free) + a small Python
**CP-SAT solver** on **Render** (free).

## What it does
- **Clash-free engine** (OR-Tools CP-SAT): no teacher or class double-booked. Proven OPTIMAL for the bundled data.
- **Buckets**: same-coloured subjects share one period across a grade; each student picks one; class timetables show all options ("Choose one"), each teacher's personal timetable shows only their subject.
- **Per-stream buckets** (Grades 9–10): a subject can belong to different buckets in different streams (e.g. Sinhala is a tech-bucket choice in PED streams but a language-bucket choice in NAT streams).
- **Religion**: Buddhism multi-teacher (high enrolment); all religions share the period; counts vary by stream (PED 1p, NAT 2p).
- **Merged/combined classes**: low-count classes pooled inside the bucket logic; the shared slot is written to each class separately, no clashes.
- **Whole-school teachers**: one schedule across grades, never clashing.
- **Placeholder staff**: unfilled "New ___" positions are split per grade so they never clash across grades.
- **Assembly**: fixed Period 1 — Wednesday for Grades 6–8, Thursday for Grades 9–10. 8 periods/day, interval after P4, Mon–Fri.
- **Override**: Grade 6 "New MAT" Maths → Mr. Mithun (also teaches Grade 8 Maths).
- **Grade 8 balance**: Computer Science set to 2 periods so the week totals 39 with religion + assembly.

## Editing (no spreadsheet needed)
Open **/edit** in the app:
- Change any subject's **periods**, **teacher**, or **name**
- **Add** a subject/teacher row, or a **class/stream**
- **Delete** a subject row or a class
- **Save changes** (writes the model to MongoDB)
- **Generate timetable** (runs the solver, saves a fresh clash-free plan)

## Project layout
```
app/
  page.js              Viewer: grade tabs, class & teacher views, PDF/Excel export
  edit/page.js         Editor: periods, teachers, classes, add/delete
  api/timetable/       GET current timetable
  api/model/           GET/PUT editable data model
  api/generate/        POST -> triggers the Render solver
components/             exportExcel.js, exportPdf.js (template colours preserved)
lib/                    timetable.js (grids + colours), mongodb.js
data/                   data_model.json, solution.json (bundled fallback)
parse_data.py           Excel -> data_model.json
solver.py               CP-SAT solver -> solution.json
service.py              FastAPI wrapper (Render): reads model from Mongo, solves, saves
scripts/seed.js         Seed Mongo with model + timetable
```

## Run locally
```bash
npm install
npm run build && npm start        # http://localhost:3000  (works with no DB)
```
Regenerate from the spreadsheet:
```bash
pip install -r requirements.txt
python parse_data.py
python solver.py data_model.json 45
cp solution.json data/solution.json && cp data_model.json data/data_model.json
```

## Deploy free
**1) MongoDB Atlas** — create a free M0 cluster, add a user, allow access from anywhere, copy the connection string. Seed once:
```bash
MONGODB_URI="...your uri..." node scripts/seed.js
```
**2) Vercel (frontend)** — import the GitHub repo (auto-detects Next.js). Set env vars `MONGODB_URI`, `MONGODB_DB`, and `SOLVER_URL` (from step 3). Deploy.
**3) Render (solver)** — New Web Service from the same repo (reads `render.yaml`), set `MONGODB_URI`. The "Generate timetable" button calls this service.

Free tiers sleep when idle, so the first request after a quiet period can take 30–60s.

## Extending to Grades 11–12
Those A/L sheets use an irregular layout (section headers, period counts in a separate
column, subject-group buckets). Add a parser branch in `parse_data.py` mapping each
stream to a class and tagging stream-choice subjects as buckets; the same `solver.py`
handles them unchanged.

## Guarantees
Every generated plan is verified for **zero teacher clashes** and **zero class clashes**.
Streams that exceed the 39 teachable weekly slots are reported rather than silently dropped.
