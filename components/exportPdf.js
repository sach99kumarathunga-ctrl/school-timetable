"use client";
import { DAYS, bucketColor } from "../lib/timetable";

const ROWS = [
  { time: "7.40 a.m. - 8.15 a.m.", period: 0 },
  { time: "8.15 a.m. - 8.30 a.m.", fixed: "Register Marking" },
  { time: "8.30 a.m. - 9.10 a.m.", period: 1 },
  { time: "9.10 a.m. - 9.50 a.m.", period: 2 },
  { time: "9.50 a.m. - 10.25 a.m.", period: 3 },
  { time: "10.25 a.m. - 10.50 a.m.", fixed: "Interval" },
  { time: "10.50 a.m. - 10.55 a.m.", fixed: "Seiri Time" },
  { time: "10.55 a.m. - 11.35 a.m.", period: 4 },
  { time: "11.35 a.m. - 12.15 p.m.", period: 5 },
  { time: "12.15 p.m. - 1.00 p.m.", period: 6 },
  { time: "1.00 p.m. - 1.45 p.m.", period: 7 },
];

function rgb(css) {
  if (!css) return [255, 255, 255];
  if (css.startsWith("#")) {
    const h = css.slice(1);
    const f = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  }
  return [239, 239, 239];
}

function cellText(cell) {
  if (!cell) return "";
  if (cell.subjects.length > 1) {
    return cell.subjects.map(s => s.subject).join(" / ");
  }
  const s = cell.subjects[0];
  return s.subject + (s.teacher ? " - " + short(s.teacher) : "");
}

function cellBucket(cell) { return cell && cell.bucketId ? cell.bucketId : null; }

function short(name) {
  if (!name) return "";
  return name.replace(/^Ms\.?\s*/,"").replace(/^Mr\.?\s*/,"").replace(/^New\s*/,"");
}

export async function exportPdf({ mode, sel, current, data }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.width;

  doc.setFillColor(31, 78, 121);
  doc.rect(0, 0, W, 46, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text("SAMPLE CLASS TIMETABLE TEMPLATE", W / 2, 20, { align: "center" });
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text("(Please prepare separate sheet for each Class Teacher in the same database as per the given template and prepare the database for Grades 1 to 12 class timetables)", W / 2, 34, { align: "center" });

  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("LYCEUM INTERNATIONAL SCHOOL - Kurunegala", W / 2, 66, { align: "center" });

  autoTable(doc, {
    startY: 78, margin: { left: 40, right: W / 2 - 40 },
    body: [
      [{ content: "Class", styles: { fillColor: [217, 225, 242], fontStyle: "bold" } }, sel,
       { content: "HR / CTC", styles: { fillColor: [217, 225, 242], fontStyle: "bold", halign: "center" } }, ""],
      [{ content: "Class Teacher", styles: { fillColor: [217, 225, 242], fontStyle: "bold" } }, "", "", ""],
      [{ content: "Supervising Sectional Head's Name", styles: { fillColor: [217, 225, 242], fontStyle: "bold" } }, "Clive Christopher",
       { content: "Employee Number", styles: { fillColor: [180, 198, 231], fontStyle: "bold", halign: "center" } }, "1005140"],
    ],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.4, textColor: [0, 0, 0], valign: "middle" },
    theme: "grid",
  });

  const head = [["TIME", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]];
  const body = [];
  const fills = [];
  const assemblyDay = current.assemblyDay;

  for (const rowDef of ROWS) {
    if (rowDef.fixed) {
      body.push([rowDef.time, { content: rowDef.fixed, colSpan: 5 }]);
      fills.push("fixed");
      continue;
    }
    const row = [rowDef.time];
    const rf = [null];
    for (let d = 0; d < 5; d++) {
      if (assemblyDay === d && rowDef.period === 0) {
        row.push("Assembly"); rf.push("assembly"); continue;
      }
      const cell = current.grid[d][rowDef.period];
      row.push(cellText(cell));
      rf.push(cellBucket(cell) ? [197, 245, 252] : null);
    }
    body.push(row); fills.push(rf);
  }

  autoTable(doc, {
    head, body, startY: doc.lastAutoTable.finalY + 14,
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 4, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.4, overflow: "linebreak", textColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", halign: "center", fontSize: 11, lineColor: [0, 0, 0], lineWidth: 0.5 },
    columnStyles: { 0: { cellWidth: 110, fontStyle: "bold", fillColor: [255, 255, 255], textColor: [0, 0, 0] } },
    didParseCell: (h) => {
      if (h.section !== "body") return;
      const rf = fills[h.row.index];
      if (rf === "fixed") {
        h.cell.styles.fillColor = [192, 192, 192];
        h.cell.styles.textColor = [0, 0, 0];
        h.cell.styles.fontStyle = "bold";
        h.cell.styles.halign = "center";
      } else if (Array.isArray(rf)) {
        const f = rf[h.column.index];
        if (f === "assembly") {
          h.cell.styles.fillColor = [239, 231, 210];
          h.cell.styles.textColor = [47, 93, 80];
          h.cell.styles.fontStyle = "italic";
          h.cell.styles.halign = "center";
        } else if (Array.isArray(f)) {
          h.cell.styles.fillColor = f;
        }
      }
    },
  });

  const yNote = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
  doc.text("NOTE: This is a sample template. Please fill in the Class Teacher's name and HR/CTC details before finalizing.", 40, yNote);

  doc.save(`${sanitize(sel)}_timetable.pdf`);
}

function sanitize(s) { return s.replace(/[\\/?*[\]:]/g, "-"); }
