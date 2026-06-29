# Issues Panel

The Issues panel shows scheduling problems that the generator could not resolve. Access it by clicking the **Issues (N)** tab (where N is the warning count).

## Panel Header

- **"Issues (N)"** — the title showing total warning count
- Subtitle: *"Each issue represents periods that could not be auto-placed. Click Fix to reduce the subject's period count by the shortage and regenerate."*
- **"Regenerate All"** button — re-runs the generator (up to 10 attempts)
- **"Alternative Options"** toggle — shows generation strategy notes

## Issues Table Columns

| Column | Description | Example |
|--------|-------------|---------|
| **Grade** | The affected grade | `Grade 10`, `Grade 11`, `Grade 12` |
| **Type** | `Bucket` (yellow) or `Lesson` (red) — indicates what kind of placement failed | `Bucket`, `Lesson` |
| **Subject / Bucket** | For Lesson type: the subject name. For Bucket type: the bucket ID | `English`, `Motivational`, `nat_g12_b1` |
| **Teacher** | The teacher assigned to the subject (or `—` for buckets) | `Ms. Nimnada`, `—` |
| **Class** | The affected class (or `—` for grade-wide subjects) | `6F`, `11 PED SCI`, `—` |
| **Short** | Number of periods that could not be placed | `1`, `2`, `5` |
| **Action** | **"Fix"** button — click to reduce that subject's period count by the short amount and regenerate | |

## Warning Types

### 1. Bucket Warnings (Type: Bucket)

Indicates a bucket group could not be fully scheduled.

**Format:**
```json
{"grade":"Grade 12","type":"bucket","id":"nat_g12_b1","short":5}
```

**Appearance in table:**
- Type badge: **Bucket** (yellow background)
- Subject column shows the bucket ID (e.g. `nat_g12_b1`)
- Teacher: `—`
- Class: `—`

**Common causes:**
- The bucket's teachers have reached their daily cap and cannot fit more periods
- All available slots are occupied by other buckets or activities
- Ms. Rusiri (44 periods) has more work than physical slots (40 max)

### 2. Lesson Warnings (Type: Lesson)

Indicates a core subject period could not be placed.

**Format:**
```json
{"grade":"Grade 11","type":"lesson","subject":"Motivational","teacher":"Mr. Chinthaka","class":"11 PED SCI","short":2}
```

**Appearance in table:**
- Type badge: **Lesson** (red background)
- Subject column shows the subject name
- Teacher column shows the teacher name
- Class column shows the affected class

**Common causes:**
- The class has no free slots at times when the teacher is available
- The subject is merged across all classes and no common free slot exists
- The class is overloaded (Gr 11/12 PED classes have 43 periods but only 39 slots)

## The "Fix" Button

Clicking **Fix** performs the following:

1. Looks up the subject in the data model
2. Reduces its period count by the short amount
3. Calls **Regenerate All** automatically

Example: If Motivational (periods: 2) has `short: 2`, clicking Fix reduces it to `periods: 0` and regenerates.

**Important:** Fix changes the source data. If MongoDB is connected, the change persists. Otherwise it persists only for the current session.

## Regenerate All

The **Regenerate All** button at the bottom of the panel re-runs the full generator. It has two purposes:

1. **After fixing issues** — regenerate to see if the fix resolved the warnings
2. **After data edits** — regenerate to apply data changes to the timetable

The generator runs up to 10 random restarts and returns the best result.

## Common Warnings

### Grade 11 / 12 PED Class Overload

```
Grade 11  Lesson  Motivational     Mr. Chinthaka   11 PED SCI   short: 2
Grade 11  Lesson  PE               New PHE 2 (G11) 11 PED SCI   short: 1
Grade 11  Lesson  Library          New LIB (G11)   11 PED SCI   short: 1
```

**Cause:** Each Grade 11/12 PED class needs 43 periods but only 39 are available (40 total − 1 assembly). 4 periods must fail.

**Resolution options:**
- Accept the warnings (the most important subjects are placed)
- Click **Fix** on less critical subjects to reduce their period count
- Edit the data to reduce bucket periods (not recommended without spec changes)

### nat_g12_b1 Bucket Shortfall

```
Grade 12  Bucket  nat_g12_b1  —  —  short: 5
```

**Cause:** Ms. Rusiri Jayakodi teaches 4 academic buckets (44 total periods) but only has 40 physical slots per week (cap raised to 8/day). The bucket gets only 5–6 of its 11 slots.

**Resolution:** This is a fundamental capacity constraint. The generator places as many as possible (5–6 slots). The remaining periods physically cannot fit.

### Grade 6–10 Single Subject Shortfalls

```
Grade 6  Lesson  English  Ms. Nimnada  6F  short: 1
Grade 7  Lesson  Computer Science  Ms. Tharanji  7D  short: 1
```

**Cause:** A specific class-teacher combination had no available slot. This is usually a transient issue — regenerating often resolves it.

**Resolution:** Click **Regenerate All** first. If the warning persists, click **Fix**.

## Grade 11 / 12 Remaining Capacity

The following subjects are merged across all 4 classes, so they need a slot where all classes are simultaneously free. After academic buckets consume 33 of the 39 slots, finding common free slots is very difficult:

| Subject | Periods | Status |
|---------|---------|--------|
| Motivational | 2 | Usually fails (needs 2 common slots) |
| PE | 1 | Usually placed (per-class after split) |
| Library | 1 | Usually placed (per-class after split) |
| Peer Tutoring | 2 | Usually placed (per-class after split) |
| General English (G11) | 1 | Usually placed (per-class after split) |
| Recreational (G12) | 1 | Usually placed (per-class after split) |
| Effective Speech | 1 | Usually placed (per-class after split) |
