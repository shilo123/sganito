// בדיקת מבנה קובץ Excel — שמות גיליונות + תצוגת תאים
const path = require('path');
const XLSX = require(path.join('C:/Users/Administrator/sganit/ClientApp/node_modules/xlsx'));

const file = process.argv[2];
const wb = XLSX.readFile(file);
console.log('=== SHEETS ===');
wb.SheetNames.forEach((n, i) => console.log(`  [${i}] "${n}"`));

for (const name of wb.SheetNames) {
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', header: 1 });
  console.log(`\n===== SHEET "${name}"  (${grid.length} rows) =====`);
  const maxRows = Math.min(grid.length, 32);
  for (let r = 0; r < maxRows; r++) {
    const row = (grid[r] || []).map((v) => String(v ?? '').trim());
    // חתוך עמודות ריקות בסוף
    let last = row.length - 1;
    while (last >= 0 && row[last] === '') last--;
    const shown = row.slice(0, Math.max(last + 1, 0));
    console.log(`R${String(r + 1).padStart(3)}| ` + shown.map((c, i) => `${i}:${c}`).join(' | '));
  }
  if (grid.length > maxRows) console.log(`  ...(+${grid.length - maxRows} more rows)`);
}
