/* eslint-disable */
// גיבוי כל הנתונים של ConfigurationId=1 לקובץ JSON יחיד (Windows Integrated Auth).
// הרצה: node scripts/backup-config1.cjs
const sql = require('msnodesqlv8');
const fs = require('fs');
const path = require('path');

const CONFIG_ID = 1;
const OUT_DIR = path.resolve(__dirname, '..', '..', 'backups');
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const OUT_FILE = path.join(OUT_DIR, `sganit_backup_config${CONFIG_ID}_${stamp}.json`);

const CONN = 'Driver={ODBC Driver 17 for SQL Server};Server=.\\SQLEXPRESS01;Database=Sganit;Trusted_Connection=yes;';

function q(sqlText) {
  return new Promise((resolve, reject) => {
    sql.query(CONN, sqlText, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

(async () => {
  console.log(`[backup] OUT: ${OUT_FILE}`);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // טבלת BackupMeta (לוודא חיבור)
  await q(`SELECT 1 AS ok`);
  console.log('[backup] connected');

  const tables = [
    { name: 'Teacher',          sql: `SELECT * FROM Teacher          WHERE ConfigurationId = ${CONFIG_ID}` },
    { name: 'Class',            sql: `SELECT * FROM Class            WHERE ConfigurationId = ${CONFIG_ID}` },
    { name: 'ClassTeacher',     sql: `SELECT * FROM ClassTeacher     WHERE ConfigurationId = ${CONFIG_ID}` },
    { name: 'TeacherHours',     sql: `SELECT * FROM TeacherHours     WHERE ConfigurationId = ${CONFIG_ID}` },
    { name: 'TeacherAssignment',sql: `SELECT * FROM TeacherAssignment WHERE ConfigurationId = ${CONFIG_ID}` },
    { name: 'Hakbatza',         sql: `SELECT * FROM Hakbatza         WHERE ConfigurationId = ${CONFIG_ID}` },
    { name: 'HakbatzaClass',    sql: `SELECT * FROM HakbatzaClass    WHERE HakbatzaId IN (SELECT HakbatzaId FROM Hakbatza WHERE ConfigurationId = ${CONFIG_ID})` },
    { name: 'HakbatzaTeacher',  sql: `SELECT * FROM HakbatzaTeacher  WHERE HakbatzaId IN (SELECT HakbatzaId FROM Hakbatza WHERE ConfigurationId = ${CONFIG_ID})` },
    { name: 'HourExtra',        sql: `SELECT * FROM HourExtra        WHERE ConfigurationId = ${CONFIG_ID}` },
    { name: 'ShehyaGroup',      sql: `SELECT * FROM ShehyaGroup      WHERE ConfigurationId = ${CONFIG_ID}` },
    { name: 'GroupInfo',        sql: `SELECT * FROM GroupInfo        WHERE ConfigurationId = ${CONFIG_ID}` },
  ];

  const out = {
    meta: {
      configurationId: CONFIG_ID,
      backupAt: new Date().toISOString(),
      database: 'Sganit',
      server: '.\\SQLEXPRESS01',
      schoolId: 1,
      yearId: 2026,
    },
    counts: {},
    data: {},
  };

  for (const t of tables) {
    process.stdout.write(`[backup] ${t.name}... `);
    const rows = await q(t.sql);
    out.data[t.name] = rows;
    out.counts[t.name] = rows.length;
    console.log(`${rows.length} rows`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');
  console.log(`[backup] saved: ${OUT_FILE}`);
  console.log('[backup] summary:', JSON.stringify(out.counts, null, 2));
})().catch((e) => { console.error('[backup] FATAL:', e.message || e); process.exit(1); });
