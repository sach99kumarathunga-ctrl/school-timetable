// Timetable generator (ES module) — whole-school, clash-free.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const PPD = 8; // periods/day (4 before interval + 4 after; interval after P4)
export const INTERVAL_AFTER = 4;
const TOTAL_SLOTS = DAYS.length * PPD;
const MAX_TRIES = 100;

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
        days: a.days || null,
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
  unmark(g, c, t, slot) {
    const day = Math.floor(slot / PPD);
    this.teacherBusy[t]?.delete(slot);
    if (this.teacherDaySlotSet[t]?.[day]) {
      this.teacherDaySlotSet[t][day].delete(slot);
      if (this.teacherDaySlotSet[t][day].size === 0) delete this.teacherDaySlotSet[t][day];
    }
    if (this.classBusy[g]?.[c]) {
      this.classBusy[g][c].delete(slot);
      if (this.classBusy[g][c].size === 0) delete this.classBusy[g][c];
    }
    const idx = this.placements.findIndex(p =>
      p.grade === g && p.class === c && p.teacher === t && p.slot === slot
    );
    if (idx !== -1) this.placements.splice(idx, 1);
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
  if (lesson.days && !lesson.days.includes(day)) return false;
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
  const allowedDays = lesson.days || [0, 1, 2, 3, 4];
  const maxPerDay = Math.ceil(lesson.periods / allowedDays.length);
  const limit = relax ? maxPerDay + 1 : maxPerDay;
  let placed = 0;
  const dayOrder = shuffleArr([...allowedDays]);
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
  const allowedDays = lesson.days || [0, 1, 2, 3, 4];
  const dayOrder = shuffleArr([...allowedDays]);
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
  const allowedDays = {};
  for (const l of singlesGroup) {
    const cls = l.classes[0];
    classToLesson[cls] = l;
    targets[cls] = l.periods;
    placedCounts[cls] = 0;
    limits[cls] = Math.ceil(l.periods / (l.days ? l.days.length : 5));
    allowedDays[cls] = l.days || [0, 1, 2, 3, 4];
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
      const dayOrder = shuffleArr([...allowedDays[cls]]);
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

function placeBucket(sched, bucketLessons, blocked, relax = false, need = null, teacherDayCapMap = {}, adjBuckets = new Set()) {
  // Check if any teacher has multiple merge blocks for the same subject.
  // If yes, alternate per merge group so the teacher's blocks are at different slots (Rule 3).
  // If no, place ALL lessons together at each slot (typical elective bucket).
  const tSubjBlocks = {};
  for (const l of bucketLessons) {
    const key = l.teacher + "@@" + l.subject;
    (tSubjBlocks[key] ||= []).push(l);
  }
  const needAlternate = Object.values(tSubjBlocks).some(arr => arr.length > 1);

  // Compute day restriction: intersection of all lessons' allowed days
  const lessonsWithDays = bucketLessons.filter(l => l.days);
  const allowedDays = lessonsWithDays.length ? lessonsWithDays.map(l => l.days).reduce((a, b) => a.filter(d => b.includes(d))) : [0, 1, 2, 3, 4];

  if (!needAlternate) {
    // All teachers have one block each — place all lessons together
    return placeBucketTogether(sched, bucketLessons, blocked, relax, need, teacherDayCapMap, adjBuckets);
  }

  // Teachers have multiple merge blocks — group by class-set and alternate
  const mergeGroups = {};
  for (const l of bucketLessons) {
    const key = [...l.classes].sort().join(",");
    (mergeGroups[key] ||= []).push(l);
  }
  const groups = Object.values(mergeGroups);
  shuffleArr(groups);

  const periodsPerLesson = Math.max(...bucketLessons.map(l => l.periods));
  const totalNeed = need == null ? groups.length * periodsPerLesson : need;
  const maxPerDay = Math.ceil(totalNeed / allowedDays.length);
  const dayCount = {};
  let placed = 0;

  // Adjacent placement: for each merge group, try a consecutive pair
  if (!relax && periodsPerLesson <= 2 && adjBuckets.has(bucketLessons[0]?.bucketId)) {
    const adjPairs = [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7]];
    const dayOrderAdj = shuffleArr([...allowedDays]);
    for (let gi = 0; gi < groups.length && placed < totalNeed; gi++) {
      const group = groups[gi];
      let groupPlaced = 0;
      for (let di = 0; di < allowedDays.length && groupPlaced < periodsPerLesson; di++) {
        const day = dayOrderAdj[(gi * allowedDays.length + di) % allowedDays.length];
        if (!relax && (dayCount[day] || 0) >= maxPerDay) continue;
        shuffleArr(adjPairs);
        let found = false;
        for (const [p1, p2] of adjPairs) {
          const s1 = slotOf(day, p1), s2 = slotOf(day, p2);
          if (blocked.has(s1) || blocked.has(s2)) continue;
          let ok = true;
          for (const l of group) {
            if (!sched.teacherFree(l.teacher, s1) || !sched.teacherFree(l.teacher, s2)) { ok = false; break; }
            if (!l.classes.every(c => sched.classFree(l.grade, c, s1) && sched.classFree(l.grade, c, s2))) { ok = false; break; }
            if (allowedDays.length >= 5) {
              const cap = teacherDayCapMap[l.teacher];
              if (cap && sched.teacherSlotsOnDay(l.teacher, day) >= cap) { ok = false; break; }
            }
          }
          if (!ok) continue;
          for (const l of group) {
            for (const c of l.classes) sched.mark(l.grade, c, l.teacher, s1, l);
            for (const c of l.classes) sched.mark(l.grade, c, l.teacher, s2, l);
          }
          dayCount[day] = (dayCount[day] || 0) + 2;
          groupPlaced += 2;
          found = true;
          break;
        }
        if (found) break;
      }
      placed += groupPlaced;
    }
    if (placed >= totalNeed) return placed;
    // fall through for remaining groups
  }

  const dayOrder = shuffleArr([...allowedDays]);
  for (let i = 0; i < totalNeed * allowedDays.length && placed < totalNeed; i++) {
    const day = dayOrder[i % allowedDays.length];
    if (!relax && (dayCount[day] || 0) >= maxPerDay) continue;
    const slotOrder = shuffleArr(Array.from({ length: PPD }, (_, i) => i));
    for (const period of slotOrder) {
      if (placed >= totalNeed) break;
      const slot = slotOf(day, period);
      if (blocked.has(slot)) continue;
      const currentGroup = groups[placed % groups.length];
      let ok = true;
      for (const l of currentGroup) {
        if (!sched.teacherFree(l.teacher, slot)) { ok = false; break; }
        if (!l.classes.every(c => sched.classFree(l.grade, c, slot))) { ok = false; break; }
        if (allowedDays.length >= 5) {
          const cap = teacherDayCapMap[l.teacher];
          if (cap && sched.teacherSlotsOnDay(l.teacher, day) >= cap) { ok = false; break; }
        }
      }
      if (!ok) continue;
      for (const l of currentGroup)
        for (const c of l.classes) sched.mark(l.grade, c, l.teacher, slot, l);
      dayCount[day] = (dayCount[day] || 0) + 1;
      placed++;
      break;
    }
  }
  return placed;
}

function placeBucketTogether(sched, bucketLessons, blocked, relax = false, need = null, teacherDayCapMap = {}, adjBuckets = new Set()) {
  const periods = need == null ? Math.max(...bucketLessons.map(l => l.periods)) : need;
  const bucketId = bucketLessons[0]?.bucketId;
  const useAdj = adjBuckets.has(bucketId) && periods <= 2 && !relax;
  const lessonsWithDays = bucketLessons.filter(l => l.days);
  const allowedDays = lessonsWithDays.length ? lessonsWithDays.map(l => l.days).reduce((a, b) => a.filter(d => b.includes(d))) : [0, 1, 2, 3, 4];
  const maxPerDay = Math.ceil(periods / allowedDays.length);
  const dayCount = {};
  let placed = 0;

  // Adjacent placement: find a pair of consecutive periods on the same day
  if (useAdj) {
    const dayOrder = shuffleArr([...allowedDays]);
    for (let di = 0; di < allowedDays.length && placed < periods; di++) {
      const day = dayOrder[di % allowedDays.length];
      if (!relax && (dayCount[day] || 0) >= maxPerDay) continue;
      const adjPairs = [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7]];
      shuffleArr(adjPairs);
      for (const [p1, p2] of adjPairs) {
        const s1 = slotOf(day, p1), s2 = slotOf(day, p2);
        if (blocked.has(s1) || blocked.has(s2)) continue;
        let ok = true;
        for (const l of bucketLessons) {
          if (!sched.teacherFree(l.teacher, s1) || !sched.teacherFree(l.teacher, s2)) { ok = false; break; }
          if (!l.classes.every(c => sched.classFree(l.grade, c, s1) && sched.classFree(l.grade, c, s2))) { ok = false; break; }
          if (allowedDays.length >= 5) {
            const cap = teacherDayCapMap[l.teacher];
            if (cap && (sched.teacherSlotsOnDay(l.teacher, day) >= cap)) { ok = false; break; }
          }
        }
        if (!ok) continue;
        for (const l of bucketLessons) {
          for (const c of l.classes) sched.mark(l.grade, c, l.teacher, s1, l);
          for (const c of l.classes) sched.mark(l.grade, c, l.teacher, s2, l);
        }
        dayCount[day] = (dayCount[day] || 0) + 2;
        placed += 2;
        break;
      }
    }
    if (placed >= periods) return placed;
    // fall through to normal placement for remaining
  }

  const dayOrder = shuffleArr([...allowedDays]);
  for (let i = 0; i < periods * allowedDays.length && placed < periods; i++) {
    const day = dayOrder[i % allowedDays.length];
    if (!relax && (dayCount[day] || 0) >= maxPerDay) continue;
    const slotOrder = shuffleArr(Array.from({ length: PPD }, (_, i) => i));
    for (const period of slotOrder) {
      if (placed >= periods) break;
      const slot = slotOf(day, period);
      if (blocked.has(slot)) continue;
      let ok = true;
      for (const l of bucketLessons) {
        if (!sched.teacherFree(l.teacher, slot)) { ok = false; break; }
        if (!l.classes.every(c => sched.classFree(l.grade, c, slot))) { ok = false; break; }
        if (allowedDays.length >= 5) {
          const cap = teacherDayCapMap[l.teacher];
          if (cap && sched.teacherSlotsOnDay(l.teacher, day) >= cap) { ok = false; break; }
        }
      }
      if (!ok) continue;
      for (const l of bucketLessons)
        for (const c of l.classes) sched.mark(l.grade, c, l.teacher, slot, l);
      dayCount[day] = (dayCount[day] || 0) + 1;
      placed++;
      break;
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
      // Compute need: number of merge groups × periods per lesson.
      // A teacher with N merge blocks needs N × periodsPerLesson slots
      // so each block gets its own set of periods (Rule 3).
      const tGroups = {};
      for (const l of ls) (tGroups[l.teacher] ||= []).push(l);
      const maxGroups = Math.max(...Object.values(tGroups).map(arr => arr.length));
      const baseNeed = Math.max(...ls.map(l => l.periods));
      const need = maxGroups * baseNeed;
      allBuckets.push({ grade: grade.grade, bid, lessons: ls, need });
    }
  }
  // Sort buckets: day-restricted first (so they get limited days before other buckets consume them),
  // then small need first (1-period like Music&Arts, Religion),
  // then by most-loaded teacher pressure descending, then by lesson count.
  allBuckets.sort((x, y) => {
    const xRestricted = x.lessons.some(l => l.days) ? 0 : 1;
    const yRestricted = y.lessons.some(l => l.days) ? 0 : 1;
    if (xRestricted !== yRestricted) return xRestricted - yRestricted;
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
  const adjBuckets = new Set(['t6_0.60', 't7_0.60']);
  for (const { grade: gr, bid, lessons: ls, need } of allBuckets) {
    const blocked = allBlocked[gr];
    const got = placeBucket(sched, ls, blocked, false, need, teacherDayCap, adjBuckets);
    if (got < need) {
      const got2 = placeBucket(sched, ls, blocked, true, need - got, teacherDayCap, adjBuckets);
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
  // ----- PASS 3: Try to repair short singles by swapping -----
  if (warnings.length) {
    const allSingles = collectAllSingles(model);
    const repaired = swapRepair(sched, warnings, allBlocked, teacherDayCap, allSingles);
    if (repaired > 0) {
      // Rebuild warnings — remove fully resolved, adjust remaining
      const newWarnings = [];
      for (const w of warnings) {
        if (w.type !== 'lesson') { newWarnings.push(w); continue; }
        const already = sched.placements.filter(p =>
          p.grade === w.grade && p.class === w.class && p.teacher === w.teacher && p.subject === w.subject
        ).length;
        const expected = (() => {
          for (const g of model.grades) {
            if (g.grade !== w.grade) continue;
            for (const s of g.subjects) {
              if (s.subject !== w.subject) continue;
              for (const a of s.assignments) {
                if (a.teacher === w.teacher && a.classes.includes(w.class))
                  return a.periods || s.weekly || 1;
              }
            }
          }
          return 0;
        })();
        if (already < expected) newWarnings.push({ ...w, short: expected - already });
      }
      return { placements: sched.placements, warnings: newWarnings };
    }
  }
  return { placements: sched.placements, warnings };
}

// Post-pass: try to resolve short singles by swapping placements within the same teacher.
function swapRepair(sched, warnings, allBlocked, teacherDayCap, allSingles) {
  // Build a lookup of lesson prototypes by key
  const lessonByKey = {};
  for (const l of allSingles) {
    const key = l.grade + '|' + l.classes[0] + '|' + l.teacher + '|' + l.subject;
    lessonByKey[key] = l;
  }

  let repaired = 0;
  for (const w of warnings) {
    if (w.type !== 'lesson') continue;
    const key = w.grade + '|' + w.class + '|' + w.teacher + '|' + w.subject;
    const lesson = lessonByKey[key];
    if (!lesson) continue;

    for (let n = 0; n < w.short; n++) {
      let placed = false;
      // Scan all slots
      for (let d = 0; d < 5 && !placed; d++) {
        if (lesson.days && !lesson.days.includes(d)) continue;
        for (let p = 0; p < PPD && !placed; p++) {
          const slot = slotOf(d, p);
          if (allBlocked[w.grade]?.has(slot)) continue;
          if (!sched.classFree(w.grade, w.class, slot)) continue;
          const cap = teacherDayCap[lesson.teacher];
          if (cap && sched.teacherSlotsOnDay(lesson.teacher, d) >= cap) continue;

          if (sched.teacherFree(lesson.teacher, slot)) {
            // Direct fit
            sched.mark(w.grade, w.class, lesson.teacher, slot, lesson);
            repaired++;
            placed = true;
          } else {
            // Teacher busy — try to relocate the conflicting placement
            const conflicts = sched.placements.filter(pl =>
              pl.teacher === lesson.teacher && pl.slot === slot && !pl.bucketId
            );
            for (const conflict of conflicts) {
              if (conflict.subject === w.subject) continue;
              // Try existing slots of the short lesson as relocation targets
              const existingSlots = sched.placements.filter(pl =>
                pl.grade === w.grade && pl.class === w.class && pl.teacher === lesson.teacher
              ).map(pl => pl.slot);
              for (const freeSlot of existingSlots) {
                if (freeSlot === slot) continue;
                if (allBlocked[conflict.grade]?.has(freeSlot)) continue;
                if (!sched.classFree(conflict.grade, conflict.class, freeSlot)) continue;
                const freeDay = Math.floor(freeSlot / PPD);
                if (cap && sched.teacherSlotsOnDay(lesson.teacher, freeDay) >= cap) continue;
                // Check same-day limit for the conflicted subject on the freeSlot day
                const sameDayCount = sched.placements.filter(pl =>
                  pl.grade === conflict.grade && pl.subject === conflict.subject &&
                  pl.day === freeDay && pl.class === conflict.class
                ).length;
                if (sameDayCount > 0) continue;
                // Move conflict to the freed slot
                const conflictProto = { grade: conflict.grade, subject: conflict.subject, teacher: lesson.teacher, classes: [conflict.class], periods: 1, bucketId: null, religion: false };
                sched.unmark(conflict.grade, conflict.class, lesson.teacher, slot);
                sched.mark(conflict.grade, conflict.class, lesson.teacher, freeSlot, conflictProto);
                // Place short lesson at the newly freed slot
                sched.mark(w.grade, w.class, lesson.teacher, slot, lesson);
                repaired++;
                placed = true;
                break;
              }
              if (placed) break;
            }
          }
        }
      }
    }
  }
  return repaired;
}

// Collect all singles across all grades into a flat array
function collectAllSingles(model) {
  const out = [];
  for (const grade of model.grades) {
    const lessons = buildLessons(grade);
    for (const l of lessons) {
      if (!l.bucketId) out.push(l);
    }
  }
  return out;
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
