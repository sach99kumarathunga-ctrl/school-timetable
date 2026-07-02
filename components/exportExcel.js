"use client";
import { DAYS, bucketColor } from "../lib/timetable";

const C = {
  navy: "1F4E79",
  label: "D9E1F2",
  empnum: "B4C6E7",
  grey: "C0C0C0",
  bucket: "C5F5FC",
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

function fill(argb) { return { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + argb } }; }
function thin() { const s = { style: "thin", color: { argb: "FF000000" } }; return { top: s, left: s, bottom: s, right: s }; }

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

export async function exportExcel({ mode, sel, current, data }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "School Timetable";
  const ws = wb.addWorksheet(sanitize(sel), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });

  ws.mergeCells(1, 1, 1, 6);
  const t = ws.getCell(1, 1);
  t.value = "SAMPLE CLASS TIMETABLE TEMPLATE\n(Please prepare separate sheet for each Class Teacher in the same database as per the given template and prepare the database for Grades 1 to 12 class timetables)";
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
  const fieldRows = [
    ["Class", sel, "HR / CTC", ""],
    ["Class Teacher", "", "", ""],
    ["Supervising Sectional Head's Name", "Clive Christopher", "Employee Number", "1005140"],
  ];
  for (const f of fieldRows) {
    const r = ws.addRow(f);
    r.height = 22;
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

  const assemblyDay = current.assemblyDay;

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
      if (assemblyDay === d && rowDef.period === 0) {
        cells.push("Assembly"); flags.push(null); continue;
      }
      const cell = current.grid[d][rowDef.period];
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

  ws.addRow([]);
  ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, 6);
  const note = ws.getCell(ws.lastRow.number, 1);
  note.value = "NOTE: This is a sample template. Please fill in the Class Teacher's name and HR/CTC details before finalizing.";
  note.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF" + C.black } };
  note.alignment = { horizontal: "left", vertical: "middle" };

  ws.getColumn(1).width = 22;
  for (let i = 2; i <= 6; i++) ws.getColumn(i).width = 19;

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${sanitize(sel)}_timetable.xlsx`);
}

function sanitize(s) { return s.replace(/[\\/?*[\]:]/g, "-").slice(0, 28); }
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
