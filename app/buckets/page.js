"use client";
import { useEffect, useState } from "react";

export default function BucketsPage() {
  const [grades, setGrades] = useState(null);
  const [gi, setGi] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/model").then(r => r.json()).then(d => setGrades(d.grades));
  }, []);

  if (!grades) return <div className="wrap" style={{ padding: 60, fontSize: 22 }}>Loading data…</div>;

  const bucketGrades = grades.map((g, i) => ({ i, grade: g, bucketSubjects: g.subjects.filter(s => s.bucketId) }))
    .filter(x => x.bucketSubjects.length > 0);
  const cur = bucketGrades[gi];
  if (!cur) return <div className="wrap" style={{ padding: 60, fontSize: 22 }}>No bucket subjects found.</div>;

  const g = cur.grade;

  function update(mut) {
    const next = structuredClone(grades);
    mut(next[cur.i]);
    setGrades(next);
  }

  function setSubjectBucket(si, v) {
    update(gr => { gr.subjects[si].bucketId = v || null; gr.subjects[si].color = v || "none"; });
  }

  function setAssignTeacher(si, ai, v) {
    update(gr => { gr.subjects[si].assignments[ai].teacher = v; });
  }

  function toggleClass(si, ai, cls) {
    update(gr => {
      const a = gr.subjects[si].assignments[ai];
      if (a.classes.includes(cls)) a.classes = a.classes.filter(c => c !== cls);
      else a.classes = [...a.classes, cls];
      a.mergedGroup = a.classes.length > 1 ? [...a.classes] : null;
    });
  }

  function addMergeBlock(si) {
    update(gr => {
      const subj = gr.subjects[si];
      const existing = subj.assignments.map(a => a.classes.join(","));
      const used = new Set(subj.assignments.flatMap(a => a.classes));
      const free = gr.classes.filter(c => !used.has(c));
      const picks = free.length ? [free[0]] : [];
      subj.assignments.push({
        teacher: subj.assignments[0]?.teacher || "New Teacher",
        classes: picks,
        periods: 5,
        mergedGroup: picks.length > 1 ? [...picks] : null,
      });
    });
  }

  function deleteMergeBlock(si, ai) {
    update(gr => {
      gr.subjects[si].assignments.splice(ai, 1);
      if (gr.subjects[si].assignments.length === 0) gr.subjects.splice(si, 1);
    });
  }

  function setPeriods(si, ai, v) {
    update(gr => {
      gr.subjects[si].assignments[ai].periods = Math.max(0, parseInt(v || "0", 10));
    });
  }

  async function save() {
    setBusy(true); setStatus("Saving…");
    try {
      const r = await fetch("/api/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades }),
      });
      const d = await r.json();
      setStatus(d.saved ? "Saved ✓" : `Not saved: ${d.reason}`);
    } catch (e) { setStatus("Save failed: " + e); }
    setBusy(false);
  }

  async function regenerate() {
    setBusy(true); setStatus("Regenerating timetable… (can take ~30–60s)");
    try {
      const r = await fetch("/api/regenerate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: { grades } }) });
      const d = await r.json();
      if (!d.ok) { setStatus("Regenerate failed: " + (d.reason || "unknown")); setBusy(false); return; }
      // Save the result to MongoDB so the timetable viewer picks it up
      const save = await fetch("/api/timetable/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placements: d.placements, warnings: d.warnings, status: "generated", createdAt: new Date().toISOString() }) });
      const sd = await save.json();
      setStatus(sd.saved ? `Regenerated ✓ ${d.placements.length} placements, ${d.warnings.length} warnings` : ("Regenerated but save: " + (sd.reason || "?")));
    } catch (e) { setStatus("Regenerate failed: " + e); }
    setBusy(false);
  }

  return (
    <>
      <header className="masthead">
        <div className="wrap">
          <p className="eyebrow">Bucket management</p>
          <h1>Edit Bucket Merge Groups</h1>
          <p>Configure which classes are merged together in a bucket subject.
             Each merge block = a group of classes taught together in the same period.
             All subjects sharing the same bucket key occupy the same time slot.</p>
        </div>
      </header>

      <nav className="gradebar">
        <div className="wrap">
          <div className="gradetabs">
            {bucketGrades.map((bg, i) => (
              <button key={bg.grade.grade} aria-selected={i === gi} onClick={() => setGi(i)}>
                {bg.grade.grade.replace("Grade ", "Gr ")} ({bg.bucketSubjects.length})
              </button>
            ))}
          </div>
          <a className="editlink" href="/">← Back to timetables</a>
        </div>
      </nav>

      <main className="wrap editor">
        <div className="sheet-head">
          <h2>{g.grade} — Bucket Subjects</h2>
          <span className="meta">{g.classes.join(" · ")}</span>
        </div>

        {/* Group subjects by bucketId */}
        {[...new Set(g.subjects.filter(s => s.bucketId).map(s => s.bucketId))].sort().map(bid => {
          const subs = g.subjects.filter(s => s.bucketId === bid);
          return (
            <div key={bid} style={{ marginBottom: 28 }}>
              <h3 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 18, margin: "16px 0 8px" }}>
                Bucket: <code style={{ background: "var(--accent-soft)", padding: "2px 8px", borderRadius: 4 }}>{bid}</code>
              </h3>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "14%" }}>Subject</th>
                    <th style={{ width: "14%" }}>Teacher</th>
                    <th className="num" style={{ width: "6%" }}>Periods</th>
                    <th>Classes in merge block (tick multi = merged)</th>
                    <th style={{ width: "8%" }}>Bucket key</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s, si) => {
                    // si is the original index in g.subjects
                    const origIdx = g.subjects.indexOf(s);
                    return s.assignments.map((a, ai) => (
                      <tr key={origIdx + "-" + ai}>
                        {ai === 0 && (
                          <td rowSpan={s.assignments.length}>
                            <input value={s.subject} onChange={e => {
                              update(gr => { gr.subjects[origIdx].subject = e.target.value; });
                            }} />
                          </td>
                        )}
                        <td>
                          <input value={a.teacher || ""} onChange={e => setAssignTeacher(origIdx, ai, e.target.value)} />
                        </td>
                        <td>
                          <input className="num" type="number" min="1" max="11"
                            value={a.periods ?? 5}
                            onChange={e => setPeriods(origIdx, ai, e.target.value)} />
                        </td>
                        <td>
                          <div className="classpick">
                            {g.classes.map(c => (
                              <label key={c} className={`chip ${a.classes.includes(c) ? "on" : ""}`}>
                                <input type="checkbox" checked={a.classes.includes(c)}
                                  onChange={() => toggleClass(origIdx, ai, c)} />
                                {c}
                              </label>
                            ))}
                          </div>
                          {a.classes.length > 1 && (
                            <span className="mergetag">merged: {a.classes.join(" + ")}</span>
                          )}
                        </td>
                        {ai === 0 && (
                          <td rowSpan={s.assignments.length}>
                            <input value={s.bucketId || ""} placeholder="(core)"
                              onChange={e => setSubjectBucket(origIdx, e.target.value)} />
                          </td>
                        )}
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="del" title="Delete this merge block"
                            onClick={() => deleteMergeBlock(origIdx, ai)}>×</button>
                          {ai === s.assignments.length - 1 && (
                            <button className="addmini" title="Add another merge block"
                              onClick={() => addMergeBlock(origIdx)}>+</button>
                          )}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </main>

      <div className="savebar">
        <div className="wrap" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn primary" disabled={busy} onClick={save}>Save changes</button>
          <button className="btn" disabled={busy} onClick={regenerate}>Generate timetable</button>
          <span className="note">{status}</span>
        </div>
      </div>
    </>
  );
}
