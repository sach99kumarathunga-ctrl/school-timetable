"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  DAYS, PERIOD_LABELS, INTERVAL_AFTER, bucketColor,
  classGrids, teacherGrids, allTeachers, allClasses, assemblyDayFor,
} from "../lib/timetable";
import { exportExcel } from "../components/exportExcel";
import { exportPdf } from "../components/exportPdf";
import { exportPersonalExcel, exportPersonalPdf } from "../components/exportPersonal";

const TIME_ROWS = [
  { label: "7.40 a.m. - 8.15 a.m.", period: 0 },
  { label: "Register Marking", fixed: true },
  { label: "8.30 a.m. - 9.10 a.m.", period: 1 },
  { label: "9.10 a.m. - 9.50 a.m.", period: 2 },
  { label: "9.50 a.m. - 10.25 a.m.", period: 3 },
  { label: "Interval", fixed: true },
  { label: "Seiri Time", fixed: true },
  { label: "10.55 a.m. - 11.35 a.m.", period: 4 },
  { label: "11.35 a.m. - 12.15 p.m.", period: 5 },
  { label: "12.15 p.m. - 1.00 p.m.", period: 6 },
  { label: "1.00 p.m. - 1.45 p.m.", period: 7 },
];

export default function Page() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("class");
  const [grade, setGrade] = useState("");
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [classSearch, setClassSearch] = useState("");
  const [classSearchActive, setClassSearchActive] = useState(false);
  const [altOptions, setAltOptions] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const r = await fetch("/api/timetable");
    const d = await r.json();
    setData(d);
  }

  const cGrids = useMemo(() => data ? classGrids(data.placements) : {}, [data]);
  const tGrids = useMemo(() => data ? teacherGrids(data.placements) : {}, [data]);
  const classes = useMemo(() => data ? allClasses(data.placements) : [], [data]);
  const teachers = useMemo(() => data ? allTeachers(data.placements) : [], [data]);
  const grades = useMemo(() => {
    const set = new Set(classes.map(c => c.split("/")[0]));
    return [...set].sort((a, b) => {
      const na = parseInt(a.replace("Grade ", ""));
      const nb = parseInt(b.replace("Grade ", ""));
      return na - nb;
    });
  }, [classes]);

  const gradeClasses = useMemo(
    () => classes.filter(c => c.startsWith(grade + "/")),
    [classes, grade]
  );

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch) return teachers;
    const q = teacherSearch.toLowerCase();
    return teachers.filter(t => t.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  const filteredClasses = useMemo(() => {
    if (!classSearch) return classes;
    const q = classSearch.toLowerCase();
    return classes.filter(c => c.toLowerCase().includes(q));
  }, [classes, classSearch]);

  useEffect(() => {
    if (!data) return;
    if (!grade && grades.length) setGrade(grades[0]);
  }, [data, grades]);

  useEffect(() => {
    if (!data) return;
    if (mode === "class") {
      if (!gradeClasses.includes(sel)) setSel(gradeClasses[0] || "");
    } else if (mode === "teacher") {
      if (!tGrids[sel]) setSel(teachers[0] || "");
    }
  }, [mode, grade, data]);

  const resolveIssue = useCallback(async (w) => {
    setMessage(`Fixing: ${w.subject} (${w.teacher}) ${w.grade} — reducing by ${w.short} period(s)...`);
    setBusy(true);
    try {
      const resp = await fetch("/api/model");
      const md = await resp.json();
      const grades = md.grades;
      for (const g of grades) {
        if (g.grade !== w.grade) continue;
        if (w.type === "lesson") {
          for (const s of g.subjects) {
            if (s.subject !== w.subject) continue;
            for (const a of s.assignments) {
              if (a.teacher !== w.teacher) continue;
              if (!a.classes.includes(w.class)) continue;
              a.periods = Math.max(0, a.periods - w.short);
              s.weekly = Math.max(0, (s.weekly || 0) - w.short);
            }
          }
        }
        if (w.type === "bucket") {
          for (const s of g.subjects) {
            if (s.bucketId !== w.id) continue;
            s.weekly = Math.max(0, (s.weekly || 1) - w.short);
            for (const a of s.assignments) {
              a.periods = Math.max(0, (a.periods || 1) - w.short);
            }
          }
        }
      }
      const saveResp = await fetch("/api/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades }),
      });
      const saveData = await saveResp.json();
      if (!saveData.saved) {
        setMessage(`Save failed: ${saveData.reason}`);
        setBusy(false);
        return;
      }
      // Now regenerate locally with improved generator
      const genResp = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: { grades } }),
      });
      const genData = await genResp.json();
      if (genData.ok) {
        const saveGenResp = await fetch("/api/timetable/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(genData),
        });
        await saveGenResp.json();
        await fetchData();
        setMessage(`Fixed! ${w.subject} reduced by ${w.short} period(s). Timetable regenerated.`);
      } else {
        setMessage(`Regenerate failed: ${genData.reason}`);
      }
    } catch (e) {
      setMessage("Error: " + e);
    }
    setBusy(false);
  }, []);

  async function regenerateAll() {
    setMessage("Regenerating timetable (improved local solver)...");
    setBusy(true);
    try {
      const resp = await fetch("/api/model");
      const md = await resp.json();
      const genResp = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: md }),
      });
      const genData = await genResp.json();
      if (genData.ok) {
        const saveResp = await fetch("/api/timetable/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(genData),
        });
        await saveResp.json();
        await fetchData();
        setMessage(`Regenerated! ${genData.placements.length} placements, ${genData.warnings.length} warnings.`);
      } else {
        setMessage(`Regenerate failed: ${genData.reason}`);
      }
    } catch (e) {
      setMessage("Error: " + e);
    }
    setBusy(false);
  }

  if (!data) return <Loading />;

  const isClass = mode === "class";
  const isTeacher = mode === "teacher";
  const isIssues = mode === "issues";
  const current = isClass ? cGrids[sel] : (isTeacher ? tGrids[sel] : null);
  const title = isIssues ? "Issues & Conflicts" : sel;
  const totalShort = data.warnings?.reduce((s, w) => s + (w.short || 0), 0) || 0;
  const subtitle = isIssues
    ? `${totalShort} unplaced period(s) · click Fix to auto-resolve`
    : isClass ? "Class timetable" : "Teacher personal timetable";

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
              <button key={g} role="tab" aria-selected={g === grade && mode === "class"}
                onClick={() => { setMode("class"); setGrade(g); setTeacherSearch(""); setClassSearch(""); }}>
                {g.replace("Grade ", "Gr ")}
              </button>
            ))}
            <button role="tab" aria-selected={mode === "teacher"}
              onClick={() => { setMode("teacher"); setSearchActive(true); }}>Teachers</button>
            <button role="tab" aria-selected={mode === "issues"}
              className={data.warnings?.length > 0 ? "has-issues" : ""}
              onClick={() => { setMode("issues"); setTeacherSearch(""); setClassSearch(""); }}>
              Issues {totalShort > 0 ? `(${totalShort})` : ""}
            </button>
          </div>
          <a className="editlink" href="/edit">Edit data</a>
          <a className="editlink" href="/buckets" style={{ marginLeft: 8 }}>Buckets</a>
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
              <div className="class-search-wrap">
                <input type="text" placeholder="Search class..." value={classSearch}
                  onChange={e => { setClassSearch(e.target.value); setSel(""); setClassSearchActive(true); }}
                  onFocus={() => setClassSearchActive(true)}
                  aria-label="Search class" />
                {classSearchActive && (
                  <div className="search-results">
                    {filteredClasses.length === 0 ? (
                      <span className="no-match">No classes found</span>
                    ) : (
                      filteredClasses.map(c => (
                        <button key={c} className={sel === c ? "active" : ""}
                          onClick={() => {
                            const [g, cls] = c.split("/");
                            setGrade(g);
                            setSel(c);
                            setClassSearch(cls);
                            setClassSearchActive(false);
                          }}>{c.split("/")[1]}</button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {isTeacher && (
            <div className="teacher-search">
              <input type="text" placeholder="Search teacher..." value={teacherSearch}
                onChange={e => { setTeacherSearch(e.target.value); setSel(""); setSearchActive(true); }}
                onFocus={() => setSearchActive(true)}
                aria-label="Search teacher" />
              {searchActive && (
                <div className="search-results">
                  {filteredTeachers.length === 0 ? (
                    <span className="no-match">No teachers found</span>
                  ) : (
                    filteredTeachers.map(t => (
                      <button key={t} className={sel === t ? "active" : ""}
                        onClick={() => { setSel(t); setSearchActive(false); setTeacherSearch(t); }}>{t}</button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          <button className="btn primary" disabled={busy} onClick={regenerateAll}>
            ⟳ Regenerate All
          </button>
          {isIssues && (
            <button className="btn" onClick={() => setAltOptions(!altOptions)}>
              ⚙ Alternative Options
            </button>
          )}
          <div className="spacer" />
          <button className="btn" disabled={busy} onClick={() => doExport("pdf")}>Download PDF</button>
          <button className="btn primary" disabled={busy} onClick={() => doExport("xlsx")}>Download Excel</button>
        </div>
      </div>

      {altOptions && (
        <div className="alt-options wrap">
          <p><b>Alternative Options</b> — Adjust generation strategy:</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className="note">The improved local generator uses interleaved placement for shared teachers, teacher-load-aware sorting, and up to 10 random restarts. Click <b>Regenerate All</b> to re-run with current data.</span>
          </div>
        </div>
      )}

      <main className="wrap sheet">
        {message && (
          <div className="msg" onClick={() => setMessage("")}>{message}</div>
        )}

        {isIssues ? (
          <IssuesPanel warnings={data.warnings || []} resolveIssue={resolveIssue} busy={busy} />
        ) : (
          <>
            <div className="sheet-head">
              <h2>{title}</h2>
              <span className="meta">{subtitle} · 8 periods/day · interval after P4</span>
            </div>
            {isClass ? <ClassTable info={current} /> : <TeacherTable info={current} />}
            {isClass && <Legend grids={cGrids} sel={sel} />}
          </>
        )}
      </main>

      <footer className="foot">
        <div className="wrap">
          Generated by improved local solver (interleaved placement, teacher-load sorting, random restarts).
          Saved to MongoDB. Set <code>MONGODB_URI</code> to persist regenerated plans.
        </div>
      </footer>
    </>
  );

  function doExport(kind) {
    if (!current) return;
    setBusy(true);
    try {
      if (isClass) {
        if (kind === "xlsx") exportExcel({ mode, sel, current, data });
        else exportPdf({ mode, sel, current, data });
      } else {
        const subjectsTaught = teacherSubjects(data.placements, sel);
        const info = { ...current, assemblyDay: teacherAssemblyDay(data.placements, sel) };
        if (kind === "xlsx") exportPersonalExcel({ teacher: sel, info, subjectsTaught });
        else exportPersonalPdf({ teacher: sel, info, subjectsTaught });
      }
    } finally { setBusy(false); }
  }
}

function IssuesPanel({ warnings, resolveIssue, busy }) {
  if (warnings.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <h2>✅ All clear!</h2>
        <p className="meta">No scheduling conflicts detected.</p>
      </div>
    );
  }
  return (
    <div className="issues-panel">
      <h2>Issues ({warnings.length})</h2>
      <p className="meta">Each issue represents periods that could not be auto-placed. Click <b>Fix</b> to reduce the subject's period count by the shortage and regenerate.</p>
      <table className="issues-table">
        <thead>
          <tr>
            <th>Grade</th>
            <th>Type</th>
            <th>Subject / Bucket</th>
            <th>Teacher</th>
            <th>Class</th>
            <th className="num">Short</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {warnings.map((w, i) => (
            <tr key={i}>
              <td>{w.grade}</td>
              <td><span className={`issue-type ${w.type}`}>{w.type === "bucket" ? "Bucket" : "Lesson"}</span></td>
              <td>{w.subject || w.id}</td>
              <td>{w.teacher || "—"}</td>
              <td>{w.class || "—"}</td>
              <td className="num">{w.short}</td>
              <td>
                <button className="btn fix-btn" disabled={busy}
                  onClick={() => resolveIssue(w)}>Fix</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="issues-actions" style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button className="btn primary" disabled={busy} onClick={() => {
          // Regenerate all button also available in the issues-actions bar above
        }}>⟳ Regenerate All</button>
        <span className="note">Fix each issue individually to reduce period counts, then regenerate.</span>
      </div>
    </div>
  );
}

function Loading() {
  return <div className="wrap" style={{ padding: "80px 24px", fontFamily: "Fraunces, serif", fontSize: 22 }}>Loading the register…</div>;
}

function HeaderRow() {
  return (
    <thead>
      <tr>
        <th className="daycol-h">Day / Time</th>
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
      <span className="cell bucket">
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
      <thead>
        <tr>
          <th className="daycol-h">Time</th>
          {DAYS.map(d => <th key={d}>{d}</th>)}
        </tr>
      </thead>
      <tbody>
        {TIME_ROWS.map((row, ri) => {
          if (row.fixed) {
            return (
              <tr key={ri} className="fixed-row">
                <td className="daycol">{row.label}</td>
                <td colSpan={5} className="fixed-cell">{row.label}</td>
              </tr>
            );
          }
          return (
            <tr key={ri}>
              <td className="daycol">{row.label}</td>
              {info.grid.map((dayGrid, d) => {
                const cell = dayGrid[row.period];
                return (
                  <td key={d} className={row.period === INTERVAL_AFTER ? "interval-rule" : ""}
                    style={cell?.[0]?.bucketId ? { background: bucketColor(cell[0].bucketId) } : undefined}>
                    {!cell ? <span className="cell empty" /> : (
                      <span className={`cell ${cell[0].bucketId ? "bucket" : ""}`}>
                        {groupTeacherCell(cell).map((grp, i) => (
                          <span key={i} style={{ display: "block", marginBottom: i < groupTeacherCell(cell).length - 1 ? 4 : 0 }}>
                            <span className="subj">{grp.subject}</span>
                            <span className="klass">{grp.classes.join("+")}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
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
  return name.replace(/^Ms\.?\s*/,"").replace(/^Mr\.?\s*/,"").replace(/^New\s*/,"");
}

function teacherSubjects(placements, teacher) {
  const set = new Set();
  for (const p of placements) if (p.teacher === teacher && p.subject !== "Assembly") set.add(p.subject);
  return [...set].sort().join(", ");
}

function teacherAssemblyDay(placements, teacher) {
  const gradeCount = {};
  for (const p of placements) if (p.teacher === teacher && p.subject !== "Assembly") {
    gradeCount[p.grade] = (gradeCount[p.grade] || 0) + 1;
  }
  const top = Object.entries(gradeCount).sort((a, b) => b[1] - a[1])[0];
  if (!top) return undefined;
  return ["Grade 6","Grade 7","Grade 8"].includes(top[0]) ? 2
    : ["Grade 9","Grade 10","Grade 11","Grade 12"].includes(top[0]) ? 3 : undefined;
}

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
