# User Guide

## 1. Opening the App

Navigate to **https://tt-app-lime.vercel.app**. You will see:

```
2026 · Whole-School Schedule
The Timetable Register
Clash-free schedules for every class and teacher
```

## 2. Navigation Bar (Grade Tabs)

At the top, a tab bar shows:

| Tab | Action |
|-----|--------|
| **Gr 6** … **Gr 12** | Click to view that grade's class timetables |
| **Teachers** | Switches to teacher search mode |
| **Issues (N)** | Opens the issues/warnings panel (N = count) |
| **Edit data ->** | Opens the data editor page |

## 3. Viewing a Class Timetable

1. Click a grade tab (e.g. **Gr 10**).
2. Below the tabs, a **class selector** shows buttons for each class/stream in that grade (e.g. `10 PED SCI A`, `10 PED SCI B`, `10 PED COM`, `10 NAT A`, `10 NAT B`, `10 EXT`).
3. Click a class to see its weekly timetable grid:

```
Day / Time |  P1  |  P2  |  P3  |  P4  |  P5  |  P6  |  P7  |  P8
Monday     | Math | Eng  | …    | …  ‖ | Sci  | …    | …    | …
Tuesday    | …    | …    | …    | …  ‖ | …    | …    | …    | …
...
```

- **Schedule:** Monday – Friday columns, 8 periods per day (P1–P8). A double border separates P4 and P5 (interval after P4).
- **Assembly:** Shown in a teal cell on the grade's assembly day (Wednesday for Gr 6–8, Thursday for Gr 9–12).
- **Single subject cells:** Show the subject name and teacher name.
- **Bucket cells:** Show a `Choose one` tag above a list of simultaneous options (e.g. Economics / Biology / Combined Maths). The cell has a coloured left border matching the bucket colour.
- **Empty cells:** Have a diagonal cross-hatch pattern.

### Class Search

Click the **Search class…** input and type a class name (e.g. `6G`, `10 NAT`, `11 PED`). Results appear in a dropdown. Click a result to jump directly to that class.

## 4. Viewing a Teacher Timetable

1. Click the **Teachers** tab.
2. Type a teacher name in the **Search teacher…** input (e.g. `Rusiri`, `Nimnada`, `Chinthaka`).
3. Click the result to see the teacher's personal timetable.

The teacher view uses a different layout:

| Time | Monday | Tuesday | Wednesday | Thursday | Friday |
|------|--------|---------|-----------|----------|--------|
| **7.40 – 8.15** | Subject | … | … | … | … |
| **Register Marking** | *(grey row, all days)* |
| **8.30 – 9.10** | … | … | … | … | … |
| … | | | | | |
| **Interval** | *(grey row, all days)* |
| **Seiri Time** | *(grey row, all days)* |
| **10.55 – 11.35** | … | … | … | … | … |
| … | | | | | |

Cells show the subject name and which classes are involved (e.g. `6A+6B` for a merged group).

## 5. Exporting

Two export buttons are always visible (except in Issues mode):

| Button | Format | Content |
|--------|--------|---------|
| **Download PDF** | PDF file | Current class or teacher timetable |
| **Download Excel** | XLSX file | Current class or teacher timetable |

- **Class export:** Shows the full weekly grid with all subjects and teachers.
- **Teacher export (PDF personal):** Uses the official Lyceum International School template with fields for teacher name, employee number, subjects taught, and section.

## 6. Downloading Exports

1. Select the class or teacher you want to export.
2. Click **Download PDF** or **Download Excel**.
3. The file is generated in your browser and downloaded immediately.

## 7. Regenerating the Timetable

1. Click the **Issues (N)** tab.
2. Click the **Regenerate All** button.
3. The generator runs up to 10 attempts and returns the best result (fewest warnings).
4. The timetable updates automatically.

See [03-issues-panel.md](03-issues-panel.md) for details on interpreting and fixing issues.

## 8. Editing School Data

1. Click **Edit data ->** in the navigation bar.
2. The editor page opens with the same grade tabs.
3. **Classes bar:** shows class pills with their total period load. Red means over 39 (won't fully fit).
4. **Subject table:**

   | Column | What to enter |
   |--------|---------------|
   | **Subject** | Subject name |
   | **Teacher** | Teacher's full name |
   | **Periods** | Weekly period count |
   | **Classes** | Checkboxes — tick 1 for a single class, tick 2+ for a merged group |
   | **Bucket key** | Leave blank for core subjects, or enter a bucket ID for bucket subjects |

5. Click **Save changes** to persist to MongoDB.
6. Click **Generate timetable** to run the Python solver (external service) or use **Regenerate All** on the main page to use the local JS generator.

## 9. Key Concepts

- **Core subject:** Each class gets its own periods independently (e.g. English, Maths).
- **Bucket subject:** Multiple subjects run simultaneously; students choose one option. All bucket subjects share the same slot.
- **Merged group:** Two or more classes are taught together in one slot by the same teacher (e.g. `6A+6B` for Speech & Drama).
- **Assembly:** A fixed slot per grade (Wednesday P1 for Gr 6–8, Thursday P1 for Gr 9–12).
