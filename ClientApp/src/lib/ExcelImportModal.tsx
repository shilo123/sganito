import { useCallback, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

export interface ExcelColumnSpec {
  key: string;          // שם השדה הפנימי
  header: string;       // הכותרת בעברית בקובץ Excel
  required: boolean;
  description: string;  // תיאור קצר למשתמש
  example: string;      // ערך לדוגמה
  hint?: string;        // הסבר נוסף קטן (לדוגמה רשימת ערכים מותרים)
}

export interface ParseRowResult<T> {
  ok: boolean;
  payload?: T;
  errors?: string[];
}

export interface ExcelImportModalProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  schema: ExcelColumnSpec[];
  sampleRows: Array<Record<string, string | number>>;
  // ממיר שורת Excel ל-payload לעיבוד. מחזיר errors עם הסבר אם פסול.
  parseRow: (raw: Record<string, unknown>, rowIdx: number) => ParseRowResult<T>;
  // מבצע את הייבוא בפועל. מקבל onProgress(current, total) כדי לעדכן UI.
  performImport: (rows: T[], onProgress: (cur: number, total: number) => void) => Promise<{ success: number; failed: number; errors: string[] }>;
  // ספירת רשומות קיימות (לאזהרה אם > 0).
  existingCount: number;
  // נקרא לאחר הצלחה (כדי לטעון מחדש את הדף).
  onCompleted: () => void;
}

interface ParsedState<T> {
  rows: T[];
  errors: Array<{ rowIdx: number; messages: string[] }>;
  totalRaw: number;
  fileName: string;
}

export function ExcelImportModal<T>({
  open, onClose, title, description, schema, sampleRows,
  parseRow, performImport, existingCount, onCompleted,
}: ExcelImportModalProps<T>) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<ParsedState<T> | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const reset = useCallback(() => {
    setParsed(null);
    setImporting(false);
    setProgress(null);
    setResult(null);
    setConfirmReplace(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const close = useCallback(() => {
    if (importing) return;
    reset();
    onClose();
  }, [importing, onClose, reset]);

  const downloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();
    // גיליון 1: התבנית עם כותרות + שורות לדוגמה
    const headers = schema.map((c) => c.header);
    const data = [headers, ...sampleRows.map((row) => schema.map((c) => row[c.key] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // רוחב עמודות
    ws['!cols'] = schema.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'נתונים');
    // גיליון 2: הסבר
    const helpRows: string[][] = [
      ['עמודה', 'חובה?', 'תיאור', 'דוגמה', 'הסבר נוסף'],
      ...schema.map((c) => [c.header, c.required ? 'כן' : 'לא', c.description, c.example, c.hint ?? '']),
    ];
    const wsHelp = XLSX.utils.aoa_to_sheet(helpRows);
    wsHelp['!cols'] = [{ wch: 16 }, { wch: 8 }, { wch: 32 }, { wch: 14 }, { wch: 38 }];
    XLSX.utils.book_append_sheet(wb, wsHelp, 'הסברים');
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_תבנית.xlsx`);
  }, [schema, sampleRows, title]);

  const handleFile = useCallback(async (file: File) => {
    setResult(null);
    setProgress(null);
    setConfirmReplace(false);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const rows: T[] = [];
      const errors: Array<{ rowIdx: number; messages: string[] }> = [];
      for (let i = 0; i < raw.length; i++) {
        const r = parseRow(raw[i], i + 2); // +2: שורה 1 בקובץ = כותרות
        if (r.ok && r.payload) rows.push(r.payload);
        else if (r.errors && r.errors.length) errors.push({ rowIdx: i + 2, messages: r.errors });
      }
      setParsed({ rows, errors, totalRaw: raw.length, fileName: file.name });
    } catch (e) {
      setParsed({
        rows: [],
        errors: [{ rowIdx: 0, messages: [String((e as Error).message || 'לא ניתן לקרוא את הקובץ')] }],
        totalRaw: 0,
        fileName: file.name,
      });
    }
  }, [parseRow]);

  const onFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const startImport = useCallback(async () => {
    if (!parsed || parsed.rows.length === 0) return;
    if (existingCount > 0 && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setImporting(true);
    setProgress({ cur: 0, total: parsed.rows.length });
    try {
      const res = await performImport(parsed.rows, (cur, total) => setProgress({ cur, total }));
      setResult(res);
      if (res.failed === 0) {
        // הצלחה מלאה — סגור אחרי 1.4 שניות + עדכן את הדף הקורא
        setTimeout(() => {
          onCompleted();
          close();
        }, 1400);
      }
    } catch (e) {
      setResult({ success: 0, failed: parsed.rows.length, errors: [String((e as Error).message)] });
    } finally {
      setImporting(false);
    }
  }, [parsed, existingCount, confirmReplace, performImport, onCompleted, close]);

  const previewRows = useMemo(() => parsed?.rows.slice(0, 5) ?? [], [parsed]);

  if (!open) return null;

  return (
    <div className="excel-import" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="excel-import__card">
        <header className="excel-import__head">
          <div className="excel-import__head-icon" aria-hidden="true">
            <i className="fa fa-file-excel-o" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="excel-import__title">{title}</div>
            <div className="excel-import__sub">{description}</div>
          </div>
          <button className="excel-import__close" onClick={close} aria-label="סגור" disabled={importing}>×</button>
        </header>

        {!parsed ? (
          <div className="excel-import__body">
            {/* טבלת מבנה הקובץ */}
            <section className="excel-import__section">
              <div className="excel-import__section-title">
                <span className="excel-import__step-num">1</span>
                <span>מבנה קובץ ה-Excel הנדרש</span>
              </div>
              <div className="excel-import__schema">
                <table className="excel-import__schema-table">
                  <thead>
                    <tr>
                      <th>עמודה</th>
                      <th>חובה?</th>
                      <th>תיאור</th>
                      <th>דוגמה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.map((c) => (
                      <tr key={c.key}>
                        <td><strong>{c.header}</strong></td>
                        <td>{c.required ? <span className="excel-import__required">חובה</span> : <span className="excel-import__optional">אופציונלי</span>}</td>
                        <td>
                          {c.description}
                          {c.hint && <div className="excel-import__hint">{c.hint}</div>}
                        </td>
                        <td><code>{c.example}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* כפתור הורדת תבנית */}
            <section className="excel-import__section">
              <div className="excel-import__section-title">
                <span className="excel-import__step-num">2</span>
                <span>הורד תבנית ריקה למילוי</span>
              </div>
              <button type="button" className="excel-import__template-btn" onClick={downloadTemplate}>
                <i className="fa fa-download" />
                הורד תבנית Excel ריקה (עם דוגמאות והסברים)
              </button>
            </section>

            {/* אזור העלאה */}
            <section className="excel-import__section">
              <div className="excel-import__section-title">
                <span className="excel-import__step-num">3</span>
                <span>העלה את הקובץ</span>
              </div>
              {existingCount > 0 && (
                <div className="excel-import__warning">
                  <i className="fa fa-exclamation-triangle" />
                  <div>
                    <strong>שים לב:</strong> במערכת קיימים כבר <strong>{existingCount.toLocaleString('he-IL')}</strong> רשומות.
                    העלאת קובץ חדש <strong>תחליף</strong> את הנתונים הקיימים. תתבקש לאשר לפני המחיקה.
                  </div>
                </div>
              )}
              <div
                className={`excel-import__drop${dragOver ? ' is-drag' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="excel-import__drop-icon"><i className="fa fa-cloud-upload" /></div>
                <div className="excel-import__drop-text">
                  <strong>גרור לכאן את קובץ ה-Excel</strong>
                  <span>או לחץ לבחירה ידנית</span>
                </div>
                <span className="excel-import__drop-formats">.xlsx · .xls · .csv</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={onFilePick}
                />
              </div>
            </section>
          </div>
        ) : (
          <div className="excel-import__body">
            <section className="excel-import__section">
              <div className="excel-import__section-title">
                <i className="fa fa-eye" style={{ color: '#1565c0' }} />
                <span>תצוגה מקדימה — {parsed.fileName}</span>
              </div>
              <div className="excel-import__preview-stats">
                <div className="excel-import__stat excel-import__stat--ok">
                  <div className="excel-import__stat-num">{parsed.rows.length.toLocaleString('he-IL')}</div>
                  <div className="excel-import__stat-lbl">שורות תקינות</div>
                </div>
                {parsed.errors.length > 0 && (
                  <div className="excel-import__stat excel-import__stat--err">
                    <div className="excel-import__stat-num">{parsed.errors.length.toLocaleString('he-IL')}</div>
                    <div className="excel-import__stat-lbl">שורות עם שגיאות</div>
                  </div>
                )}
                <div className="excel-import__stat">
                  <div className="excel-import__stat-num">{parsed.totalRaw.toLocaleString('he-IL')}</div>
                  <div className="excel-import__stat-lbl">סה״כ שורות בקובץ</div>
                </div>
              </div>
              {parsed.errors.length > 0 && (
                <div className="excel-import__errors">
                  <strong>שורות עם שגיאות (לא ייובאו):</strong>
                  <ul>
                    {parsed.errors.slice(0, 10).map((er) => (
                      <li key={er.rowIdx}>שורה {er.rowIdx}: {er.messages.join(', ')}</li>
                    ))}
                    {parsed.errors.length > 10 && <li>...ועוד {parsed.errors.length - 10} שורות</li>}
                  </ul>
                </div>
              )}
              {parsed.rows.length > 0 && (
                <div className="excel-import__preview-table-wrap">
                  <table className="excel-import__preview-table">
                    <thead>
                      <tr>
                        {schema.map((c) => <th key={c.key}>{c.header}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i}>
                          {schema.map((c) => (
                            <td key={c.key}>{String((r as unknown as Record<string, unknown>)[c.key] ?? '—')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rows.length > 5 && (
                    <div className="excel-import__more">+{parsed.rows.length - 5} שורות נוספות</div>
                  )}
                </div>
              )}
            </section>

            {/* פרוגרס + תוצאה */}
            {progress && (
              <section className="excel-import__section">
                <div className="excel-import__progress">
                  <div className="excel-import__progress-bar">
                    <div className="excel-import__progress-fill" style={{ width: `${(progress.cur / Math.max(1, progress.total)) * 100}%` }} />
                  </div>
                  <div className="excel-import__progress-text">
                    {result ? 'הסתיים' : 'מייבא...'} {progress.cur.toLocaleString('he-IL')} / {progress.total.toLocaleString('he-IL')}
                  </div>
                </div>
              </section>
            )}
            {result && (
              <section className="excel-import__section">
                <div className={`excel-import__result excel-import__result--${result.failed === 0 ? 'ok' : 'partial'}`}>
                  {result.failed === 0 ? (
                    <><i className="fa fa-check-circle" /> כל {result.success.toLocaleString('he-IL')} השורות יובאו בהצלחה!</>
                  ) : (
                    <><i className="fa fa-exclamation-circle" /> יובאו {result.success} מתוך {result.success + result.failed}. {result.failed} נכשלו.</>
                  )}
                  {result.errors.length > 0 && (
                    <ul>{result.errors.slice(0, 5).map((er, i) => <li key={i}>{er}</li>)}</ul>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="excel-import__foot">
          {!parsed ? (
            <>
              <button className="excel-import__btn excel-import__btn--ghost" onClick={close}>ביטול</button>
            </>
          ) : confirmReplace && !importing && !result ? (
            <>
              <div className="excel-import__confirm-text">
                <i className="fa fa-warning" /> אישור: למחוק את <strong>{existingCount.toLocaleString('he-IL')}</strong> הרשומות הקיימות ולטעון <strong>{parsed.rows.length.toLocaleString('he-IL')}</strong> חדשות?
              </div>
              <button className="excel-import__btn excel-import__btn--ghost" onClick={() => setConfirmReplace(false)}>חזור</button>
              <button className="excel-import__btn excel-import__btn--danger" onClick={startImport}>
                <i className="fa fa-trash" /> מחק והעלה
              </button>
            </>
          ) : !result ? (
            <>
              <button className="excel-import__btn excel-import__btn--ghost" onClick={() => reset()} disabled={importing}>טען קובץ אחר</button>
              <button
                className="excel-import__btn excel-import__btn--primary"
                onClick={startImport}
                disabled={importing || parsed.rows.length === 0}
              >
                {importing ? (
                  <><i className="fa fa-spinner fa-spin" /> מייבא...</>
                ) : (
                  <><i className="fa fa-upload" /> אישור והעלאה ({parsed.rows.length.toLocaleString('he-IL')} שורות)</>
                )}
              </button>
            </>
          ) : (
            <button className="excel-import__btn excel-import__btn--primary" onClick={close}>סגור</button>
          )}
        </footer>
      </div>
    </div>
  );
}

export default ExcelImportModal;
