"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DAYS, PERIOD_LABELS, INTERVAL_AFTER, bucketColor,
  classGrids, teacherGrids, allTeachers, allClasses, assemblyDayFor,
} from "../lib/timetable";
import { exportExcel } from "../components/exportExcel";
import { exportPdf } from "../components/exportPdf";
import { exportPersonalExcel, exportPersonalPdf } from "../components/exportPersonal";

export default function Page() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("class"); // 'class' | 'teacher'
  const [grade, setGrade] = useState("");
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/timetable").then(r => r.json()).then(d => {
      setData(d);
    });
  }, []);

  const cGrids = useMemo(() => data ? classGrids(data.placements) : {}, [data]);
  const tGrids = useMemo(() => data ? teacherGrids(data.placements) : {}, [data]);
  const classes = useMemo(() => data ? allClasses(data.placements) : [], [data]);
  const teachers = useMemo(() => data ? allTeachers(data.placements) : [], [data]);
  const grades = useMemo(() => {
    const set = new Set(classes.map(c => c.split("/")[0]));
    return [...set];
  }, [classes]);

  // classes within the selected grade
  const gradeClasses = useMemo(
    () => classes.filter(c => c.startsWith(grade + "/")),
    [classes, grade]
  );

  useEffect(() => {
    if (!data) return;
    if (!grade && grades.length) setGrade(grades[0]);
  }, [data, grades]); // eslint-disable-line

  useEffect(() => {
    if (!data) return;
    if (mode === "class") {
      if (!gradeClasses.includes(sel)) setSel(gradeClasses[0] || "");
    } else {
      if (!tGrids[sel]) setSel(teachers[0] || "");
    }
  }, [mode, grade, data]); // eslint-disable-line

  if (!data) return <Loading />;

  const isClass = mode === "class";
  const options = isClass ? gradeClasses : teachers;
  const current = isClass ? cGrids[sel] : tGrids[sel];
  const title = sel;
  const subtitle = isClass ? "Class timetable" : "Teacher personal timetable";

  function doExport(kind) {
    if (!current) return;
    setBusy(true);
    try {
      if (isClass) {
        if (kind === "xlsx") exportExcel({ mode, sel, current, data });
        else exportPdf({ mode, sel, current, data });
      } else {
        // Teacher: use the Lyceum personal-timetable template. Compute subjects + assembly day.
        const subjectsTaught = teacherSubjects(data.placements, sel);
        const info = { ...current, assemblyDay: teacherAssemblyDay(data.placements, sel) };
        if (kind === "xlsx") exportPersonalExcel({ teacher: sel, info, subjectsTaught });
        else exportPersonalPdf({ teacher: sel, info, subjectsTaught });
      }
    } finally { setBusy(false); }
  }

  return (
    <>
      <header className="masthead">
        <div className="wrap">
          <p className="eyebrow">2026 · Whole-School Schedule</p>
          <h1>The Timetable Register</h1>
          <p>Clash-free schedules for every class and teacher — buckets, religion blocks,
             merged classes and shared staff all reconciled into one plan.</p>
        </div>
      </header>

      <nav className="gradebar">
        <div className="wrap">
          <div className="gradetabs" role="tablist" aria-label="Grades">
            {grades.map(g => (
              <button key={g} role="tab" aria-selected={g === grade}
                onClick={() => { setMode("class"); setGrade(g); }}>
                {g.replace("Grade ", "Gr ")}
              </button>
            ))}
            <button role="tab" aria-selected={mode === "teacher"}
              onClick={() => setMode("teacher")}>Teachers</button>
          </div>
          <a className="editlink" href="/edit">Edit data →</a>
        </div>
      </nav>

      <div className="controls">
        <div className="wrap">
          {isClass && (
            <div className="seg" role="group" aria-label="Within grade">
              {gradeClasses.map(c => (
                <button key={c} aria-pressed={c === sel} onClick={() => setSel(c)}>
                  {c.split("/")[1]}
                </button>
              ))}
            </div>
          )}
          {!isClass && (
            <select value={sel} onChange={e => setSel(e.target.value)} aria-label="Select teacher">
              {teachers.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          <div className="spacer" />
          <button className="btn" disabled={busy} onClick={() => doExport("pdf")}>Download PDF</button>
          <button className="btn primary" disabled={busy} onClick={() => doExport("xlsx")}>Download Excel</button>
        </div>
      </div>

      <main className="wrap sheet">
        {data.warnings?.length > 0 && (
          <div className="warns">
            <b>{data.warnings.length} period(s) could not be auto-placed.</b> These need a manual slot:
            <ul>{data.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        <div className="sheet-head">
          <h2>{title}</h2>
          <span className="meta">{subtitle} · 8 periods/day · interval after P4</span>
        </div>

        {isClass
          ? <ClassTable info={current} />
          : <TeacherTable info={current} />}

        {isClass && <Legend grids={cGrids} sel={sel} />}
      </main>

      <footer className="foot">
        <div className="wrap">
          Generated by constraint solver (OR-Tools CP-SAT). Saved to MongoDB.
          Set <code>MONGODB_URI</code> to persist regenerated plans.
        </div>
      </footer>
    </>
  );
}

function Loading() {
  return <div className="wrap" style={{ padding: "80px 24px", fontFamily: "Fraunces, serif", fontSize: 22 }}>Loading the register…</div>;
}

function HeaderRow() {
  return (
    <thead>
      <tr>
        <th className="daycol-h">Day</th>
        {PERIOD_LABELS.map((p, i) => (
          <th key={p} className={i === INTERVAL_AFTER ? "interval-rule" : ""}>{p}</th>
        ))}
      </tr>
    </thead>
  );
}

function ClassTable({ info }) {
  if (!info) return null;
  return (
    <table className="tt">
      <HeaderRow />
      <tbody>
        {DAYS.map((day, d) => (
          <ClassDay key={day} day={day} d={d} info={info} />
        ))}
      </tbody>
    </table>
  );
}

function ClassDay({ day, d, info }) {
  const isAssembly = info.assemblyDay === d;
  return (
    <tr>
      <td className="daycol">{day}</td>
      {info.grid[d].map((cell, p) => {
        if (isAssembly && p === 0) {
          return <td key={p} className="assembly-cell">Assembly</td>;
        }
        return (
          <td key={p} className={p === INTERVAL_AFTER ? "interval-rule" : ""}
              style={cell?.bucketId ? { background: bucketColor(cell.bucketId) } : undefined}>
            <CellContent cell={cell} />
          </td>
        );
      })}
    </tr>
  );
}

function CellContent({ cell }) {
  if (!cell) return <span className="cell empty" />;
  if (cell.subjects.length > 1) {
    return (
      <span className={`cell bucket`}>
        <span className="bucket-tag">Choose one</span>
        {cell.subjects.map((s, i) => (
          <span className="pick" key={i}><b>{s.subject}</b> · {short(s.teacher)}<br /></span>
        ))}
      </span>
    );
  }
  const s = cell.subjects[0];
  return (
    <span className={`cell ${cell.bucketId ? "bucket" : ""}`}>
      <span className="subj">{s.subject}</span>
      {s.teacher && <span className="tch">{s.teacher}</span>}
    </span>
  );
}

function TeacherTable({ info }) {
  if (!info) return null;
  return (
    <table className="tt">
      <HeaderRow />
      <tbody>
        {DAYS.map((day, d) => (
          <tr key={day}>
            <td className="daycol">{day}</td>
            {info.grid[d].map((cell, p) => (
              <td key={p} className={p === INTERVAL_AFTER ? "interval-rule" : ""}
                  style={cell?.[0]?.bucketId ? { background: bucketColor(cell[0].bucketId) } : undefined}>
                {!cell ? <span className="cell empty" /> : (
                  <span className={`cell ${cell[0].bucketId ? "bucket" : ""}`}>
                    {groupTeacherCell(cell).map((grp, i) => (
                      <span key={i} style={{ display: "block", marginBottom: i < arr(cell) - 1 ? 4 : 0 }}>
                        <span className="subj">{grp.subject}</span>
                        <span className="klass">{grp.classes.join("+")}</span>
                      </span>
                    ))}
                  </span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Legend({ grids, sel }) {
  const seen = new Map();
  const info = grids[sel];
  if (!info) return null;
  for (const row of info.grid) for (const cell of row) {
    if (cell?.bucketId && !seen.has(cell.bucketId)) {
      const names = cell.subjects.map(s => s.subject);
      seen.set(cell.bucketId, names);
    }
  }
  if (seen.size === 0) return null;
  return (
    <div className="legend">
      {[...seen.entries()].map(([id, names]) => (
        <span key={id}>
          <span className="swatch" style={{ background: bucketColor(id) }} />
          Bucket: {names.slice(0, 4).join(" / ")}{names.length > 4 ? "…" : ""}
        </span>
      ))}
    </div>
  );
}

function short(name) {
  if (!name) return "";
  return name.replace(/^Ms\.?\s*/, "").replace(/^Mr\.?\s*/, "").replace(/^New\s*/, "");
}

// Distinct subjects a teacher teaches (for the "Subjects Taught" header field).
function teacherSubjects(placements, teacher) {
  const set = new Set();
  for (const p of placements) if (p.teacher === teacher && p.subject !== "Assembly") set.add(p.subject);
  return [...set].sort().join(", ");
}
// The teacher's assembly day = the grade they teach most in (so their template shows it).
function teacherAssemblyDay(placements, teacher) {
  const gradeCount = {};
  for (const p of placements) if (p.teacher === teacher && p.subject !== "Assembly") {
    gradeCount[p.grade] = (gradeCount[p.grade] || 0) + 1;
  }
  const top = Object.entries(gradeCount).sort((a, b) => b[1] - a[1])[0];
  if (!top) return undefined;
  return ["Grade 6", "Grade 7", "Grade 8"].includes(top[0]) ? 2
    : ["Grade 9", "Grade 10"].includes(top[0]) ? 3 : undefined;
}

// Group a teacher's cell entries by subject+grade, merging classes as "6A+6B".
function groupTeacherCell(cell) {
  const by = {};
  for (const e of cell) {
    const gnum = e.grade.replace("Grade ", "");
    const label = e.class.startsWith(gnum) ? e.class : `${gnum}${e.class}`;
    const key = `${e.subject}@@${e.grade}`;
    (by[key] ||= { subject: e.subject, grade: e.grade, classes: [] }).classes.push(label);
  }
  return Object.values(by).map(g => ({ subject: g.subject, classes: g.classes.sort() }));
}
function arr(cell) { return groupTeacherCell(cell).length; }
