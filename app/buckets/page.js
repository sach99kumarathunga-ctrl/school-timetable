"use client";
import { useEffect, useState } from "react";

function deriveGroups(subs) {
  const seen = new Map();
  for (const s of subs) {
    for (const a of s.assignments) {
      const key = [...a.classes].sort().join(",");
      if (!seen.has(key)) seen.set(key, [...a.classes]);
    }
  }
  const groups = [...seen.values()].map((classes, id) => ({ id, classes }));
  const periodsPerLesson = Math.max(1, ...subs.flatMap(s => s.assignments.map(a => a.periods)));
  const subjects = subs.map(s => ({
    name: s.subject,
    origIdx: -1,
    assignments: groups.map(g => {
      const key = [...g.classes].sort().join(",");
      const match = s.assignments.find(a => [...a.classes].sort().join(",") === key);
      return { groupId: g.id, teacher: match?.teacher || "" };
    }),
  }));
  return { groups, periodsPerLesson, subjects };
}

function initBuckets(grades) {
  return grades.map(g => {
    const bids = [...new Set(g.subjects.filter(s => s.bucketId).map(s => s.bucketId))].sort();
    const buckets = {};
    for (const bid of bids) {
      const subs = g.subjects.filter(s => s.bucketId === bid);
      const state = deriveGroups(subs);
      state.bid = bid;
      buckets[bid] = state;
    }
    return { grade: g, buckets };
  });
}

export default function BucketsPage() {
  const [grades, setGrades] = useState(null);
  const [gi, setGi] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [states, setStates] = useState(null);

  useEffect(() => {
    fetch("/api/model").then(r => r.json()).then(d => {
      setGrades(d.grades);
      setStates(initBuckets(d.grades));
    });
  }, []);

  if (!grades || !states) return <div className="wrap" style={{ padding: 60, fontSize: 22 }}>Loading data…</div>;

  const cur = states[gi];
  const g = grades[gi];
  const bucketIds = Object.keys(cur.buckets).sort();

  function updateBuckets(mut) {
    const next = structuredClone(states);
    mut(next[gi]);
    setStates(next);
  }

  function updateGrades(mut) {
    const nextG = structuredClone(grades);
    mut(nextG[gi]);
    setGrades(nextG);
  }

  function toggleGroupClass(bid, gid, cls) {
    updateBuckets(st => {
      const group = st.buckets[bid].groups.find(x => x.id === gid);
      if (!group) return;
      if (group.classes.includes(cls))
        group.classes = group.classes.filter(c => c !== cls);
      else
        group.classes = [...group.classes, cls];
      if (group.classes.length === 0)
        st.buckets[bid].groups = st.buckets[bid].groups.filter(x => x.id !== gid);
    });
  }

  function addMergeGroup(bid) {
    updateBuckets(st => {
      const b = st.buckets[bid];
      const used = new Set(b.groups.flatMap(x => x.classes));
      const free = g.classes.filter(c => !used.has(c));
      if (free.length === 0) return;
      const pick = [free[0]];
      if (free.length >= 2) pick.push(free[1]);
      const nid = Math.max(0, ...b.groups.map(x => x.id)) + 1;
      b.groups.push({ id: nid, classes: pick });
      for (const subj of b.subjects) {
        subj.assignments.push({ groupId: nid, teacher: "" });
      }
    });
  }

  function deleteMergeGroup(bid, gid) {
    updateBuckets(st => {
      const b = st.buckets[bid];
      b.groups = b.groups.filter(x => x.id !== gid);
      for (const subj of b.subjects)
        subj.assignments = subj.assignments.filter(a => a.groupId !== gid);
    });
  }

  function setSubjectTeacher(bid, si, ai, v) {
    updateBuckets(st => { st.buckets[bid].subjects[si].assignments[ai].teacher = v; });
  }

  function addSubject(bid) {
    const name = prompt("New subject name:");
    if (!name) return;
    updateBuckets(st => {
      const b = st.buckets[bid];
      if (b.subjects.some(x => x.name === name)) return;
      b.subjects.push({
        name,
        assignments: b.groups.map(g => ({ groupId: g.id, teacher: "" })),
      });
    });
  }

  function deleteSubject(bid, si) {
    if (!confirm(`Remove "${cur.buckets[bid].subjects[si].name}" from this bucket?`)) return;
    updateBuckets(st => {
      st.buckets[bid].subjects.splice(si, 1);
    });
  }

  function setPeriodsPerLesson(bid, v) {
    updateBuckets(st => { st.buckets[bid].periodsPerLesson = Math.max(1, parseInt(v || "1", 10)); });
  }

  function renameSubject(bid, si, v) {
    updateBuckets(st => { st.buckets[bid].subjects[si].name = v; });
  }

  function rebuildGradeBuckets(grade, bucketStates) {
    for (const [bid, bst] of Object.entries(bucketStates)) {
      grade.subjects = grade.subjects.filter(s => s.bucketId !== bid);
      for (const subj of bst.subjects) {
        const ass = subj.assignments.map(a => {
          const g = bst.groups.find(x => x.id === a.groupId);
          return { teacher: a.teacher, classes: g ? [...g.classes] : [], periods: bst.periodsPerLesson };
        }).filter(a => a.teacher && a.classes.length > 0);
        if (ass.length === 0) continue;
        grade.subjects.push({ subject: subj.name, bucketId: bid, color: bid, assignments: ass });
      }
    }
  }

  async function save() {
    const nextG = structuredClone(grades);
    for (const st of states) {
      const grade = nextG.find(x => x.grade === st.grade.grade);
      if (!grade) continue;
      rebuildGradeBuckets(grade, st.buckets);
    }
    setGrades(nextG);
    setBusy(true); setStatus("Saving…");
    try {
      const r = await fetch("/api/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades: nextG }),
      });
      const d = await r.json();
      setStatus(d.saved ? "Saved ✓" : `Not saved: ${d.reason}`);
    } catch (e) { setStatus("Save failed: " + e); }
    setBusy(false);
  }

  async function regenerate() {
    const nextG = structuredClone(grades);
    for (const st of states) {
      const grade = nextG.find(x => x.grade === st.grade.grade);
      if (!grade) continue;
      rebuildGradeBuckets(grade, st.buckets);
    }
    setGrades(nextG);
    setBusy(true); setStatus("Regenerating…");
    try {
      const r = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: { grades: nextG } }),
      });
      if (!r.ok) { const t = await r.text().catch(() => ""); setStatus("Regenerate failed (HTTP " + r.status + "): " + t.slice(0, 100)); setBusy(false); return; }
      const d = await r.json();
      if (!d.ok) { setStatus("Regenerate failed: " + (d.reason || "unknown")); setBusy(false); return; }
      const save = await fetch("/api/timetable/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placements: d.placements, warnings: d.warnings, status: "generated", createdAt: new Date().toISOString() }),
      });
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
          <p>Merge blocks are defined once per bucket.
             Tick which classes form each merge group.
             Then assign teachers per subject per block.</p>
        </div>
      </header>

      <nav className="gradebar">
        <div className="wrap">
          <div className="gradetabs">
            {states.map((st, i) => (
              <button key={st.grade.grade} aria-selected={i === gi} onClick={() => setGi(i)}>
                {st.grade.grade.replace("Grade ", "Gr ")} ({Object.keys(st.buckets).length})
              </button>
            ))}
          </div>
          <a className="editlink" href="/">← Back to timetables</a>
        </div>
      </nav>

      <main className="wrap editor">
        <div className="sheet-head">
          <h2>{g.grade}</h2>
          <span className="meta">{g.classes.join(" · ")}</span>
        </div>

        {bucketIds.map(bid => {
          const bst = cur.buckets[bid];
          return (
            <div key={bid} style={{ marginBottom: 32, border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
              <h3 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 18, margin: "0 0 8px 0" }}>
                Bucket <code style={{ background: "var(--accent-soft)", padding: "2px 8px", borderRadius: 4 }}>{bid}</code>
                <span style={{ fontWeight: 400, fontSize: 14, marginLeft: 12, color: "var(--muted)" }}>
                  Periods per week: <input className="num" type="number" min="1" max="11"
                    value={bst.periodsPerLesson} onChange={e => setPeriodsPerLesson(bid, e.target.value)}
                    style={{ width: 48 }} />
                </span>
              </h3>

              <div style={{ marginBottom: 12 }}>
                <b style={{ fontSize: 13 }}>Merge groups (tick classes that share the same period):</b>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                  {bst.groups.map(g => (
                    <div key={g.id} style={{
                      border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px",
                      background: "var(--bg)",
                    }}>
                      <div className="classpick" style={{ display: "inline-flex" }}>
                        {g.classes.map(c => (
                          <label key={c} className={`chip ${g.classes.includes(c) ? "on" : ""}`}
                            style={{ fontSize: 12 }}>
                            <input type="checkbox" checked={g.classes.includes(c)}
                              onChange={() => toggleGroupClass(bid, g.id, c)} />
                            {c}
                          </label>
                        ))}
                      </div>
                      {g.classes.length > 1 && (
                        <span className="mergetag" style={{ marginLeft: 6 }}>merged</span>
                      )}
                      <button className="del" title="Delete merge group"
                        onClick={() => deleteMergeGroup(bid, g.id)} style={{ marginLeft: 6 }}>×</button>
                    </div>
                  ))}
                  <button className="addmini" title="Add a merge group" onClick={() => addMergeGroup(bid)}>+</button>
                </div>
              </div>

              {bst.groups.length > 0 && (
                <table style={{ marginTop: 4 }}>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      {bst.groups.map(g => (
                        <th key={g.id}>
                          {g.classes.length > 1
                            ? g.classes.join(" + ")
                            : g.classes[0] || "(empty)"}
                        </th>
                      ))}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bst.subjects.map((subj, si) => (
                      <tr key={subj.name}>
                        <td>
                          <input value={subj.name}
                            onChange={e => renameSubject(bid, si, e.target.value)}
                            style={{ fontWeight: 600 }} />
                        </td>
                        {subj.assignments.map(a => (
                          <td key={a.groupId}>
                            <input value={a.teacher || ""}
                              onChange={e => setSubjectTeacher(bid, si, subj.assignments.indexOf(a), e.target.value)}
                              placeholder="Teacher…" />
                          </td>
                        ))}
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="del" title="Remove subject from bucket"
                            onClick={() => deleteSubject(bid, si)}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ marginTop: 8 }}>
                <button className="addmini" onClick={() => addSubject(bid)}>+ Add subject</button>
              </div>
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
