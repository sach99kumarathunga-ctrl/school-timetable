// Shared constants + colour mapping for buckets, matching the source workbook.
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const PPD = 8; // teaching periods/day (assembly is an extra pre-period)
export const PERIOD_LABELS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
export const INTERVAL_AFTER = 4; // interval falls after period 4

// Bucket colour keys from the workbook -> display colours (soft tints).
export const BUCKET_COLORS = {
  "RELIGION": "#fde2e2",
  "rgb:FFFFFF00": "#fff7b8",
  "rgb:FF7030A0": "#e6d4f2",
  "t9_0.60": "#cfe2f3",
  "t7_0.60": "#d9ead3",
  "t6_0.60": "#fce5cd",
  "t5_0.80": "#f4cccc",
  "t4_0.60": "#d0e0e3",
  "t8_0.80": "#ead1dc",
  "t3_0.80": "#d9d2e9",
  "idx:9": "#cfe2f3",
};

// Stable colour for any bucketId, falling back to a hash tint.
export function bucketColor(bucketId) {
  if (!bucketId) return null;
  if (BUCKET_COLORS[bucketId]) return BUCKET_COLORS[bucketId];
  let h = 0;
  for (let i = 0; i < bucketId.length; i++) h = (h * 31 + bucketId.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 88%)`;
}

export function assemblyDayFor(grade) {
  if (["Grade 6", "Grade 7", "Grade 8"].includes(grade)) return 2; // Wednesday
  if (["Grade 9", "Grade 10"].includes(grade)) return 3; // Thursday
  return null;
}

// Build an empty grid [day][period] for a single class or teacher.
export function emptyGrid() {
  return DAYS.map(() => Array(PPD).fill(null));
}

// Group placements into per-class grids: { "Grade 6/6A": grid }
export function classGrids(placements) {
  const grids = {};
  for (const p of placements) {
    const key = `${p.grade}/${p.class}`;
    grids[key] ||= { grade: p.grade, class: p.class, assemblyDay: assemblyDayFor(p.grade), grid: emptyGrid() };
    if (p.subject === "Assembly") continue; // shown via assemblyDay, not as a teaching cell
    const cell = grids[key].grid[p.day][p.period];
    if (cell) {
      cell.subjects.push({ subject: p.subject, teacher: p.teacher });
    } else {
      grids[key].grid[p.day][p.period] = {
        bucketId: p.bucketId,
        subjects: [{ subject: p.subject, teacher: p.teacher }],
      };
    }
  }
  return grids;
}

// Per-teacher grids: { "Mr. Mithun": { grid, teacher } }
export function teacherGrids(placements) {
  const grids = {};
  for (const p of placements) {
    if (!p.teacher || p.subject === "Assembly") continue;
    grids[p.teacher] ||= { teacher: p.teacher, grid: emptyGrid() };
    const cell = grids[p.teacher].grid[p.day][p.period];
    const entry = { subject: p.subject, klass: `${p.grade.replace("Grade ", "")}${p.class.replace(/[^0-9A-Za-z]/g, "")}`, grade: p.grade, class: p.class, bucketId: p.bucketId };
    if (cell) cell.push(entry);
    else grids[p.teacher].grid[p.day][p.period] = [entry];
  }
  return grids;
}

export function allTeachers(placements) {
  const set = new Set();
  for (const p of placements) if (p.teacher) set.add(p.teacher);
  return [...set].sort();
}

export function allClasses(placements) {
  const set = new Set();
  for (const p of placements) set.add(`${p.grade}/${p.class}`);
  return [...set].sort();
}
