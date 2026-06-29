// Timetable generator (ES module) — whole-school, clash-free.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const PPD = 8; // periods/day (4 before interval + 4 after; interval after P4)
export const INTERVAL_AFTER = 4;
const TOTAL_SLOTS = DAYS.length * PPD;
const MAX_TRIES = 10;

const ASSEMBLY = {
  "Grade 6": { day: 2, period: 0 },
  "Grade 7": { day: 2, period: 0 },
  "Grade 8": { day: 2, period: 0 },
  "Grade 9": { day: 3, period: 0 },
  "Grade 10": { day: 3, period: 0 },
  "Grade 11": { day: 3, period: 0 },
  "Grade 12": { day: 3, period: 0 },
};

const slotOf = (d, p) => d * PPD + p;

export function applyOverrides(model, overrides = []) {
  if (!overrides.length) return model;
  for (const g of model.grades) {
    for (const s of g.subjects) {
      for (const a of s.assignments) {
        for (const r of overrides) {
          if (g.grade === r.grade && r.matchTeacher.test(a.teacher || "")) {
            a.teacher = r.replaceWith;
            a._override = r.note;
          }
        }
      }
    }
  }
  return model;
}

function buildLessons(grade) {
  const lessons = [];
  for (const s of grade.subjects) {
    for (const a of s.assignments) {
      if (!a.teacher) continue;
      lessons.push({
        grade: grade.grade, subject: s.subject, teacher: a.teacher,
        classes: a.classes.length ? a.classes : grade.classes,
        periods: a.periods || s.weekly || 1,
        bucketId: s.bucketId || null, religion: !!s.religionBlock,
      });
    }
  }
  return lessons;
}

class Scheduler {
  constructor() {
    this.teacherBusy = {}; this.classBusy = {};
    this.teacherDaySlotSet = {}; // teacherDaySlotSet[teacher][day] = Set of slots
    this.placements = [];
  }
  teacherFree(t, slot) { return !(this.teacherBusy[t] && this.teacherBusy[t].has(slot)); }
  classFree(g, c, slot) { return !(this.classBusy[g]?.[c]?.has(slot)); }
  teacherSlotsOnDay(t, day) { return this.teacherDaySlotSet[t]?.[day]?.size || 0; }
  mark(g, c, t, slot, lesson) {
    const day = Math.floor(slot / PPD);
    (this.teacherBusy[t] ||= new Set()).add(slot);
    ((this.teacherDaySlotSet[t] ||= {})[day] ||= new Set()).add(slot);
    ((this.classBusy[g] ||= {})[c] ||= new Set()).add(slot);
    this.placements.push({
      grade: g, class: c, slot, day, period: slot % PPD,
      subject: lesson.subject, teacher: t, bucketId: lesson.bucketId, religion: lesson.religion,
    });
  }
  reserveAssembly(grade, classes) {
    const a = ASSEMBLY[grade]; if (!a) return;
    const slot = slotOf(a.day, a.period);
    for (const c of classes) {
      ((this.classBusy[grade] ||= {})[c] ||= new Set()).add(slot);
      this.placements.push({ grade, class: c, slot, day: a.day, period: a.period, subject: "Assembly", teacher: null, bucketId: null });
    }
  }
}

function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Place a single period for a lesson at a valid slot if possible.
// Returns true if placed, false otherwise.
// limit: per-class per-day max for this subject.
// teacherDayCap: optional max periods this teacher can have on any single day.
function tryPlacePeriod(sched, lesson, blocked, day, period, limit, teacherDayCap = null) {
  const slot = slotOf(day, period);
  if (blocked.has(slot)) return false;
  if (!sched.teacherFree(lesson.teacher, slot)) return false;
  if (!lesson.classes.every(c => sched.classFree(lesson.grade, c, slot))) return false;
  const sameDayCount = sched.placements.filter(p =>
    p.grade === lesson.grade && p.subject === lesson.subject &&
    p.day === day && lesson.classes.includes(p.class)).length;
  if (sameDayCount >= limit) return false;
  if (teacherDayCap !== null && sched.teacherSlotsOnDay(lesson.teacher, day) >= teacherDayCap) return false;
  for (const c of lesson.classes) sched.mark(lesson.grade, c, lesson.teacher, slot, lesson);
  return true;
}

// Place periods for a single lesson — round-robin across days for natural spreading.
function placeLesson(sched, lesson, blocked, relax = false, need = null, teacherDayCap = null) {
  const target = need == null ? lesson.periods : need;
  const maxPerDay = Math.ceil(lesson.periods / 5);
  const limit = relax ? maxPerDay + 1 : maxPerDay;
  let placed = 0;
  const dayOrder = shuffleArr([0, 1, 2, 3, 4]);
  for (let i = 0; i < target * 5 && placed < target; i++) {
    const day = dayOrder[i % 5];
    const slotOrder = shuffleArr(Array.from({ length: PPD }, (_, i) => i));
    for (const period of slotOrder) {
      if (tryPlacePeriod(sched, lesson, blocked, day, period, limit, teacherDayCap)) {
        placed++;
        break;
      }
    }
  }
  return placed;
}

// Place periods with no spread limit (last resort).
function placeLessonForce(sched, lesson, blocked, need, teacherDayCap = null) {
  let placed = 0;
  const dayOrder = shuffleArr([0, 1, 2, 3, 4]);
  for (const day of dayOrder) {
    const slotOrder = shuffleArr(Array.from({ length: PPD }, (_, i) => i));
    for (const period of slotOrder) {
      if (placed >= need) break;
      const slot = slotOf(day, period);
      if (blocked.has(slot)) continue;
      if (!sched.teacherFree(lesson.teacher, slot)) continue;
      if (!lesson.classes.every(c => sched.classFree(lesson.grade, c, slot))) continue;
      if (teacherDayCap !== null && sched.teacherSlotsOnDay(lesson.teacher, day) >= teacherDayCap) continue;
      for (const c of lesson.classes) sched.mark(lesson.grade, c, lesson.teacher, slot, lesson);
      placed++;
    }
  }
  return placed;
}

// Interleaved placement: for a group of lessons sharing the same teacher,
// place them round-robin, one period per lesson at a time.
// This prevents one class from consuming all of the teacher's good slots.
function placeInterleaved(sched, singlesGroup, blocked, teacherDayCap = null) {
  const classToLesson = {};
  const limits = {};
  const placedCounts = {};
  const targets = {};
  for (const l of singlesGroup) {
    const cls = l.classes[0];
    classToLesson[cls] = l;
    targets[cls] = l.periods;
    placedCounts[cls] = 0;
    limits[cls] = Math.ceil(l.periods / 5);
  }
  const classKeys = Object.keys(targets);
  const totalTarget = Object.values(targets).reduce((a, b) => a + b, 0);
  let totalPlaced = 0;
  const maxIter = totalTarget * 5;
  for (let iter = 0; iter < maxIter && totalPlaced < totalTarget; iter++) {
    let placedAny = false;
    for (const cls of shuffleArr([...classKeys])) {
      if (placedCounts[cls] >= targets[cls]) continue;
      const l = classToLesson[cls];
      const dayOrder = shuffleArr([0, 1, 2, 3, 4]);
      for (const day of dayOrder) {
        const periodOrder = shuffleArr(Array.from({ length: PPD }, (_, i) => i));
        for (const period of periodOrder) {
          if (tryPlacePeriod(sched, l, blocked, day, period, limits[cls], teacherDayCap)) {
            placedCounts[cls]++;
            totalPlaced++;
            placedAny = true;
            break;
          }
        }
        if (placedCounts[cls] >= targets[cls]) break;
      }
    }
    if (!placedAny) {
      for (const cls of classKeys) {
        if (placedCounts[cls] < targets[cls]) {
          limits[cls] = Math.min(limits[cls] + 1, PPD);
        }
      }
    }
  }
  return placedCounts;
}

function placeBucket(sched, bucketLessons, blocked, relax = false, need = null, teacherDayCapMap = {}) {
  const periods = need == null ? Math.max(...bucketLessons.map(l => l.periods)) : need;
  const maxPerDay = Math.ceil(periods / 5);
  const dayCount = {};
  let placed = 0;
  const dayOrder = shuffleArr([0, 1, 2, 3, 4]);
  // Round-robin across days for natural spreading
  for (let i = 0; i < periods * 5 && placed < periods; i++) {
    const day = dayOrder[i % 5];
    if (!relax && (dayCount[day] || 0) >= maxPerDay) continue;
    const slotOrder = shuffleArr(Array.from({ length: PPD }, (_, i) => i));
    let placedThisDay = false;
    for (const period of slotOrder) {
      if (placed >= periods) break;
      const slot = slotOf(day, period);
      if (blocked.has(slot)) continue;
      const ok = bucketLessons.every(l => {
        if (!sched.teacherFree(l.teacher, slot)) return false;
        if (!l.classes.every(c => sched.classFree(l.grade, c, slot))) return false;
        const cap = teacherDayCapMap[l.teacher];
        if (cap && sched.teacherSlotsOnDay(l.teacher, day) >= cap) return false;
        return true;
      });
      if (!ok) continue;
      for (const l of bucketLessons)
        for (const c of l.classes) sched.mark(l.grade, c, l.teacher, slot, l);
      dayCount[day] = (dayCount[day] || 0) + 1;
      placed++;
      placedThisDay = true;
      break; // one per day per round-robin iteration
    }
  }
  return placed;
}

function tryGenerate(model) {
  const sched = new Scheduler();
  const gradeMap = {};
  for (const g of model.grades) {
    sched.reserveAssembly(g.grade, g.classes);
    gradeMap[g.grade] = g;
  }
  const warnings = [];

  // Compute total teacher load across ALL grades for daily spread caps
  const teacherTotal = {};
  for (const grade of model.grades) {
    for (const s of grade.subjects) {
      for (const a of s.assignments) {
        if (!a.teacher) continue;
        teacherTotal[a.teacher] = (teacherTotal[a.teacher] || 0) + (a.periods || s.weekly || 1);
      }
    }
  }
  // Daily cap per teacher: ceil(total/5)+1, max 7 (one free period).
  // If a teacher's total exceeds cap*5 (i.e. they can't fit even at cap), raise to PPD.
  const teacherDayCap = {};
  for (const [t, total] of Object.entries(teacherTotal)) {
    let cap = Math.min(7, Math.max(3, Math.ceil(total / 5) + 1));
    if (total > cap * 5) cap = Math.min(PPD, Math.max(3, Math.ceil(total / 5) + 1));
    teacherDayCap[t] = cap;
  }

  // ----- PASS 1: Place ALL buckets across ALL grades (fair share across grades) -----
  const allBuckets = []; // {grade, bid, lessons, need}
  const allBlocked = {};
  for (const grade of model.grades) {
    const a = ASSEMBLY[grade.grade];
    const blocked = new Set();
    if (a) blocked.add(slotOf(a.day, a.period));
    allBlocked[grade.grade] = blocked;
    const lessons = buildLessons(grade);
    const buckets = {};
    for (const l of lessons) {
      if (l.bucketId) (buckets[l.bucketId] ||= []).push(l);
    }
    for (const [bid, ls] of Object.entries(buckets)) {
      allBuckets.push({ grade: grade.grade, bid, lessons: ls, need: Math.max(...ls.map(l => l.periods)) });
    }
  }
  // Sort buckets: small need first (1-period like Music&Arts, Religion),
  // then by most-loaded teacher pressure descending, then by lesson count.
  allBuckets.sort((x, y) => {
    if (x.need !== y.need) return x.need - y.need;
    const pressureX = Math.max(...x.lessons.map(l => {
      const cap = teacherDayCap[l.teacher] || PPD;
      return (teacherTotal[l.teacher] || 0) / (cap * 5);
    }));
    const pressureY = Math.max(...y.lessons.map(l => {
      const cap = teacherDayCap[l.teacher] || PPD;
      return (teacherTotal[l.teacher] || 0) / (cap * 5);
    }));
    if (pressureY !== pressureX) return pressureY - pressureX;
    return y.lessons.length - x.lessons.length;
  });
  for (const { grade: gr, bid, lessons: ls, need } of allBuckets) {
    const blocked = allBlocked[gr];
    const got = placeBucket(sched, ls, blocked, false, null, teacherDayCap);
    if (got < need) {
      const got2 = placeBucket(sched, ls, blocked, true, need - got, teacherDayCap);
      if (got + got2 < need)
        warnings.push({ grade: gr, type: "bucket", id: bid, short: need - got - got2 });
    }
  }

  // ----- PASS 2: Place ALL singles across ALL grades -----
  // Collect singles per teacher globally
  const teacherSingles = {};
  for (const grade of model.grades) {
    const lessons = buildLessons(grade);
    for (const l of lessons) {
      if (l.bucketId) continue;
      (teacherSingles[l.teacher] ||= []).push(l);
    }
  }
  // Sort teachers by total load descending
  const teacherOrder = Object.entries(teacherSingles).sort((a, b) => {
    const loadA = a[1].reduce((s, l) => s + l.periods, 0);
    const loadB = b[1].reduce((s, l) => s + l.periods, 0);
    if (loadB !== loadA) return loadB - loadA;
    return b[1].length - a[1].length;
  });
  for (const [, tSingles] of teacherOrder) {
    const tName = tSingles[0].teacher;
    const cap = teacherDayCap[tName] || null;
    // Group singles by grade so we use correct blocked set
    const byGrade = {};
    for (const l of tSingles) {
      (byGrade[l.grade] ||= []).push(l);
    }
    for (const [gr, gSingles] of Object.entries(byGrade)) {
      const blocked = allBlocked[gr];
      if (gSingles.length > 1) {
        const placed = placeInterleaved(sched, gSingles, blocked, cap);
        for (const l of gSingles) {
          const cls = l.classes[0];
          const got = placed[cls] || 0;
          if (got < l.periods) {
            const got2 = placeLesson(sched, l, blocked, true, l.periods - got, cap);
            if (got + got2 < l.periods) {
              const remaining = l.periods - got - got2;
              const got3 = placeLessonForce(sched, l, blocked, remaining, cap);
              if (got + got2 + got3 < l.periods) {
                warnings.push({
                  grade: gr, type: "lesson", subject: l.subject,
                  teacher: l.teacher, class: cls, short: l.periods - got - got2 - got3
                });
              }
            }
          }
        }
      } else {
        const l = gSingles[0];
        const got = placeLesson(sched, l, blocked, false, null, cap);
        if (got < l.periods) {
          const got2 = placeLesson(sched, l, blocked, true, l.periods - got, cap);
          if (got + got2 < l.periods) {
            const remaining = l.periods - got - got2;
            const got3 = placeLessonForce(sched, l, blocked, remaining, cap);
            if (got + got2 + got3 < l.periods) {
              warnings.push({
                grade: gr, type: "lesson", subject: l.subject,
                teacher: l.teacher, class: l.classes[0], short: l.periods - got - got2 - got3
              });
            }
          }
        }
      }
    }
  }
  return { placements: sched.placements, warnings };
}

export function generate(model, overrides = []) {
  applyOverrides(model, overrides);
  let best = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const result = tryGenerate(model);
    if (result.warnings.length === 0) {
      return { ...result, DAYS, PPD, INTERVAL_AFTER };
    }
    if (!best || result.warnings.length < best.warnings.length) best = result;
  }
  return { ...best, DAYS, PPD, INTERVAL_AFTER };
}

export function allTeachers(placements) {
  const set = new Set();
  for (const p of placements) if (p.teacher) set.add(p.teacher);
  return [...set].sort();
}
export function allClasses(model) {
  const out = [];
  for (const g of model.grades) for (const c of g.classes) out.push({ grade: g.grade, cls: c });
  return out;
}
export function buildGrid(placements, { cls, grade, teacher }) {
  const grid = Array.from({ length: PPD }, () => Array.from({ length: DAYS.length }, () => []));
  for (const p of placements) {
    if (cls && !(p.class === cls && p.grade === grade)) continue;
    if (teacher && p.teacher !== teacher) continue;
    grid[p.period][p.day].push(p);
  }
  return grid;
}
