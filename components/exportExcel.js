"use client";
import { DAYS, PERIOD_LABELS, bucketColor } from "../lib/timetable";

// Convert a CSS colour (hex or hsl) to an ARGB hex for ExcelJS.
function toARGB(css) {
  if (!css) return null;
  if (css.startsWith("#")) {
    const h = css.slice(1);
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    return "FF" + full.toUpperCase();
  }
  // hsl(h s% l%)
  const m = css.match(/hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return "FFEFEFEF";
  let [h, s, l] = [parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100];
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), mm = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const hex = v => Math.round((v + mm) * 255).toString(16).padStart(2, "0");
  return ("FF" + hex(r) + hex(g) + hex(b)).toUpperCase();
}

export async function exportExcel({ mode, sel, current, data }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "School Timetable";
  const ws = wb.addWorksheet(sanitize(sel), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });

  const titleRow = ws.addRow([`${mode === "class" ? "Class" : "Teacher"} Timetable — ${sel}`]);
  titleRow.font = { name: "Arial", size: 15, bold: true };
  ws.mergeCells(1, 1, 1, PERIOD_LABELS.length + 1);
  ws.addRow([`8 periods/day · interval after Period 4 · 2026`]).font = { name: "Arial", italic: true, size: 9, color: { argb: "FF777777" } };
  ws.addRow([]);

  const header = ["Day", ...PERIOD_LABELS];
  const hRow = ws.addRow(header);
  hRow.eachCell(c => {
    c.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF20211D" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = thin();
  });

  const assemblyDay = mode === "class" ? current.assemblyDay : null;

  DAYS.forEach((day, d) => {
    const cells = [day];
    const meta = [];
    const assemblyCells = [];
    for (let p = 0; p < PERIOD_LABELS.length; p++) {
      if (assemblyDay === d && p === 0) {
        cells.push("Assembly"); meta.push(null); assemblyCells.push(true); continue;
      }
      assemblyCells.push(false);
      const cell = current.grid[d][p];
      if (!cell) { cells.push(""); meta.push(null); continue; }
      if (mode === "class") {
        if (cell.subjects.length > 1) {
          cells.push("Choose one:\n" + cell.subjects.map(s => `${s.subject} (${s.teacher || ""})`).join("\n"));
        } else {
          cells.push(cell.subjects[0].subject + (cell.subjects[0].teacher ? `\n${cell.subjects[0].teacher}` : ""));
        }
        meta.push(cell.bucketId);
      } else {
        cells.push(cell[0].subject + "\n" + cell.map(c => `${c.grade.replace("Grade ", "G")} ${c.class}`).join(", "));
        meta.push(cell[0].bucketId);
      }
    }
    const row = ws.addRow(cells);
    row.height = 46;
    row.eachCell((c, col) => {
      c.alignment = { wrapText: true, vertical: "middle", horizontal: col === 1 ? "center" : "left" };
      c.font = { name: "Arial", size: 9, bold: col === 1 };
      c.border = thin();
      if (col === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4EDE9" } };
      else if (assemblyCells[col - 2]) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFE7D2" } };
        c.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF2F5D50" } };
        c.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        const b = meta[col - 2];
        if (b) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toARGB(bucketColor(b)) } };
      }
    });
  });

  ws.getColumn(1).width = 12;
  for (let i = 2; i <= PERIOD_LABELS.length + 1; i++) ws.getColumn(i).width = 18;

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${sanitize(sel)}_timetable.xlsx`);
}

function thin() {
  const s = { style: "thin", color: { argb: "FFD8D3C4" } };
  return { top: s, left: s, bottom: s, right: s };
}
function sanitize(s) { return s.replace(/[\\/?*[\]:]/g, "-").slice(0, 28); }
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
