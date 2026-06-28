"use client";
// Personal (subject-teacher) timetable export — Lyceum template layout, app theme colours.
// Palette: #2596be (primary), #c5f5fc (light), #4f6265 (slate), #8c8c8c (grey), #000 (text).
// Merged classes are shown combined, e.g. "6A+6B".
import { bucketColor } from "../lib/timetable";

const C = {
  navy: "1F4E79",      // title band (theme4 tint -0.5)
  label: "D9E1F2",     // field labels (theme8 tint 0.8)
  empnum: "B4C6E7",    // Employee Number cells (theme8 tint 0.6)
  grey: "C0C0C0",      // Register/Interval/Seiri fixed rows (indexed 22)
  bucket: "C5F5FC",    // bucket subject highlight
  black: "000000", white: "FFFFFF",
};

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

function classLabel(grade, cls) {
  const gnum = grade.replace("Grade ", "");
  return cls.startsWith(gnum) ? cls : `${gnum}${cls}`;
}
// Group a teacher cell into [{subject, classes:[...]}], merging classes per subject+grade.
function groupCell(cell) {
  if (!cell) return [];
  const by = {};
  for (const e of cell) {
    const key = `${e.subject}@@${e.grade}`;
    (by[key] ||= { subject: e.subject, classes: [] }).classes.push(classLabel(e.grade, e.class));
  }
  return Object.values(by).map(g => ({ subject: g.subject, classes: g.classes.sort() }));
}
function cellText(cell) {
  return groupCell(cell).map(g => `${g.subject}\n${g.classes.join("+")}`).join("\n");
}
function cellBucket(cell) { return cell && cell[0] && cell[0].bucketId ? cell[0].bucketId : null; }

export async function exportPersonalExcel({ teacher, info, subjectsTaught }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sanitize(teacher), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb: "FF" + argb } });

  // Title band (instructional text, like the template) in primary colour
  ws.mergeCells(1, 1, 1, 6);
  const t = ws.getCell(1, 1);
  t.value = "SAMPLE SUBJECT TEACHER TIMETABLE TEMPLATE\n(Please prepare separate sheet for each Subject Teacher in the same database as per the given template and prepare the database for Grades 1 to 12 subject teachers)";
  t.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF" + C.white } };
  t.fill = fill(C.navy);
  t.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(1).height = 42;

  ws.mergeCells(2, 1, 2, 6);
  const sub = ws.getCell(2, 1);
  sub.value = "LYCEUM INTERNATIONAL SCHOOL - Kurunegala";
  sub.font = { name: "Arial", size: 13, bold: true, color: { argb: "FF" + C.black } };
  sub.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 28;

  ws.addRow([]);
  // Header fields block (label | value | label | value), label cells in light blue
  const fieldRows = [
    ["Teacher's Name", teacher, "Employee Number", ""],
    ["Subjects Taught", subjectsTaught || "", "", ""],
    ["Section to which the Teacher Belong to:\n[Primary/Middle School/Lower Secondary/Upper Secondary]", "", "", ""],
    ["Supervising Sectional Head's Name", "", "Employee Number", ""],
  ];
  for (const f of fieldRows) {
    const r = ws.addRow(f);
    r.height = f[0].length > 40 ? 48 : 22;
    r.getCell(1).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF" + C.black } };
    r.getCell(1).fill = fill(C.label);
    r.getCell(1).alignment = { vertical: "middle", wrapText: true };
    r.getCell(1).border = thin();
    r.getCell(2).border = thin();
    r.getCell(2).font = { name: "Arial", size: 10, color: { argb: "FF" + C.black } };
    if (f[2]) {
      r.getCell(3).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF" + C.black } };
      r.getCell(3).fill = fill(C.empnum);
      r.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(3).border = thin();
      r.getCell(4).border = thin();
    }
  }
  ws.addRow([]);

  const head = ws.addRow(["TIME", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
  head.height = 22;
  head.eachCell(c => {
    c.font = { name: "Arial", bold: true, size: 12, color: { argb: "FF" + C.black } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = thin();
  });

  for (const rowDef of ROWS) {
    if (rowDef.fixed) {
      const r = ws.addRow([rowDef.time, rowDef.fixed]);
      ws.mergeCells(r.number, 2, r.number, 6);
      r.getCell(1).font = { name: "Arial", size: 10, color: { argb: "FF" + C.black } };
      r.getCell(1).border = thin();
      const fc = r.getCell(2);
      fc.alignment = { horizontal: "center", vertical: "middle" };
      fc.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF" + C.black } };
      fc.fill = fill(C.grey);
      for (let cc = 1; cc <= 6; cc++) r.getCell(cc).border = thin();
      continue;
    }
    const cells = [rowDef.time];
    const flags = [null];
    for (let d = 0; d < 5; d++) {
      const cell = info.grid[d][rowDef.period];
      flags.push(cellBucket(cell));
      cells.push(cellText(cell));
    }
    const r = ws.addRow(cells);
    r.height = 40;
    r.eachCell((c, col) => {
      c.border = thin();
      c.alignment = { wrapText: true, vertical: "middle", horizontal: col === 1 ? "left" : "center" };
      if (col === 1) {
        c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF" + C.black } };
      } else {
        c.font = { name: "Arial", size: 9, color: { argb: "FF" + C.black } };
        const b = flags[col - 1];
        if (b) c.fill = fill(C.bucket);
      }
    });
  }

  ws.getColumn(1).width = 22;
  for (let i = 2; i <= 6; i++) ws.getColumn(i).width = 19;

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${sanitize(teacher)}_personal_timetable.xlsx`);
}

export async function exportPersonalPdf({ teacher, info, subjectsTaught }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.width;

  // Navy title band with instructional text (template #1F4E79)
  doc.setFillColor(31, 78, 121);
  doc.rect(0, 0, W, 46, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text("SAMPLE SUBJECT TEACHER TIMETABLE TEMPLATE", W / 2, 20, { align: "center" });
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text("(Please prepare separate sheet for each Subject Teacher in the same database as per the given template and prepare the database for Grades 1 to 12 subject teachers)", W / 2, 34, { align: "center" });

  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("LYCEUM INTERNATIONAL SCHOOL - Kurunegala", W / 2, 66, { align: "center" });

  // Header fields table (labels in steel blue)
  autoTable(doc, {
    startY: 78, margin: { left: 40, right: W / 2 - 40 },
    body: [
      [{ content: "Teacher's Name", styles: { fillColor: [217, 225, 242], fontStyle: "bold" } }, teacher,
       { content: "Employee Number", styles: { fillColor: [180, 198, 231], fontStyle: "bold", halign: "center" } }, ""],
      [{ content: "Subjects Taught", styles: { fillColor: [217, 225, 242], fontStyle: "bold" } }, subjectsTaught || "", "", ""],
      [{ content: "Section to which the Teacher Belong to:\n[Primary/Middle School/Lower Secondary/Upper Secondary]", styles: { fillColor: [217, 225, 242], fontStyle: "bold" } }, "", "", ""],
      [{ content: "Supervising Sectional Head's Name", styles: { fillColor: [217, 225, 242], fontStyle: "bold" } }, "",
       { content: "Employee Number", styles: { fillColor: [180, 198, 231], fontStyle: "bold", halign: "center" } }, ""],
    ],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.4, textColor: [0, 0, 0], valign: "middle" },
    theme: "grid",
  });

  const head = [["TIME", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]];
  const body = [];
  const fills = [];
  for (const rowDef of ROWS) {
    if (rowDef.fixed) {
      body.push([rowDef.time, { content: rowDef.fixed, colSpan: 5 }]);
      fills.push("fixed");
      continue;
    }
    const row = [rowDef.time];
    const rf = [null];
    for (let d = 0; d < 5; d++) {
      const cell = info.grid[d][rowDef.period];
      row.push(cellText(cell).replace(/\n/g, " "));
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
        if (Array.isArray(f)) h.cell.styles.fillColor = f;
      }
    },
  });

  doc.save(`${sanitize(teacher)}_personal_timetable.pdf`);
}

function thin() {
  const s = { style: "thin", color: { argb: "FF000000" } };
  return { top: s, left: s, bottom: s, right: s };
}
function toHex(css) {
  if (!css) return "EFEFEF";
  if (css.startsWith("#")) {
    const h = css.slice(1);
    return (h.length === 3 ? h.split("").map(c => c + c).join("") : h).toUpperCase();
  }
  const [r, g, b] = rgb(css);
  return [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}
function rgb(css) {
  if (!css) return [239, 239, 239];
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
  return [(r + mm) * 255, (g + mm) * 255, (b + mm) * 255];
}
function sanitize(s) { return s.replace(/[\\/?*[\]:]/g, "-").slice(0, 28); }
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
