# Scheduling Logic

## Overview

The generator (`lib/generator.js`) is a stochastic greedy solver with random restarts. It places lessons slot-by-slot, using shuffled day/period orders for natural spreading. It runs **up to 10 attempts** and returns the attempt with fewest warnings.

### Constants

| Constant | Value |
|----------|-------|
| Periods per day (PPD) | 8 |
| Days per week | 5 (Mon–Fri) |
| Total slots per week | 40 (8 × 5) |
| Available slots (minus assembly) | 39 per class |
| Interval | After Period 4 |
| MAX_TRIES | 10 |

## Assembly Reservations

Before any placement, each grade's assembly slot is reserved:

| Grades | Day | Period |
|--------|-----|--------|
| 6, 7, 8 | Wednesday (day 2) | P1 (period 0) |
| 9, 10, 11, 12 | Thursday (day 3) | P1 (period 0) |

## Teacher Daily Cap

Each teacher has a **daily cap** — the maximum number of periods they can teach in one day.

**Formula:**
```
cap = min(7, max(3, ceil(total_periods / 5) + 1))
```

- Start with `ceil(total / 5) + 1` (e.g. total=30 → ceil(6)+1 = 7)
- Clamp between 3 and 7
- If total exceeds `cap × 5` (teacher can't fit at current cap), raise to `min(PPD, ceil(total/5)+1)` — allows up to 8 periods/day for overloaded teachers

**Examples:**

| Teacher | Total Periods | Cap | Daily Max × 5 |
|---------|--------------|-----|---------------|
| Regular teacher | 30 | 7 | 35 |
| Light teacher | 10 | 3 | 15 |
| Ms. Rusiri Jayakodi | 44 | 8 | 40 (raised) |

The daily cap is enforced in `tryPlacePeriod`, `placeLesson`, `placeBucket`, and `placeLessonForce`. Each teacher keeps a `teacherDaySlotSet` tracking unique occupied slots per day.

## PASS 1: Buckets (Grade-Wide)

### What is a Bucket?

A **bucket** is a group of subjects that run simultaneously in the same slot. Students choose one option. All subjects in a bucket share the same period across all classes in the grade.

Examples:
- **Grade 10 N&A bucket:** Sinhala / Tamil / Buddhism (3 options, 5 periods/week)
- **Grade 11 Music & Arts:** Eastern Music / Western Music / Art / Cultural Dancing (1 period/week)
- **Grade 11 Religion:** Buddhism / Hinduism / Islam / Catholicism / Christianity (1 period/week)
- **Grade 11 NAT academic bucket:** Physics / Accounting (11 periods/week, serves NAT classes)

### Bucket Placement Algorithm

1. Collect **all bucket lessons across all grades** into a single list.
2. **Sort buckets** by:
   - **Primary:** Need ascending (1-period buckets like Music & Arts, Religion placed first)
   - **Secondary:** Teacher pressure descending (most constrained teacher first)
   - **Tertiary:** Lesson count descending
3. For each bucket, `placeBucket` runs:
   - **Round-robin across days** (`dayOrder[i % 5]`), one slot per iteration
   - Each iteration: pick a day in shuffled order, try each period (shuffled)
   - All bucket subjects' teachers and classes must be free at the chosen slot
   - Teacher daily caps are checked for all teachers in the bucket
   - `maxPerDay = ceil(periods / 5)` limits slots per day
   - If `placeBucket` can't place all periods, a **relaxed** retry allows +1 per day
   - Remaining shortfall becomes a **warning**

## PASS 2: Singles (Core Subjects)

After all buckets are placed, core subjects are placed individually.

### Teacher Sorting

Teachers are sorted by:
1. **Total load descending** (most periods first)
2. **Lesson count descending**

This ensures heavily loaded teachers (who are most constrained) get first choice of remaining slots.

### Per-Class Singles

Singles with 1 class per assignment use `placeLesson`:

- **Round-robin across days:** `day = dayOrder[iter % 5]`
- **Shuffled periods:** Each day's periods are randomly ordered
- **Teacher cap check:** Enforces daily maximum
- **Subject-per-day limit:** `ceil(periods/5)` periods per day for the same subject
- **Relaxed retry:** If short, retry with +1 per-day limit
- **Force retry:** If still short, retry with no per-day limit

### Interleaved Singles (Shared Teacher)

When a teacher has **multiple single lessons** in the same grade (e.g. Ms. Nimnada teaches English to 7A, 7B, 7C, 7D), they use **interleaved placement** to prevent one class from consuming all the teacher's good slots:

1. Place 1 period for class A, then 1 for class B, then 1 for class C, etc.
2. Repeat round-robin until all classes have all their periods.
3. Each attempt tries all days (shuffled) and all periods (shuffled).
4. If no class can place anything in a round, the per-day limit is relaxed by +1.

### Merged-Grade Singles

Subjects that serve **all classes** of a grade (e.g. Motivational with Mr. Chinthaka, serving all 4 Grade 11 classes) are placed the same way as per-class singles — they need all classes and the teacher to be free at the chosen slot. These are harder to place because they require a slot where every class in the grade is free simultaneously.

## Capacity Constraints

### Per-Class Capacity

Each class has 39 available slots (40 total − 1 assembly). Grade 11 and 12 PED classes are spec'd with:
- 33 academic bucket periods
- 2 whole-grade buckets (Music & Arts, Religion)
- 8 single-period activities (PE, Library, Peer Tutoring × 2, Motivational × 2, General English/Recreational, Effective Speech)
- **Total: 43 periods — 4 more than available**

This means 4 periods **must** fail per overloaded class. The generator places what it can and reports the shortfall as warnings.

### Teacher Capacity

Each teacher has a maximum of 40 periods per week (8/day × 5 days). A teacher with 44 periods (e.g. Ms. Rusiri, who teaches in 4 buckets × 11 periods) **cannot physically fit** — 4 periods will always fail.

## Random Restarts

Because the generator uses `shuffleArr()` extensively (shuffled days, shuffled periods, shuffled class order), each attempt produces a different result. The `generate()` function runs up to 10 attempts and returns the one with the **fewest warnings**.

## Data Flow

```
data/data_model.json
        ↓
   buildLessons()  — converts subjects to lesson objects
        ↓
   teacherTotal()  — sums periods per teacher for cap computation
        ↓
   PASS 1: Buckets (all grades, sorted by need)
        ↓
   PASS 2: Singles (sorted by teacher load, interleaved for multiple)
        ↓
   { placements, warnings }
        ↓
   UI renders timetable grids / Issues panel
```
