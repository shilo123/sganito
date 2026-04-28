import { getActiveToast } from './toast';

// Surfaces the popup-blocked failure through the global toast when
// possible, falling back to alert() only if toast isn't mounted yet
// (e.g. invoked from a static context outside the app shell).
function notifyPopupBlocked() {
  const t = getActiveToast();
  if (t) {
    t.error('הדפדפן חסם פתיחת חלון חדש — בטל את החסימה ונסה שוב', { title: 'פתיחת חלון נחסמה' });
  } else {
    // eslint-disable-next-line no-alert -- last-resort fallback
    alert('הדפדפן חסם פתיחת חלון חדש — בטל את החסימה ונסה שוב');
  }
}

// Lightweight, zero-dependency export utilities for Excel / Word / PDF.
// Strategy:
//   - Excel: produce a rich HTML table with MIME application/vnd.ms-excel.
//     Excel opens HTML tables natively as .xls with fonts/colors preserved.
//   - Word:  same HTML with application/msword so the user gets a Word doc
//            that mirrors the on-screen design.
//   - PDF:   open a new window with the print-styled HTML and call print();
//            the user picks "Save as PDF" from the browser's print dialog.
// All three render an identical, polished layout with a branded header,
// zebra-striped table, summary row, and print-friendly repeating headers.

export interface ExportColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (row: T) => string | number | null | undefined;
  width?: number; // in chars, rough hint for Excel column widths
  align?: 'right' | 'left' | 'center';
}

export interface ExportOptions<T = Record<string, unknown>> {
  title: string; // shown at top of exported doc
  subtitle?: string; // optional secondary line (e.g. layer name)
  filename: string; // without extension
  columns: ExportColumn<T>[];
  rows: T[];
  // Optional school/brand name — shown small in the banner. Defaults to
  // "מערכת סגנית" if not provided.
  brand?: string;
}

// ============================================================================
// Schedule-grid export (used by "מערכת בית הספר")
// Takes the full list of assignments + classes and renders a printable
// weekly grid: one table per class, Hebrew day columns, hour rows.
// ============================================================================
export interface ScheduleAssignment {
  ClassId: number | string;
  ClassName?: string;
  HourId: number | string;
  TeacherName?: string | null;
  Professional?: string | null;
  Hakbatza?: number | string | null;
}

export interface ScheduleClass {
  ClassId: number | string;
  ClassName: string;
}

export interface ScheduleExportOptions {
  schoolName: string;
  title: string; // e.g., "מערכת בית הספר — שכבה א׳"
  subtitle?: string;
  filename: string;
  classes: ScheduleClass[];
  assignments: ScheduleAssignment[];
  hoursPerDay?: number; // default 9
  logoUrl?: string;
}

function escapeHtml(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(): string {
  const now = new Date();
  const d = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const t = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return `${d} · ${t}`;
}

function buildTableHtml<T>(opts: ExportOptions<T>): string {
  const brand = opts.brand ?? 'מערכת סגנית';
  const cellValue = (row: T, col: ExportColumn<T>): string => {
    const raw = col.render
      ? col.render(row)
      : (row as Record<string, unknown>)[col.key];
    return escapeHtml(raw as string | number | null | undefined);
  };
  const head = opts.columns
    .map(
      (c) =>
        `<th style="text-align:${c.align || 'right'}">${escapeHtml(c.label)}</th>`,
    )
    .join('');
  const body = opts.rows
    .map((r, idx) => {
      const cells = opts.columns
        .map(
          (c) =>
            `<td style="text-align:${c.align || 'right'}">${cellValue(r, c)}</td>`,
        )
        .join('');
      const cls = idx % 2 === 0 ? 'row-even' : 'row-odd';
      return `<tr class="${cls}">${cells}</tr>`;
    })
    .join('');

  const subtitle = opts.subtitle
    ? `<div class="sub">${escapeHtml(opts.subtitle)}</div>`
    : '';
  const rowCount = opts.rows.length;

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Arial", "David", sans-serif;
    direction: rtl;
    margin: 0;
    padding: 24px 28px;
    background: #f8fafc;
    color: #0f172a;
  }
  .doc {
    max-width: 1100px;
    margin: 0 auto;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 6px 24px -8px rgba(15, 23, 42, 0.15), 0 2px 4px rgba(15, 23, 42, 0.06);
    overflow: hidden;
  }
  .banner {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    color: #fff;
    padding: 22px 28px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }
  .banner h1 {
    margin: 0 0 6px 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .banner .sub {
    font-size: 13px;
    opacity: 0.9;
  }
  .banner-meta {
    text-align: left;
    font-size: 12px;
    opacity: 0.92;
    line-height: 1.7;
  }
  .banner-meta .brand {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.5px;
  }
  .stats {
    background: #f1f5f9;
    padding: 10px 28px;
    font-size: 12px;
    color: #475569;
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    border-bottom: 1px solid #e2e8f0;
  }
  .stats strong { color: #0f172a; }
  .table-wrap { padding: 18px 20px 24px; }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
    background: #fff;
  }
  thead th {
    background: linear-gradient(180deg, #334155 0%, #1e293b 100%);
    color: #fff;
    padding: 10px 12px;
    font-weight: 600;
    letter-spacing: 0.2px;
    border: 1px solid #1e293b;
    font-size: 12.5px;
  }
  tbody td {
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    vertical-align: middle;
  }
  tr.row-even td { background: #ffffff; }
  tr.row-odd td { background: #f8fafc; }
  tbody tr:hover td { background: #eff6ff; }
  tfoot td {
    background: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
    border: 1px solid #cbd5e1;
    padding: 10px 12px;
  }
  .footer-note {
    padding: 12px 28px 20px;
    font-size: 11px;
    color: #94a3b8;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    background: #fafafa;
  }
  /* Print / PDF tuning */
  @media print {
    body { background: #fff; padding: 0; }
    .doc { box-shadow: none; border-radius: 0; max-width: 100%; }
    .banner { background: #1e3a8a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead th { background: #1e293b !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr.row-odd td { background: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
  }
  @page { margin: 14mm 12mm; }
</style>
</head>
<body>
  <div class="doc">
    <div class="banner">
      <div>
        <h1>${escapeHtml(opts.title)}</h1>
        ${subtitle}
      </div>
      <div class="banner-meta">
        <div class="brand">${escapeHtml(brand)}</div>
        <div>${escapeHtml(formatDateTime())}</div>
      </div>
    </div>
    <div class="stats">
      <span>סך הכל שורות: <strong>${rowCount}</strong></span>
      <span>עמודות: <strong>${opts.columns.length}</strong></span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
        <tfoot>
          <tr>
            <td colspan="${opts.columns.length}" style="text-align:right">
              סך הכל: ${rowCount} שורות
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="footer-note">
      דוח הופק אוטומטית · ${escapeHtml(brand)} · ${escapeHtml(formatDateTime())}
    </div>
  </div>
</body>
</html>`;
}

function downloadBlob(content: string, filename: string, mime: string) {
  // Prepend UTF-8 BOM so Excel reads Hebrew correctly
  const BOM = '﻿';
  const blob = new Blob([BOM + content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportToExcel<T>(opts: ExportOptions<T>) {
  const html = buildTableHtml(opts);
  downloadBlob(html, opts.filename + '.xls', 'application/vnd.ms-excel');
}

export function exportToWord<T>(opts: ExportOptions<T>) {
  const html = buildTableHtml(opts);
  downloadBlob(html, opts.filename + '.doc', 'application/msword');
}

export function exportToPDF<T>(opts: ExportOptions<T>) {
  const html = buildTableHtml(opts);
  const w = window.open('', '_blank');
  if (!w) {
    notifyPopupBlocked();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Wait for layout / fonts to settle before opening the print dialog
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      // user can still print manually
    }
  }, 400);
}

export function buildExportHandlers<T>(base: ExportOptions<T>) {
  return {
    onExcel: () => exportToExcel(base),
    onWord: () => exportToWord(base),
    onPdf: () => exportToPDF(base),
  };
}

// ----------------------------------------------------------------------------
// Schedule-grid builder (one table per class, days × hours)
// ----------------------------------------------------------------------------

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const HAK_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#ddd6fe', '#a7f3d0', '#fecaca'];

function buildScheduleHtml(opts: ScheduleExportOptions): string {
  const hoursPerDay = opts.hoursPerDay ?? 9;
  const hours = Array.from({ length: hoursPerDay }, (_, i) => i + 1);

  // Build classId -> hourId -> assignments[]
  const byClass = new Map<string, Map<number, ScheduleAssignment[]>>();
  for (const a of opts.assignments) {
    const cid = String(a.ClassId);
    const hid = Number(a.HourId);
    let m = byClass.get(cid);
    if (!m) { m = new Map(); byClass.set(cid, m); }
    const list = m.get(hid) ?? [];
    list.push(a);
    m.set(hid, list);
  }

  const classTables = opts.classes
    .slice()
    .sort((a, b) => a.ClassName.localeCompare(b.ClassName, 'he'))
    .map((cls) => {
      const classMap = byClass.get(String(cls.ClassId)) ?? new Map();
      let totalAssigned = 0;
      let totalSlots = 0;
      const rows = hours
        .map((hour) => {
          const dayCells = [1, 2, 3, 4, 5].map((day) => {
            const hid = day * 10 + hour;
            const cellAssigns = classMap.get(hid) ?? [];
            totalSlots++;
            if (cellAssigns.length === 0) {
              return `<td class="empty" style="text-align:center;color:#cbd5e1;">—</td>`;
            }
            totalAssigned++;
            const a = cellAssigns[0];
            const hak = Number(a.Hakbatza ?? 0);
            const teacher = escapeHtml(a.TeacherName ?? '');
            const prof = a.Professional ? `<div class="prof">${escapeHtml(a.Professional)}</div>` : '';
            let badges = '';
            if (hak > 0) {
              const c = HAK_COLORS[(hak - 1) % HAK_COLORS.length];
              badges += `<span class="badge-pill" style="background:${c}">ה${hak}</span>`;
            }
            return `<td class="cell">
              <div class="teacher">${teacher}</div>
              ${prof}
              ${badges ? `<div class="badges">${badges}</div>` : ''}
            </td>`;
          });
          return `<tr><th class="hour-hdr">${hour}</th>${dayCells.join('')}</tr>`;
        })
        .join('');

      const pct = totalSlots > 0 ? Math.round((totalAssigned / totalSlots) * 100) : 0;
      return `
        <div class="class-block">
          <div class="class-hdr">
            <h2>${escapeHtml(cls.ClassName)}</h2>
            <div class="class-stats">
              <span>שובצו <strong>${totalAssigned}</strong> / ${totalSlots} (${pct}%)</span>
            </div>
          </div>
          <table class="sched-tbl">
            <thead>
              <tr>
                <th class="hour-hdr">שעה</th>
                ${HEB_DAYS.slice(0, 5).map((d) => `<th>${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join('');

  const logoImg = opts.logoUrl ? `<img src="${escapeHtml(opts.logoUrl)}" alt="logo" class="logo" />` : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Arial", "David", sans-serif;
    direction: rtl;
    margin: 0;
    padding: 24px 28px;
    background: #f8fafc;
    color: #0f172a;
  }
  .doc {
    max-width: 1200px;
    margin: 0 auto;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 32px -10px rgba(15, 23, 42, 0.18);
    overflow: hidden;
  }
  .banner {
    background: linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #3b82f6 100%);
    color: #fff;
    padding: 28px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    position: relative;
  }
  .banner::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 50%);
    pointer-events: none;
  }
  .banner-left { display: flex; align-items: center; gap: 18px; position: relative; }
  .logo {
    width: 64px; height: 64px; border-radius: 12px;
    background: #fff; padding: 6px; object-fit: contain;
    box-shadow: 0 4px 12px -4px rgba(0,0,0,0.3);
  }
  .banner h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.3px; }
  .banner .school { font-size: 14px; opacity: 0.9; margin-top: 2px; font-weight: 500; letter-spacing: 0.5px; }
  .banner .sub { font-size: 13px; opacity: 0.85; margin-top: 4px; }
  .banner-right {
    text-align: left;
    font-size: 12px;
    opacity: 0.92;
    line-height: 1.7;
    background: rgba(255,255,255,0.1);
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.18);
    position: relative;
  }
  .banner-right .date { font-weight: 700; font-size: 13px; }

  .content { padding: 20px 24px 32px; }

  .class-block {
    margin-bottom: 28px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .class-hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px;
    background: linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%);
    border-radius: 8px 8px 0 0;
    border: 1px solid #bfdbfe; border-bottom: none;
  }
  .class-hdr h2 {
    margin: 0; font-size: 17px; color: #1e3a8a; font-weight: 700;
  }
  .class-stats { font-size: 12px; color: #1e40af; }

  .sched-tbl {
    border-collapse: collapse; width: 100%;
    font-size: 12px; background: #fff;
    border: 1px solid #cbd5e1;
  }
  .sched-tbl thead th {
    background: linear-gradient(180deg, #1e40af 0%, #1e3a8a 100%);
    color: #fff; padding: 9px 6px; font-weight: 700;
    border: 1px solid #1e3a8a; font-size: 12px; text-align: center;
    letter-spacing: 0.3px;
  }
  .sched-tbl .hour-hdr {
    background: linear-gradient(180deg, #334155 0%, #1e293b 100%) !important;
    color: #fff; width: 48px; text-align: center; font-weight: 700;
  }
  .sched-tbl td {
    border: 1px solid #e2e8f0; padding: 6px 4px;
    vertical-align: middle; text-align: center;
    height: 52px; width: calc((100% - 48px) / 5);
    position: relative;
  }
  .sched-tbl td.empty { background: #fafafa; }
  .sched-tbl tbody tr:nth-child(even) td:not(.empty) { background: #fbfcfe; }
  .sched-tbl .teacher { font-weight: 700; font-size: 12px; color: #0f172a; line-height: 1.2; }
  .sched-tbl .prof { font-size: 10.5px; color: #475569; margin-top: 2px; line-height: 1.2; }
  .sched-tbl .badges { display: flex; gap: 3px; justify-content: center; margin-top: 3px; }
  .sched-tbl .badge-pill {
    display: inline-block; padding: 1px 6px; border-radius: 3px;
    font-size: 9px; font-weight: 700; color: #1f2937;
  }

  .footer-note {
    padding: 14px 32px 22px;
    font-size: 11px; color: #94a3b8;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    background: #fafafa;
  }

  @media print {
    body { background: #fff; padding: 0; }
    .doc { box-shadow: none; border-radius: 0; max-width: 100%; }
    .banner, .class-hdr, .sched-tbl thead th, .sched-tbl .hour-hdr,
    .sched-tbl .badge-pill, .sched-tbl tbody tr:nth-child(even) td:not(.empty) {
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .class-block { page-break-inside: avoid; margin-bottom: 14px; }
    .class-hdr h2 { font-size: 14px; }
    .sched-tbl td { height: 42px; font-size: 11px; }
    .sched-tbl .teacher { font-size: 11px; }
    .sched-tbl .prof { font-size: 10px; }
  }
  @page { margin: 10mm 8mm; }
</style>
</head>
<body>
  <div class="doc">
    <div class="banner">
      <div class="banner-left">
        ${logoImg}
        <div>
          <h1>${escapeHtml(opts.title)}</h1>
          <div class="school">${escapeHtml(opts.schoolName)}</div>
          ${opts.subtitle ? `<div class="sub">${escapeHtml(opts.subtitle)}</div>` : ''}
        </div>
      </div>
      <div class="banner-right">
        <div class="date">${escapeHtml(formatDateTime())}</div>
        <div>${opts.classes.length} כיתות · ${opts.assignments.length} שיבוצים</div>
      </div>
    </div>
    <div class="content">
      ${classTables}
    </div>
    <div class="footer-note">
      ${escapeHtml(opts.schoolName)} · הופק במערכת סגנית · ${escapeHtml(formatDateTime())}
    </div>
  </div>
</body>
</html>`;
}

export function exportScheduleToExcel(opts: ScheduleExportOptions) {
  const html = buildScheduleHtml(opts);
  downloadBlob(html, opts.filename + '.xls', 'application/vnd.ms-excel');
}

export function exportScheduleToWord(opts: ScheduleExportOptions) {
  const html = buildScheduleHtml(opts);
  downloadBlob(html, opts.filename + '.doc', 'application/msword');
}

export function exportScheduleToPDF(opts: ScheduleExportOptions) {
  const html = buildScheduleHtml(opts);
  const w = window.open('', '_blank');
  if (!w) {
    notifyPopupBlocked();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch { /* user prints manually */ }
  }, 500);
}

export function buildScheduleHandlers(opts: ScheduleExportOptions) {
  return {
    onExcel: () => exportScheduleToExcel(opts),
    onWord: () => exportScheduleToWord(opts),
    onPdf: () => exportScheduleToPDF(opts),
  };
}
