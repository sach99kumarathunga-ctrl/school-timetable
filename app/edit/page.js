"use client";
import { useEffect, useState } from "react";

export default function EditPage() {
  const [grades, setGrades] = useState(null);
  const [gi, setGi] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/model").then(r => r.json()).then(d => setGrades(d.grades));
  }, []);

  if (!grades) return <div className="wrap" style={{ padding: 60, fontSize: 22 }}>Loading data…</div>;
  const g = grades[gi];

  function update(mut) {
    const next = structuredClone(grades);
    mut(next[gi]);
    setGrades(next);
  }

  function setSubjectName(si, v) { update(gr => { gr.subjects[si].subject = v; }); }
  function setBucket(si, v) { update(gr => { gr.subjects[si].bucketId = v || null; gr.subjects[si].color = v || "none"; }); }
  function deleteSubject(si) { update(gr => gr.subjects.splice(si, 1)); }
  function addSubject() {
    update(gr => gr.subjects.push({
      subject: "New Subject", weekly: 1, color: "none", religionBlock: false,
      bucketId: null, assignments: [{ teacher: "New Teacher", classes: gr.classes.slice(0, 1), periods: 1 }],
    }));
  }

  function setAssignField(si, ai, field, value) {
    update(gr => {
      const a = gr.subjects[si].assignments[ai];
      if (field === "teacher") a.teacher = value;
      if (field === "periods") a.periods = Math.max(0, parseInt(value || "0", 10));
    });
  }
  function toggleClass(si, ai, cls) {
    update(gr => {
      const a = gr.subjects[si].assignments[ai];
      if (a.classes.includes(cls)) a.classes = a.classes.filter(c => c !== cls);
      else a.classes = [...a.classes, cls];
    });
  }
  function addAssignment(si) {
    update(gr => gr.subjects[si].assignments.push({ teacher: "New Teacher", classes: [], periods: gr.subjects[si].weekly || 1 }));
  }
  function deleteAssignment(si, ai) {
    update(gr => {
      gr.subjects[si].assignments.splice(ai, 1);
      if (gr.subjects[si].assignments.length === 0) gr.subjects.splice(si, 1);
    });
  }

  function addClass() {
    const name = prompt("New class/stream name (e.g. 6H or 11 PED SCI B):");
    if (!name) return;
    update(gr => { if (!gr.classes.includes(name)) gr.classes.push(name); });
  }
  function deleteClass(cls) {
    if (!confirm(`Delete class ${cls}? It will be removed from all assignments.`)) return;
    update(gr => {
      gr.classes = gr.classes.filter(c => c !== cls);
      for (const s of gr.subjects) for (const a of s.assignments) a.classes = a.classes.filter(c => c !== cls);
      for (const s of gr.subjects) s.assignments = s.assignments.filter(a => a.classes.length);
      gr.subjects = gr.subjects.filter(s => s.assignments.length);
    });
  }

  async function save() {
    setBusy(true); setStatus("Saving…");
    try {
      const r = await fetch("/api/model", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grades }) });
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
      const save = await fetch("/api/timetable/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placements: d.placements, warnings: d.warnings, status: "generated", createdAt: new Date().toISOString() }) });
      const sd = await save.json();
      setStatus(sd.saved ? `Regenerated ✓ ${d.placements.length} placements, ${d.warnings.length} warnings` : ("Regenerated but save: " + (sd.reason || "?")));
    } catch (e) { setStatus("Regenerate failed: " + e); }
    setBusy(false);
  }

  function classLoad(cls) {
    let core = 0; const bk = {};
    for (const s of g.subjects) {
      const a = s.assignments.find(a => a.classes.includes(cls));
      if (!a) continue;
      const p = a.periods || s.weekly || 0;
      if (s.bucketId) bk[s.bucketId] = Math.max(bk[s.bucketId] || 0, p);
      else core += p;
    }
    return core + Object.values(bk).reduce((x, y) => x + y, 0);
  }

  return (
    <>
      <header className="masthead">
        <div className="wrap">
          <p className="eyebrow">Data management</p>
          <h1>Edit School Data</h1>
          <p>Edit periods, teachers, and classes. Tick two or more classes in one row to
             make a merged class (taught together in one slot). Save, then generate.</p>
        </div>
      </header>

      <nav className="gradebar">
        <div className="wrap">
          <div className="gradetabs">
            {grades.map((gr, i) => (
              <button key={gr.grade} aria-selected={i === gi} onClick={() => setGi(i)}>
                {gr.grade.replace("Grade ", "Gr ")}
              </button>
            ))}
          </div>
          <a className="editlink" href="/buckets">Buckets →</a>
          <a className="editlink" href="/">← Timetables</a>
        </div>
      </nav>

      <main className="wrap editor">
        <div className="sheet-head">
          <h2>{g.grade}</h2>
          <span className="meta">{g.classes.length} classes · {g.subjects.length} subjects</span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 13 }}>Classes / streams:</b>{" "}
          {g.classes.map(c => {
            const load = classLoad(c);
            return (
              <span key={c} className="status-pill" style={{ marginRight: 6, background: load > 39 ? "#ffd9d9" : undefined }}>
                {c} · {load}p <button className="del" title="Delete class" onClick={() => deleteClass(c)}>×</button>
              </span>
            );
          })}
          <button className="btn" style={{ marginLeft: 8 }} onClick={addClass}>+ Add class</button>
          <div className="note" style={{ marginTop: 4 }}>Load per class (core + one per bucket). Red = over 39 (won’t fully fit).</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "16%" }}>Subject</th>
              <th style={{ width: "16%" }}>Teacher</th>
              <th className="num">Periods</th>
              <th>Classes (tick to include · 2+ ticks = merged group)</th>
              <th style={{ width: "9%" }}>Bucket key</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {g.subjects.map((s, si) => (
              s.assignments.map((a, ai) => (
                <tr key={si + "-" + ai}>
                  {ai === 0 && (
                    <td rowSpan={s.assignments.length}>
                      <input value={s.subject} onChange={e => setSubjectName(si, e.target.value)} />
                    </td>
                  )}
                  <td><input value={a.teacher || ""} onChange={e => setAssignField(si, ai, "teacher", e.target.value)} /></td>
                  <td><input className="num" type="number" min="0" value={a.periods ?? 0} onChange={e => setAssignField(si, ai, "periods", e.target.value)} /></td>
                  <td>
                    <div className="classpick">
                      {g.classes.map(c => (
                        <label key={c} className={`chip ${a.classes.includes(c) ? "on" : ""}`}>
                          <input type="checkbox" checked={a.classes.includes(c)} onChange={() => toggleClass(si, ai, c)} />
                          {c}
                        </label>
                      ))}
                    </div>
                    {a.classes.length > 1 && <span className="mergetag">merged: {a.classes.join(" + ")}</span>}
                  </td>
                  {ai === 0 && (
                    <td rowSpan={s.assignments.length}>
                      <input value={s.bucketId || ""} placeholder="(core)" onChange={e => setBucket(si, e.target.value)} />
                    </td>
                  )}
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="del" title="Delete this teacher/group" onClick={() => deleteAssignment(si, ai)}>🗑</button>
                    {ai === s.assignments.length - 1 && (
                      <button className="addmini" title="Add another teacher / merge group" onClick={() => addAssignment(si)}>+</button>
                    )}
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
        <div className="addrow">
          <button className="btn" onClick={addSubject}>+ Add subject</button>
          <span className="note">
            <b>Merge classes:</b> tick two or more classes in one teacher row — taught together in one slot.
            Separate classes → give each its own row (“+”). Same <b>bucket key</b> = same period (pick one).
          </span>
        </div>
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
