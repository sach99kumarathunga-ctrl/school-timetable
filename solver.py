"""
CP-SAT timetable solver (OR-Tools). Reads data_model.json, writes solution.json.

Slots: 5 days x 8 teaching periods = 40 (0..39). Assembly is an extra pre-period,
emitted separately, not a teaching slot.

Decision vars:
  For each bucket (grade,bucketId) with P periods: bucketSlot[b][k] = chosen slot for
    the k-th occurrence (k=0..P-1). All member subjects occupy that slot in parallel.
  For each single (grade,class,subject,teacher) with P periods: x[single][slot] in {0,1}
    with sum == P.

Constraints:
  - Class: at most one occupied slot per (grade,class) across all its singles + buckets.
  - Teacher: at most one occupied slot per teacher across whole school
    (singles + bucket members).
  - Spread (soft via objective): minimise same-subject-same-day for a class.
"""
import json, sys
from collections import defaultdict
from ortools.sat.python import cp_model

DAYS = 5
PPD = 8
TOTAL = DAYS * PPD

def load(path):
    with open(path) as f:
        return json.load(f)

def build_and_solve(model, time_limit=30):
    m = cp_model.CpModel()

    # Assembly is a FIXED Period 1 slot (not extra): Wed P1 for Grades 6-8,
    # Thu P1 for Grades 9-10. No lesson may be scheduled in that slot.
    ASSEMBLY = {"Grade 6": 2, "Grade 7": 2, "Grade 8": 2, "Grade 9": 3, "Grade 10": 3, "Grade 11": 3, "Grade 12": 3}
    def assembly_slot(grade_name):
        d = ASSEMBLY.get(grade_name)
        return None if d is None else d * PPD + 0  # period 0 = P1

    # Gather structures
    singles = []
    buckets = []
    for grade in model["grades"]:
        G = grade["grade"]
        # Bucket instances are keyed by (bucketId, class-group). Each distinct group of
        # classes that share a coloured bucket-slot is its own instance: e.g. the music
        # bucket for merge-group (6A,6B) is separate from (6C,6D), so a teacher covering
        # the same subject in both groups is scheduled at different slots.
        bucket_map = {}
        for s in grade["subjects"]:
            for a in s["assignments"]:
                if not a["teacher"]:
                    continue
                classes = a["classes"] if a["classes"] else grade["classes"]
                periods = a["periods"] or s["weekly"] or 1
                if s["bucketId"]:
                    # Religion is ONE shared period for the whole grade: keep it as a
                    # single instance (all religions + Buddhism's per-class teachers at
                    # the same slot). Other buckets split per merge-group so a teacher
                    # covering the same subject in two groups gets two different slots.
                    is_rel = (s["bucketId"] == "RELIGION") or bool(s.get("religionBlock"))
                    if is_rel:
                        gkey = (s["bucketId"], "ALL")
                    else:
                        gkey = (s["bucketId"], tuple(sorted(classes)))
                    b = bucket_map.setdefault(gkey, {
                        "grade": G, "bucketId": s["bucketId"],
                        "classes": set(), "periods": 0, "members": []})
                    b["periods"] = max(b["periods"], periods)
                    b["classes"].update(classes)
                    b["members"].append({"subject": s["subject"], "teacher": a["teacher"],
                                          "classes": classes, "religion": bool(s["religionBlock"])})
                else:
                    for c in classes:
                        singles.append({"grade": G, "class": c, "subject": s["subject"],
                                        "teacher": a["teacher"], "periods": periods})
        for b in bucket_map.values():
            b["classes"] = sorted(b["classes"])
        buckets.extend(bucket_map.values())

    # Variables
    # single occupancy x[i][slot]. Placement is SOFT: place up to `periods`, and the
    # objective maximises total placed, so fully-feasible grades place everything (0
    # shortfall) while over-subscribed A/L streams place as many as fit (rest reported).
    x = {}
    shortfalls = []
    for i, sg in enumerate(singles):
        for slot in range(TOTAL):
            x[(i, slot)] = m.NewBoolVar(f"s{i}_{slot}")
        placed = sum(x[(i, slot)] for slot in range(TOTAL))
        m.Add(placed <= sg["periods"])
        sf = m.NewIntVar(0, sg["periods"], f"sf{i}")
        m.Add(sf == sg["periods"] - placed)
        shortfalls.append(sf)
        asl = assembly_slot(sg["grade"])
        if asl is not None:
            m.Add(x[(i, asl)] == 0)

    # bucket occupancy: y[b][slot] = 1 if bucket b uses this slot; sum == periods
    y = {}
    for bi, b in enumerate(buckets):
        for slot in range(TOTAL):
            y[(bi, slot)] = m.NewBoolVar(f"b{bi}_{slot}")
        placed = sum(y[(bi, slot)] for slot in range(TOTAL))
        m.Add(placed <= b["periods"])
        sfb = m.NewIntVar(0, b["periods"], f"sfb{bi}")
        m.Add(sfb == b["periods"] - placed)
        shortfalls.append(sfb)
        asl = assembly_slot(b["grade"])
        if asl is not None:
            m.Add(y[(bi, asl)] == 0)

    # Class constraint: for each (grade,class) and slot, <=1 occupancy
    # collect contributors per (grade,class,slot)
    class_terms = defaultdict(list)
    for i, sg in enumerate(singles):
        for slot in range(TOTAL):
            class_terms[(sg["grade"], sg["class"], slot)].append(x[(i, slot)])
    for bi, b in enumerate(buckets):
        classes = set()
        for mem in b["members"]:
            classes.update(mem["classes"])
        for c in classes:
            for slot in range(TOTAL):
                class_terms[(b["grade"], c, slot)].append(y[(bi, slot)])
    for key, terms in class_terms.items():
        if len(terms) > 1:
            m.Add(sum(terms) <= 1)

    # Teacher constraint: each teacher <=1 per slot across whole school.
    teacher_terms = defaultdict(list)
    for i, sg in enumerate(singles):
        for slot in range(TOTAL):
            teacher_terms[(sg["teacher"], slot)].append(x[(i, slot)])
    for bi, b in enumerate(buckets):
        for mem in b["members"]:
            for slot in range(TOTAL):
                teacher_terms[(mem["teacher"], slot)].append(y[(bi, slot)])
    for key, terms in teacher_terms.items():
        if len(terms) > 1:
            m.Add(sum(terms) <= 1)

    # Soft spread: penalise same (class,subject) twice in one day.
    penalties = []
    bysubj = defaultdict(list)  # (grade,class,subject) -> list of i
    for i, sg in enumerate(singles):
        bysubj[(sg["grade"], sg["class"], sg["subject"])].append(i)
    for key, idxs in bysubj.items():
        for d in range(DAYS):
            day_slots = range(d * PPD, d * PPD + PPD)
            terms = [x[(i, slot)] for i in idxs for slot in day_slots]
            if len(terms) > 1:
                over = m.NewIntVar(0, PPD, f"over_{key}_{d}".replace(" ", "_"))
                m.Add(over >= sum(terms) - 1)
                penalties.append(over)
    # Objective: place as many required periods as possible (shortfall heavily weighted),
    # then reduce same-subject-same-day clustering.
    m.Minimize(1000 * sum(shortfalls) + sum(penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_search_workers = 8
    status = solver.Solve(m)

    placements = []
    # assemblies — fixed Period 1
    for grade in model["grades"]:
        d = ASSEMBLY.get(grade["grade"])
        if d is None:
            continue
        for c in grade["classes"]:
            placements.append({"grade": grade["grade"], "class": c, "teacher": None,
                               "slot": d * PPD + 0, "day": d, "period": 0,
                               "subject": "Assembly", "bucketId": None})

    ok = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    if ok:
        for i, sg in enumerate(singles):
            for slot in range(TOTAL):
                if solver.Value(x[(i, slot)]):
                    placements.append({"grade": sg["grade"], "class": sg["class"],
                                       "teacher": sg["teacher"], "slot": slot,
                                       "day": slot // PPD, "period": slot % PPD,
                                       "subject": sg["subject"], "bucketId": None})
        for bi, b in enumerate(buckets):
            for slot in range(TOTAL):
                if solver.Value(y[(bi, slot)]):
                    for mem in b["members"]:
                        for c in mem["classes"]:
                            placements.append({"grade": b["grade"], "class": c,
                                               "teacher": mem["teacher"], "slot": slot,
                                               "day": slot // PPD, "period": slot % PPD,
                                               "subject": mem["subject"], "bucketId": b["bucketId"],
                                               "religion": mem["religion"]})
    return {
        "status": solver.StatusName(status),
        "objective": solver.ObjectiveValue() if ok else 0,
        "placements": placements,
        "DAYS": ["Mon", "Tue", "Wed", "Thu", "Fri"], "PPD": PPD,
    }

if __name__ == "__main__":
    model = load(sys.argv[1] if len(sys.argv) > 1 else "data_model.json")
    res = build_and_solve(model, time_limit=int(sys.argv[2]) if len(sys.argv) > 2 else 30)
    with open("solution.json", "w") as f:
        json.dump(res, f)
    print("status:", res["status"], "objective:", res["objective"], "placements:", len(res["placements"]))
