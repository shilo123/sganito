import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export interface ParsedRowsResult<T> {
  rows: T[];
  errors: Array<{ rowIdx: number; messages: string[]; sheet?: string }>;
  totalRaw: number;
  // פעולות שהמשתמש צריך לבצע לפני שהייבוא יוכל להצליח (ערכי קוד שלא נמצאו במערכת).
  actionable?: {
    missingTeachers?: string[];
    missingClasses?: string[];
    // מיפוי שם כיתה חסרה → LayerId, כדי ליצור כל כיתה בשכבה הנכונה שלה
    missingClassLayers?: Record<string, number>;
    notes?: string[]; // הסברים חופשיים נוספים
  };
}

// תצוגת דוגמה חזותית לקובץ — בסגנון Excel (עמודות A,B,C... ושורות 1,2,3...)
export interface ExcelPreviewSheet {
  sheetName: string;
  cells: Array<Array<string | number>>;
  // אינדקסים של שורות (מבוסס 0) שצריך להציג כשורת כותרת רגילה (תכלת)
  headerRows?: number[];
  // שורות כותרת-בלוק (צהוב — שם הכיתה וכו')
  titleRows?: number[];
  // עמודות צרות (לרוב מפרידים — צבע אפור)
  narrowCols?: number[];
}

// תבנית ייבוא יחידה. ניתן להעביר רשימה של תבניות ל-modal, והמשתמש יבחר.
// auto-detect לפי `detect(wb)` שמחזיר ציון 0..1 — הגבוה ביותר נבחר אוטומטית.
export interface ExcelImportTemplate<T> {
  id: string;
  name: string;                 // שם להצגה בטאבים
  description: string;          // הסבר קצר על הפורמט
  schema: ExcelColumnSpec[];    // לצורך הצגת מבנה התבנית והורדה
  sampleRows: Array<Record<string, string | number>>;
  // תצוגת קובץ Excel חזותית להמחשה במודאל (אופציונלי). מערך = כמה גיליונות עם טאבים.
  previewSheet?: ExcelPreviewSheet | ExcelPreviewSheet[];
  // ציון התאמה לחוברת עבודה — 0=לא מתאים, 1=מתאים מעולה
  detect?: (wb: XLSX.WorkBook) => number;
  // פרסר מלא של חוברת העבודה. אם לא מסופק, ינסה parseRow על הגיליון הראשון.
  parseFile?: (wb: XLSX.WorkBook) => ParsedRowsResult<T>;
  // לחילופין: פרסר שורה (לתבניות שטוחות גיליון יחיד)
  parseRow?: (raw: Record<string, unknown>, rowIdx: number) => ParseRowResult<T>;
  // אופציונלי: builder מותאם לחוברת הורדה. אם לא מסופק - תיבנה מ-schema/sampleRows.
  buildTemplateWorkbook?: () => XLSX.WorkBook;
  // אופציונלי: הוספה אוטומטית של מורים חסרים שזוהו בקובץ. אם מסופק - יופיע כפתור בכרטיס "פעולות נדרשות".
  addMissingTeachers?: (names: string[]) => Promise<{ added: number; failed: number; errors: string[] }>;
  // אופציונלי: הוספה אוטומטית של כיתות חסרות. classLayers ממפה כל כיתה ל-LayerId
  // שלה (לפי הגיליון שממנו נקראה) — כך שכל כיתה נוצרת בשכבה הנכונה.
  addMissingClasses?: (names: string[], classLayers?: Record<string, number>) => Promise<{ added: number; failed: number; errors: string[] }>;
  // נקרא אחרי הוספה אוטומטית — להזרמת רענון נתונים לפני שיפוץ הקובץ.
  onAfterAutoAdd?: () => Promise<void> | void;
}

// המרת אינדקס עמודה (0..) לאות אקסל ("A","B",..,"Z","AA"..)
function colLetter(n: number): string {
  let s = '';
  let x = n;
  while (x >= 0) {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
}

export interface ExcelImportModalProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;

  // --- ממשק חדש (מומלץ): מערך תבניות ---
  templates?: ExcelImportTemplate<T>[];

  // --- ממשק ישן (תאימות לאחור): תבנית יחידה ---
  schema?: ExcelColumnSpec[];
  sampleRows?: Array<Record<string, string | number>>;
  parseRow?: (raw: Record<string, unknown>, rowIdx: number) => ParseRowResult<T>;

  // משותף:
  performImport: (rows: T[], onProgress: (cur: number, total: number) => void) => Promise<{ success: number; failed: number; errors: string[] }>;
  existingCount: number;
  onCompleted: () => void;
}

interface ParsedState<T> {
  rows: T[];
  errors: Array<{ rowIdx: number; messages: string[]; sheet?: string }>;
  totalRaw: number;
  fileName: string;
  actionable?: ParsedRowsResult<T>['actionable'];
}

// פרסר ברירת מחדל לתבניות שטוחות — קורא את הגיליון הראשון כטבלה רגילה.
function defaultParseFile<T>(
  wb: XLSX.WorkBook,
  parseRow: (raw: Record<string, unknown>, rowIdx: number) => ParseRowResult<T>,
): ParsedRowsResult<T> {
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const rows: T[] = [];
  const errors: Array<{ rowIdx: number; messages: string[]; sheet?: string }> = [];
  for (let i = 0; i < raw.length; i++) {
    const r = parseRow(raw[i], i + 2);
    if (r.ok && r.payload) rows.push(r.payload);
    else if (r.errors && r.errors.length) errors.push({ rowIdx: i + 2, messages: r.errors, sheet: sheetName });
  }
  return { rows, errors, totalRaw: raw.length };
}

// בונה חוברת הורדה ברירת-מחדל מ-schema/sampleRows
function defaultBuildTemplate(title: string, schema: ExcelColumnSpec[], sampleRows: Array<Record<string, string | number>>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  // גיליון 1: התבנית עם כותרות + שורות לדוגמה
  const headers = schema.map((c) => c.header);
  const data = [headers, ...sampleRows.map((row) => schema.map((c) => row[c.key] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);
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
  return wb;
  void title; // לא בשימוש כרגע אבל שמרנו לטובת התאמות עתידיות
}

export function ExcelImportModal<T>({
  open, onClose, title, description,
  templates, schema, sampleRows, parseRow,
  performImport, existingCount, onCompleted,
}: ExcelImportModalProps<T>) {
  // איחוד התבניות: אם מסופק templates - נשתמש בו; אחרת נעטוף את ה-API הישן.
  const effectiveTemplates = useMemo<ExcelImportTemplate<T>[]>(() => {
    if (templates && templates.length > 0) return templates;
    if (schema && parseRow) {
      return [{
        id: 'default',
        name: 'תבנית סטנדרטית',
        description: 'טבלה אחת — שורת כותרת בשורה הראשונה ושורות נתונים בהמשך.',
        schema,
        sampleRows: sampleRows ?? [],
        parseRow,
      }];
    }
    return [];
  }, [templates, schema, sampleRows, parseRow]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => effectiveTemplates[0]?.id ?? '');
  const [parsed, setParsed] = useState<ParsedState<T> | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [autoDetected, setAutoDetected] = useState<string | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const [autoAdding, setAutoAdding] = useState<'teachers' | 'classes' | null>(null);
  const [autoAddResult, setAutoAddResult] = useState<string | null>(null);

  // ודא ש-selectedTemplateId חוקי כשהתבניות משתנות
  useEffect(() => {
    if (effectiveTemplates.length === 0) return;
    if (!effectiveTemplates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(effectiveTemplates[0].id);
    }
  }, [effectiveTemplates, selectedTemplateId]);

  const selectedTemplate = useMemo(
    () => effectiveTemplates.find((t) => t.id === selectedTemplateId) ?? effectiveTemplates[0],
    [effectiveTemplates, selectedTemplateId],
  );

  const reset = useCallback(() => {
    setParsed(null);
    setImporting(false);
    setProgress(null);
    setResult(null);
    setConfirmReplace(false);
    setAutoDetected(null);
    setAutoAdding(null);
    setAutoAddResult(null);
    lastFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const close = useCallback(() => {
    if (importing) return;
    reset();
    onClose();
  }, [importing, onClose, reset]);

  const downloadTemplate = useCallback(() => {
    if (!selectedTemplate) return;
    const wb = selectedTemplate.buildTemplateWorkbook
      ? selectedTemplate.buildTemplateWorkbook()
      : defaultBuildTemplate(title, selectedTemplate.schema, selectedTemplate.sampleRows);
    const safeName = `${title.replace(/\s+/g, '_')}_${selectedTemplate.name.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, safeName);
  }, [selectedTemplate, title]);

  const handleFile = useCallback(async (file: File) => {
    setResult(null);
    setProgress(null);
    setConfirmReplace(false);
    setAutoDetected(null);
    setAutoAddResult(null);
    lastFileRef.current = file;

    // אבטחה: ולידציה של הקובץ לפני פירוק כדי לא לעבד קבצים זדוניים/ענקיים.
    // (1) הגבלת גודל ל-10MB — מונע zip-bomb וקריסת הדפדפן על קובץ עצום.
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setParsed({
        rows: [], errors: [{ rowIdx: 0, messages: [`הקובץ גדול מדי (${(file.size / 1048576).toFixed(1)}MB). המקסימום הוא 10MB.`] }],
        totalRaw: 0, fileName: file.name,
      });
      return;
    }
    // (2) רק סיומות גיליון מותרות — חוסם העלאת קבצים אחרים (exe/html/וכו').
    const lower = file.name.toLowerCase();
    const allowed = ['.xlsx', '.xls', '.csv'];
    if (!allowed.some((ext) => lower.endsWith(ext))) {
      setParsed({
        rows: [], errors: [{ rowIdx: 0, messages: ['סוג קובץ לא נתמך. יש להעלות קובץ Excel או CSV בלבד (.xlsx, .xls, .csv).'] }],
        totalRaw: 0, fileName: file.name,
      });
      return;
    }

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // auto-detect: מצא את התבנית עם ציון detect הגבוה ביותר
      let bestId = selectedTemplateId;
      let bestScore = -1;
      for (const t of effectiveTemplates) {
        if (!t.detect) continue;
        try {
          const score = t.detect(wb);
          if (score > bestScore) { bestScore = score; bestId = t.id; }
        } catch { /* התעלם משגיאת detect של תבנית בודדת */ }
      }
      if (bestScore >= 0.5 && bestId !== selectedTemplateId) {
        setSelectedTemplateId(bestId);
        setAutoDetected(bestId);
      } else if (bestScore >= 0.5) {
        setAutoDetected(bestId);
      }
      const template = effectiveTemplates.find((t) => t.id === bestId) ?? selectedTemplate;
      if (!template) throw new Error('לא נבחרה תבנית');

      // הרץ את הפרסר המתאים
      const out: ParsedRowsResult<T> = template.parseFile
        ? template.parseFile(wb)
        : (template.parseRow
            ? defaultParseFile(wb, template.parseRow)
            : { rows: [], errors: [{ rowIdx: 0, messages: ['התבנית לא מגדירה פרסר'] }], totalRaw: 0 });

      setParsed({
        rows: out.rows,
        errors: out.errors,
        totalRaw: out.totalRaw,
        fileName: file.name,
        actionable: out.actionable,
      });
    } catch (e) {
      setParsed({
        rows: [],
        errors: [{ rowIdx: 0, messages: [String((e as Error).message || 'לא ניתן לקרוא את הקובץ')] }],
        totalRaw: 0,
        fileName: file.name,
      });
    }
  }, [effectiveTemplates, selectedTemplateId, selectedTemplate]);

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

  // הוספה אוטומטית של מורים/כיתות חסרים, ואז ניתוח מחדש של הקובץ
  const runAutoAdd = useCallback(async (kind: 'teachers' | 'classes') => {
    if (!selectedTemplate || !parsed || !lastFileRef.current) return;
    const names = kind === 'teachers'
      ? (parsed.actionable?.missingTeachers ?? [])
      : (parsed.actionable?.missingClasses ?? []);
    if (names.length === 0) return;
    const fn = kind === 'teachers' ? selectedTemplate.addMissingTeachers : selectedTemplate.addMissingClasses;
    if (!fn) return;

    setAutoAdding(kind);
    setAutoAddResult(null);
    try {
      const res = kind === 'classes'
        ? await selectedTemplate.addMissingClasses!(names, parsed.actionable?.missingClassLayers)
        : await selectedTemplate.addMissingTeachers!(names);
      if (selectedTemplate.onAfterAutoAdd) await selectedTemplate.onAfterAutoAdd();
      // הרץ שוב את הפרסר על הקובץ עם הנתונים המעודכנים
      const f = lastFileRef.current;
      if (f) {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const out: ParsedRowsResult<T> = selectedTemplate.parseFile
          ? selectedTemplate.parseFile(wb)
          : (selectedTemplate.parseRow
              ? defaultParseFile(wb, selectedTemplate.parseRow)
              : { rows: [], errors: [], totalRaw: 0 });
        setParsed({ rows: out.rows, errors: out.errors, totalRaw: out.totalRaw, fileName: f.name, actionable: out.actionable });
      }
      const summary = res.failed === 0
        ? `נוספו ${res.added} ${kind === 'teachers' ? 'מורים' : 'כיתות'} בהצלחה.`
        : `נוספו ${res.added}, נכשלו ${res.failed}. ${res.errors.slice(0, 2).join('; ')}`;
      setAutoAddResult(summary);
    } catch (e) {
      setAutoAddResult(`שגיאה: ${(e as Error).message}`);
    } finally {
      setAutoAdding(null);
    }
  }, [parsed, selectedTemplate]);

  if (!open) return null;
  if (!selectedTemplate) return null; // אין תבניות

  const schemaForPreview = selectedTemplate.schema;
  // אין יותר בחירת תבנית ידנית — הזיהוי תמיד אוטומטי לפי תוכן הקובץ.
  const showTemplatePicker = false;
  const multiTemplate = effectiveTemplates.length > 1;

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
            {/* זיהוי אוטומטי — אין בחירת תבנית ידנית */}
            {multiTemplate && (
              <div className="excel-import__autodetect-note">
                <i className="fa fa-magic" />
                <div>
                  <strong>הפורמט מזוהה אוטומטית.</strong> אין צורך לבחור — כשתעלה את הקובץ
                  המערכת מזהה את מבנהו וקוראת אותו לפי הפורמט המתאים.
                </div>
              </div>
            )}

            {/* טבלת מבנה הקובץ */}
            <section className="excel-import__section">
              <div className="excel-import__section-title">
                <span className="excel-import__step-num">{showTemplatePicker ? 2 : 1}</span>
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
                    {schemaForPreview.map((c) => (
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

            {/* תצוגת דוגמה חזותית */}
            {selectedTemplate.previewSheet && (
              <section className="excel-import__section">
                <div className="excel-import__section-title">
                  <i className="fa fa-eye" style={{ color: '#1565c0' }} />
                  <span>כך נראה הקובץ ב-Excel (דוגמה)</span>
                </div>
                <ExcelPreviewSheetView preview={selectedTemplate.previewSheet} />
              </section>
            )}

            {/* כפתור הורדת תבנית */}
            <section className="excel-import__section">
              <div className="excel-import__section-title">
                <span className="excel-import__step-num">{showTemplatePicker ? 3 : 2}</span>
                <span>הורד תבנית ריקה למילוי</span>
              </div>
              <button type="button" className="excel-import__template-btn" onClick={downloadTemplate}>
                <i className="fa fa-download" />
                הורד תבנית Excel ריקה ({selectedTemplate.name})
              </button>
            </section>

            {/* אזור העלאה */}
            <section className="excel-import__section">
              <div className="excel-import__section-title">
                <span className="excel-import__step-num">{showTemplatePicker ? 4 : 3}</span>
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
            {autoDetected && (
              <div className="excel-import__autodetect">
                <i className="fa fa-magic" /> זוהתה אוטומטית התבנית: <strong>{effectiveTemplates.find((t) => t.id === autoDetected)?.name}</strong>
              </div>
            )}
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
              {(parsed.actionable && ((parsed.actionable.missingTeachers?.length ?? 0) > 0 || (parsed.actionable.missingClasses?.length ?? 0) > 0 || (parsed.actionable.notes?.length ?? 0) > 0)) && (
                <div className="excel-import__actions">
                  <div className="excel-import__actions-title">
                    <i className="fa fa-exclamation-circle" />
                    <span>פעולות שעליך להשלים לפני הייבוא</span>
                  </div>
                  <div className="excel-import__actions-sub">
                    הקובץ כולל ערכים שאינם רשומים במערכת. הוסף אותם תחילה ואז העלה שוב את הקובץ.
                  </div>

                  {parsed.actionable.missingTeachers && parsed.actionable.missingTeachers.length > 0 && (
                    <div className="excel-import__actions-group">
                      <div className="excel-import__actions-group-title">
                        <i className="fa fa-user-plus" />
                        <span>
                          <strong>{parsed.actionable.missingTeachers.length.toLocaleString('he-IL')}</strong> מורים מהקובץ אינם רשומים במערכת
                        </span>
                        {selectedTemplate.addMissingTeachers ? (
                          <button
                            type="button"
                            className="excel-import__auto-add-btn"
                            disabled={autoAdding !== null}
                            onClick={() => runAutoAdd('teachers')}
                          >
                            {autoAdding === 'teachers' ? (
                              <><i className="fa fa-spinner fa-spin" /> מוסיף...</>
                            ) : (
                              <><i className="fa fa-magic" /> הוסף אוטומטית את כולם</>
                            )}
                          </button>
                        ) : (
                          <span className="excel-import__actions-where">הוסף ב<em>"ניהול מורים"</em> בתפריט הצדדי</span>
                        )}
                      </div>
                      <div className="excel-import__actions-chips">
                        {parsed.actionable.missingTeachers.map((name) => (
                          <span key={name} className="excel-import__chip excel-import__chip--teacher" title={name}>{name}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsed.actionable.missingClasses && parsed.actionable.missingClasses.length > 0 && (
                    <div className="excel-import__actions-group">
                      <div className="excel-import__actions-group-title">
                        <i className="fa fa-cubes" />
                        <span>
                          <strong>{parsed.actionable.missingClasses.length.toLocaleString('he-IL')}</strong> כיתות מהקובץ אינן רשומות במערכת
                        </span>
                        {selectedTemplate.addMissingClasses ? (
                          <button
                            type="button"
                            className="excel-import__auto-add-btn"
                            disabled={autoAdding !== null}
                            onClick={() => runAutoAdd('classes')}
                          >
                            {autoAdding === 'classes' ? (
                              <><i className="fa fa-spinner fa-spin" /> מוסיף...</>
                            ) : (
                              <><i className="fa fa-magic" /> הוסף אוטומטית את כולן</>
                            )}
                          </button>
                        ) : (
                          <span className="excel-import__actions-where">הוסף בכפתור <em>"הוסף כיתה לשכבה המסומנת"</em> בראש הדף</span>
                        )}
                      </div>
                      <div className="excel-import__actions-chips">
                        {parsed.actionable.missingClasses.map((name) => (
                          <span key={name} className="excel-import__chip excel-import__chip--class" title={name}>{name}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {autoAddResult && (
                    <div className="excel-import__auto-add-result">
                      <i className="fa fa-info-circle" /> {autoAddResult}
                    </div>
                  )}

                  {parsed.actionable.notes && parsed.actionable.notes.length > 0 && (
                    <ul className="excel-import__actions-notes">
                      {parsed.actionable.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {parsed.errors.length > 0 && (
                <ExcelErrorReport errors={parsed.errors} />
              )}
              {parsed.rows.length > 0 && (
                <div className="excel-import__preview-table-wrap">
                  <table className="excel-import__preview-table">
                    <thead>
                      <tr>
                        {schemaForPreview.map((c) => <th key={c.key}>{c.header}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i}>
                          {schemaForPreview.map((c) => (
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

// ============================================================
// תצוגת דוגמת קובץ Excel (mini-spreadsheet) — תומך גם בכמה גיליונות עם טאבים
// ============================================================
function ExcelPreviewSheetView({ preview }: { preview: ExcelPreviewSheet | ExcelPreviewSheet[] }) {
  const sheets = useMemo(() => (Array.isArray(preview) ? preview : [preview]), [preview]);
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, sheets.length - 1);
  const sheet = sheets[safeIdx];
  if (!sheet) return null;

  const cells = sheet.cells;
  const maxCols = cells.reduce((m, r) => Math.max(m, r.length), 0);
  const headerSet = new Set(sheet.headerRows ?? []);
  const titleSet = new Set(sheet.titleRows ?? []);
  const narrowSet = new Set(sheet.narrowCols ?? []);

  return (
    <div className="excel-preview-sheet">
      <div className="excel-preview-sheet__tabs" role="tablist">
        {sheets.map((s, i) => (
          <button
            type="button"
            key={`${s.sheetName}-${i}`}
            className={`excel-preview-sheet__tab${i === safeIdx ? ' is-active' : ''}`}
            onClick={() => setActiveIdx(i)}
            role="tab"
            aria-selected={i === safeIdx}
          >
            {s.sheetName}
          </button>
        ))}
      </div>
      <div className="excel-preview-sheet__scroll">
        <table className="excel-preview-sheet__table">
          <thead>
            <tr>
              <th className="excel-preview-sheet__corner"> </th>
              {Array.from({ length: maxCols }).map((_, c) => (
                <th key={c} className={narrowSet.has(c) ? 'is-narrow' : ''}>{colLetter(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((row, rIdx) => {
              const isHeader = headerSet.has(rIdx);
              const isTitle = titleSet.has(rIdx);
              return (
                <tr key={rIdx} className={isTitle ? 'is-title' : isHeader ? 'is-header' : ''}>
                  <th className="excel-preview-sheet__row-num">{rIdx + 1}</th>
                  {Array.from({ length: maxCols }).map((_, c) => {
                    const v = row[c];
                    const display = v == null ? '' : String(v);
                    return (
                      <td key={c} className={narrowSet.has(c) ? 'is-narrow' : ''}>{display}</td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// דוח שגיאות מקובץ ומוסבר — מסווג כל שגיאה לקטגוריה עם הסבר ופתרון
// ============================================================
interface ExcelErrorRow { sheet?: string; rowIdx: number; messages: string[]; }
interface FlatExcelError { sheet?: string; rowIdx: number; message: string; }

interface ErrorCategory {
  key: string;
  icon: string;                       // מחלקת font-awesome
  title: string;                      // כותרת קצרה
  explain: string;                    // מה השגיאה אומרת
  fix: string;                        // איך מתקנים
  severity: 'fixable' | 'blocking';   // fixable = ייפתר אוטומטית אחרי הוספת חסרים
}

// סיווג הודעת שגיאה בודדת לקטגוריה מובנת
function classifyExcelError(msg: string): ErrorCategory {
  if (/מורה ".+?" לא נמצא/.test(msg)) {
    return {
      key: 'teacher-missing', icon: 'fa-user-times', severity: 'fixable',
      title: 'מורה שאינו רשום עדיין במערכת',
      explain: 'בקובץ מופיע שם מורה שלא קיים ברשימת המורים של המערכת, ולכן לא ניתן לשייך אליו שעות.',
      fix: 'השתמש בכפתור "הוסף אוטומטית את כולם" בסעיף "פעולות שעליך להשלים" שלמעלה — לאחר ההוספה הקובץ ינותח מחדש והשורות האלה ייטענו.',
    };
  }
  if (/כיתה ".+?" לא נמצאה/.test(msg)) {
    return {
      key: 'class-missing', icon: 'fa-cube', severity: 'fixable',
      title: 'כיתה שאינה רשומה עדיין במערכת',
      explain: 'בקובץ מופיע שם כיתה שלא קיים במערכת עבור השכבה הנוכחית.',
      fix: 'הוסף את הכיתות החסרות בסעיף "פעולות שעליך להשלים" שלמעלה, או צור אותן ידנית בדף, ואז העלה את הקובץ שוב.',
    };
  }
  if (/שעות לא חוקיות|שעות חייב להיות מספר/.test(msg)) {
    return {
      key: 'invalid-hours', icon: 'fa-clock-o', severity: 'blocking',
      title: 'מספר שעות לא תקין',
      explain: 'בתא השעות נמצא ערך שאינו מספר חיובי — לדוגמה טקסט, אפס, או תא ריק.',
      fix: 'פתח את הקובץ, תקן את התא כך שיכיל מספר שלם וחיובי (לדוגמה 5), ואז העלה שוב.',
    };
  }
  if (/חסר שם כיתה/.test(msg)) {
    return {
      key: 'no-class-name', icon: 'fa-cube', severity: 'blocking',
      title: 'שורה ללא שם כיתה',
      explain: 'בשורה יש נתוני מורה/שעות אך עמודת הכיתה ריקה.',
      fix: 'מלא את שם הכיתה בעמודה המתאימה, או מחק את השורה אם היא מיותרת.',
    };
  }
  if (/חסר שם מורה/.test(msg)) {
    return {
      key: 'no-teacher-name', icon: 'fa-user', severity: 'blocking',
      title: 'שורה ללא שם מורה',
      explain: 'בשורה יש נתוני כיתה/שעות אך עמודת המורה ריקה.',
      fix: 'מלא את שם המורה בעמודה המתאימה, או מחק את השורה אם היא מיותרת.',
    };
  }
  if (/לא נמצא שם כיתה בכותרת/.test(msg)) {
    return {
      key: 'block-no-title', icon: 'fa-table', severity: 'blocking',
      title: 'בלוק ללא שם כיתה בכותרת',
      explain: 'זוהה בלוק של מקצוע/שעות/מורה בגיליון, אך בשורה שמעליו לא נמצא שם כיתה.',
      fix: 'ודא שמעל כל בלוק מופיע תא עם שם הכיתה (לדוגמה "אורית" או "ג\' 2 אורית").',
    };
  }
  if (/לא נמצאו בלוקי כיתות/.test(msg)) {
    return {
      key: 'no-blocks', icon: 'fa-table', severity: 'blocking',
      title: 'גיליון ללא בלוקי כיתות',
      explain: 'בגיליון הכיתה לא נמצא אף תא "מקצוע" שמסמן את תחילת הבלוק, ולכן לא ניתן לקרוא ממנו נתונים.',
      fix: 'ודא שכל בלוק מתחיל בשורת כותרת עם התאים "מקצוע", "מס שעות" ו-"מורה".',
    };
  }
  return {
    key: 'other', icon: 'fa-exclamation-triangle', severity: 'blocking',
    title: 'שגיאה אחרת',
    explain: 'שגיאה שלא ניתן לסווג אוטומטית.',
    fix: 'עיין בפירוט השורות למטה לאיתור הבעיה.',
  };
}

// קיצור הודעה ארוכה לתצוגה בפירוט
function shortErrorMessage(msg: string): string {
  return msg.length > 140 ? msg.slice(0, 137) + '…' : msg;
}

function ExcelErrorReport({ errors }: { errors: ExcelErrorRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // שטח את כל ההודעות לרשימה אחת
  const flat: FlatExcelError[] = useMemo(() => {
    const out: FlatExcelError[] = [];
    for (const e of errors) {
      for (const m of e.messages) out.push({ sheet: e.sheet, rowIdx: e.rowIdx, message: m });
    }
    return out;
  }, [errors]);

  // קבץ לפי קטגוריה
  const groups = useMemo(() => {
    const map = new Map<string, { cat: ErrorCategory; items: FlatExcelError[] }>();
    for (const f of flat) {
      const cat = classifyExcelError(f.message);
      const g = map.get(cat.key);
      if (g) g.items.push(f);
      else map.set(cat.key, { cat, items: [f] });
    }
    // קטגוריות חוסמות קודם, אחר כך הניתנות לתיקון אוטומטי
    return Array.from(map.values()).sort((a, b) => {
      if (a.cat.severity !== b.cat.severity) return a.cat.severity === 'blocking' ? -1 : 1;
      return b.items.length - a.items.length;
    });
  }, [flat]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="excel-import__err-report">
      <div className="excel-import__err-report-head">
        <i className="fa fa-list-ul" />
        <span>פירוט השגיאות בקובץ — <strong>{flat.length.toLocaleString('he-IL')}</strong> בעיות, מסווגות לפי סוג</span>
      </div>
      {groups.map(({ cat, items }) => {
        const isOpen = expanded.has(cat.key);
        const sample = items.slice(0, isOpen ? 50 : 0);
        return (
          <div key={cat.key} className={`excel-import__err-group excel-import__err-group--${cat.severity}`}>
            <div className="excel-import__err-group-head">
              <i className={`fa ${cat.icon}`} />
              <span className="excel-import__err-group-title">{cat.title}</span>
              <span className="excel-import__err-group-count">{items.length.toLocaleString('he-IL')} שורות</span>
              <span className={`excel-import__err-badge excel-import__err-badge--${cat.severity}`}>
                {cat.severity === 'fixable' ? 'ניתן לתיקון אוטומטי' : 'דורש תיקון בקובץ'}
              </span>
            </div>
            <div className="excel-import__err-group-explain">{cat.explain}</div>
            <div className="excel-import__err-group-fix">
              <i className="fa fa-lightbulb-o" /> <strong>איך מתקנים:</strong> {cat.fix}
            </div>
            <button type="button" className="excel-import__err-toggle" onClick={() => toggle(cat.key)}>
              <i className={`fa fa-chevron-${isOpen ? 'up' : 'down'}`} />
              {isOpen ? 'הסתר את רשימת השורות' : `הצג את רשימת השורות (${items.length.toLocaleString('he-IL')})`}
            </button>
            {isOpen && (
              <ul className="excel-import__err-list">
                {sample.map((f, i) => (
                  <li key={i}>
                    {f.sheet ? <span className="excel-import__err-sheet">{f.sheet}</span> : null}
                    {f.rowIdx > 0 ? <span className="excel-import__err-row">שורה {f.rowIdx}</span> : null}
                    <span>{shortErrorMessage(f.message)}</span>
                  </li>
                ))}
                {items.length > sample.length && (
                  <li className="excel-import__err-more">…ועוד {(items.length - sample.length).toLocaleString('he-IL')} שורות מאותו סוג</li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ExcelImportModal;
