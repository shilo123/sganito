import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ajax } from '../../api/client';
import { useToast } from '../../lib/toast';

// ---- Types ----

interface ShibutzErrorRow {
  ClassId: number;
  ClassName: string;
  Day: number;
  Hour: number;
  Message: string;
  TeachersMissingHours: string;
  SavedCount: number;
  ErrorCount: number;
}

interface DiagnosticRow {
  ClassId: number;
  ClassName: string;
  TeacherId: number;
  TeacherName: string;
  Required: number;
  Assigned: number;
  Missing: number;
  Hakbatza: number;
  FreeDay: number;
  IsHomeroom: number;
  TotalRequiredAllClasses: number;
  DefinedHourSlots: number;        // total TeacherHours rows (may include hours not in SchoolHours)
  AvailableHourSlots: number;      // actual hours usable for teaching (SchoolHours intersection)
}

interface TeacherUnusedRow {
  TeacherId: number;
  TeacherName: string;
  DefinedHours: number;
  UsedHours: number;
  UnusedHours: number;
  UnusedHourIds: string; // CSV of HourIds (HourId = dayDigit + sequence)
}

type DeleteType = -1 | 0 | 1;

// ---- Constants ----

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

// Parses "12:John Doe|34:Jane Roe|..." into a list of {id, name}.
function parseTeachersCsv(csv: string | null | undefined): Array<{ id: number; name: string }> {
  if (!csv) return [];
  return csv
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const idx = s.indexOf(':');
      if (idx <= 0) return { id: 0, name: s };
      return { id: Number(s.slice(0, idx)) || 0, name: s.slice(idx + 1).trim() };
    })
    .filter((t) => t.id > 0);
}

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

interface ClassLiveProgress {
  ClassId: number;
  ClassName: string;
  TotalSlots: number;
  FilledSlots: number;
}
interface ShibutzLiveStatus {
  IsRunning: boolean;
  ElapsedMs: number;
  TotalSlots: number;
  RedSlots: number;
  CurrentStep: string;
  Classes: ClassLiveProgress[];
}

// HourId encodes the day in the leading digit (1=ראשון, 2=שני, …) and the
// hour sequence in the trailing digits — same convention as Assign.tsx.
function splitUnusedHourIds(csv: string): { day: number; hour: number }[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => ({
      day: Number(s.charAt(0)) || 0,
      hour: Number(s.substring(1)) || 0,
    }));
}

// ---- Component ----

export default function AssignAuto() {
  const toast = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState<string>('מבצע שיבוץ אוטומטי');

  const [errors, setErrors] = useState<ShibutzErrorRow[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [resultMode, setResultMode] = useState<'success' | 'errors' | 'empty' | null>(null);
  const [successAlert, setSuccessAlert] = useState(false);

  const [confirmDeletion, setConfirmDeletion] = useState<DeleteType>(-1);

  const [diagnostic, setDiagnostic] = useState<DiagnosticRow[]>([]);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  // Teachers with leftover capacity after the run (defined working hours
  // that didn't end up assigned). Refreshed on every successful run.
  const [unusedHours, setUnusedHours] = useState<TeacherUnusedRow[]>([]);
  const [showUnusedHours, setShowUnusedHours] = useState(false);
  // Authoritative count of empty cells in the grid (from DB) — shown in the
  // diagnostic dialog. Can differ from diagnostic.length (unmet ClassTeacher
  // requirements) so we keep both and show emptyCellsState as the headline.
  const [emptyCellsState, setEmptyCellsState] = useState(0);
  // Current empty-slot count loaded on mount and refreshed after every run.
  // Drives the main button mode: when > 0 we show "תיקון חוסרים אוטומטי"
  // which only fills gaps without wiping the existing schedule.
  const [currentGapCount, setCurrentGapCount] = useState<number | null>(null);
  // מספר משבצות משובצות (HourTypeId=1) — בשילוב עם currentGapCount קובע
  // אם להציג "תיקון חוסרים" (יש שיבוץ חלקי) או "שיבוץ אוטומטי" (אין שיבוץ).
  const [currentAssignedCount, setCurrentAssignedCount] = useState<number | null>(null);

  // התנגשות יום חופשי בכיתה — נטען לפני הפעלת השיבוץ. אם יש כיתות שבהן 3+
  // מורים חולקים את אותו יום חופש, מציעים למשתמש לפני השיבוץ להעביר אחד.
  interface FreeDayConflict {
    ClassId: number;
    ClassName: string;
    LayerId: number;
    FreeDay: number;
    TeacherCount: number;
    TeachersCsv: string;
  }
  const [freeDayConflicts, setFreeDayConflicts] = useState<FreeDayConflict[]>([]);
  const [showConflictsModal, setShowConflictsModal] = useState(false);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, { teacherId: number; newFreeDay: number }>>(new Map());
  // Snapshot of the auto-built defaults captured each time the modal opens —
  // lets us tell whether the user has touched any select. The auto-resolve
  // button only shows up after a manual edit, so it doesn't compete with the
  // initial confirmation flow.
  const [initialResolutions, setInitialResolutions] = useState<Map<string, { teacherId: number; newFreeDay: number }>>(new Map());
  const [autoResolveBusy, setAutoResolveBusy] = useState(false);
  // After the FreeDay conflict modal resolves, which flow should run?
  // 'assign' = full reschedule (delete + ShibutzAuto), 'fixGaps' = only
  // FillEmptySlots without wiping the schedule. Defaults to 'assign'.
  const pendingFlowRef = useRef<'assign' | 'fixGaps'>('assign');
  // Recommendation widget state — lets the deputy principal pick a teacher
  // and a class with empty cells; the system computes how many hours that
  // combination could fill, and the apply button writes the new contract.
  interface TeacherLite { TeacherId: number; FullName: string; FreeDay: number; Frontaly: number }
  interface ClassLite { ClassId: number; ClassName: string }
  interface ClassTeacherLite { ClassId: number; TeacherId: number; Hour: number; ClassTeacherId: number; Hakbatza: number | null; Ihud: number | null }
  const [allTeachers, setAllTeachers] = useState<TeacherLite[]>([]);
  const [allClasses, setAllClasses] = useState<ClassLite[]>([]);
  const [classTeacherRows, setClassTeacherRows] = useState<ClassTeacherLite[]>([]);
  const [teacherBusyMap, setTeacherBusyMap] = useState<Map<number, Set<number>>>(new Map());
  // True empty cells per class — keyed by ClassId, value = set of HourIds.
  // Computed from live TeacherAssignment + SchoolHours so we don't rely on
  // the session-based `errors` array (which stays stale after FillEmptySlots
  // closes some cells; that produced "8 שעות חסר" cards for classes with 1
  // actual gap).
  const [emptyCellsByClass, setEmptyCellsByClass] = useState<Map<number, Set<number>>>(new Map());
  // Per-class HourId → teacher first name. Used to render the mini grid
  // inside each "missing" card so the deputy principal can see exactly
  // where the empty slot sits inside the class schedule.
  const [classScheduleByClass, setClassScheduleByClass] = useState<Map<number, Map<number, string>>>(new Map());
  const [validHourIdsList, setValidHourIdsList] = useState<number[]>([]);
  const [recTeacherId, setRecTeacherId] = useState<number>(0);
  const [recClassId, setRecClassId] = useState<number>(0);
  const [recBusy, setRecBusy] = useState(false);
  // Per-class teacher selection for the inline recommendation rows. Keyed
  // by classId so each missing class has its own independent dropdown.
  const [classRecTeacher, setClassRecTeacher] = useState<Map<number, number>>(new Map());
  const [classRecBusy, setClassRecBusy] = useState<number>(0);
  const [batchApplyBusy, setBatchApplyBusy] = useState(false);
  // Per-class "show all teachers" toggle. By default the dropdown for each
  // missing class only shows teachers already contracted to that class
  // (existing ClassTeacher rows) plus a "ראה עוד מורים" option that, when
  // chosen, expands the list to every other teacher.
  const [classShowAllTeachers, setClassShowAllTeachers] = useState<Set<number>>(new Set());

  // Loads the data the recommendation widget needs the first time the
  // diagnostic modal opens with errors — full teacher list (FreeDay), all
  // classes (for the dropdown), all ClassTeacher rows (so we know if a
  // contract already exists for a (T,C) pair and update vs insert), and
  // a teacher→busyHourIds map (so the "fillable hours" math is accurate).
  const loadRecommendationData = useCallback(async () => {
    if (allTeachers.length > 0) return;
    try {
      type TRow = { TeacherId: number | string; FirstName?: string; LastName?: string; FreeDay?: number | string | null; Frontaly?: number | string | null };
      type CRow = { ClassId: number | string; ClassName?: string; Name?: string };
      type CTRow = { ClassId: number | string; TeacherId: number | string; Hour: number | string | null; ClassTeacherId: number | string; Hakbatza?: number | string | null; Ihud?: number | string | null };
      type AssignRow = { TeacherId: number | string; ClassId: number | string; HourId: number | string };
      type SHRow = { HourId: number | string; IsOnlyShehya?: number | string | boolean | null };
      const [tRows, cRows, ctRows, taRows, shRows] = await Promise.all([
        ajax<TRow[]>('Teacher_GetTeacherList', { TeacherId: '' }).catch(() => []),
        ajax<CRow[]>('Class_GetAllClass').catch(() => []),
        ajax<CTRow[]>('Gen_GetTable', { TableName: 'ClassTeacher', Condition: 'ConfigurationId=1' }).catch(() => []),
        ajax<AssignRow[]>('Gen_GetTable', { TableName: 'TeacherAssignment', Condition: 'ConfigurationId=1 AND HourTypeId=1' }).catch(() => []),
        ajax<SHRow[]>('Gen_GetTable', { TableName: 'SchoolHours', Condition: 'ConfigurationId=1' }).catch(() => []),
      ]);
      const teachers: TeacherLite[] = (Array.isArray(tRows) ? tRows : []).map((t) => ({
        TeacherId: Number(t.TeacherId),
        FullName: `${t.FirstName ?? ''} ${t.LastName ?? ''}`.trim(),
        FreeDay: Number(t.FreeDay ?? 0) || 0,
        Frontaly: Number(t.Frontaly ?? 0) || 0,
      })).filter((t) => t.TeacherId > 0)
        .sort((a, b) => a.FullName.localeCompare(b.FullName, 'he'));
      const classes: ClassLite[] = (Array.isArray(cRows) ? cRows : []).map((c) => ({
        ClassId: Number(c.ClassId),
        ClassName: String(c.ClassName ?? c.Name ?? ''),
      })).filter((c) => c.ClassId > 0);
      const ctList: ClassTeacherLite[] = (Array.isArray(ctRows) ? ctRows : []).map((r) => ({
        ClassId: Number(r.ClassId),
        TeacherId: Number(r.TeacherId),
        Hour: Number(r.Hour ?? 0) || 0,
        ClassTeacherId: Number(r.ClassTeacherId ?? 0),
        Hakbatza: r.Hakbatza == null || r.Hakbatza === '' ? null : Number(r.Hakbatza) || null,
        Ihud: r.Ihud == null || r.Ihud === '' ? null : Number(r.Ihud) || null,
      }));
      const busy = new Map<number, Set<number>>();
      // (ClassId, HourId) cells that are actually filled — used to derive
      // truly empty cells per class.
      const filledCells = new Set<string>();
      for (const a of (Array.isArray(taRows) ? taRows : [])) {
        const tid = Number(a.TeacherId);
        const cid = Number(a.ClassId);
        const hid = Number(a.HourId);
        if (tid && hid) {
          let s = busy.get(tid);
          if (!s) { s = new Set(); busy.set(tid, s); }
          s.add(hid);
        }
        if (cid && hid) filledCells.add(`${cid}_${hid}`);
      }
      // Build emptyCellsByClass: for every (Class × valid SchoolHour) that
      // has no placement, push HourId to the class's set.
      const validHourIds: number[] = [];
      for (const r of (Array.isArray(shRows) ? shRows : [])) {
        const ios = String(r.IsOnlyShehya ?? '').toLowerCase();
        if (ios === '1' || ios === 'true') continue;
        const hid = Number(r.HourId);
        if (hid > 0) validHourIds.push(hid);
      }
      const empties = new Map<number, Set<number>>();
      for (const cls of classes) {
        for (const hid of validHourIds) {
          if (!filledCells.has(`${cls.ClassId}_${hid}`)) {
            let s = empties.get(cls.ClassId);
            if (!s) { s = new Set(); empties.set(cls.ClassId, s); }
            s.add(hid);
          }
        }
      }
      // Build per-class hour→teacher schedule for the mini-grid display.
      // First build a teacher-id → first-name lookup so we can show names
      // (full names crowd the tiny cells).
      const tNameById = new Map<number, string>();
      for (const t of teachers) {
        const first = t.FullName.split(' ')[0] ?? t.FullName;
        tNameById.set(t.TeacherId, first);
      }
      const cellsMap = new Map<number, Map<number, string>>();
      for (const a of (Array.isArray(taRows) ? taRows : [])) {
        const cid = Number(a.ClassId);
        const hid = Number(a.HourId);
        const tid = Number(a.TeacherId);
        if (!cid || !hid || !tid) continue;
        let m = cellsMap.get(cid);
        if (!m) { m = new Map(); cellsMap.set(cid, m); }
        // First placement wins (Hakbatza overlap shows whichever loaded first).
        if (!m.has(hid)) m.set(hid, tNameById.get(tid) ?? '?');
      }
      validHourIds.sort((a, b) => a - b);
      setAllTeachers(teachers);
      setAllClasses(classes);
      setClassTeacherRows(ctList);
      setTeacherBusyMap(busy);
      setEmptyCellsByClass(empties);
      setClassScheduleByClass(cellsMap);
      setValidHourIdsList(validHourIds);
    } catch (err) {
      console.error('loadRecommendationData failed', err);
    }
  }, [allTeachers.length]);

  // When the diagnostic opens with errors, prime the dropdown defaults so
  // the widget shows a sensible suggestion immediately (most-empty class,
  // a teacher who could actually plug some of those gaps).
  useEffect(() => {
    if (!showDiagnostic || errors.length === 0) return;
    loadRecommendationData();
  }, [showDiagnostic, errors.length, loadRecommendationData]);

  // Returns the count of empty cells in `classId` that `teacherId` could
  // legally fill: teacher's FreeDay doesn't match the cell's day AND the
  // teacher isn't already busy at that hour. This is the "המספר שעות"
  // shown in the recommendation widget.
  const computeFillableHours = useCallback((teacherId: number, classId: number): number => {
    if (!teacherId || !classId) return 0;
    const teacher = allTeachers.find((t) => t.TeacherId === teacherId);
    if (!teacher) return 0;
    const busy = teacherBusyMap.get(teacherId) ?? new Set<number>();
    const empties = emptyCellsByClass.get(classId);
    if (!empties) return 0;
    let count = 0;
    for (const hourId of empties) {
      if (teacher.FreeDay > 0 && Math.floor(hourId / 10) === teacher.FreeDay) continue;
      if (busy.has(hourId)) continue;
      count++;
    }
    return count;
  }, [allTeachers, teacherBusyMap, emptyCellsByClass]);

  const checkFreeDayConflicts = useCallback(async () => {
    try {
      const data = await ajax<FreeDayConflict[]>('Class_GetFreeDayConflicts');
      const list = Array.isArray(data) ? data : [];
      setFreeDayConflicts(list);
      return list;
    } catch (err) {
      console.error('Class_GetFreeDayConflicts failed', err);
      return [];
    }
  }, []);

  // טוען Empty cells per class ישירות מ-DB. שונה מ-emptyCellsByClass שב-state
  // (זה נטען רק כש-modal נפתח); כאן אנחנו צריכים את הנתונים לפני קבלת
  // ההחלטה איזה modal להציג.
  async function fetchEmptyCellsByClass(): Promise<Map<number, Set<number>>> {
    type AssignRow = { ClassId: number | string; HourId: number | string };
    type SHRow = { HourId: number | string; IsOnlyShehya?: number | string | boolean | null };
    type CRow = { ClassId: number | string };
    const [taRows, shRows, cRows] = await Promise.all([
      ajax<AssignRow[]>('Gen_GetTable', { TableName: 'TeacherAssignment', Condition: 'ConfigurationId=1 AND HourTypeId=1' }).catch(() => [] as AssignRow[]),
      ajax<SHRow[]>('Gen_GetTable', { TableName: 'SchoolHours', Condition: 'ConfigurationId=1' }).catch(() => [] as SHRow[]),
      ajax<CRow[]>('Class_GetAllClass').catch(() => [] as CRow[]),
    ]);
    const filled = new Set<string>();
    for (const a of (Array.isArray(taRows) ? taRows : [])) {
      const cid = Number(a.ClassId), hid = Number(a.HourId);
      if (cid && hid) filled.add(`${cid}_${hid}`);
    }
    const validHourIds: number[] = [];
    for (const r of (Array.isArray(shRows) ? shRows : [])) {
      const ios = String(r.IsOnlyShehya ?? '').toLowerCase();
      if (ios === '1' || ios === 'true') continue;
      const hid = Number(r.HourId);
      if (hid > 0) validHourIds.push(hid);
    }
    const empties = new Map<number, Set<number>>();
    for (const c of (Array.isArray(cRows) ? cRows : [])) {
      const cid = Number(c.ClassId);
      if (!cid) continue;
      for (const hid of validHourIds) {
        if (!filled.has(`${cid}_${hid}`)) {
          let s = empties.get(cid);
          if (!s) { s = new Set(); empties.set(cid, s); }
          s.add(hid);
        }
      }
    }
    return empties;
  }

  // בנה רשימת התנגשויות יום-חופשי מתוך diagnostic של post-assign:
  // נכלול רק (ClassId, FreeDay) שעבורם יש תא ריק בכיתה ביום ה-FreeDay של
  // המורה — אחרת זו לא בעיית FreeDay אלא over-demand גלובלי / Hakbatza /
  // התנגשות אחרת. הפורמט זהה ל-SP `Class_GetFreeDayConflicts`.
  function buildFreeDayConflictsFromDiag(
    diag: DiagnosticRow[],
    emptyCellsByCls: Map<number, Set<number>>,
  ): FreeDayConflict[] {
    const emptyDaysByClass = new Map<number, Set<number>>();
    for (const [cid, hours] of emptyCellsByCls) {
      const days = new Set<number>();
      for (const h of hours) days.add(Math.floor(h / 10));
      emptyDaysByClass.set(cid, days);
    }
    const byKey = new Map<string, FreeDayConflict>();
    for (const r of diag) {
      if (!(r.Missing > 0)) continue;
      if (!(r.FreeDay > 0)) continue;
      const days = emptyDaysByClass.get(r.ClassId);
      if (!days || !days.has(r.FreeDay)) continue;
      const key = `${r.ClassId}_${r.FreeDay}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          ClassId: r.ClassId,
          ClassName: r.ClassName,
          LayerId: 0,
          FreeDay: r.FreeDay,
          TeacherCount: 0,
          TeachersCsv: '',
        };
        byKey.set(key, entry);
      }
      entry.TeacherCount++;
      entry.TeachersCsv += (entry.TeachersCsv ? '|' : '') + `${r.TeacherId}:${r.TeacherName}`;
    }
    return Array.from(byKey.values());
  }

  useEffect(() => {
    checkFreeDayConflicts();
  }, [checkFreeDayConflicts]);

  // בדיקת היתכנות מקדימה — רצה ברקע ללא loading. מאחדת:
  //   1. Assign_PreCheck — over-demand גלובלי/כיתתי/מורה + 3+ מורים עם אותו FreeDay.
  //   2. Assign_FreeDayPreCheck — Hall's המקומי (יום עמוס מדי) + הקבצות עם
  //      FreeDay לא-מסונכרן.
  // רצה ב-mount וכן בכל שינוי ב-currentGapCount, כדי שגם משתמש שזה עתה
  // נכנס לדף (בלי שיבוץ קיים) יראה את הבאנר אם הנתונים בעייתיים.
  interface PreCheckIssue { Kind: string; Id1: number; Id2: number; Label: string; Detail: string }
  const [preCheckIssues, setPreCheckIssues] = useState<PreCheckIssue[]>([]);
  const [showPreCheckDetails, setShowPreCheckDetails] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [primary, freeDay] = await Promise.all([
          ajax<PreCheckIssue[]>('Assign_PreCheck').catch(() => [] as PreCheckIssue[]),
          ajax<PreCheckIssue[]>('Assign_FreeDayPreCheck').catch(() => [] as PreCheckIssue[]),
        ]);
        if (cancelled) return;
        const merged: PreCheckIssue[] = [
          ...(Array.isArray(primary) ? primary : []),
          ...(Array.isArray(freeDay) ? freeDay : []),
        ];
        setPreCheckIssues(merged);
      } catch (err) {
        console.error('PreCheck failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentGapCount]);

  // Elapsed seconds counter while the loading overlay is visible.
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!isLoading) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(0);
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  // Live progress polling — מציג למשתמש מה השרת עושה תוך כדי השיבוץ. לא נוגע
  // בלוגיקת השיבוץ עצמה: רק קורא ל-Assign_GetShibutzLiveStatus כל ~700ms.
  // ה-state מתאפס כשה-loading נסגר.
  const [liveStatus, setLiveStatus] = useState<ShibutzLiveStatus | null>(null);
  useEffect(() => {
    if (!isLoading) {
      setLiveStatus(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await ajax<ShibutzLiveStatus>('Assign_GetShibutzLiveStatus');
        if (!cancelled && s && typeof s === 'object') setLiveStatus(s);
      } catch {
        // הפולינג חסין לכשלים — נמשיך לדגום בלי להפסיק
      }
    };
    tick();
    const id = setInterval(tick, 700);
    return () => { cancelled = true; clearInterval(id); };
  }, [isLoading]);

  async function fetchShibutzErrors(): Promise<{
    errors: ShibutzErrorRow[];
    savedCount: number;
    errorCount: number;
  }> {
    try {
      const data = await ajax<ShibutzErrorRow[]>('Assign_GetShibutzErrors');
      if (!Array.isArray(data) || data.length === 0) {
        return { errors: [], savedCount: 0, errorCount: 0 };
      }
      const last = data[data.length - 1];
      const sc = last?.SavedCount ?? 0;
      const ec = last?.ErrorCount ?? 0;
      const onlyErrors = data.filter((r) => (r.ClassId ?? 0) > 0);
      return { errors: onlyErrors, savedCount: sc, errorCount: ec };
    } catch (e) {
      console.error('Assign_GetShibutzErrors failed', e);
      return { errors: [], savedCount: 0, errorCount: 0 };
    }
  }

  function handleResult(result: { errors: ShibutzErrorRow[]; savedCount: number; errorCount: number }) {
    setErrors(result.errors);
    setSavedCount(result.savedCount);
    setErrorCount(result.errorCount);

    if (result.errors.length > 0) {
      setResultMode('errors');
    } else if (result.errorCount > 0) {
      setResultMode('errors');
    } else if (result.savedCount > 0) {
      setResultMode('success');
    } else {
      setResultMode('empty');
    }
    setShowResults(true);
    setSuccessAlert(true);
  }

  async function fetchDiagnostic(): Promise<DiagnosticRow[]> {
    try {
      const data = await ajax<DiagnosticRow[]>('Assign_GetShibutzDiagnostic');
      if (!Array.isArray(data)) return [];
      return data.filter(
        (r) => (r?.ClassId ?? 0) > 0 && (r?.TeacherId ?? 0) > 0 && (r?.Missing ?? 0) > 0,
      );
    } catch (e) {
      console.error('Assign_GetShibutzDiagnostic failed', e);
      return [];
    }
  }

  async function fetchUnusedHours(): Promise<TeacherUnusedRow[]> {
    try {
      const data = await ajax<TeacherUnusedRow[]>('Assign_GetTeacherUnusedHours');
      if (!Array.isArray(data)) return [];
      return data.filter((r) => (r?.TeacherId ?? 0) > 0 && (r?.UnusedHours ?? 0) > 0);
    } catch (e) {
      console.error('Assign_GetTeacherUnusedHours failed', e);
      return [];
    }
  }

  async function refreshGapCount(): Promise<number> {
    try {
      const res = await ajax<{ EmptySlots?: number; AssignedSlots?: number }>('Assign_GetEmptySlotsCount');
      const n = Number(res?.EmptySlots ?? 0);
      const a = Number(res?.AssignedSlots ?? 0);
      setCurrentGapCount(n);
      setCurrentAssignedCount(a);
      return n;
    } catch (e) {
      console.error('Assign_GetEmptySlotsCount failed', e);
      return 0;
    }
  }

  // Load gap count on mount so the main button can offer "fix gaps" right
  // away when the schedule isn't 100% filled.
  useEffect(() => {
    refreshGapCount();
  }, []);

  // Build fresh resolution defaults for each conflict. The default new
  // free day is picked automatically per conflict so that:
  //   1. It doesn't match the original conflict day (the dropdown excludes
  //      that day anyway).
  //   2. It doesn't fall on another day that's *also* a wall in the same
  //      class — that would just rebuild the conflict on a different day.
  //   3. Across all conflicts, picks are spread across days with the
  //      lowest current pick-count (round-robin), so 6 conflicts don't all
  //      end up moving teachers onto the same Monday.
  // If every weekday is a conflict day for a class (extremely unlikely),
  // we fall back to 0 ("ללא יום חופשי") — that's always safe.
  function buildConflictDefaults(
    conflicts: FreeDayConflict[],
  ): Map<string, { teacherId: number; newFreeDay: number }> {
    const conflictDaysByClass = new Map<number, Set<number>>();
    for (const c of conflicts) {
      let set = conflictDaysByClass.get(c.ClassId);
      if (!set) { set = new Set(); conflictDaysByClass.set(c.ClassId, set); }
      set.add(c.FreeDay);
    }

    // Mon→Thu→Sun preference — friday (6) is excluded from the dropdown.
    const PREF_ORDER = [2, 3, 4, 5, 1];
    // Tracks how many resolutions already point at each day, to spread load.
    const dayLoad = new Map<number, number>();
    // Each teacher can move only once (a teacher has a single FreeDay).
    // Picking the same teacher across multiple resolutions wastes moves.
    const usedTeachers = new Set<number>();

    const defaults = new Map<string, { teacherId: number; newFreeDay: number }>();
    for (const c of conflicts) {
      const teachers = parseTeachersCsv(c.TeachersCsv);
      if (teachers.length === 0) continue;
      // Prefer a teacher who hasn't been picked yet in another resolution —
      // moving a unique teacher actually reduces the off-count, while
      // re-picking the same teacher just overwrites the previous choice on
      // the server (Teacher_SetFreeDay is per-teacher, last-write-wins).
      const pick = teachers.find((t) => !usedTeachers.has(t.id)) ?? teachers[0];
      usedTeachers.add(pick.id);

      const blocked = conflictDaysByClass.get(c.ClassId) ?? new Set<number>();
      const candidates = PREF_ORDER.filter((d) => !blocked.has(d));
      candidates.sort((a, b) => {
        const la = dayLoad.get(a) ?? 0;
        const lb = dayLoad.get(b) ?? 0;
        if (la !== lb) return la - lb;
        return PREF_ORDER.indexOf(a) - PREF_ORDER.indexOf(b);
      });
      const newDay = candidates[0] ?? 0;
      if (newDay > 0) dayLoad.set(newDay, (dayLoad.get(newDay) ?? 0) + 1);

      defaults.set(`${c.ClassId}_${c.FreeDay}`, { teacherId: pick.id, newFreeDay: newDay });
    }
    return defaults;
  }

  // Greedy auto-resolver — fetches the *full* class↔teacher graph (so we
  // see classes that aren't currently in conflict, which is critical to
  // avoid moving teachers onto days where they'd create new walls in those
  // classes). Then iteratively picks the worst (class, day) wall and moves
  // one teacher off it to the day that creates the smallest new peak count
  // across every class the teacher teaches.
  async function autoResolveFreeDays() {
    if (autoResolveBusy) return false;
    setAutoResolveBusy(true);
    try {
      const PREF_DAYS = [2, 3, 4, 5, 1, 0]; // Mon→Thu→Sun → ללא as last resort
      const MAX_ATTEMPTS = 8;

      // Fetch full class↔teacher graph + every teacher's current FreeDay.
      // This is what the original (CSV-only) version was missing: it could
      // park a moved teacher on a day that already had off-teachers in some
      // OTHER class the teacher teaches, silently birthing a new wall there.
      type ClassRowFull = {
        ClassId: number;
        TeacherId: number | string | null;
        Hakbatza?: number | string | null;
        LayerId?: number | string | null;
      };
      type TeacherRow = { TeacherId: number | string; FreeDay?: number | string | null };
      const [layerResults, teacherRows] = await Promise.all([
        Promise.all([1, 2, 3, 4, 5, 6].map((lid) =>
          ajax<ClassRowFull[]>('Class_GetClassByLayerId', { LayerId: lid }).catch(() => []),
        )),
        ajax<TeacherRow[]>('Teacher_GetTeacherList', { TeacherId: '' }).catch(() => []),
      ]);
      // teacherClassesGlobal[teacherId] -> set of class IDs (from ClassTeacher)
      const teacherClassesGlobal = new Map<number, Set<number>>();
      // classTeachersGlobal[classId] -> set of teacher IDs (everyone in the class)
      const classTeachersGlobal = new Map<number, Set<number>>();
      // Hakbatza membership: each group (keyed by "LayerId_Hakbatza") collects
      // the teachers who must teach it together. They MUST end up with the
      // same FreeDay (or all = 0) — otherwise the Hakbatza can't run on any
      // day where one member is off, and the schedule loses those slots.
      const hakbatzaGroups = new Map<string, Set<number>>();
      // Reverse lookup: teacherId -> list of group keys they belong to.
      const teacherHakGroups = new Map<number, string[]>();
      for (const rows of layerResults) {
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          const tid = Number(row.TeacherId ?? 0);
          const cid = Number(row.ClassId ?? 0);
          if (!tid || !cid) continue;
          let ts = teacherClassesGlobal.get(tid);
          if (!ts) { ts = new Set(); teacherClassesGlobal.set(tid, ts); }
          ts.add(cid);
          let cs = classTeachersGlobal.get(cid);
          if (!cs) { cs = new Set(); classTeachersGlobal.set(cid, cs); }
          cs.add(tid);
          const hak = Number(row.Hakbatza ?? 0);
          const layerId = Number(row.LayerId ?? 0);
          if (hak > 0 && layerId > 0) {
            const gkey = `${layerId}_${hak}`;
            let g = hakbatzaGroups.get(gkey);
            if (!g) { g = new Set(); hakbatzaGroups.set(gkey, g); }
            g.add(tid);
            const owned = teacherHakGroups.get(tid);
            if (!owned) teacherHakGroups.set(tid, [gkey]);
            else if (!owned.includes(gkey)) owned.push(gkey);
          }
        }
      }
      // Helper: every teacher transitively reachable through shared Hakbatza
      // membership. When we change one teacher's FreeDay, every co-member
      // must move with them, otherwise we just shifted the wall.
      const hakClosure = (rootId: number): Set<number> => {
        const visited = new Set<number>([rootId]);
        const queue: number[] = [rootId];
        while (queue.length > 0) {
          const cur = queue.shift()!;
          const groups = teacherHakGroups.get(cur);
          if (!groups) continue;
          for (const gkey of groups) {
            const members = hakbatzaGroups.get(gkey);
            if (!members) continue;
            for (const m of members) {
              if (!visited.has(m)) { visited.add(m); queue.push(m); }
            }
          }
        }
        return visited;
      };
      // Each teacher's CURRENT FreeDay from the Teacher table — covers
      // teachers not in any conflict CSV (their off-day might still bump
      // counts when we move other teachers nearby).
      const currentFreeDay = new Map<number, number>();
      for (const t of Array.isArray(teacherRows) ? teacherRows : []) {
        const tid = Number(t.TeacherId);
        if (!tid) continue;
        const fd = Number(t.FreeDay ?? 0);
        currentFreeDay.set(tid, Number.isFinite(fd) ? fd : 0);
      }

      // Plan changes locally first — only one Teacher_SetFreeDay per teacher
      // (last write wins anyway), and we can recompute repeatedly without
      // hitting the server.
      const plannedFreeDay = new Map<number, number>(currentFreeDay);

      const recomputeCountsAll = () => {
        const counts = new Map<string, number>();
        for (const [classId, tids] of classTeachersGlobal) {
          for (const tid of tids) {
            const d = plannedFreeDay.get(tid);
            if (d === undefined || d === 0) continue;
            const k = `${classId}_${d}`;
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
        }
        return counts;
      };

      const findWorstWall = (counts: Map<string, number>) => {
        let max = 0; let worstKey = '';
        for (const [k, v] of counts) {
          if (v >= 3 && v > max) { max = v; worstKey = k; }
        }
        return worstKey ? { key: worstKey, count: max } : null;
      };

      // Pre-step — synchronize Hakbatza members BEFORE the wall loop.
      // Hakbatza partners must teach the same hour, so every distinct
      // FreeDay among members blocks one schedulable day for the group.
      // The wall finder won't catch this (no 3+ wall fires) so we explicitly
      // align the group to a single FreeDay: pick the mode of existing
      // values, falling back to 0 (no day off) when no clear majority.
      for (const [, members] of hakbatzaGroups) {
        if (members.size <= 1) continue;
        const freq = new Map<number, number>();
        for (const tid of members) {
          const d = plannedFreeDay.get(tid) ?? 0;
          freq.set(d, (freq.get(d) ?? 0) + 1);
        }
        if (freq.size <= 1) continue; // already aligned
        // Pick the FreeDay shared by the most members. Ties: prefer 0 (the
        // safest non-blocking choice). Only members already in this group
        // get touched, but the closure helper used during the wall loop
        // will keep cross-Hakbatza partners moving in lockstep.
        let bestDay = 0;
        let bestCount = -1;
        for (const [day, cnt] of freq) {
          if (cnt > bestCount || (cnt === bestCount && day === 0)) {
            bestDay = day;
            bestCount = cnt;
          }
        }
        for (const tid of members) plannedFreeDay.set(tid, bestDay);
      }

      let attempt = 0;
      while (attempt++ < MAX_ATTEMPTS) {
        let counts = recomputeCountsAll();
        if (!findWorstWall(counts)) break; // all clear in our planning

        let safety = 0;
        while (safety++ < 200) {
          const worst = findWorstWall(counts);
          if (!worst) break;
          const [classIdStr, dayStr] = worst.key.split('_');
          const classId = Number(classIdStr);
          const day = Number(dayStr);

          const cTeachers = classTeachersGlobal.get(classId) ?? new Set<number>();
          const offHere = [...cTeachers].filter((tid) => plannedFreeDay.get(tid) === day);
          if (offHere.length === 0) break;

          // Pick the teacher whose move benefits the most walls.
          const teacherScore = (tid: number): number => {
            const cls = teacherClassesGlobal.get(tid) ?? new Set([classId]);
            let s = 0;
            for (const cId of cls) {
              if ((counts.get(`${cId}_${day}`) ?? 0) >= 3) s++;
            }
            return s;
          };
          offHere.sort((a, b) => teacherScore(b) - teacherScore(a));
          const teacherId = offHere[0];
          // The move actually targets the WHOLE Hakbatza closure of this
          // teacher — moving a single member without their group just shifts
          // the wall to whatever day the partners stay on. The closure walks
          // every Hakbatza that ANY member belongs to, transitively.
          const moveSet = hakClosure(teacherId);
          // Combined set of classes touched by all members of the move set.
          const tCls = new Set<number>();
          for (const tid of moveSet) {
            const cs = teacherClassesGlobal.get(tid);
            if (cs) for (const cId of cs) tCls.add(cId);
          }

          // Pick the day with the lowest resulting peak across all classes
          // the teacher teaches (ALL of them, not just original-conflict ones).
          let bestDay = 0;
          let bestPeak = Infinity;
          for (const cand of PREF_DAYS) {
            if (cand === day) continue;
            let peak = 0;
            if (cand > 0) {
              for (const cId of tCls) {
                const k = `${cId}_${cand}`;
                const newCount = (counts.get(k) ?? 0) + 1;
                if (newCount > peak) peak = newCount;
              }
            }
            if (peak < bestPeak) {
              bestPeak = peak;
              bestDay = cand;
              if (peak < 3) break;
            }
          }

          // Apply the move to EVERY teacher in the Hakbatza closure (so
          // partners stay synchronized). Includes the picked teacher.
          for (const tid of moveSet) {
            plannedFreeDay.set(tid, bestDay);
          }
          counts = recomputeCountsAll();
        }

        // Diff vs current FreeDay — single Teacher_SetFreeDay per teacher.
        const changes: Array<{ teacherId: number; freeDay: number }> = [];
        for (const [tid, plannedDay] of plannedFreeDay) {
          const cur = currentFreeDay.get(tid) ?? 0;
          if (plannedDay !== cur) {
            changes.push({ teacherId: tid, freeDay: plannedDay });
          }
        }
        if (changes.length === 0) break;

        await Promise.all(
          changes.map((ch) =>
            ajax('Teacher_SetFreeDay', {
              TeacherId: String(ch.teacherId),
              FreeDay: String(ch.freeDay),
            }),
          ),
        );
        // Sync our snapshot with what we just persisted, so later iterations
        // (if any) compute diffs correctly.
        for (const ch of changes) currentFreeDay.set(ch.teacherId, ch.freeDay);

        // Re-pull conflicts from server — if empty, we're done.
        const list = await checkFreeDayConflicts();
        if (list.length === 0) {
          toast.success('כל ההתנגשויות נפתרו אוטומטית');
          setShowConflictsModal(false);
          try {
            const data = await ajax<PreCheckIssue[]>('Assign_PreCheck');
            setPreCheckIssues(Array.isArray(data) ? data : []);
          } catch { /* non-blocking */ }
          return true;
        }
        // Otherwise, refresh planned days from server (in case our local
        // model was off) and reset modal state to the new conflicts.
        const updated = await ajax<TeacherRow[]>('Teacher_GetTeacherList', { TeacherId: '' }).catch(() => []);
        for (const t of Array.isArray(updated) ? updated : []) {
          const tid = Number(t.TeacherId);
          if (!tid) continue;
          const fd = Number(t.FreeDay ?? 0);
          plannedFreeDay.set(tid, Number.isFinite(fd) ? fd : 0);
          currentFreeDay.set(tid, Number.isFinite(fd) ? fd : 0);
        }
        // Rebuild the modal's resolution state for the new conflict set so
        // the visible UI doesn't drift from server reality.
        const defaults = buildConflictDefaults(list);
        setConflictResolutions(defaults);
        const snap = new Map<string, { teacherId: number; newFreeDay: number }>();
        for (const [k, v] of defaults) snap.set(k, { ...v });
        setInitialResolutions(snap);
      }

      toast.warning(`לא הצלחנו לפתור הכל ב-${MAX_ATTEMPTS} ניסיונות`);
      return false;
    } catch (err) {
      console.error('autoResolveFreeDays failed', err);
      toast.error('שגיאה בפתרון אוטומטי');
      return false;
    } finally {
      setAutoResolveBusy(false);
    }
  }

  function openConflictModalNow(conflicts: FreeDayConflict[]) {
    if (conflicts.length === 0) return;
    const defaults = buildConflictDefaults(conflicts);
    setConflictResolutions(defaults);
    // Snapshot a deep copy so later edits to conflictResolutions don't
    // mutate this baseline (Map.set on a copy of the Map still copies
    // entries by reference, but resolution values are plain objects we
    // never mutate — Map identity is what matters here).
    const snap = new Map<string, { teacherId: number; newFreeDay: number }>();
    for (const [k, v] of defaults) snap.set(k, { ...v });
    setInitialResolutions(snap);
    setShowConflictsModal(true);
  }

  async function doAssign() {
    // בדוק התנגשויות יום חופשי לפני שיבוץ. אם יש — בקש מהמשתמש לפתור קודם.
    const conflicts = await checkFreeDayConflicts();
    if (conflicts.length > 0) {
      openConflictModalNow(conflicts);
      return;
    }
    await runAssignFlow();
  }

  async function runAssignFlow() {
    setSuccessAlert(false);
    setShowResults(false);
    setShowDiagnostic(false);
    setDiagnostic([]);
    setEmptyCellsState(0);
    setLoadingTitle('מנקה שיבוצים קיימים');
    setIsLoading(true);

    try {
      // קודם מוחקים את כל השיבוצים האוטומטיים הקיימים — שיבוץ אוטומטי
      // צריך להתחיל מדף נקי. ידני (IsAuto=0) לא נמחק.
      try {
        await ajax('Assign_DeleteAssignAuto', { IsAuto: '1' });
      } catch (e) {
        console.error('Assign_DeleteAssignAuto failed', e);
      }
      setLoadingTitle('מבצע שיבוץ אוטומטי');
      await ajax('Assign_ShibutzAuto');

      // Final pass: fill any remaining empty cells with available teachers
      // (homeroom first, then least-loaded teacher with free TeacherHours at
      // that hour). Without this, ClassTeacher demand < SchoolHours capacity
      // leaves visible "אין שיבוץ" cells in the school grid.
      setLoadingTitle('משלים משבצות ריקות');
      try {
        await ajax('Assign_FillEmptySlots');
      } catch (e) {
        console.error('Assign_FillEmptySlots failed', e);
      }

      // Run the post-assignment fetches in parallel — they're independent
      // reads (diagnostic, empty-slot count, error list, unused-hour list)
      // and chaining them sequentially was costing ~5–15s per run.
      const [diag, emptySlotsRes, result, unused] = await Promise.all([
        fetchDiagnostic(),
        ajax<{ EmptySlots?: number; AssignedSlots?: number; Capacity?: number; TotalRequired?: number }>('Assign_GetEmptySlotsCount').catch(() => null),
        fetchShibutzErrors(),
        fetchUnusedHours(),
      ]);
      setDiagnostic(diag);
      setUnusedHours(unused);

      const emptyCells = emptySlotsRes ? Number(emptySlotsRes.EmptySlots ?? 0) : diag.length;
      // assignedCells = unique (Class, Hour) cells with at least one teacher.
      // Different from session.SavedCount, which counts *placements* and
      // double-counts hakbatza overlaps. Using assignedCells gives a stable
      // "X out of Y cells" denominator that matches the actual grid.
      const assignedCells = emptySlotsRes
        ? Number(emptySlotsRes.AssignedSlots ?? Math.max(0, result.savedCount))
        : Math.max(0, result.savedCount);
      const capacity = Number(emptySlotsRes?.Capacity ?? assignedCells + emptyCells);
      const totalRequired = Number(emptySlotsRes?.TotalRequired ?? capacity);

      setSavedCount(assignedCells);
      setErrors(result.errors);

      // Success — חייב לעמוד בשני תנאים יחד:
      // 1. כל התאים בלוח מולאו (emptyCells === 0)
      // 2. כל הדרישה האפקטיבית מומשה (assignedCells >= totalRequired)
      // אם totalRequired > capacity — יש over-demand פיזית בלתי-אפשרי לכסות
      // (למשל המשתמש שינה SchoolHours/ClassTeacher.Hour כך שהדרישה חורגת
      // מהקיבולת). במצב זה greedy ימלא את כל התאים אבל הדרישה לא תושלם —
      // חובה להציג זאת במקום הודעת "100%" שקרית.
      const fullyComplete = emptyCells === 0 && assignedCells >= totalRequired;
      const overDemand = Math.max(0, totalRequired - assignedCells);

      setIsLoading(false);

      if (fullyComplete) {
        setResultMode('success');
        setShowResults(true);
        setSuccessAlert(true);
        setShowDiagnostic(false);
      } else {
        // gap = max(emptyCells, overDemand). If grid is full but demand
        // exceeds capacity, treat the over-demand as the "missing" count
        // so the diagnostic dialog shows real numbers, not 0.
        const reportedGap = Math.max(emptyCells, overDemand);
        setResultMode('errors');
        setEmptyCellsState(reportedGap);
        setErrorCount(reportedGap);
        setSuccessAlert(true);
        // אם החוסר נובע מ-FreeDay של מורה — תא ריק בכיתה ביום ה-FreeDay
        // של מורה שיש לו Missing>0 — הצג את ה-modal הייעודי לפתרון ימי
        // חופשי במקום ה-Diagnostic של dropdowns.
        const empties = await fetchEmptyCellsByClass();
        const fdConflicts = buildFreeDayConflictsFromDiag(diag, empties);
        if (fdConflicts.length > 0) {
          setShowDiagnostic(false);
          setFreeDayConflicts(fdConflicts);
          pendingFlowRef.current = 'assign';
          openConflictModalNow(fdConflicts);
        } else {
          setShowDiagnostic(true);
        }
      }
      // רענן את ה-coverage pill בראש המסך (MasterLayout) — מאזין לאירוע.
      window.dispatchEvent(new CustomEvent('class-status-changed'));
    } catch (e) {
      console.error('Assign_ShibutzAuto failed', e);
      toast.error('אירעה שגיאה בזמן ביצוע השיבוץ האוטומטי. אנא נסה שוב.');
      setIsLoading(false);
    } finally {
      setIsLoading(false);
      refreshGapCount();
    }
  }

  // Gap-fix mode: keep the existing schedule, just call the server's
  // FillEmptySlots which slots an available teacher (homeroom first, then
  // least-loaded) into every empty cell. No deletion, no rebuild.
  async function doFixGaps() {
    // קודם בודקים התנגשות יום חופשי — בדיוק כמו בשיבוץ אוטומטי. אם יש
    // — נפתח את המודל; הוא ירוץ runAssignFlow אחרי הפתרון, אבל מאחר
    // שתיקון חוסרים לא רוצה למחוק שיבוץ, נוסיף flag (להלן) שמכוון
    // ל-runFixGapsFlow במקום.
    const conflicts = await checkFreeDayConflicts();
    if (conflicts.length > 0) {
      pendingFlowRef.current = 'fixGaps';
      openConflictModalNow(conflicts);
      return;
    }
    await runFixGapsFlow();
  }

  async function runFixGapsFlow() {
    setSuccessAlert(false);
    setShowResults(false);
    setShowDiagnostic(false);
    setDiagnostic([]);
    setEmptyCellsState(0);
    setLoadingTitle('מתקן חוסרים אוטומטית');
    setIsLoading(true);

    try {
      let filled = 0;
      let stillEmpty = 0;
      try {
        const res = await ajax<{ Filled?: number; StillEmpty?: number; Error?: string }>(
          'Assign_FillEmptySlots',
        );
        filled = Number(res?.Filled ?? 0);
        stillEmpty = Number(res?.StillEmpty ?? 0);
      } catch (e) {
        console.error('Assign_FillEmptySlots failed', e);
        toast.error('אירעה שגיאה בתיקון החוסרים. אנא נסה שוב.');
        return;
      }

      // Refresh post-run state in parallel — include errors fetch so the
      // diagnostic dialog has a real savedCount to display.
      const [diag, emptySlotsRes, errResult, unused] = await Promise.all([
        fetchDiagnostic(),
        ajax<{ EmptySlots?: number; AssignedSlots?: number }>('Assign_GetEmptySlotsCount').catch(() => null),
        fetchShibutzErrors(),
        fetchUnusedHours(),
      ]);
      setDiagnostic(diag);
      setUnusedHours(unused);
      setErrors(errResult.errors);
      const assignedCells = emptySlotsRes
        ? Number(emptySlotsRes.AssignedSlots ?? 0)
        : Math.max(0, errResult.savedCount);
      setSavedCount(assignedCells);

      const remaining = emptySlotsRes ? Number(emptySlotsRes.EmptySlots ?? 0) : stillEmpty;
      setCurrentGapCount(remaining);

      if (remaining === 0) {
        setResultMode('success');
        setShowResults(true);
        setSuccessAlert(true);
        setShowDiagnostic(false);
        toast.success(`הושלם — ${filled} חוסרים מולאו, המערכת מלאה`);
      } else {
        setEmptyCellsState(remaining);
        setErrorCount(remaining);
        setSuccessAlert(true);
        // אם החוסר נובע מ-FreeDay של מורה — הצג modal ייעודי במקום
        // ה-Diagnostic של dropdowns. אחרי עדכון FreeDay נמשיך ב-fixGaps
        // (לא נמחק שיבוץ קיים, רק נמלא חוסרים).
        const empties = await fetchEmptyCellsByClass();
        const fdConflicts = buildFreeDayConflictsFromDiag(diag, empties);
        if (fdConflicts.length > 0) {
          setShowDiagnostic(false);
          setFreeDayConflicts(fdConflicts);
          pendingFlowRef.current = 'fixGaps';
          openConflictModalNow(fdConflicts);
        } else {
          // הצג את אותו דיאגנוסטיקה כמו ב-runAuto — מבוסס משבצות חיות מ-DB,
          // לא על הסשן (שעלול להיות ריק כי לא הופעל ShibutzAuto). הפופאפ
          // עצמו בונה כרטיסים מ-emptyCellsByClass.
          setShowDiagnostic(true);
        }
        if (filled > 0) {
          toast.warning(`מולאו ${filled} חוסרים. נותרו ${remaining} משבצות שאין להן מורה זמין.`);
        } else {
          toast.warning(`לא נמצאו מורים פנויים לחוסרים. נותרו ${remaining} משבצות.`);
        }
      }
      window.dispatchEvent(new CustomEvent('class-status-changed'));
    } finally {
      setIsLoading(false);
    }
  }

  async function doForceAssign() {
    setLoadingTitle('משבץ בכפייה את החוסרים');
    setIsLoading(true);
    try {
      // Smart force first: tries to displace other teachers from conflicting slots
      await ajax('Assign_ShibutzForceSmart');
      await new Promise((r) => setTimeout(r, 300));
      // Fallback: simple force for whatever couldn't be displaced
      await ajax('Assign_ShibutzForce');
      await new Promise((r) => setTimeout(r, 300));
      const diag = await fetchDiagnostic();
      setDiagnostic(diag);
      if (diag.length === 0) {
        setShowDiagnostic(false);
        setResultMode('success');
        setShowResults(true);
        setSuccessAlert(true);
        toast.success('כל החוסרים שובצו בכפייה בהצלחה');
      } else {
        toast.success('שובצו בכפייה. נותרו ' + diag.length + ' חוסרים שאי אפשר לשבץ פיזית');
        setShowDiagnostic(true);
      }
    } catch (e) {
      console.error('Assign_ShibutzForce failed', e);
      toast.error('שגיאה בשיבוץ בכפייה');
    } finally {
      setIsLoading(false);
      refreshGapCount();
    }
  }

  async function doFixMissing() {
    setSuccessAlert(false);
    setShowResults(false);
    setLoadingTitle('מתקן חוסרים באמצעות הזזות');
    setIsLoading(true);
    try {
      await ajax('Assign_ShibutzFixMissing');
      await new Promise((r) => setTimeout(r, 500));
      const result = await fetchShibutzErrors();
      handleResult(result);
    } catch (e) {
      console.error('Assign_ShibutzFixMissing failed', e);
      toast.error('אירעה שגיאה בזמן תיקון חוסרים. אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  }

  async function executeDeletion() {
    const action = confirmDeletion;
    setConfirmDeletion(-1);
    if (action === -1) return;
    try {
      await ajax('Assign_DeleteAssignAuto', { IsAuto: action });
      setSuccessAlert(false);
      setShowResults(false);
      setErrors([]);
      setSavedCount(0);
      setErrorCount(0);
      // After deletion the schedule is empty — switch the main button back
      // to "שבץ אוטומטית" by clearing the gap count.
      setCurrentGapCount(0);
      setUnusedHours([]);
      window.dispatchEvent(new CustomEvent('class-status-changed'));
      toast.success('השיבוץ נמחק בהצלחה');
    } catch (e) {
      console.error('Assign_DeleteAssignAuto failed', e);
      toast.error('שגיאה במחיקת השיבוץ');
    }
  }

  async function loadDataForAssignAuto(layerId: string) {
    try {
      await ajax('Assign_GetDataForAssignAuto', { LayerId: layerId });
    } catch (e) {
      console.error('Assign_GetDataForAssignAuto failed', e);
    }
  }
  // Suppress unused warning — exposed for potential manual flow triggers
  void loadDataForAssignAuto;
  // Reserved for later use - fix-missing button was removed per user request
  void doFixMissing;

  return (
    <div style={{ direction: 'rtl' }}>
      {isLoading && (() => {
        const live = liveStatus && liveStatus.IsRunning ? liveStatus : null;
        const total = live?.TotalSlots ?? 0;
        const red = live?.RedSlots ?? 0;
        const filled = Math.max(0, total - red);
        const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 1000) / 10) : 0;
        const step = live?.CurrentStep?.trim();
        const headline = step && step.length > 0 ? step : loadingTitle;
        // ממיין את הכיתות: קודם פעילות (לא מלאות, יש שיבוץ), אחר-כך מלאות,
        // ואז ריקות. תמיד מגביל ל-12 שכבר נראה דחוס מספיק במסך.
        const classes = (live?.Classes ?? [])
          .slice()
          .sort((a, b) => {
            const aDone = a.TotalSlots > 0 && a.FilledSlots >= a.TotalSlots ? 1 : 0;
            const bDone = b.TotalSlots > 0 && b.FilledSlots >= b.TotalSlots ? 1 : 0;
            const aActive = a.FilledSlots > 0 && !aDone ? 1 : 0;
            const bActive = b.FilledSlots > 0 && !bDone ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;
            if (aDone !== bDone) return aDone - bDone;
            return (b.FilledSlots / Math.max(1, b.TotalSlots)) - (a.FilledSlots / Math.max(1, a.TotalSlots));
          })
          .slice(0, 12);
        return (
          <div className="action-loading" role="status" aria-live="polite">
            <div className="action-loading__card assign-loading-card assign-loading-card--live">
              <div className="assign-loading-spinner" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="action-loading__title">{headline}...</div>
              <div className="action-loading__sub">
                {live ? `${filled.toLocaleString('he-IL')} מתוך ${total.toLocaleString('he-IL')} משבצות שובצו` : 'אנא המתן, התהליך עשוי לקחת מספר שניות'}
              </div>
              {live && total > 0 ? (
                <>
                  <div className="assign-progress" aria-label={`התקדמות ${pct}%`}>
                    <div className="assign-progress__fill" style={{ width: `${pct}%` }} />
                    <div className="assign-progress__label">{pct.toFixed(1)}%</div>
                  </div>
                  {classes.length > 0 && (
                    <div className="assign-progress-classes">
                      {classes.map((c) => {
                        const cPct = c.TotalSlots > 0 ? Math.min(100, Math.round((c.FilledSlots / c.TotalSlots) * 100)) : 0;
                        const cDone = c.TotalSlots > 0 && c.FilledSlots >= c.TotalSlots;
                        const cActive = !cDone && c.FilledSlots > 0;
                        const cls = `assign-progress-classes__item${cDone ? ' is-done' : ''}${cActive ? ' is-active' : ''}`;
                        return (
                          <div key={c.ClassId} className={cls} title={`${c.ClassName} – ${c.FilledSlots}/${c.TotalSlots}`}>
                            <div className="assign-progress-classes__head">
                              <span className="assign-progress-classes__name">{c.ClassName}</span>
                              <span className="assign-progress-classes__count">{c.FilledSlots}/{c.TotalSlots}</span>
                            </div>
                            <div className="assign-progress-classes__bar">
                              <div className="assign-progress-classes__fill" style={{ width: `${cPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="action-loading__bar" />
              )}
              <div className="assign-loading-timer" aria-live="off">
                <i className="fa fa-clock-o" /> {formatElapsed(elapsedSec)}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="assign-auto">
        <div className="assign-auto__card">
          {(() => {
            // "תיקון חוסרים" יוצג רק אם יש שיבוץ חלקי קיים (יותר מ-0%)
            // ועדיין יש משבצות ריקות. אם אין שיבוץ בכלל — תמיד "שיבוץ אוטומטי".
            const inGapMode =
              currentGapCount !== null
              && currentGapCount > 0
              && currentAssignedCount !== null
              && currentAssignedCount > 0;
            return (
              <>
                <div className="assign-auto__header">
                  <div>
                    <div className="assign-auto__kicker">פעולת שיבוץ</div>
                    <h2 className="assign-auto__title">
                      {inGapMode ? 'תיקון חוסרים אוטומטי' : 'שיבוץ אוטומטי'}
                    </h2>
                  </div>
                  {inGapMode && (
                    <div className="assign-auto__warning">
                      <i className="fa fa-info-circle" />
                      <span>
                        נותרו {currentGapCount} משבצות ריקות. הפעולה תשבץ מורים פנויים בחוסרים מבלי לפגוע במה שכבר משובץ.
                      </span>
                    </div>
                  )}
                  {preCheckIssues.length > 0 && (
                    <div className="assign-auto__pre-check">
                      <i className="fa fa-info-circle" />
                      <span>
                        ייתכן והשיבוץ האוטומטי לא יצליח במלואו ({preCheckIssues.length} בעיות פוטנציאליות).
                      </span>
                      <button
                        type="button"
                        className="assign-auto__pre-check-btn"
                        onClick={() => setShowPreCheckDetails(true)}
                      >
                        ראה עוד
                      </button>
                    </div>
                  )}
                  {/* Proactive free-day conflict banner — visible even before
                      the user clicks "שבץ". Without it the conflict modal
                      only surfaces during the assign flow, so a user just
                      browsing the page would never know the schedule is
                      unsolvable until they tried.
                      ה-banner מופיע גם בשלוש בעיות FreeDay אחרות שמזוהות
                      ב-PreCheck (overload 3+, capacity squeeze, hakbatza
                      split) — אחרת המשתמש לא רואה אזהרה ברורה ואת מסלול
                      ה"פתור עכשיו". */}
                  {(() => {
                    const freeDayKinds = new Set([
                      'class_freeday_overload',
                      'class_freeday_capacity_squeeze',
                      'hakbatza_freeday_split',
                    ]);
                    const freeDayPreCheckCount = preCheckIssues.filter(i => freeDayKinds.has(i.Kind)).length;
                    const totalFreeDayClasses = freeDayConflicts.length || freeDayPreCheckCount;
                    if (totalFreeDayClasses === 0) return null;
                    return (
                      <div className="assign-auto__free-day-warn">
                        <i className="fa fa-exclamation-triangle" />
                        <span>
                          {freeDayConflicts.length > 0
                            ? `התנגשות יום חופשי ב-${freeDayConflicts.length} ${freeDayConflicts.length === 1 ? 'כיתה' : 'כיתות'} — השיבוץ לא יושלם עד שיוסדר.`
                            : `זוהו ${freeDayPreCheckCount} בעיות יום חופשי שעלולות למנוע שיבוץ מלא.`}
                        </span>
                        {freeDayConflicts.length > 0 ? (
                          <button
                            type="button"
                            className="assign-auto__free-day-btn"
                            onClick={() => openConflictModalNow(freeDayConflicts)}
                          >
                            פתור עכשיו
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="assign-auto__free-day-btn"
                            onClick={() => setShowPreCheckDetails(true)}
                          >
                            ראה פירוט
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="assign-auto__actions">
                  <button
                    type="button"
                    className="assign-auto__btn assign-auto__btn--primary"
                    onClick={inGapMode ? doFixGaps : doAssign}
                  >
                    <i className={`fa fa-${inGapMode ? 'wrench' : 'magic'}`} />
                    <span>{inGapMode ? 'תקן חוסרים אוטומטית' : 'שבץ אוטומטית'}</span>
                  </button>
                  <button
                    type="button"
                    className="assign-auto__btn assign-auto__btn--danger"
                    onClick={() => setConfirmDeletion(0)}
                  >
                    <i className="fa fa-trash" />
                    <span>מחק שיבוץ</span>
                  </button>
                  <button
                    type="button"
                    className="assign-auto__btn assign-auto__btn--info"
                    onClick={() => navigate('/Assign/Assign')}
                  >
                    <i className="fa fa-calendar" />
                    <span>פתח מערכת בית ספר</span>
                  </button>
                </div>
              </>
            );
          })()}

          {successAlert && resultMode === 'success' && (
            <div
              className="assign-success-modal"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSuccessAlert(false);
              }}
            >
              <div className="assign-success-modal__card">
                <div className="assign-success-modal__icon">
                  <i className="fa fa-check" />
                </div>
                <div className="assign-success-modal__title">השיבוץ הושלם!</div>
                <div className="assign-success-modal__pct">100%</div>
                <div className="assign-success-modal__sub">
                  כל המשבצות שובצו בהצלחה — המערכת מלאה ומוכנה
                </div>
                <button
                  type="button"
                  className="btn btn-success assign-success-modal__close"
                  onClick={() => setSuccessAlert(false)}
                >
                  <i className="fa fa-check-circle" /> סגור
                </button>
              </div>
            </div>
          )}
          {successAlert && resultMode !== 'success' && (
            <div className="assign-auto__success">
              <i className="fa fa-check-circle" />
              <span>שיבוץ אוטומטי לשכבה בוצע בהצלחה!</span>
            </div>
          )}

          {/* Pre-check details modal — opens when user clicks "ראה עוד" on
              the feasibility hint. Lists all reasons the auto-assign might
              fail, grouped by kind, with clear actionable copy. */}
          {showPreCheckDetails && (() => {
            const KIND_META: Record<string, { title: string; icon: string; tone: 'class' | 'teacher' | 'freeday' }> = {
              class_over_demand: {
                title: 'כיתות עם דרישת שעות מעבר לקיבולת בית-הספר',
                icon: 'fa-school',
                tone: 'class',
              },
              class_under_demand: {
                title: 'כיתות שב"הגדרות כיתות ומורים" חסרות שעות מול קיבולת',
                icon: 'fa-school',
                tone: 'class',
              },
              hakbatza_imbalance: {
                title: 'הקבצות עם שעות לא הגיוניות (CT.Hour > היקף הקבצה)',
                icon: 'fa-balance-scale',
                tone: 'class',
              },
              teacher_over_demand: {
                title: 'מורים שצריכים יותר שעות מהזמין להם',
                icon: 'fa-user-clock',
                tone: 'teacher',
              },
              class_freeday_overload: {
                title: 'כיתות עם יותר מדי מורים בעלי אותו יום חופש',
                icon: 'fa-calendar-times-o',
                tone: 'freeday',
              },
              class_freeday_capacity_squeeze: {
                title: 'כיתות עם דחיסת יום חופש (מורים בעלי יום חופש דורשים יותר מהזמין בשאר הימים)',
                icon: 'fa-calendar-times-o',
                tone: 'freeday',
              },
              hakbatza_freeday_split: {
                title: 'הקבצות עם ימי חופש לא-מסונכרנים בין מורים',
                icon: 'fa-calendar-times-o',
                tone: 'freeday',
              },
            };
            const grouped = ([
              'class_over_demand',
              'class_under_demand',
              'hakbatza_imbalance',
              'teacher_over_demand',
              'class_freeday_overload',
              'class_freeday_capacity_squeeze',
              'hakbatza_freeday_split',
            ] as const)
              .map((kind) => ({ kind, items: preCheckIssues.filter((i) => i.Kind === kind) }))
              .filter((g) => g.items.length > 0);
            return (
              <div
                className="assign-success-modal"
                role="dialog"
                aria-modal="true"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setShowPreCheckDetails(false);
                }}
              >
                <div className="precheck-modal">
                  <div className="precheck-modal__header">
                    <span className="precheck-modal__icon" aria-hidden="true">
                      <i className="fa fa-exclamation-triangle" />
                    </span>
                    <div className="precheck-modal__head-text">
                      <div className="precheck-modal__title">בעיות פוטנציאליות בשיבוץ</div>
                      <div className="precheck-modal__sub">
                        זוהו {preCheckIssues.length}{' '}
                        {preCheckIssues.length === 1 ? 'בעיה שעלולה' : 'בעיות שעלולות'} למנוע שיבוץ מלא — סקירה לפני ההפעלה
                      </div>
                    </div>
                    <button
                      type="button"
                      className="precheck-modal__close"
                      onClick={() => setShowPreCheckDetails(false)}
                      aria-label="סגור"
                    >
                      <i className="fa fa-times" />
                    </button>
                  </div>
                  <div className="precheck-modal__body">
                    {grouped.map(({ kind, items }) => {
                      const meta = KIND_META[kind] ?? { title: kind, icon: 'fa-info-circle', tone: 'class' as const };
                      return (
                        <section key={kind} className={`precheck-section precheck-section--${meta.tone}`}>
                          <header className="precheck-section__head">
                            <span className="precheck-section__icon" aria-hidden="true">
                              <i className={`fa ${meta.icon}`} />
                            </span>
                            <span className="precheck-section__title">{meta.title}</span>
                            <span className="precheck-section__count">{items.length}</span>
                          </header>
                          <ul className="precheck-section__list">
                            {items.map((it, i) => (
                              <li key={i} className="precheck-section__item">
                                <span className="precheck-section__label">{it.Label}</span>
                                <span className="precheck-section__detail">{it.Detail}</span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                  <div className="precheck-modal__footer">
                    <span className="precheck-modal__hint">
                      ניתן להפעיל את השיבוץ למרות זאת — הוא יחזיר דוח חוסרים בסוף
                    </span>
                    <button
                      type="button"
                      className="precheck-modal__close-btn"
                      onClick={() => setShowPreCheckDetails(false)}
                    >
                      סגור
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Free-day conflict resolver — opened automatically before doAssign
              when a class has 3+ teachers sharing the same FreeDay. */}
          {showConflictsModal && freeDayConflicts.length > 0 && (() => {
            // Per-class map of conflict days, so we can detect when a
            // resolution's new day would just rebuild the wall on another day.
            const conflictDaysByClass = new Map<number, Set<number>>();
            // Map TeacherId -> set of ClassIds the teacher appears in across
            // all conflict CSVs. Used to simulate cross-class side-effects of
            // a single FreeDay move.
            const teacherClasses = new Map<number, Set<number>>();
            for (const c of freeDayConflicts) {
              let set = conflictDaysByClass.get(c.ClassId);
              if (!set) { set = new Set(); conflictDaysByClass.set(c.ClassId, set); }
              set.add(c.FreeDay);
              for (const t of parseTeachersCsv(c.TeachersCsv)) {
                let cs = teacherClasses.get(t.id);
                if (!cs) { cs = new Set(); teacherClasses.set(t.id, cs); }
                cs.add(c.ClassId);
              }
            }
            const actionableConflicts = freeDayConflicts.filter(
              (c) => parseTeachersCsv(c.TeachersCsv).length > 0,
            );

            // Per-class set of teachers known from any conflict CSV — best
            // approximation of "teachers who teach this class" with current
            // data. (A teacher with no FreeDay won't appear here, which is
            // fine: they don't contribute to any wall.)
            const teachersPerClass = new Map<number, Set<number>>();
            for (const c of freeDayConflicts) {
              let set = teachersPerClass.get(c.ClassId);
              if (!set) { set = new Set(); teachersPerClass.set(c.ClassId, set); }
              for (const t of parseTeachersCsv(c.TeachersCsv)) set.add(t.id);
            }

            // Live feasibility — runs on every render (so it's "in parallel"
            // from the user's POV: it never blocks input). Computes the final
            // FreeDay per teacher (last write wins, matching server) then
            // recounts off-teachers per (class, day) from scratch and flags
            // any pair at 3+. Catches the case where the user lines up every
            // resolution on the same new day, which the previous delta-based
            // approach missed because that day wasn't tracked initially.
            type Status = 'pending' | 'ok' | 'fail';
            type Wall = { classId: number; className: string; day: number; count: number };
            const computeStatusAndWalls = (): { status: Status; walls: Wall[] } => {
              if (actionableConflicts.length === 0) return { status: 'pending', walls: [] };
              for (const c of actionableConflicts) {
                const r = conflictResolutions.get(`${c.ClassId}_${c.FreeDay}`);
                if (!r || r.teacherId <= 0) return { status: 'pending', walls: [] };
              }

              const finalFreeDay = new Map<number, number>();
              // Seed with each teacher's original FreeDay (the conflict day
              // they appear on).
              for (const c of freeDayConflicts) {
                for (const t of parseTeachersCsv(c.TeachersCsv)) {
                  finalFreeDay.set(t.id, c.FreeDay);
                }
              }
              // Apply resolutions; later writes overwrite earlier ones to
                // mirror server behavior.
              for (const [, r] of conflictResolutions) {
                if (r.teacherId > 0) finalFreeDay.set(r.teacherId, r.newFreeDay);
              }

              const postCounts = new Map<string, number>();
              for (const [classId, tids] of teachersPerClass) {
                for (const tid of tids) {
                  const d = finalFreeDay.get(tid);
                  if (d === undefined || d === 0) continue;
                  const key = `${classId}_${d}`;
                  postCounts.set(key, (postCounts.get(key) ?? 0) + 1);
                }
              }

              // אסוף את כל ה-walls שנשארו (count >= 3) עם שם הכיתה והיום
              const classNameById = new Map<number, string>();
              for (const c of freeDayConflicts) classNameById.set(c.ClassId, c.ClassName);

              const walls: Wall[] = [];
              for (const [k, count] of postCounts) {
                if (count >= 3) {
                  const [cid, d] = k.split('_').map(Number);
                  walls.push({
                    classId: cid,
                    className: classNameById.get(cid) || `כיתה ${cid}`,
                    day: d,
                    count,
                  });
                }
              }
              walls.sort((a, b) => b.count - a.count);
              return { status: walls.length > 0 ? 'fail' : 'ok', walls };
            };
            const { status, walls: remainingWalls } = computeStatusAndWalls();
            const allReady = status === 'ok';
            // Show the auto-resolve button only after the user has touched
            // a select. We compare the current resolutions to the snapshot
            // taken when the modal opened.
            const userTouched = (() => {
              if (initialResolutions.size === 0) return false;
              for (const [k, cur] of conflictResolutions) {
                const snap = initialResolutions.get(k);
                if (!snap) return true;
                if (snap.teacherId !== cur.teacherId) return true;
                if (snap.newFreeDay !== cur.newFreeDay) return true;
              }
              return false;
            })();
            return (
            <div
              className="assign-success-modal"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setShowConflictsModal(false);
              }}
            >
              <div className="assign-conflicts-modal__card">
                <div className={`assign-conflicts-modal__header assign-conflicts-modal__header--${status}`}>
                  <span className="assign-conflicts-modal__header-icon" aria-hidden="true">
                    <i className={`fa ${status === 'ok' ? 'fa-check' : status === 'fail' ? 'fa-times' : 'fa-exclamation-triangle'}`} />
                  </span>
                  <span className="assign-conflicts-modal__header-text">
                    <span className="assign-conflicts-modal__header-title">
                      {status === 'ok' && 'הכל מוכן — השיבוץ יצליח'}
                      {status === 'fail' && 'הבחירה הנוכחית לא תאפשר שיבוץ מלא'}
                      {status === 'pending' && 'התנגשות יום חופשי — דרושה החלטה'}
                    </span>
                    <span className="assign-conflicts-modal__header-sub">
                      {status === 'ok' && 'כל הקונפליקטים פתורים בצורה שלא תיצור קיר חדש בכיתה.'}
                      {status === 'fail' && remainingWalls.length > 0 && (() => {
                        const top = remainingWalls.slice(0, 2);
                        const more = remainingWalls.length - top.length;
                        const list = top.map(w =>
                          `${w.className} ביום ${DAY_NAMES[w.day - 1] || w.day} (${w.count} מורים)`
                        ).join(', ');
                        return `נשאר קיר ב-${list}${more > 0 ? ` ועוד ${more}` : ''}. בחר יום אחר או "ללא יום חופשי" כדי לפזר.`;
                      })()}
                      {status === 'pending' && 'הימים החלופיים נבחרו אוטומטית. ניתן לעדכן ידנית.'}
                    </span>
                  </span>
                  {userTouched && (
                    <button
                      type="button"
                      className="assign-conflicts-modal__header-action"
                      onClick={async () => {
                        const ok = await autoResolveFreeDays();
                        if (ok) {
                          if (pendingFlowRef.current === 'fixGaps') {
                            pendingFlowRef.current = 'assign';
                            await runFixGapsFlow();
                          } else {
                            await runAssignFlow();
                          }
                        }
                      }}
                      disabled={autoResolveBusy}
                      title="פתרון אוטומטי של כל ההתנגשויות והפעלת השיבוץ"
                    >
                      {autoResolveBusy ? (
                        <><i className="fa fa-spinner fa-spin" /> משבץ…</>
                      ) : (
                        <><i className="fa fa-magic" /> שבץ ימים חופשיים</>
                      )}
                    </button>
                  )}
                  <span className="assign-conflicts-modal__header-badge">
                    {status === 'ok' && (<><i className="fa fa-check-circle" /> מוכן</>)}
                    {status === 'fail' && (<><i className="fa fa-exclamation-circle" /> לא תקין</>)}
                    {status === 'pending' && (<>בודק…</>)}
                  </span>
                </div>
                <div className="assign-conflicts-modal__body">
                  {/* Hint banner - הסבר ברור על הבעיה */}
                  <div className="assign-conflicts-modal__hint">
                    <i className="fa fa-lightbulb-o" />
                    <div>
                      <strong>איך פותרים?</strong>{' '}
                      בכל כיתה שמסומנת באדום/כתום, ה<strong>מורה הראשון ברשימה</strong>{' '}
                      (מסומן ב-<i className="fa fa-star" style={{ color: '#22c55e', fontSize: 11 }} /> "מומלץ")
                      הוא ההצעה הטובה ביותר להעברה ליום אחר.
                      ההצעה נבחרה כדי להסיר את הקיר עם הכי פחות נזק לכיתות אחרות.
                      <br />
                      <strong>סדר הטיפול:</strong> הכיתות מסודרות מהקריטיות ביותר (אדום) למינוריות.
                      תן עדיפות לפתרון של הקריטיות.
                    </div>
                  </div>

                  {/* רשימת קונפליקטים מסודרת לפי חומרה (TeacherCount יורד) */}
                  {[...freeDayConflicts]
                    .sort((a, b) => b.TeacherCount - a.TeacherCount)
                    .map((c) => {
                    const key = `${c.ClassId}_${c.FreeDay}`;
                    const teachers = parseTeachersCsv(c.TeachersCsv);
                    const res = conflictResolutions.get(key);
                    // Edge case: SP returned a conflict but the teachers CSV
                    // was empty/garbled. Show the row so the user knows about
                    // the data integrity issue, but skip the form.
                    if (teachers.length === 0) {
                      return (
                        <div key={key} className="assign-conflict-row">
                          <div className="assign-conflict-row__title">
                            כיתה <strong>{c.ClassName}</strong> — התנגשות ביום{' '}
                            <strong>{DAY_NAMES[c.FreeDay - 1] || c.FreeDay}</strong>
                          </div>
                          <div
                            className="assign-conflict-row__form"
                            style={{ color: '#7c2d12', fontSize: 13 }}
                          >
                            <i className="fa fa-warning" />
                            <span>לא ניתן לפתור אוטומטית — חסרים נתוני המורים בכיתה. בדוק את "הגדרות כיתות ומורים".</span>
                          </div>
                        </div>
                      );
                    }
                    // דירוג חומרה: 7+ קריטי, 5-6 גבוה, 3-4 בינוני
                    const severity = c.TeacherCount >= 7 ? 'critical'
                                  : c.TeacherCount >= 5 ? 'high'
                                  : 'medium';
                    const severityLabel = severity === 'critical' ? 'קריטי'
                                       : severity === 'high' ? 'דחוף'
                                       : 'בינוני';
                    const severityClass = severity === 'critical' ? 'high'
                                       : severity === 'high' ? 'high'
                                       : 'medium';
                    const recommendedTeacherId = res?.teacherId ?? teachers[0]?.id ?? 0;
                    const recommendedTeacher = teachers.find((t) => t.id === recommendedTeacherId);
                    return (
                      <div key={key} className={`assign-conflict-row${severity === 'critical' ? ' assign-conflict-row--critical' : ''}`}>
                        <div className="assign-conflict-row__title">
                          <span>
                            כיתה <strong>{c.ClassName}</strong> — יש{' '}
                            <strong>{c.TeacherCount} מורים</strong> עם יום חופשי ב
                            <strong>יום {DAY_NAMES[c.FreeDay - 1] || c.FreeDay}</strong>
                          </span>
                          <span className={`assign-conflict-row__severity assign-conflict-row__severity--${severityClass}`}>
                            <i className={`fa ${severity === 'critical' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}`} />
                            {severityLabel}
                          </span>
                        </div>

                        {recommendedTeacher && (
                          <div className="assign-conflict-row__hint">
                            <i className="fa fa-info-circle" />
                            <strong>{recommendedTeacher.name}</strong> הוא המורה הקריטי כאן —
                            העברתו ליום אחר תוריד את העומס ב-{c.ClassName} מ-{c.TeacherCount} ל-{c.TeacherCount - 1} מורים חופשיים באותו יום.
                          </div>
                        )}

                        <div className="assign-conflict-row__form">
                          <span>נעביר את:</span>
                          <select
                            className="form-control"
                            value={res?.teacherId ?? recommendedTeacherId}
                            onChange={(e) => {
                              const tid = Number(e.target.value);
                              const next = new Map(conflictResolutions);
                              next.set(key, { teacherId: tid, newFreeDay: res?.newFreeDay ?? 0 });
                              setConflictResolutions(next);
                            }}
                          >
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}{t.id === recommendedTeacherId ? ' ⭐ מומלץ' : ''}
                              </option>
                            ))}
                          </select>
                          <span>ליום:</span>
                          <select
                            className="form-control"
                            value={res?.newFreeDay ?? 0}
                            onChange={(e) => {
                              const d = Number(e.target.value);
                              const next = new Map(conflictResolutions);
                              next.set(key, { teacherId: res?.teacherId ?? recommendedTeacherId, newFreeDay: d });
                              setConflictResolutions(next);
                            }}
                          >
                            <option value={0}>— ללא יום חופשי —</option>
                            {[1, 2, 3, 4, 5].filter((d) => d !== c.FreeDay).map((d) => (
                              <option key={d} value={d}>{DAY_NAMES[d - 1]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="assign-conflicts-modal__footer">
                  <span className="assign-conflicts-modal__footer-info">
                    {freeDayConflicts.length} {freeDayConflicts.length === 1 ? 'התנגשות' : 'התנגשויות'} לפתרון
                  </span>
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={() => setShowConflictsModal(false)}
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={async () => {
                      // Skip is destructive — the assign will run with the
                      // conflict in place and almost certainly come back with
                      // empty cells. Force a confirm.
                      const ok = window.confirm(
                        'דילוג על ההתנגשויות יוביל כמעט בוודאות לשיבוץ חלקי בלבד.\n\nלהמשיך בכל זאת?',
                      );
                      if (!ok) return;
                      setShowConflictsModal(false);
                      if (pendingFlowRef.current === 'fixGaps') {
                        pendingFlowRef.current = 'assign';
                        await runFixGapsFlow();
                      } else {
                        await runAssignFlow();
                      }
                    }}
                  >
                    <i className="fa fa-fast-forward" /> דלג ושבץ בכל זאת
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={status === 'fail' || status === 'pending'}
                    title={
                      status === 'fail'
                        ? 'הבחירה הנוכחית עוד לא פותרת — תקן את ההתנגשויות שמסומנות באדום'
                        : status === 'pending'
                        ? 'נא לבחור פתרון לכל ההתנגשויות'
                        : ''
                    }
                    onClick={async () => {
                      // Validate: every actionable conflict (i.e. one that has
                      // at least one teacher in the CSV) must have a chosen
                      // resolution. Otherwise we'd silently skip it and the
                      // assignment would still fail.
                      const actionable = freeDayConflicts.filter(
                        (c) => parseTeachersCsv(c.TeachersCsv).length > 0,
                      );
                      const missing = actionable.filter((c) => {
                        const r = conflictResolutions.get(`${c.ClassId}_${c.FreeDay}`);
                        return !r || r.teacherId <= 0;
                      });
                      if (missing.length > 0) {
                        toast.warning(
                          `יש לבחור פתרון ל-${missing.length} ${missing.length === 1 ? 'התנגשות' : 'התנגשויות'} לפני שמירה.`,
                          { title: 'חסר פתרון' },
                        );
                        return;
                      }
                      // Apply per-row resolutions FIRST (those are the
                      // user's explicit choices, take priority).
                      const planned = new Map<number, number>();
                      for (const [, r] of conflictResolutions) {
                        if (r.teacherId > 0) planned.set(r.teacherId, r.newFreeDay);
                      }

                      // THEN synchronize each Hakbatza group — partners must
                      // share a FreeDay or the group can't run on any day
                      // where one member is off. Without this step every
                      // unresolved-by-user Hakbatza member kept whatever
                      // FreeDay they had before, leaving the schedule with
                      // the same empties even after "אשר ושבץ".
                      try {
                        type ClassRow = { ClassId: number; TeacherId: number | string | null; Hakbatza?: number | string | null; LayerId?: number | string | null; FreeDay?: number | string | null };
                        const layerData = await Promise.all(
                          [1, 2, 3, 4, 5, 6].map((lid) =>
                            ajax<ClassRow[]>('Class_GetClassByLayerId', { LayerId: lid }).catch(() => []),
                          ),
                        );
                        const groups = new Map<string, Map<number, number>>(); // gkey -> teacherId -> currentFreeDay
                        for (const rows of layerData) {
                          if (!Array.isArray(rows)) continue;
                          for (const row of rows) {
                            const tid = Number(row.TeacherId ?? 0);
                            const hak = Number(row.Hakbatza ?? 0);
                            const layerId = Number(row.LayerId ?? 0);
                            const fd = Number(row.FreeDay ?? 0);
                            if (!tid || !hak || !layerId) continue;
                            const gkey = `${layerId}_${hak}`;
                            let g = groups.get(gkey);
                            if (!g) { g = new Map(); groups.set(gkey, g); }
                            // Use the planned value if user already moved this
                            // teacher; otherwise the current Teacher.FreeDay.
                            g.set(tid, planned.has(tid) ? (planned.get(tid) ?? 0) : (Number.isFinite(fd) ? fd : 0));
                          }
                        }
                        for (const [, members] of groups) {
                          if (members.size <= 1) continue;
                          const freq = new Map<number, number>();
                          for (const day of members.values()) freq.set(day, (freq.get(day) ?? 0) + 1);
                          if (freq.size <= 1) continue;
                          let pickDay = 0; let bestCnt = -1;
                          for (const [day, cnt] of freq) {
                            if (cnt > bestCnt || (cnt === bestCnt && day === 0)) {
                              pickDay = day; bestCnt = cnt;
                            }
                          }
                          for (const tid of members.keys()) planned.set(tid, pickDay);
                        }
                      } catch (err) {
                        console.error('Hakbatza sync prep failed', err);
                      }

                      const promises: Promise<unknown>[] = [];
                      for (const [tid, day] of planned) {
                        promises.push(
                          ajax('Teacher_SetFreeDay', {
                            TeacherId: String(tid),
                            FreeDay: String(day),
                          }),
                        );
                      }
                      try {
                        await Promise.all(promises);
                        toast.success('ימי חופשי עודכנו (כולל סנכרון הקבצות), מבצע שיבוץ...');
                      } catch (err) {
                        console.error('Teacher_SetFreeDay failed', err);
                        toast.error('עדכון ימי חופשי נכשל');
                        return;
                      }
                      setShowConflictsModal(false);
                      // Re-fetch conflicts to refresh state, then run flow
                      await checkFreeDayConflicts();
                      if (pendingFlowRef.current === 'fixGaps') {
                        pendingFlowRef.current = 'assign';
                        await runFixGapsFlow();
                      } else {
                        await runAssignFlow();
                      }
                    }}
                  >
                    <i className="fa fa-check" /> אשר ושבץ
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

          {/* Unused-capacity banner — shown after a run when any teacher
              still has free working hours that didn't end up assigned. */}
          {successAlert && unusedHours.length > 0 && (() => {
            const totalUnused = unusedHours.reduce((sum, t) => sum + (t.UnusedHours ?? 0), 0);
            return (
              <div
                style={{
                  marginTop: 12,
                  background: '#fffbeb',
                  border: '1px solid #fcd34d',
                  borderRight: '4px solid #f59e0b',
                  borderRadius: 6,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <i
                    className="fa fa-clock-o"
                    style={{ fontSize: 22, color: '#b45309' }}
                    aria-hidden="true"
                  />
                  <div>
                    <div style={{ fontWeight: 700, color: '#92400e' }}>
                      שעות פנויות שלא נוצלו
                    </div>
                    <div style={{ fontSize: 13, color: '#78350f', marginTop: 2 }}>
                      <strong>{unusedHours.length}</strong>{' '}
                      {unusedHours.length === 1 ? 'מורה' : 'מורים'} עם סה״כ{' '}
                      <strong>{totalUnused}</strong> שעות עבודה שלא הופכו לשיבוץ
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-warning"
                  onClick={() => setShowUnusedHours(true)}
                >
                  <i className="fa fa-list-ul" /> הצג פירוט
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Unused-hours modal — full breakdown per teacher, grouped by day. */}
      {showUnusedHours && (
        <div
          className="modal"
          style={{
            display: 'block',
            background: 'rgba(0,0,0,0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1050,
            overflow: 'auto',
          }}
          onClick={() => setShowUnusedHours(false)}
        >
          <div
            className="modal-dialog modal-lg"
            style={{ direction: 'rtl', maxWidth: 800 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div
                className="modal-header"
                style={{ background: '#fffbeb', borderBottom: '2px solid #f59e0b' }}
              >
                <button
                  type="button"
                  className="close"
                  onClick={() => setShowUnusedHours(false)}
                  aria-label="Close"
                >
                  &times;
                </button>
                <h4 className="modal-title" style={{ color: '#92400e' }}>
                  <i className="fa fa-clock-o" /> שעות פנויות שלא נוצלו
                </h4>
              </div>
              <div className="modal-body">
                <div
                  className="alert"
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    color: '#78350f',
                    marginBottom: 15,
                  }}
                >
                  המורים הבאים הוגדרו עם שעות עבודה שלא הופכו לשיבוץ. ייתכן
                  שהדרישות בכיתות (ClassTeacher) פחותות מכמות השעות שהוגדרה,
                  או שהשעות מתנגשות עם שיבוצים אחרים.
                </div>

                {unusedHours.map((t) => {
                  const slots = splitUnusedHourIds(t.UnusedHourIds);
                  // Group slots by day for compact display.
                  const byDay = new Map<number, number[]>();
                  for (const s of slots) {
                    const arr = byDay.get(s.day) ?? [];
                    arr.push(s.hour);
                    byDay.set(s.day, arr);
                  }
                  const dayKeys = Array.from(byDay.keys()).sort((a, b) => a - b);
                  return (
                    <div
                      key={t.TeacherId}
                      style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: '10px 12px',
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 6,
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <strong style={{ fontSize: 15 }}>{t.TeacherName}</strong>
                        <span
                          style={{
                            background: '#fde68a',
                            color: '#78350f',
                            padding: '2px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {t.UnusedHours} שעות פנויות מתוך {t.DefinedHours}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#4b5563' }}>
                        {dayKeys.length === 0 ? (
                          <em>אין פירוט שעות</em>
                        ) : (
                          dayKeys.map((d) => (
                            <div key={d} style={{ marginBottom: 2 }}>
                              <span style={{ color: '#1f2937', fontWeight: 600 }}>
                                יום {DAY_NAMES[d - 1] || d}:
                              </span>{' '}
                              {byDay
                                .get(d)!
                                .sort((a, b) => a - b)
                                .map((h) => `שעה ${h}`)
                                .join(', ')}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setShowUnusedHours(false)}
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Diagnostic modal (new) */}
      {showDiagnostic && (
        <div
          className="modal"
          style={{
            display: 'block',
            background: 'rgba(0,0,0,0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1050,
            overflow: 'auto',
          }}
          onClick={() => setShowDiagnostic(false)}
        >
          <div
            className="modal-dialog modal-lg"
            style={{ direction: 'rtl', maxWidth: 900 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div
                className="modal-header"
                style={{ background: '#fff8e1', borderBottom: '2px solid #ffb74d' }}
              >
                <button
                  type="button"
                  className="close"
                  onClick={() => setShowDiagnostic(false)}
                  aria-label="Close"
                >
                  &times;
                </button>
                <h4 className="modal-title" style={{ color: '#e65100' }}>
                  <i className="fa fa-exclamation-triangle" /> השיבוץ הושלם חלקית - חוסרים
                </h4>
              </div>
              <div className="modal-body">
                <div className="alert alert-warning" style={{ marginBottom: 15 }}>
                  <strong>שובצו {savedCount} שעות</strong> מתוך{' '}
                  <strong>{savedCount + emptyCellsState}</strong>. לא ניתן היה לשבץ{' '}
                  <strong style={{ color: '#d32f2f' }}>{emptyCellsState}</strong> משבצות.
                </div>

                {/* Per-class summary — one card per class with missing slots.
                    Clicking "תקן" pre-selects the class in the recommendation
                    widget below so the deputy principal moves straight from
                    "this class is short N hours" to "give teacher Y +N
                    hours" in two clicks. */}
                {(() => {
                  // Group by class — only classes with REAL empty cells
                  // (errors[] returns per-empty-slot data). A diagnostic
                  // (T,C) miss without an empty cell means the schedule
                  // gave the slot to another teacher — visually the class
                  // looks "complete", so showing it under "חסר שיבוץ"
                  // would be misleading. We surface only true gaps.
                  type ClassMissEntry = {
                    classId: number;
                    className: string;
                    totalMissing: number;
                    teachers: Array<{ name: string; missing: number }>;
                  };
                  const map = new Map<number, ClassMissEntry>();
                  // Build cards from emptyCellsByClass — that's the live DB
                  // state, not the stale session-based `errors` list. Each
                  // class gets a card with its actual empty-cell count.
                  for (const [cid, hourIds] of emptyCellsByClass) {
                    if (hourIds.size === 0) continue;
                    const cls = allClasses.find((c) => c.ClassId === cid);
                    map.set(cid, {
                      classId: cid,
                      className: cls?.ClassName ?? String(cid),
                      totalMissing: hourIds.size,
                      teachers: [],
                    });
                  }
                  // Optionally annotate each class with the teachers from
                  // the diagnostic that are short there — purely advisory,
                  // helps the deputy principal know who they're "missing".
                  for (const r of diagnostic) {
                    const cid = Number(r.ClassId);
                    const miss = Number(r.Missing ?? 0);
                    if (!cid || miss <= 0) continue;
                    const entry = map.get(cid);
                    if (entry) entry.teachers.push({ name: String(r.TeacherName ?? ''), missing: miss });
                  }
                  // Also include classes with OVER-DEMAND (sum of
                  // ClassTeacher.Hour > grid capacity). These don't show
                  // up as empty cells — every cell is filled — but the
                  // demand can't physically fit. Surface them as cards
                  // with totalMissing = excess so the deputy principal
                  // sees that the issue is data, not algorithm.
                  if (classTeacherRows.length > 0 && allClasses.length > 0 && validHourIdsList.length > 0) {
                    const capPerClass = validHourIdsList.length;
                    const demandByClass = new Map<number, number>();
                    // Hakbatza/Ihud = MAX לכל קבוצה (כולם באותה שעה), סולו = ערך הרשומה
                    const groups = new Map<number, Map<string, number>>();
                    for (const r of classTeacherRows) {
                      if (!(r.Hour > 0)) continue;
                      const cid = r.ClassId;
                      const gk = r.Hakbatza
                        ? `H${r.Hakbatza}`
                        : r.Ihud
                          ? `I${r.Ihud}`
                          : `T${r.TeacherId}`;
                      let cMap = groups.get(cid);
                      if (!cMap) { cMap = new Map(); groups.set(cid, cMap); }
                      const prev = cMap.get(gk) ?? 0;
                      cMap.set(gk, gk[0] === 'T' ? prev + r.Hour : Math.max(prev, r.Hour));
                    }
                    for (const [cid, cMap] of groups) {
                      let sum = 0;
                      for (const [, h] of cMap) sum += h;
                      demandByClass.set(cid, sum);
                    }
                    for (const [cid, demand] of demandByClass) {
                      if (demand <= capPerClass) continue;
                      if (map.has(cid)) continue;
                      const cls = allClasses.find((c) => c.ClassId === cid);
                      map.set(cid, {
                        classId: cid,
                        className: cls?.ClassName ?? String(cid),
                        totalMissing: demand - capPerClass,
                        teachers: [],
                      });
                    }
                  }
                  const classCards = Array.from(map.values()).sort((a, b) => b.totalMissing - a.totalMissing);
                  if (classCards.length === 0) return null;
                  return (
                    <>
                      {/* When the run leaves 3+ classes short, the per-card
                          dropdown flow becomes tedious — point the deputy
                          principal at the broader "ניהול כיתות ומורים"
                          screen where they can adjust contracts in bulk. */}
                      {classCards.length >= 3 && (
                        <div className="missing-list__bulk-hint">
                          <div className="missing-list__bulk-hint-icon">
                            <i className="fa fa-lightbulb-o" />
                          </div>
                          <div className="missing-list__bulk-hint-text">
                            <strong>{classCards.length} כיתות עם חוסר שיבוץ</strong>
                            <span>מומלץ לטפל בכך מ-"ניהול כיתות ומורים" — אפשר לעדכן חוזים בכמה כיתות במקביל בלי להריץ את השיבוץ אחרי כל שינוי.</span>
                          </div>
                          <button
                            type="button"
                            className="missing-list__bulk-hint-btn"
                            onClick={() => {
                              setShowDiagnostic(false);
                              navigate('/Config/TeacherClass');
                            }}
                          >
                            <i className="fa fa-sitemap" />
                            <span>פתח ניהול כיתות ומורים</span>
                            <i className="fa fa-arrow-left" />
                          </button>
                        </div>
                      )}
                      <div className="missing-list">
                      {classCards.map((cc) => {
                        const tid = classRecTeacher.get(cc.classId) ?? 0;
                        const fillable = tid ? computeFillableHours(tid, cc.classId) : 0;
                        const existingCt = classTeacherRows.find(
                          (r) => r.TeacherId === tid && r.ClassId === cc.classId && r.ClassTeacherId > 0,
                        );
                        const currentHour = existingCt?.Hour ?? 0;
                        const newHour = currentHour + fillable;
                        const teacherInfo = allTeachers.find((t) => t.TeacherId === tid);
                        // teacherInfo unused after batch-apply consolidation but
                        // kept around in case the toast text needs it in the
                        // future; keep next to `existingCt` derivations.
                        void teacherInfo;
                        // Split teachers into two groups: those already
                        // contracted to this class (via ClassTeacher with any
                        // hour value, including hakbatza partners with Hour=0)
                        // and the rest. The default dropdown only shows the
                        // first group + a "ראה עוד מורים" option that flips
                        // showAll on.
                        const assignedTeacherIds = new Set<number>();
                        for (const r of classTeacherRows) {
                          if (r.ClassId === cc.classId) assignedTeacherIds.add(r.TeacherId);
                        }
                        const showAll = classShowAllTeachers.has(cc.classId);
                        const assignedOptions = allTeachers.filter((t) => assignedTeacherIds.has(t.TeacherId));
                        const otherOptions = allTeachers.filter((t) => !assignedTeacherIds.has(t.TeacherId));
                        return (
                          <div key={cc.classId} className="missing-list__card">
                            <div className="missing-list__card-header">
                              <div className="missing-list__card-header-icon">
                                <i className="fa fa-exclamation-circle" />
                              </div>
                              <div className="missing-list__card-header-text">
                                <span className="missing-list__card-header-class">{cc.className}</span>
                                <span className="missing-list__card-header-sub">חסרות {cc.totalMissing} שעות</span>
                              </div>
                              <span className="missing-list__card-header-count">{cc.totalMissing}</span>
                            </div>
                            {cc.teachers.length > 0 && (
                              <div className="missing-list__teachers">
                                {cc.teachers.map((t, idx) => (
                                  <span key={idx} className="missing-list__teacher-chip">
                                    {t.name} <span>·{t.missing}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="missing-list__form">
                              <div className="missing-list__field">
                                <label className="missing-list__label">בחר מורה</label>
                                <select
                                  className="missing-list__select"
                                  value={tid || ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '__more__') {
                                      // open up the full list — keep current selection unchanged
                                      setClassShowAllTeachers((prev) => {
                                        const next = new Set(prev);
                                        next.add(cc.classId);
                                        return next;
                                      });
                                      return;
                                    }
                                    const newTid = Number(v) || 0;
                                    setClassRecTeacher((prev) => {
                                      const next = new Map(prev);
                                      if (newTid === 0) next.delete(cc.classId);
                                      else next.set(cc.classId, newTid);
                                      return next;
                                    });
                                  }}
                                  disabled={allTeachers.length === 0}
                                >
                                  <option value="">— בחר מורה —</option>
                                  {assignedOptions.length > 0 && (
                                    <optgroup label="מורי הכיתה">
                                      {assignedOptions.map((t) => (
                                        <option key={t.TeacherId} value={t.TeacherId} className="missing-list__option missing-list__option--assigned">
                                          {t.FullName}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {!showAll && otherOptions.length > 0 && (
                                    <option value="__more__" className="missing-list__option missing-list__option--more">
                                      ראה עוד מורים ({otherOptions.length})…
                                    </option>
                                  )}
                                  {showAll && otherOptions.length > 0 && (
                                    <optgroup label="שאר המורים">
                                      {otherOptions.map((t) => (
                                        <option key={t.TeacherId} value={t.TeacherId} className="missing-list__option missing-list__option--other">
                                          {t.FullName}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                              </div>
                              <div className="missing-list__field">
                                <label className="missing-list__label">תוספת שעות</label>
                                <div className="missing-list__readout">
                                  {fillable > 0 ? (
                                    <strong className="missing-list__hours">{fillable}</strong>
                                  ) : tid ? (
                                    <span className="missing-list__hours-zero">המורה אינה זמינה במשבצות הריקות</span>
                                  ) : (
                                    <span className="missing-list__hours-zero">בחר מורה</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {tid > 0 && (() => {
                              const teacher = allTeachers.find((t) => t.TeacherId === tid);
                              if (!teacher) return null;
                              const currentLoad = classTeacherRows
                                .filter((r) => r.TeacherId === tid && r.Hour > 0)
                                .reduce((a, r) => a + r.Hour, 0);
                              const addAmount = fillable;
                              const newLoad = currentLoad + addAmount;
                              return (
                                <div className="missing-list__teacher-context">
                                  <i className="fa fa-info-circle" />
                                  <span>
                                    <strong>{teacher.FullName}</strong> מלמד/ת כיום{' '}
                                    <strong>{currentLoad}</strong> שעות פרונטלי
                                    {teacher.Frontaly > 0 && <> (מכסה {teacher.Frontaly})</>}.{' '}
                                    {addAmount > 0 && (
                                      <>בתוספת <strong>{addAmount}</strong> שעות יהיו <strong>{newLoad}</strong> שעות.</>
                                    )}
                                  </span>
                                </div>
                              );
                            })()}
                            {/* Inline mini-grid — sits inside the same card so
                                the deputy principal sees exactly which slot
                                of THIS class is empty next to the dropdown
                                that resolves it. */}
                            {(() => {
                              const dayHours = new Map<number, number[]>();
                              for (const hid of validHourIdsList) {
                                const day = Math.floor(hid / 10);
                                let arr = dayHours.get(day);
                                if (!arr) { arr = []; dayHours.set(day, arr); }
                                arr.push(hid);
                              }
                              const days = Array.from(dayHours.keys()).sort((a, b) => a - b);
                              const maxHours = dayHours.size > 0
                                ? Math.max(...Array.from(dayHours.values()).map((v) => v.length))
                                : 0;
                              const dayLabels = ['', 'א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\''];
                              const cellMap = classScheduleByClass.get(cc.classId) ?? new Map<number, string>();
                              const empties = emptyCellsByClass.get(cc.classId) ?? new Set<number>();
                              return (
                                <div className="missing-list__mini-grid missing-list__mini-grid--inline">
                                  <table className="missing-list__mini-grid-table">
                                    <thead>
                                      <tr>
                                        <th className="missing-list__mini-grid-corner" />
                                        {days.map((d) => (
                                          <th key={d} className="missing-list__mini-grid-dayhead">
                                            {dayLabels[d]}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Array.from({ length: maxHours }).map((_, hourIdx) => (
                                        <tr key={hourIdx}>
                                          <td className="missing-list__mini-grid-rowhead">{hourIdx + 1}</td>
                                          {days.map((d) => {
                                            const hid = dayHours.get(d)?.[hourIdx];
                                            if (hid === undefined) {
                                              return <td key={d} className="missing-list__mini-grid-cell missing-list__mini-grid-cell--na" />;
                                            }
                                            const isEmpty = empties.has(hid);
                                            const teacherName = cellMap.get(hid) ?? '';
                                            return (
                                              <td
                                                key={d}
                                                className={`missing-list__mini-grid-cell${isEmpty ? ' missing-list__mini-grid-cell--empty' : ''}`}
                                                title={isEmpty ? 'משבצת ריקה' : teacherName}
                                              >
                                                {isEmpty ? '—' : teacherName}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                      {/* Single batch-apply button — enabled only when EVERY
                          card has a valid teacher selected with fillable
                          hours > 0. One click commits all contract changes
                          and triggers a re-schedule. Placed BEFORE the
                          per-class mini-grids so the action is the next
                          thing the deputy principal hits after picking. */}
                      {(() => {
                        const allValid = classCards.length > 0 && classCards.every((cc) => {
                          const t = classRecTeacher.get(cc.classId) ?? 0;
                          return t > 0 && computeFillableHours(t, cc.classId) > 0;
                        });
                        return (
                          <div className="missing-list__batch">
                            <div className="missing-list__batch-info">
                              {allValid
                                ? `מוכן ליישם ${classCards.length} עדכוני חוזה — לחץ להחלה ושיבוץ מחדש`
                                : 'בחר מורה תקפה בכל כיתה כדי להפעיל את הכפתור'}
                            </div>
                            <button
                              type="button"
                              className="missing-list__batch-apply"
                              disabled={!allValid || batchApplyBusy}
                              onClick={async () => {
                                if (!allValid || batchApplyBusy) return;
                                setBatchApplyBusy(true);
                                try {
                                  for (const cc of classCards) {
                                    const tid = classRecTeacher.get(cc.classId) ?? 0;
                                    const fill = computeFillableHours(tid, cc.classId);
                                    if (!tid || fill <= 0) continue;
                                    const existingCt = classTeacherRows.find(
                                      (r) => r.TeacherId === tid && r.ClassId === cc.classId && r.ClassTeacherId > 0,
                                    );
                                    const currentHour = existingCt?.Hour ?? 0;
                                    await ajax('Class_SetTeacherToClass', {
                                      ClassId: cc.classId,
                                      TeacherId: tid,
                                      Hour: String(currentHour + fill),
                                      TargetHakbatza: '',
                                      SourceHakbatza: '',
                                      TargetIhud: '',
                                      SourceIhud: '',
                                      TargetClassTeacherId: '',
                                      SourceClassTeacherId: existingCt ? String(existingCt.ClassTeacherId) : '',
                                      Type: existingCt ? 4 : 2,
                                    });
                                  }
                                  toast.success(`עודכנו ${classCards.length} חוזים, מבצע שיבוץ מחדש...`);
                                  setShowDiagnostic(false);
                                  setAllTeachers([]);
                                  setClassRecTeacher(new Map());
                                  await runAssignFlow();
                                } catch (err) {
                                  console.error('batch apply failed', err);
                                  toast.error('שגיאה ביישום העדכונים');
                                } finally {
                                  setBatchApplyBusy(false);
                                }
                              }}
                            >
                              {batchApplyBusy ? (
                                <><i className="fa fa-spinner fa-spin" /> מיישם…</>
                              ) : (
                                'החל ושבץ'
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                    </>
                  );
                })()}

                {/* Standalone widget kept hidden — per-class inline forms
                    above replaced its role. Toggle if needed. */}
                {false && errors.length > 0 && allTeachers.length > 0 && (() => {
                  const classesWithEmpties = Array.from(new Set(errors.map((e) => Number(e.ClassId))))
                    .map((cid) => allClasses.find((c) => c.ClassId === cid))
                    .filter((c): c is ClassLite => !!c)
                    .sort((a, b) => a.ClassName.localeCompare(b.ClassName, 'he'));
                  const fillable = recTeacherId && recClassId
                    ? computeFillableHours(recTeacherId, recClassId)
                    : 0;
                  const existingCt = classTeacherRows.find(
                    (r) => r.TeacherId === recTeacherId && r.ClassId === recClassId
                          && r.ClassTeacherId > 0,
                  );
                  const currentHour = existingCt?.Hour ?? 0;
                  const newHour = currentHour + fillable;
                  const teacherInfo = allTeachers.find((t) => t.TeacherId === recTeacherId);
                  const classInfo = allClasses.find((c) => c.ClassId === recClassId);
                  return (
                    <div className="rec-widget">
                      <div className="rec-widget__header">
                        <span className="rec-widget__icon" aria-hidden="true">
                          <i className="fa fa-lightbulb-o" />
                        </span>
                        <div>
                          <div className="rec-widget__title">המלצה לתיקון</div>
                          <div className="rec-widget__sub">
                            הוסף שעות חוזה למורה בכיתה — המערכת תחשב כמה שעות אפשר לסגור עם הבחירה
                          </div>
                        </div>
                      </div>
                      <div className="rec-widget__body">
                        <div className="rec-widget__field">
                          <label className="rec-widget__label">מורה</label>
                          <select
                            className="rec-widget__select"
                            value={recTeacherId || ''}
                            onChange={(e) => setRecTeacherId(Number(e.target.value) || 0)}
                          >
                            <option value="">— בחר מורה —</option>
                            {allTeachers.map((t) => (
                              <option key={t.TeacherId} value={t.TeacherId}>
                                {t.FullName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="rec-widget__field">
                          <label className="rec-widget__label">כיתה</label>
                          <select
                            className="rec-widget__select"
                            value={recClassId || ''}
                            onChange={(e) => setRecClassId(Number(e.target.value) || 0)}
                          >
                            <option value="">— בחר כיתה —</option>
                            {classesWithEmpties.map((c) => (
                              <option key={c.ClassId} value={c.ClassId}>
                                {c.ClassName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="rec-widget__field">
                          <label className="rec-widget__label">שעות לסגירה</label>
                          <div className="rec-widget__readout">
                            {fillable > 0 ? (
                              <>
                                <strong className="rec-widget__hours">{fillable}</strong>
                                <span className="rec-widget__hours-detail">
                                  {currentHour > 0 && <>(מ-{currentHour} ל-{newHour})</>}
                                  {currentHour === 0 && <>(חוזה חדש)</>}
                                </span>
                              </>
                            ) : recTeacherId && recClassId ? (
                              <span className="rec-widget__hours-zero">אין משבצות שניתן לסגור עם זוג זה</span>
                            ) : (
                              <span className="rec-widget__hours-zero">בחר מורה וכיתה</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rec-widget__apply"
                          disabled={recBusy || fillable <= 0 || !recTeacherId || !recClassId}
                          onClick={async () => {
                            if (recBusy || fillable <= 0) return;
                            setRecBusy(true);
                            try {
                              await ajax('Class_SetTeacherToClass', {
                                ClassId: recClassId,
                                TeacherId: recTeacherId,
                                Hour: String(newHour),
                                TargetHakbatza: '',
                                SourceHakbatza: '',
                                TargetIhud: '',
                                SourceIhud: '',
                                TargetClassTeacherId: '',
                                SourceClassTeacherId: existingCt ? String(existingCt.ClassTeacherId) : '',
                                Type: existingCt ? 4 : 2,
                              });
                              toast.success(
                                `נוספו ${fillable} שעות ל-${teacherInfo?.FullName ?? ''} בכיתה ${classInfo?.ClassName ?? ''}, מבצע שיבוץ מחדש...`,
                              );
                              setShowDiagnostic(false);
                              setAllTeachers([]); // force reload after schedule
                              await runAssignFlow();
                            } catch (err) {
                              console.error('apply recommendation failed', err);
                              toast.error('שגיאה ביישום ההמלצה');
                            } finally {
                              setRecBusy(false);
                            }
                          }}
                        >
                          {recBusy ? (
                            <><i className="fa fa-spinner fa-spin" /> מיישם…</>
                          ) : (
                            <>החל המלצה ושבץ</>
                          )}
                        </button>
                      </div>
                      {fillable > 0 && teacherInfo && classInfo && (
                        <div className="rec-widget__preview">
                          <i className="fa fa-info-circle" />
                          הוספת <strong>{fillable}</strong> שעות ל-<strong>{teacherInfo.FullName}</strong>
                          {' '}בכיתה <strong>{classInfo.ClassName}</strong>
                          {' — '}
                          {currentHour > 0 ? <>חוזה יעלה מ-{currentHour} ל-{newHour}</> : <>יוצר חוזה חדש</>}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* The FreeDay conflicts modal is only useful when there
                    are actually FreeDay-driven blockers — either real walls
                    (the strict pre-assign check has rows) OR Hakbatza groups
                    with mismatched FreeDays among diagnostic members. After
                    the auto-resolve sync runs, neither condition holds and
                    showing the button just confused the user. */}
                {(() => {
                  const hakDays = new Map<number, Set<number>>();
                  for (const r of diagnostic) {
                    if (r.Hakbatza > 0) {
                      let s = hakDays.get(r.Hakbatza);
                      if (!s) { s = new Set(); hakDays.set(r.Hakbatza, s); }
                      s.add(r.FreeDay || 0);
                    }
                  }
                  const hakHasMismatch = Array.from(hakDays.values()).some((s) => s.size > 1);
                  const freeDayShortage = diagnostic.some(
                    (r) => r.FreeDay > 0 && r.TotalRequiredAllClasses > r.AvailableHourSlots,
                  );
                  return (freeDayConflicts.length > 0 || hakHasMismatch || freeDayShortage);
                })() && (
                  <div
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderInlineStart: '4px solid #2563eb',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 15,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <i className="fa fa-calendar-times-o" style={{ color: '#2563eb', fontSize: 18 }} />
                    <span style={{ flex: 1, color: '#1e3a8a', fontSize: 13 }}>
                      חלק מהחוסרים מקורם בהתנגשות יום חופשי או הקבצה. פתח את מודאל ההתנגשויות כדי לסנכרן ימי חופש (המודאל בודק התנגשויות רכות החל מ-2 מורים).
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        // First try the strict (>=3) check — that's what the
                        // pre-assign banner uses, so we don't silently widen
                        // the definition unless we actually need to.
                        let list = await checkFreeDayConflicts();
                        if (list.length === 0) {
                          // Fall back to soft conflicts (>=2), specifically
                          // for the post-failure path. Many real Hakbatza
                          // FreeDay mismatches sit at exactly 2 teachers.
                          try {
                            const soft = await ajax<typeof list>(
                              'Class_GetFreeDayConflicts', { MinTeachers: 2 },
                            );
                            list = Array.isArray(soft) ? soft : [];
                            setFreeDayConflicts(list);
                          } catch {
                            list = [];
                          }
                        }
                        if (list.length === 0) {
                          toast.warning('לא נמצאו התנגשויות יום חופשי פעילות בנתונים. בדוק את "ניהול מורים" — ייתכן שיש לבטל יום חופש או לסנכרן הקבצה ידנית.');
                          return;
                        }
                        setShowDiagnostic(false);
                        openConflictModalNow(list);
                      }}
                    >
                      פתח מודאל התנגשויות יום חופשי
                    </button>
                  </div>
                )}

                {/* Per-slot failure list — shown when diagnostic has no
                    teacher-level rows but there ARE empty cells. The
                    backend attaches a reason string to every unassigned
                    slot (candidate count, consecutive blocks, hakbatza
                    conflicts, etc.) via AnalyzeWhyNotAssigned. */}
                {diagnostic.length === 0 && errors.length > 0 && (() => {
                  const DAY_NAMES = ['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
                  const byClass = new Map<number, { name: string; items: ShibutzErrorRow[] }>();
                  for (const e of errors) {
                    if (!e.ClassId) continue;
                    const entry = byClass.get(e.ClassId);
                    if (entry) entry.items.push(e);
                    else byClass.set(e.ClassId, { name: e.ClassName, items: [e] });
                  }
                  const classList = Array.from(byClass.entries()).sort((a, b) =>
                    a[1].name.localeCompare(b[1].name, 'he'),
                  );
                  return (
                    <div
                      className="alert"
                      style={{
                        marginBottom: 15,
                        background: '#fff7ed',
                        border: '1px solid #fdba74',
                        borderLeft: '4px solid #ea580c',
                        padding: 12,
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: 8, color: '#9a3412' }}>
                        <i className="fa fa-list-ul" style={{ marginLeft: 6 }} />
                        משבצות שלא שובצו — {errors.length} סה״כ:
                      </strong>
                      <div style={{ maxHeight: 320, overflowY: 'auto', paddingInlineEnd: 4 }}>
                        {classList.map(([cid, { name, items }]) => (
                          <details
                            key={cid}
                            open={classList.length <= 3}
                            style={{ marginBottom: 6, background: '#fff', borderRadius: 6, border: '1px solid #fed7aa', padding: '6px 10px' }}
                          >
                            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#7c2d12' }}>
                              {name}{' '}
                              <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 12 }}>
                                ({items.length} משבצות)
                              </span>
                            </summary>
                            <ul style={{ marginTop: 6, marginBottom: 0, paddingInlineStart: 18, fontSize: 13 }}>
                              {items.map((it, idx) => (
                                <li key={idx} style={{ marginBottom: 4, lineHeight: 1.5 }}>
                                  <span style={{ color: '#9a3412', fontWeight: 600 }}>
                                    יום {DAY_NAMES[it.Day] || it.Day} · שעה {it.Hour}
                                  </span>
                                  {it.Message && (
                                    <span style={{ color: '#4b5563' }}> — {it.Message}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  // FreeDay-related issues: teachers whose required hours
                  // exceed available because of their free day. Show this
                  // BEFORE other capacity warnings so the user understands
                  // the root cause (a free day removes ~6 slots from the
                  // available pool).
                  const freeDayIssues = Array.from(
                    new Map(
                      diagnostic
                        .filter((r) =>
                          r.FreeDay > 0
                          && r.TotalRequiredAllClasses > r.AvailableHourSlots,
                        )
                        .map((r) => [r.TeacherId, r]),
                    ).values(),
                  );
                  if (freeDayIssues.length === 0) return null;
                  return (
                    <div
                      className="alert"
                      style={{
                        marginBottom: 15,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderLeft: '4px solid #dc2626',
                        padding: 12,
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ color: '#991b1b' }}>
                          <i className="fa fa-calendar-times-o" /> בעיות יום חופשי — סיבה ראשונה לחוסרים:
                        </strong>
                      </div>
                      <ul style={{ marginBottom: 0, marginTop: 6, color: '#7f1d1d' }}>
                        {freeDayIssues.map((r) => {
                          const dayName = DAY_NAMES[r.FreeDay - 1] || `יום ${r.FreeDay}`;
                          const gap = r.TotalRequiredAllClasses - r.AvailableHourSlots;
                          return (
                            <li key={r.TeacherId} style={{ marginBottom: 6 }}>
                              <strong>{r.TeacherName}</strong> — יום חופשי: <strong>{dayName}</strong>.
                              דרושות <strong>{r.TotalRequiredAllClasses}</strong> שעות, אך זמינות רק{' '}
                              <strong>{r.AvailableHourSlots}</strong> שעות (חסרות{' '}
                              <strong>{gap}</strong>).
                              <br />
                              <span style={{ fontSize: 12, color: '#9f1239' }}>
                                💡 בטל את יום החופש או הקטן את מספר השעות הנדרשות.
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}

                {(() => {
                  // Hakbatza groups with conflicting free days — teachers
                  // sharing a hakbatza must teach the same hour, so distinct
                  // free days reduce the joint availability.
                  const hakFreeDayConflicts = new Map<
                    number,
                    { teachers: Set<string>; days: Set<number>; classNames: Set<string> }
                  >();
                  for (const r of diagnostic) {
                    if (r.Hakbatza > 0) {
                      let bucket = hakFreeDayConflicts.get(r.Hakbatza);
                      if (!bucket) {
                        bucket = { teachers: new Set(), days: new Set(), classNames: new Set() };
                        hakFreeDayConflicts.set(r.Hakbatza, bucket);
                      }
                      bucket.teachers.add(`${r.TeacherName} (${r.FreeDay > 0 ? DAY_NAMES[r.FreeDay - 1] : 'ללא'})`);
                      bucket.days.add(r.FreeDay || 0);
                      bucket.classNames.add(r.ClassName);
                    }
                  }
                  const conflicts = Array.from(hakFreeDayConflicts.entries()).filter(
                    ([, b]) => b.days.size > 1,
                  );
                  if (conflicts.length === 0) return null;
                  return (
                    <div
                      className="alert"
                      style={{
                        marginBottom: 15,
                        background: '#fff1f2',
                        border: '1px solid #fda4af',
                        borderLeft: '4px solid #be123c',
                        padding: 12,
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ color: '#9f1239' }}>
                          <i className="fa fa-users" /> התנגשות יום חופשי בהקבצה:
                        </strong>
                      </div>
                      <ul style={{ marginBottom: 0, marginTop: 6, color: '#881337' }}>
                        {conflicts.map(([hak, b]) => (
                          <li key={hak} style={{ marginBottom: 6 }}>
                            <strong>הקבצה {hak}</strong> ({Array.from(b.classNames).join(', ')}) —{' '}
                            ימי חופש שונים בין המורים: {Array.from(b.teachers).join(' · ')}.
                            <br />
                            <span style={{ fontSize: 12, color: '#9f1239' }}>
                              💡 ההקבצה לא יכולה לקבל את כל שעותיה — צריך לסנכרן יום חופשי בין החברים.
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {(() => {
                  const capacityIssues = diagnostic.filter(
                    (r) => r.TotalRequiredAllClasses > r.AvailableHourSlots,
                  );
                  const uniqueTeachers = Array.from(
                    new Map(capacityIssues.map((r) => [r.TeacherId, r])).values(),
                  );
                  if (uniqueTeachers.length === 0) return null;
                  return (
                    <div
                      className="alert alert-danger"
                      style={{ marginBottom: 15, borderLeft: '4px solid #d32f2f' }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <strong>
                          <i className="fa fa-user-times" /> חסרות שעות עבודה למורים:
                        </strong>
                      </div>
                      <ul style={{ marginBottom: 0, marginTop: 6 }}>
                        {uniqueTeachers.map((r) => {
                          const gap = r.TotalRequiredAllClasses - r.AvailableHourSlots;
                          const ghostHours = r.DefinedHourSlots - r.AvailableHourSlots;
                          return (
                            <li key={r.TeacherId} style={{ marginBottom: 8 }}>
                              <strong>{r.TeacherName}</strong>: דרושות{' '}
                              <strong>{r.TotalRequiredAllClasses}</strong> שעות שבועיות בכיתות.{' '}
                              מוגדרות <strong>{r.DefinedHourSlots}</strong> שעות עבודה,{' '}
                              {ghostHours > 0 ? (
                                <>
                                  אבל <strong>{ghostHours}</strong> מהן בשעות שלא קיימות בבית
                                  הספר — בפועל רק <strong>{r.AvailableHourSlots}</strong> שעות אמיתיות (חסרות{' '}
                                  <strong>{gap}</strong>).
                                </>
                              ) : (
                                <>
                                  יש <strong>{r.AvailableHourSlots}</strong> שעות אמיתיות (חסרות{' '}
                                  <strong>{gap}</strong>).
                                </>
                              )}
                              <br />
                              <button
                                type="button"
                                className="btn btn-xs btn-warning"
                                style={{ marginTop: 4 }}
                                onClick={() => {
                                  window.location.href = `/Config/TeacherHours?teacherId=${r.TeacherId}`;
                                }}
                              >
                                <i className="fa fa-edit" /> פתח הגדרת שעות של {r.TeacherName}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}
                {false && <table className="table table-bordered table-hover table-striped">
                  <thead>
                    <tr className="warning">
                      <th style={{ textAlign: 'center' }}>כיתה</th>
                      <th style={{ textAlign: 'center' }}>מורה</th>
                      <th style={{ textAlign: 'center' }}>דרוש</th>
                      <th style={{ textAlign: 'center' }}>שובץ</th>
                      <th style={{ textAlign: 'center' }}>חסר</th>
                      <th>המלצה</th>
                      <th style={{ textAlign: 'center', width: 130 }}>פעולה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Pre-compute which Hakbatza numbers actually have
                      // mismatched FreeDays across diagnostic members. After
                      // the auto-resolve sync runs, all members share a
                      // FreeDay — and "Hakbatza" is no longer the blocking
                      // reason. Without this gate the row tip falsely keeps
                      // blaming Hakbatza forever.
                      const hakDays = new Map<number, Set<number>>();
                      for (const dr of diagnostic) {
                        if (dr.Hakbatza > 0) {
                          let s = hakDays.get(dr.Hakbatza);
                          if (!s) { s = new Set(); hakDays.set(dr.Hakbatza, s); }
                          s.add(dr.FreeDay || 0);
                        }
                      }
                      const hakIsBlocking = (h: number) => (hakDays.get(h)?.size ?? 0) > 1;
                      return diagnostic.map((r, i) => {
                      const tips: string[] = [];
                      // Only blame Hakbatza when the group's members actually
                      // have mismatched FreeDays — the schedule blocker. Once
                      // members are aligned (post-sync), being in a Hakbatza
                      // is no longer a reason for the missing slot.
                      if (r.Hakbatza > 0 && hakIsBlocking(r.Hakbatza)) {
                        tips.push(
                          `הקבצה ${r.Hakbatza} — סנכרן ימי חופש בין החברים`,
                        );
                      }
                      if (r.IsHomeroom === 1) {
                        tips.push('מחנכ/ת — שעות נעולות לפעמים בשעה הראשונה');
                      }
                      // Only flag FreeDay when the math actually says it
                      // hurts: required hours exceed available hours.
                      const freeDayCausesShortage =
                        r.FreeDay > 0 && r.TotalRequiredAllClasses > r.AvailableHourSlots;
                      if (freeDayCausesShortage) {
                        tips.push(
                          `יום חופש (${DAY_NAMES[r.FreeDay - 1] || r.FreeDay}) חוסם — בטל את היום או הוסף שעות עבודה`,
                        );
                      } else if (r.TotalRequiredAllClasses > r.AvailableHourSlots) {
                        tips.push(
                          `הוסף שעות עבודה למורה (דרוש ${r.TotalRequiredAllClasses}, יש ${r.AvailableHourSlots})`,
                        );
                      }
                      if (tips.length === 0) {
                        // Fallback recommendations are intentionally short
                        // and action-focused — the deputy principal needs
                        // "what should I change" not a paragraph of theory.
                        const classHasEmpties = errors.some((e) => e.ClassId === r.ClassId);
                        if (classHasEmpties) {
                          tips.push(`הקטן את שעות המורה בכיתה ב-${r.Missing}, או הוסף שעות עבודה למורה`);
                        } else {
                          tips.push(`הכיתה מלאה — הקטן את שעות המורה ב-${r.Missing}, או החלף מורה אחר ב-${r.Missing} שעות`);
                        }
                      }
                      return (
                        <tr key={i}>
                          <td style={{ textAlign: 'center' }}>
                            <strong>{r.ClassName}</strong>
                          </td>
                          <td style={{ textAlign: 'right' }}>{r.TeacherName}</td>
                          <td style={{ textAlign: 'center' }}>{r.Required}</td>
                          <td style={{ textAlign: 'center' }}>{r.Assigned}</td>
                          <td style={{ textAlign: 'center', color: '#d32f2f', fontWeight: 'bold' }}>
                            {r.Missing}
                          </td>
                          <td>
                            <ul style={{ margin: 0, paddingRight: 18 }}>
                              {tips.map((t, k) => (
                                <li key={k}>{t}</li>
                              ))}
                            </ul>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-xs btn-warning"
                              style={{ whiteSpace: 'nowrap' }}
                              onClick={() => {
                                window.location.href = `/Config/TeacherHours?teacherId=${r.TeacherId}`;
                              }}
                              title="פתח את מסך שעות המורה כדי לתקן"
                            >
                              <i className="fa fa-edit" /> הגדר שעות
                            </button>
                          </td>
                        </tr>
                      );
                      });
                    })()}
                  </tbody>
                </table>}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-info"
                  onClick={() => setShowDiagnostic(false)}
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results modal — only in error/partial mode. The success branch is
          handled by the .assign-success-modal above; showing both at once
          double-popped the screen on a clean run. */}
      {showResults && resultMode !== 'success' && (
        <div
          className="modal"
          style={{
            display: 'block',
            background: 'rgba(0,0,0,0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1050,
            overflow: 'auto',
          }}
          onClick={() => setShowResults(false)}
        >
          <div
            className="modal-dialog modal-lg"
            style={{ direction: 'rtl' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header label-info">
                <button
                  type="button"
                  className="close"
                  onClick={() => setShowResults(false)}
                  aria-label="Close"
                >
                  &times;
                </button>
                <h4 className="modal-title">
                  {resultMode === 'success' ? (
                    <>
                      <i className="fa fa-check-circle" /> שיבוץ אוטומטי
                    </>
                  ) : (
                    <>
                      <i className="fa fa-exclamation-triangle" /> דוח שגיאות שיבוץ
                    </>
                  )}
                </h4>
              </div>
              <div className="modal-body">
                {resultMode === 'success' ? (
                  <div className="alert alert-success" style={{ textAlign: 'center', fontSize: 18 }}>
                    <strong>שיבוץ הושלם בהצלחה!</strong>
                    <br />
                    שובצו {savedCount} שעות
                  </div>
                ) : (
                  <>
                    <div className="alert alert-info" style={{ marginBottom: 15 }}>
                      <strong>סיכום:</strong> שובצו {savedCount} שעות,{' '}
                      {errorCount || errors.length} שגיאות
                    </div>
                    <table className="table table-bordered table-hover table-striped">
                      <thead>
                        <tr className="danger">
                          <th style={{ textAlign: 'center', width: 80 }}>כיתה</th>
                          <th style={{ textAlign: 'center', width: 100 }}>יום</th>
                          <th style={{ textAlign: 'center', width: 80 }}>שעה</th>
                          <th>סיבת השגיאה</th>
                          <th style={{ textAlign: 'center', width: 200 }}>
                            מורים שחסרים שעות
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {errors.length > 0 ? (
                          errors.map((err, i) => {
                            const dayName = DAY_NAMES[err.Day - 1] || 'יום ' + err.Day;
                            const className = err.ClassName || 'כיתה ' + err.ClassId;
                            return (
                              <tr key={i}>
                                <td style={{ textAlign: 'center' }}>
                                  <strong>{className}</strong>
                                </td>
                                <td style={{ textAlign: 'center' }}>{dayName}</td>
                                <td style={{ textAlign: 'center' }}>{err.Hour}</td>
                                <td style={{ direction: 'rtl', textAlign: 'right' }}>
                                  {err.Message}
                                </td>
                                <td style={{ direction: 'rtl', textAlign: 'right' }}>
                                  {err.TeachersMissingHours || 'אין'}
                                </td>
                              </tr>
                            );
                          })
                        ) : errorCount > 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center' }}>
                              השרת דיווח על {errorCount} שגיאות, אך הפרטים לא התקבלו.
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center' }}>
                              לא שובצו שעות ולא דווחו שגיאות. ייתכן שיש בעיה בתהליך השיבוץ.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className={
                    resultMode === 'success' ? 'btn btn-success' : 'btn btn-info'
                  }
                  onClick={() => setShowResults(false)}
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeletion !== -1 && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDeletion(-1);
          }}
        >
          <div className="confirm-modal__card">
            <div className="confirm-modal__icon">
              <i className="fa fa-exclamation-triangle" />
            </div>
            <h3 className="confirm-modal__title">מחיקת השיבוץ של מערכת בית הספר</h3>
            <p className="confirm-modal__text">
              פעולה זו תמחק את כל השיבוצים של הכיתות במערכת. <br />
              <strong>הערה:</strong> שעות העבודה של המורים (ניהול מורים) והדרישות (ClassTeacher) יישמרו.
              <br /><br />
              האם להמשיך?
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setConfirmDeletion(-1)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={executeDeletion}
                autoFocus
              >
                <i className="fa fa-trash" /> מחק לצמיתות
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
