const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PPD = 8;
const TOTAL = DAYS.length * PPD;
const ASSEMBLY = { "Grade 6": 2, "Grade 7": 2, "Grade 8": 2, "Grade 9": 3, "Grade 10": 3 };

function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }
function shuffled(n, rnd) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function buildVars(model) {
  const buckets = [], singles = [];
  for (const grade of model.grades) {
    const G = grade.grade;
    const byBucket = {};
    for (const s of grade.subjects) {
      for (const a of s.assignments) {
        if (!a.teacher) continue;
        const classes = a.classes.length ? a.classes : grade.classes;
        const periods = a.periods || s.weekly || 1;
        if (s.bucketId) {
          (byBucket[s.bucketId] ||= { grade: G, bucketId: s.bucketId, periods: 0, members: [] });
          byBucket[s.bucketId].periods = Math.max(byBucket[s.bucketId].periods, periods);
          byBucket[s.bucketId].members.push({ subject: s.subject, teacher: a.teacher, classes, religion: !!s.religionBlock });
        } else {
          for (const c of classes)
            singles.push({ grade: G, class: c, subject: s.subject, teacher: a.teacher, periods });
        }
      }
    }
    for (const b of Object.values(byBucket)) buckets.push(b);
  }
  return { buckets, singles };
}

class State {
  constructor() { this.tBusy = {}; this.cBusy = {}; this.place = []; }
  tFree(t, s) { return !this.tBusy[t]?.has(s); }
  cFree(g, c, s) { return !this.cBusy[g]?.[c]?.has(s); }
  add(g, c, t, s, subject, bucketId, religion) {
    (this.tBusy[t] ||= new Set()).add(s);
    ((this.cBusy[g] ||= {})[c] ||= new Set()).add(s);
    this.place.push({ grade: g, class: c, teacher: t, slot: s, day: Math.floor(s / PPD), period: s % PPD, subject, bucketId: bucketId || null, religion: !!religion });
  }
}

function placeBuckets(st, buckets, order) {
  const warn = [];
  const list = buckets.slice().sort((a, b) => (b.members.length * b.periods) - (a.members.length * a.periods));
  for (const b of list) {
    let placed = 0;
    for (const slot of order) {
      if (placed >= b.periods) break;
      const ok = b.members.every(m => st.tFree(m.teacher, slot) && m.classes.every(c => st.cFree(b.grade, c, slot)));
      if (!ok) continue;
      for (const m of b.members) for (const c of m.classes) st.add(b.grade, c, m.teacher, slot, m.subject, b.bucketId, m.religion);
      placed++;
    }
    if (placed < b.periods) warn.push(`${b.grade}: bucket ${b.bucketId} short ${b.periods - placed}p`);
  }
  return warn;
}

function placeSingles(st, singles, order, deadline) {
  // Flatten to unit tasks (one period each). Tasks from the same (class,subject,teacher)
  // get an increasing minIndex so we don't pick the same slot twice and we keep order.
  const tasks = [];
  for (const v of singles) {
    for (let k = 0; k < v.periods; k++)
      tasks.push({ grade: v.grade, class: v.class, subject: v.subject, teacher: v.teacher, periods: v.periods, k });
  }
  // Order tasks: tightest teacher first, then class load, then fewer total periods last.
  const tload = {};
  for (const v of singles) tload[v.teacher] = (tload[v.teacher] || 0) + v.periods;
  const cload = {};
  for (const v of singles) { const key = v.grade + "/" + v.class; cload[key] = (cload[key] || 0) + v.periods; }
  tasks.sort((a, b) =>
    (tload[b.teacher] - tload[a.teacher]) ||
    (cload[b.grade + "/" + b.class] - cload[a.grade + "/" + a.class]) ||
    a.subject.localeCompare(b.subject));

  const warn = [];
  // domain helper: valid slots for a task given current state and soft same-day rule
  function* domain(t, soft, usedDaysFor) {
    const used = usedDaysFor(t);
    for (const slot of order) {
      if (!st.tFree(t.teacher, slot) || !st.cFree(t.grade, t.class, slot)) continue;
      if (soft && t.periods <= DAYS.length && used.has(Math.floor(slot / PPD))) continue;
      yield slot;
    }
  }
  // track days used per (class,subject) for spread
  const dayMap = new Map();
  const keyOf = t => t.grade + "|" + t.class + "|" + t.subject;
  const usedDaysFor = t => dayMap.get(keyOf(t)) || new Set();

  let soft = true;
  function dfs(i) {
    if (Date.now() > deadline) return false;
    if (i >= tasks.length) return true;
    const t = tasks[i];
    for (const slot of domain(t, soft, usedDaysFor)) {
      st.add(t.grade, t.class, t.teacher, slot, t.subject, null, false);
      const dm = dayMap.get(keyOf(t)) || new Set(); dm.add(Math.floor(slot / PPD)); dayMap.set(keyOf(t), dm);
      if (dfs(i + 1)) return true;
      // undo
      st.place.pop(); st.tBusy[t.teacher].delete(slot); st.cBusy[t.grade][t.class].delete(slot);
      dm.delete(Math.floor(slot / PPD));
    }
    return false;
  }

  if (!dfs(0)) {
    // retry without soft spread
    soft = false;
    // reset any partial (dfs always cleans up on false, so state is clean)
    if (!dfs(0)) {
      // best effort greedy fill + report
      for (const t of tasks) {
        // already placed?
        // place any remaining
      }
      // Greedy fill whatever is unplaced
      const need = {};
      for (const v of singles) need[v.grade + "|" + v.class + "|" + v.subject + "|" + v.teacher] = v.periods;
      for (const p of st.place) { const k = p.grade + "|" + p.class + "|" + p.subject + "|" + p.teacher; if (k in need) need[k]--; }
      for (const v of singles) {
        const k = v.grade + "|" + v.class + "|" + v.subject + "|" + v.teacher;
        let n = need[k] || 0;
        for (const slot of order) { if (n <= 0) break; if (st.tFree(v.teacher, slot) && st.cFree(v.grade, v.class, slot)) { st.add(v.grade, v.class, v.teacher, slot, v.subject, null, false); n--; } }
        if (n > 0) warn.push(`${v.grade}: ${v.subject}/${v.teacher} [${v.class}] short ${n}p`);
      }
    }
  }
  return warn;
}

function attempt(model, seed, timeMs = 4000) {
  const st = new State();
  const order = shuffled(TOTAL, rng(seed));
  const { buckets, singles } = buildVars(model);
  for (const g of model.grades) {
    const d = ASSEMBLY[g.grade]; if (d === undefined) continue;
    for (const c of g.classes) st.place.push({ grade: g.grade, class: c, teacher: null, slot: -1, day: d, period: -1, subject: "Assembly", bucketId: null });
  }
  const w1 = placeBuckets(st, buckets, order);
  const w2 = placeSingles(st, singles, order, Date.now() + timeMs);
  return { placements: st.place, warnings: [...w1, ...w2], DAYS, PPD };
}

function generate(model, restarts = 12, timeMs = 4000) {
  let best = null;
  for (let i = 0; i < restarts; i++) {
    const res = attempt(model, ((i + 1) * 1103515245 + 12345) % 2147483647, timeMs);
    if (!best || res.warnings.length < best.warnings.length) best = res;
    if (best.warnings.length === 0) break;
  }
  return best;
}

module.exports = { generate, attempt, DAYS, PPD };

if (require.main === module) {
  const fs = require("fs");
  const model = JSON.parse(fs.readFileSync(__dirname + "/data_model.json", "utf8"));
  const t0 = Date.now();
  const res = generate(model, 8, 5000);
  console.log("time", Date.now() - t0, "ms  placements:", res.placements.length, "warnings:", res.warnings.length);
  res.warnings.slice(0, 20).forEach(w => console.log(" !", w));
  const seen = {}; let clash = 0;
  for (const p of res.placements) { if (!p.teacher || p.slot < 0) continue; const k = p.teacher + "@" + p.slot; if (seen[k] && seen[k] !== (p.bucketId || "") + p.subject) clash++; seen[k] = (p.bucketId || "") + p.subject; }
  console.log("teacher clashes:", clash);
}
