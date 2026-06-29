# Developer Handover Guide
## Lyceum International School — Whole-School Timetable Generator

This guide is for a developer (or an AI coding assistant) taking over maintenance of the
timetable system. It explains the architecture, the data model, how the constraint solver
enforces each scheduling rule, and how to extend the system safely. Read it alongside the
codebase in this repository.

> **Companion documents:** `Timetable_Instructions_Standalone` (the school-facing rules and
> full per-grade data) and `README.md` (quick start + deploy). This guide is the technical
> deep-dive those two don’t cover.

---

## 1. What the system does

It produces a **clash-free** weekly timetable for an entire school (Grades 6–12), then lets
staff view, edit, regenerate, and export it. "Clash-free" means: no teacher is in two places
at once, and no class attends two things at once, in any period of the week.

The hard part is the scheduling. It’s solved with **Google OR-Tools CP-SAT** (a constraint
solver), not hand-rolled logic. The rest of the system is plumbing around that solver:
parsing the source spreadsheet into a clean data model, storing it, running the solver, and
rendering the result.

---

## 2. Architecture at a glance

```
   Excel (ttt.xlsx)
        │  parse_data.py  (Python, openpyxl)
        ▼
   data_model.json ──────────────► MongoDB (collection: models)
        │                                      ▲
        │                                      │ edits via web UI
        ▼                                      │
   solver.py  (Python, OR-Tools CP-SAT)        │
        │                                      │
        ▼                                      │
   solution.json ───────────────► MongoDB (collection: timetables)
        │                                      │
        ▼                                      ▼
   Next.js app (app/, components/, lib/)  ◄── reads timetable + model
        │
        ├─ viewer (app/page.js): grade tabs, class & teacher views, exports
        └─ editor (app/edit/page.js): edit periods/teachers/classes/merges
```

**Why two runtimes (Node + Python)?** OR-Tools does not run inside Vercel’s Node serverless
runtime. So the **solver lives in a separate Python service** (`service.py`, deployed on
Render) and the Next.js app calls it over HTTP to regenerate. Locally, the app reads the
bundled `data/solution.json` and needs neither the database nor the Python service.

**Hosting (all free tiers):** Next.js → Vercel; data → MongoDB Atlas; solver → Render.

---

## 3. Repository map

| Path | Language | Responsibility |
|------|----------|----------------|
| `parse_data.py` | Python | Excel → `data_model.json`. All the messy sheet-specific parsing lives here. |
| `solver.py` | Python | `data_model.json` → `solution.json`. The CP-SAT model. **The heart of the system.** |
| `service.py` | Python | FastAPI wrapper around the solver for Render. Reads model from Mongo, solves, writes timetable. |
| `app/page.js` | React | Viewer. Grade tabs, class/teacher grids, export buttons. |
| `app/edit/page.js` | React | Editor. Subject/teacher/period/class editing with merge-group chips. |
| `app/api/timetable/route.js` | Node | GET current timetable (DB if present, else bundled file). |
| `app/api/model/route.js` | Node | GET/PUT the editable data model. |
| `app/api/generate/route.js` | Node | POST → triggers the Render solver service. |
| `lib/timetable.js` | JS | Turns flat placements into per-class / per-teacher grids; bucket colours; assembly day. |
| `lib/mongodb.js` | JS | Mongo connection helper (returns null if `MONGODB_URI` unset). |
| `components/exportExcel.js` / `exportPdf.js` | JS | Class & teacher grid exports. |
| `components/exportPersonal.js` | JS | Teacher personal timetable in the official Lyceum template. |
| `data/data_model.json`, `data/solution.json` | data | Bundled fallback so the app works with no DB. |
| `scripts/seed.js` | Node | Seed Mongo with the bundled model + timetable. |

---

## 4. The data model (`data_model.json`)

This is the **single source of truth** the solver consumes. Keep its shape stable.

```jsonc
{
  "grades": [
    {
      "grade": "Grade 6",
      "classes": ["6A", "6B", "6C", "6D", "6E", "6F", "6G"],
      "subjects": [
        {
          "subject": "English",
          "weekly": 7,            // default weekly periods
          "color": "none",        // "none" = core; any token = bucket colour key
          "religionBlock": false, // true for religion subjects
          "bucketId": null,       // null = core; else the bucket this subject belongs to
          "assignments": [
            {
              "teacher": "Ms. Nimnada",
              "classes": ["6A"],   // 1 class = single; 2+ = MERGED GROUP
              "periods": 7,
              "mergedGroup": null  // informational; the merge is defined by classes.length
            }
            // ...one assignment per teacher/class-group
          ]
        }
      ],
      "buckets": { /* derived: bucketId -> [subject names] */ }
    }
  ]
}
```

### Key invariants
- **Core vs bucket:** `bucketId === null` → core subject (own period per class, counted
  fully). Non-null → bucket subject (shares one period with its bucket-mates, counted once).
- **Merged group = an assignment whose `classes` array has length ≥ 2.** Those classes are
  taught together, one teacher, one slot. This is the ONE place merges are expressed — there
  is no separate "merge table." If you change merge handling, change it here and in the
  solver’s bucket grouping (Section 6).
- **Placeholder teachers** are localised per grade as `"New XXX (Grade n)"` so an unfilled
  post never collides across grades.

---

## 5. The solution format (`solution.json`)

```jsonc
{
  "status": "OPTIMAL" | "FEASIBLE" | "INFEASIBLE",
  "objective": 138.0,
  "DAYS": 5, "PPD": 8,
  "placements": [
    {
      "grade": "Grade 6", "class": "6A",
      "teacher": "Ms. Nimnada" | null,   // null only for Assembly
      "slot": 16,        // 0..39, = day*8 + period
      "day": 2,          // 0=Mon .. 4=Fri
      "period": 0,       // 0..7
      "subject": "English",
      "bucketId": null
    }
  ]
}
```

A merged group produces **one placement per member class**, all sharing the same slot.
`lib/timetable.js` groups these back together for display.

---

## 6. How the solver enforces each rule (`solver.py`)

This is the most important section. The solver builds a CP-SAT model where boolean variables
decide whether each teaching unit occupies each of the 40 weekly slots (5 days × 8 periods),
then adds constraints. Understanding the mapping from *rule* to *constraint* is what lets you
extend the system without breaking the clash-free guarantee.

### 6.1 Two kinds of teaching unit
- **Singles** — a core subject for one class (or one merged group). Variable
  `x[(i, slot)] = 1` if single `i` is taught at `slot`.
- **Buckets** — a choose-one group sharing a period. Variable `y[(b, slot)] = 1` if bucket
  `b` occupies `slot`. All members of the bucket are taught in parallel at that slot.

### 6.2 Bucket grouping (where merges are handled)
Buckets are keyed per **merge-group**: `(bucketId, sorted(classes))`. So the Music bucket for
`(6A,6B)` is a *separate* bucket instance from `(6C,6D)`. This is deliberate — it lets the
same teacher cover the same subject for different groups at **different** slots (a teacher
can’t be in two places at once).

**Religion is the exception:** it is keyed as `(bucketId, "ALL")` so the whole grade’s
religion runs in **one** shared period, with Buddhism’s several per-class teachers all placed
at that single slot. (Without this exception the per-class Buddhism teachers and the
all-class Hinduism/Islam/etc. members would demand different slots and the grade becomes
infeasible — this was a real bug; see Section 9.)

### 6.3 The constraints

| Rule (from the spec) | CP-SAT constraint |
|----------------------|-------------------|
| A class attends ≤ 1 thing per slot | For each (class, slot): `sum(singles touching that class) + sum(buckets touching that class) ≤ 1`. A class is counted **once per bucket** (via a set), so choose-one is respected. |
| A teacher teaches ≤ 1 group per slot | For each (teacher, slot): `sum(their singles) + sum(their bucket instances) ≤ 1`. |
| Each subject gets its weekly periods | Soft: `placed ≤ periods` and a shortfall var `sf = periods − placed`. (See 6.4.) |
| Assembly is fixed at Period 1 | The assembly slot for the grade is forced to 0 for every unit (`x[i, asl]=0`, `y[b, asl]=0`); Assembly is emitted directly as a placement. `ASSEMBLY = {Grade 6:2, …, Grade 12:3}` (day index). |
| Buckets share one period | All members of a bucket instance share the single `y[(b,slot)]` variable, so they’re always co-scheduled. |
| Merged classes co-taught | A merged group is one single/bucket member with `classes=[…]`; its one slot is emitted as one placement per member class. |
| Avoid same subject twice/day | Soft penalty added to the objective. |

### 6.4 Why constraints are *soft* (resilience)
A/L (Grades 11–12) raw data can exceed the 39-period capacity. With hard equality
(`placed == periods`) the whole model goes INFEASIBLE and **no** grade gets a timetable.

So placement is **soft**: `placed ≤ periods`, with a `shortfall` variable per unit. The
objective is:

```
Minimize( 1000 * sum(shortfalls) + sum(spread_penalties) )
```

The huge weight on shortfalls means the solver places **as many required periods as
possible** first. Fully-feasible grades (6–10) hit zero shortfall (effectively optimal);
over-subscribed A/L streams place what fits and the rest is reported rather than crashing.
**Do not revert this to hard equality** unless every grade is guaranteed ≤ 39.

### 6.5 Verifying output
After any solver change, verify zero clashes. A quick Node check (used throughout
development):

```js
const s = require("./solution.json");
// teacher clashes: same teacher+slot with different subject/bucket signature
// class clashes:   same grade/class+slot with different subject/bucket signature
```
Grades 6–10 must report **0 teacher clashes, 0 class clashes**.

---

## 7. The parser (`parse_data.py`)

Each sheet has its own layout, so parsing is sheet-specific:
- **Grades 6–8** (`parse_simple_grade`): classes are columns; coloured fills mark buckets;
  merged cell ranges define merge groups (read via `get_row_merge_groups`, which propagates
  the top-left value across the merged span — openpyxl only stores it in the top-left cell).
- **Grades 9–10** (`parse_grade_9_10`): stream columns; PED vs NAT have different buckets;
  the same subject can sit in different buckets per stream.
- **Grades 11–12** (`parse_grade_11_12`): A/L streams; column B is the weekly period count;
  rows 5–22 are A/L mains, 25–33 NAT activities, 36–45 PED activities. Loaded **as-is** for
  later editing (some streams intentionally exceed 39).

Hard-coded business rules live near the top of the file:
- `TEACHER_OVERRIDES` — e.g. Grade 6 "New MAT" → Mr. Mithun.
- `PERIOD_OVERRIDES` — e.g. (Grade 8, Computer Science) → 2, so each Grade 8 class totals 39.
- `localize_placeholder` — turns "New ENG" into "New ENG (Grade 8)".

If the school sends a new spreadsheet with a **different layout**, the parser is where you’ll
spend your time. The solver and UI shouldn’t need changes as long as the output matches the
`data_model.json` shape in Section 4.

---

## 8. The web app

### Viewer (`app/page.js`)
- Loads `/api/timetable`. Builds grids with `classGrids` / `teacherGrids` from
  `lib/timetable.js`.
- Grade tabs filter classes; a Teachers tab lists personal timetables.
- Exports: class/teacher grids (`exportExcel`/`exportPdf`); teacher personal timetable in the
  Lyceum template (`exportPersonal.js`). Merged classes render combined (e.g. `6A+6B`).

### Editor (`app/edit/page.js`)
- Loads `/api/model`, edits in React state, `PUT`s back to `/api/model` (Mongo), then `POST`s
  `/api/generate` to trigger the Render solver.
- **Merge UI:** each subject row shows class **chips**; ticking ≥ 2 classes in one teacher row
  makes a merged group (a "merged: …" tag appears). Separate classes → separate rows (the "+"
  button adds another teacher/group).
- A live per-class load counter turns red when a class exceeds 39 periods.

### APIs
- `/api/model` (GET/PUT): the editable model. GET prefers the latest DB doc, falls back to
  the bundled file. PUT requires `MONGODB_URI`.
- `/api/generate` (POST): proxies to `${SOLVER_URL}/generate` on Render.
- `/api/timetable` (GET): the current solution (DB latest, else bundled file).

> **Gotcha:** because GET prefers the DB, a **stale DB document overrides the bundled file**.
> If edits or fixes "don’t show," re-seed (`scripts/seed.js`) or run locally with no
> `MONGODB_URI`. This bit us during development.

---

## 9. Bugs already fixed (don’t reintroduce)

1. **Merged classes truncated** — earlier code showed only the first merge pair. Fixed by
   reading the full merged ranges in the parser and grouping display by subject+grade.
   Verify: Mr. Jabir’s Islam shows all of `6A+…+6G`, `7A+…+7F`, `8A+…+8F`.
2. **Religion infeasibility** — splitting religion per merge-group forced multiple religion
   slots per class. Fixed by keying religion as one `(RELIGION, "ALL")` instance (Section 6.2).
3. **Same teacher, multiple merged groups, same slot** — fixed by per-merge-group bucket
   keys so those groups land at different slots.
4. **Whole-school infeasibility from A/L over-capacity** — fixed by soft placement (6.4).

---

## 10. How to extend safely

- **Add/trim a grade’s subjects:** edit `data_model.json` (or use the editor). Keep each
  class ≤ 39. Re-run the solver; confirm 0 clashes for the feasible grades.
- **Add a new grade with a new sheet layout:** write a `parse_grade_X` function that emits the
  Section-4 shape; add its assembly day to `ASSEMBLY` in `solver.py`; nothing else should need
  to change.
- **Change a scheduling rule:** locate the matching constraint in Section 6.3 and modify it.
  Always re-run the clash check (6.5) afterward.
- **Trim Grades 11–12:** in the editor, reduce each A/L stream to its actual subjects (≈3
  mains + activities) so the per-class load drops to ≤ 39, then regenerate.

---

## 11. Run & deploy quick reference

**Local (no DB, uses bundled data):**
```
npm install && npm run build && npm start      # http://localhost:3000
```

**Regenerate data from the spreadsheet:**
```
pip install -r requirements.txt
python parse_data.py            # writes data_model.json
python solver.py data_model.json 60   # writes solution.json
cp solution.json data/ && cp data_model.json data/
```

**Deploy (free):** MongoDB Atlas (seed with `scripts/seed.js`), Vercel (set `MONGODB_URI`,
`MONGODB_DB`, `SOLVER_URL`), Render (reads `render.yaml`, set `MONGODB_URI`). Free tiers sleep
when idle, so the first regenerate after a quiet period can take 30–60s.

---

## 12. Verified status

- Grades 6–10: solved with **0 teacher clashes, 0 class clashes** (OPTIMAL/feasible).
- Grades 11–12: present and editable; scheduled best-effort pending A/L trimming.
- Assembly fixed at Period 1 (Wed for 6–8, Thu for 9–12).
- Personal timetables match the official Lyceum template, with merged classes shown combined.
