// Timetable generator (ES module) — whole-school, clash-free.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const PPD = 8; // periods/day (4 before interval + 4 after; interval after P4)
export const INTERVAL_AFTER = 4;
const TOTAL_SLOTS = DAYS.length * PPD;

const ASSEMBLY = {
  "Grade 6": { day: 2, period: 0 },
  "Grade 7": { day: 2, period: 0 },
  "Grade 8": { day: 2, period: 0 },
  "Grade 9": { day: 3, period: 0 },
  "Grade 10": { day: 3, period: 0 },
};

const slotOf = (d, p) => d * PPD + p;

export function applyOverrides(model, overrides = []) {
  const rules = overrides.length ? overrides : [
    { grade: "Grade 8", matchTeacher: /^New /i, replaceWith: "Mr. Mithun", note: "reassigned from new teacher" },
  ];
  for (const g of model.grades) {
    for (const s of g.subjects) {
      for (const a of s.assignments) {
        for (const r of rules) {
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
  constructor() { this.teacherBusy = {}; this.classBusy = {}; this.placements = []; }
  teacherFree(t, slot) { return !(this.teacherBusy[t] && this.teacherBusy[t].has(slot)); }
  classFree(g, c, slot) { return !(this.classBusy[g]?.[c]?.has(slot)); }
  mark(g, c, t, slot, lesson) {
    (this.teacherBusy[t] ||= new Set()).add(slot);
    ((this.classBusy[g] ||= {})[c] ||= new Set()).add(slot);
    this.placements.push({
      grade: g, class: c, slot, day: Math.floor(slot / PPD), period: slot % PPD,
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

function placeLesson(sched, lesson, blocked, relax = false, need = null) {
  const target = need == null ? lesson.periods : need;
  let placed = 0;
  for (let slot = 0; slot < TOTAL_SLOTS && placed < target; slot++) {
    if (blocked.has(slot)) continue;
    if (!sched.teacherFree(lesson.teacher, slot)) continue;
    if (!lesson.classes.every(c => sched.classFree(lesson.grade, c, slot))) continue;
    if (!relax) {
      const sameDay = sched.placements.some(p =>
        p.grade === lesson.grade && p.subject === lesson.subject &&
        Math.floor(p.slot / PPD) === Math.floor(slot / PPD) &&
        lesson.classes.includes(p.class));
      if (sameDay && lesson.periods <= DAYS.length) continue;
    }
    for (const c of lesson.classes) sched.mark(lesson.grade, c, lesson.teacher, slot, lesson);
    placed++;
  }
  return placed;
}

function placeBucket(sched, bucketLessons, blocked) {
  const periods = Math.max(...bucketLessons.map(l => l.periods));
  let placed = 0;
  for (let slot = 0; slot < TOTAL_SLOTS && placed < periods; slot++) {
    if (blocked.has(slot)) continue;
    const ok = bucketLessons.every(l =>
      sched.teacherFree(l.teacher, slot) &&
      l.classes.every(c => sched.classFree(l.grade, c, slot)));
    if (!ok) continue;
    for (const l of bucketLessons)
      for (const c of l.classes) sched.mark(l.grade, c, l.teacher, slot, l);
    placed++;
  }
  return placed;
}

export function generate(model, overrides = []) {
  applyOverrides(model, overrides);
  const sched = new Scheduler();
  for (const g of model.grades) sched.reserveAssembly(g.grade, g.classes);
  const warnings = [];
  for (const grade of model.grades) {
    const a = ASSEMBLY[grade.grade];
    const blocked = new Set();
    if (a) blocked.add(slotOf(a.day, a.period));
    const lessons = buildLessons(grade);
    const buckets = {}; const singles = [];
    for (const l of lessons) {
      if (l.bucketId) (buckets[l.bucketId] ||= []).push(l);
      else for (const c of l.classes) singles.push({ ...l, classes: [c] });
    }
    const bucketList = Object.entries(buckets).sort((x, y) => y[1].length - x[1].length);
    for (const [bid, ls] of bucketList) {
      const need = Math.max(...ls.map(l => l.periods));
      const got = placeBucket(sched, ls, blocked);
      if (got < need) warnings.push({ grade: grade.grade, type: "bucket", id: bid, short: need - got });
    }
    singles.sort((x, y) => y.periods - x.periods);
    for (const l of singles) {
      const got = placeLesson(sched, l, blocked, false);
      if (got < l.periods) {
        const got2 = placeLesson(sched, l, blocked, true, l.periods - got);
        if (got + got2 < l.periods)
          warnings.push({ grade: grade.grade, type: "lesson", subject: l.subject, teacher: l.teacher, class: l.classes[0], short: l.periods - got - got2 });
      }
    }
  }
  return { placements: sched.placements, warnings, DAYS, PPD, INTERVAL_AFTER };
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
