"use client";
import { DAYS, PERIOD_LABELS, bucketColor } from "../lib/timetable";

function rgb(css) {
  if (!css) return [255, 255, 255];
  if (css.startsWith("#")) {
    const h = css.slice(1);
    const f = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  }
  const m = css.match(/hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return [239, 239, 239];
  let [h, s, l] = [parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100];
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), mm = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [(r + mm) * 255, (g + mm) * 255, (b + mm) * 255].map(Math.round);
}

export async function exportPdf({ mode, sel, current, data }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(`${mode === "class" ? "Class" : "Teacher"} Timetable — ${sel}`, 40, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text("8 periods/day · interval after Period 4 · 2026", 40, 56);
  doc.setTextColor(20);

  const head = [["Day", ...PERIOD_LABELS]];
  const body = [];
  const fills = []; // [rowIdx][colIdx] -> rgb
  const assemblyDay = mode === "class" ? current.assemblyDay : null;

  DAYS.forEach((day, d) => {
    const row = [day];
    const rowFill = [null];
    for (let p = 0; p < PERIOD_LABELS.length; p++) {
      if (assemblyDay === d && p === 0) {
        row.push("Assembly"); rowFill.push("assembly"); continue;
      }
      const cell = current.grid[d][p];
      if (!cell) { row.push(""); rowFill.push(null); continue; }
      if (mode === "class") {
        row.push(cell.subjects.length > 1
          ? "Choose one:\n" + cell.subjects.map(s => `${s.subject} (${short(s.teacher)})`).join("\n")
          : cell.subjects[0].subject + (cell.subjects[0].teacher ? `\n${cell.subjects[0].teacher}` : ""));
        rowFill.push(cell.bucketId ? rgb(bucketColor(cell.bucketId)) : null);
      } else {
        row.push(cell[0].subject + "\n" + cell.map(c => `${c.grade.replace("Grade ", "G")} ${c.class}`).join(", "));
        rowFill.push(cell[0].bucketId ? rgb(bucketColor(cell[0].bucketId)) : null);
      }
    }
    body.push(row); fills.push(rowFill);
  });

  autoTable(doc, {
    head, body, startY: 68,
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 4, valign: "middle", lineColor: [216, 211, 196], lineWidth: 0.5, overflow: "linebreak" },
    headStyles: { fillColor: [32, 33, 29], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { fillColor: [228, 237, 233], fontStyle: "bold", halign: "center", cellWidth: 60 } },
    didParseCell: (h) => {
      if (h.section !== "body") return;
      const rf = fills[h.row.index];
      if (!Array.isArray(rf)) return;
      const f = rf[h.column.index];
      if (f === "assembly") {
        h.cell.styles.fillColor = [239, 231, 210];
        h.cell.styles.textColor = [47, 93, 80];
        h.cell.styles.fontStyle = "italic";
        h.cell.styles.halign = "center";
      } else if (Array.isArray(f)) {
        h.cell.styles.fillColor = f;
      }
    },
  });

  doc.save(`${sanitize(sel)}_timetable.pdf`);
}

function short(n) { return n ? n.replace(/^(Ms|Mr)\.?\s*/, "").replace(/^New\s*/, "") : ""; }
function sanitize(s) { return s.replace(/[\\/?*[\]:]/g, "-"); }
