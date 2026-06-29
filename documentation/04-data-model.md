# Data Model

## Overall Structure

```json
{
  "grades": [
    {
      "grade": "Grade 6",
      "classes": ["6A", "6B", ...],
      "subjects": [ ... ],
      "buckets": [ ... ]
    }
  ]
}
```

## Grade Object

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `grade` | string | Display name, e.g. `"Grade 6"`, `"Grade 11"` |
| `classes` | string[] | Stream/division names, e.g. `["6A","6B","6C","6D","6E","6F","6G"]` |
| `subjects` | Subject[] | Array of all subjects for this grade |
| `buckets` | BucketMeta[] | Derived bucket metadata (id, color, subjects list) |

### Classes by Grade

| Grade | Classes |
|-------|---------|
| 6 | 6A, 6B, 6C, 6D, 6E, 6F, 6G |
| 7 | 7A, 7B, 7C, 7D, 7E, 7F |
| 8 | 8A, 8B, 8C, 8D, 8E |
| 9 | 9 PED SCI A, 9 PED SCI B, 9 PED COM, 9 NAT A, 9 NAT B, 9 EXT |
| 10 | 10 PED SCI A, 10 PED SCI B, 10 PED COM, 10 NAT A, 10 NAT B, 10 EXT |
| 11 | 11 PED SCI, 11 PED COM, 11 NAT SCI, 11 NAT COM |
| 12 | 12 PED SCI, 12 NAT SCI, 12 PED COM, 12 NAT COM |

## Subject Object

```json
{
  "subject": "English",
  "weekly": 8,
  "color": "none",
  "religionBlock": false,
  "bucketId": null,
  "assignments": [
    {
      "teacher": "Ms. Nimnada",
      "classes": ["6A"],
      "periods": 8,
      "mergedGroup": null
    }
  ]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `subject` | string | Subject name (e.g. `"English"`, `"Mathematics"`) |
| `weekly` | number | Default weekly periods |
| `color` | string | Color key for the UI. `"none"` = core/auto, otherwise a bucket color key |
| `religionBlock` | boolean | `true` if this is part of a religion bucket |
| `bucketId` | string | `null` for core subjects, or a bucket group ID (e.g. `"nat_g11_b1"`, `"g11_act"`) |
| `assignments` | Assignment[] | One or more teacher-class-period combinations |

## Assignment Object

```json
{
  "teacher": "Ms. Nimnada",
  "classes": ["6A"],
  "periods": 8,
  "mergedGroup": ["6A"]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `teacher` | string | Teacher's full name (e.g. `"Ms. Nimnanda"`, `"Mr. Chinthaka"`) |
| `classes` | string[] | Classes this assignment serves. **1 class** = single. **2+ classes** = merged group |
| `periods` | number | Weekly period count for this assignment |
| `mergedGroup` | string[] | Copy of `classes` — informational; denotes a merged teaching group |

## Core vs Bucket Subjects

### Core Subjects (`bucketId: null`)

Each class gets its own independent periods. Example — English in Grade 6 has 7 assignments (one per class), each with periods = 8:

```json
{
  "subject": "English",
  "weekly": 8,
  "bucketId": null,
  "assignments": [
    { "teacher": "Ms. Nimnada", "classes": ["6A"], "periods": 8 },
    { "teacher": "Ms. Nimnada", "classes": ["6B"], "periods": 8 },
    ...
  ]
}
```

### Bucket Subjects (`bucketId` set)

Multiple subjects share the same slot. All subjects with the same `bucketId` run simultaneously, and students choose one. Each subject has periods equal to the bucket's total need.

```json
{
  "subject": "Sinhala",
  "bucketId": "t9_0.60",
  "assignments": [{ "teacher": "...", "classes": ["10 PED SCI A","10 PED SCI B","10 PED COM","10 NAT A","10 NAT B","10 EXT"], "periods": 5 }]
},
{
  "subject": "Tamil",
  "bucketId": "t9_0.60",
  "assignments": [{ "teacher": "...", "classes": [...], "periods": 5 }]
}
```

Both Sinhala and Tamil (and Buddhism) share `bucketId: "t9_0.60"`. They occupy 5 slots per week, running simultaneously — one Sinhala, one Tamil, one Buddhism at each of the 5 slots.

## Merged Groups

When two or more classes are taught together by the same teacher, the assignment has multiple classes:

```json
{ "teacher": "New EFS (Grade 6)", "classes": ["6A", "6B"], "periods": 1 }
```

This means 6A and 6B attend Effective Speech together. In the timetable, this shows as `"6A+6B"` with a single subject entry.

## Grade 11 / 12 Special Structure

Grade 11 and 12 follow the G.C.E. A/L system with academic orientations:

### Academic Orientations

| Orientation | Classes | Academic Bucket Groups |
|-------------|---------|----------------------|
| **NAT** (Natural Sciences) | `11 NAT SCI`, `11 NAT COM` | Physics+Accounting, Chemistry+Business+ICT, Biology+CombinedMaths+Economics |
| **PED** (Physical Sciences) | `11 PED SCI`, `11 PED COM` | Economics+Biology+CombinedMaths, Physics+Accounting, Chemistry+Business+IT |

Each academic bucket group has **11 periods/week**. The bucket IDs follow the pattern `nat_g11_b1` / `ped_g11_b4`, etc.

### National (Non-Academic) Activities

These subjects apply to all classes in the grade:

| Activity | Periods | Teacher |
|----------|---------|---------|
| Music & Arts (4 options) | 1 | Per-option teacher |
| Religion (5 options) | 1 | Per-option teacher |
| PE | 1 | NEW PHE 2 |
| Library | 1 | New LIB |
| Peer Tutoring | 2 | New PTR |
| Motivational (whole-grade merged) | 2 | Mr. Chinthaka |
| General English (G11 only) | 1 | Ms. Vindya |
| Recreational (G12 only) | 1 | Ms. Shiremila |
| Effective Speech | 1 | Ms. Shiremila |

### Bucket Groups for Grade 11

| Bucket ID | Subjects | Serves |
|-----------|----------|--------|
| `nat_g11_b1` | Physics, Accounting | 11 NAT SCI, 11 NAT COM |
| `nat_g11_b2` | Chemistry, Business, ICT | 11 NAT SCI, 11 NAT COM |
| `nat_g11_b3` | Biology, Combined Maths, Economics | 11 NAT SCI, 11 NAT COM |
| `ped_g11_b4` | Economics, Biology, Combined Maths | 11 PED SCI, 11 PED COM |
| `ped_g11_b5` | Physics, Accounting | 11 PED SCI, 11 PED COM |
| `ped_g11_b6` | Chemistry, Business, IT | 11 PED SCI, 11 PED COM |
| `g11_act` | Eastern Music, Western Music, Art, Cultural Dancing | ALL classes |
| `g11_rel` | Buddhism, Hinduism, Islam, Catholicism, Christianity | ALL classes |

### Bucket Groups for Grade 12

Same structure as Grade 11 but with `g12_` and `nat_g12_` / `ped_g12_` prefixes. Grade 12 PED uses `Recreational` instead of `General English`.

## Color Keys

Bucket colors are defined in `lib/colors.js`. Each bucket ID maps to a pastel color for the UI:

| Key | Color | Used By |
|-----|-------|---------|
| `rgb:FFFFFF00` | `#FFF275` (yellow) | Grade 9/10 N&A bucket |
| `t9_0.60` | `#9DC3E6` (light blue) | Grade 9/10 Sinhala/Tamil |
| `t7_0.60` | `#A9D08E` (green) | Grade 7 Western Music/French |
| `t6_0.60` | `#C6E0B4` (light green) | Grade 6 Civics/Cookery/Tech |
| `RELIGION` | `#F4B183` (orange) | Religion blocks |
| `pec_g6` | `#F4B183` (orange) | Grade 6 PE/LF/CS |
| `nat_g11_b1` .. `nat_g12_b3` | Per-bucket pastels | Grade 11/12 academic buckets |
| `g11_act`, `g11_rel`, `g12_act`, `g12_rel` | Per-bucket pastels | Grade 11/12 activities |

## Solution Format

The generator output is stored as:

```json
{
  "placements": [
    { "grade": "Grade 6", "class": "6A", "slot": 16, "day": 2, "period": 0,
      "subject": "English", "teacher": "Ms. Nimnada", "bucketId": null }
  ],
  "warnings": [
    { "grade": "Grade 11", "type": "lesson", "subject": "Motivational",
      "teacher": "Mr. Chinthaka", "class": "11 PED SCI", "short": 2 }
  ],
  "DAYS": ["Mon","Tue","Wed","Thu","Fri"],
  "PPD": 8,
  "INTERVAL_AFTER": 4
}
```

### Placement Fields

| Field | Description |
|-------|-------------|
| `grade` | Grade name |
| `class` | Class/stream |
| `slot` | 0–39 (day × 8 + period) |
| `day` | 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri |
| `period` | 0=P1 … 7=P8 |
| `subject` | Subject name |
| `teacher` | Teacher name (or null for Assembly) |
| `bucketId` | Bucket ID or null |

### Warning Fields

| Field | Description |
|-------|-------------|
| `grade` | Affected grade |
| `type` | `"bucket"` or `"lesson"` |
| `id` | Bucket ID (bucket warnings only) |
| `subject` | Subject name (lesson warnings only) |
| `teacher` | Teacher name (lesson warnings only) |
| `class` | Affected class (lesson warnings only) |
| `short` | Number of unplaced periods |
