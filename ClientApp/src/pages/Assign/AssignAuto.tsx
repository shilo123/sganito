import { useState, useEffect } from 'react';
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
  Ihud: number;
  FreeDay: number;
  IsHomeroom: number;
  TotalRequiredAllClasses: number;
  DefinedHourSlots: number;        // total TeacherHours rows (may include hours not in SchoolHours)
  AvailableHourSlots: number;      // actual hours usable for teaching (SchoolHours intersection)
}

type DeleteType = -1 | 0 | 1;

// ---- Constants ----

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ---- Component ----

export default function AssignAuto() {
  const toast = useToast();
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
  // Authoritative count of empty cells in the grid (from DB) — shown in the
  // diagnostic dialog. Can differ from diagnostic.length (unmet ClassTeacher
  // requirements) so we keep both and show emptyCellsState as the headline.
  const [emptyCellsState, setEmptyCellsState] = useState(0);

  // Busy flag for the in-dialog auto-fix button.
  const [recoveryBusy, setRecoveryBusy] = useState(false);

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

  // Report modal shown after "תקן שעות מורים אוטומטית" — lists each teacher
  // that had hours added, with the specific slots (day + hour).
  interface RecoveryReportEntry {
    TeacherId: number;
    TeacherName: string;
    IsHomeroom: boolean;
    Added: number;
    Required: number;
    HourIds: number[];
  }
  const [recoveryReport, setRecoveryReport] = useState<RecoveryReportEntry[] | null>(null);

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

  async function doAssign() {
    setSuccessAlert(false);
    setShowResults(false);
    setShowDiagnostic(false);
    setDiagnostic([]);
    setEmptyCellsState(0);
    setLoadingTitle('מבצע שיבוץ אוטומטי');
    setIsLoading(true);

    try {
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

      const diag = await fetchDiagnostic();
      setDiagnostic(diag);

      let emptyCells = 0;
      try {
        const es = await ajax<{ EmptySlots?: number }>('Assign_GetEmptySlotsCount');
        emptyCells = Number(es?.EmptySlots ?? 0);
      } catch {
        emptyCells = diag.length;
      }

      const result = await fetchShibutzErrors();
      setSavedCount(Math.max(0, result.savedCount));
      setErrors(result.errors);

      // Success when every ClassTeacher requirement is met. Empty cells in
      // the grid (no demand from ClassTeacher) are normal — they correspond
      // to break/recess/free periods, NOT to scheduling failures.
      const fullyComplete = diag.length === 0;

      setIsLoading(false);

      if (fullyComplete) {
        setResultMode('success');
        setShowResults(true);
        setSuccessAlert(true);
      } else {
        setEmptyCellsState(emptyCells);
        setErrorCount(emptyCells);
        setShowDiagnostic(true);
        setSuccessAlert(true);
      }
    } catch (e) {
      console.error('Assign_ShibutzAuto failed', e);
      toast.error('אירעה שגיאה בזמן ביצוע השיבוץ האוטומטי. אנא נסה שוב.');
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }

  // Recovery flow: auto-add TeacherHours (smart) + re-run the scheduler.
  // Triggered from the "try auto-fix" button inside the diagnostic report.
  async function runRecoveryAndRetry() {
    if (recoveryBusy) return;
    setRecoveryBusy(true);
    setShowDiagnostic(false);
    setLoadingTitle('מוסיף שעות עבודה למורים ומנסה שוב...');
    setIsLoading(true);
    try {
      // Step 1: smart auto-assign of teacher working hours
      let addedHours = 0;
      let quotaUpdated = 0;
      let report: RecoveryReportEntry[] = [];
      try {
        const raw = await fetch('/WebService.asmx/Teacher_AutoAssignHoursSmart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
          body: 'AutoSetHomeroomFreeDay=0',
          credentials: 'include',
        });
        if (raw.ok) {
          const data = await raw.json();
          addedHours = Number(data?.Added || 0);
          quotaUpdated = Number(data?.QuotaUpdated || 0);
          if (Array.isArray(data?.DetailsFull)) report = data.DetailsFull as RecoveryReportEntry[];
        }
      } catch (e) {
        console.error('Teacher_AutoAssignHoursSmart (recovery) failed', e);
      }

      // Step 2: re-run the scheduler
      setLoadingTitle('מריץ שוב את השיבוץ האוטומטי...');
      await ajax('Assign_ShibutzAuto');
      await new Promise((r) => setTimeout(r, 400));

      // Step 3: re-check the final state from the DB
      setLoadingTitle('מאמת תוצאות מול נתונים');
      const diag = await fetchDiagnostic();
      setDiagnostic(diag);

      let emptyCells = 0;
      try {
        const es = await ajax<{ EmptySlots?: number }>('Assign_GetEmptySlotsCount');
        emptyCells = Number(es?.EmptySlots ?? 0);
      } catch {
        emptyCells = diag.length;
      }

      const result = await fetchShibutzErrors();
      setSavedCount(Math.max(0, result.savedCount));
      setErrors(result.errors);

      setIsLoading(false);
      setRecoveryBusy(false);

      // Show the per-teacher hours report when any teacher was touched.
      if (report.length > 0) setRecoveryReport(report);

      if (emptyCells === 0 && diag.length === 0) {
        setResultMode('success');
        setShowResults(true);
        setSuccessAlert(true);
        const prefix = addedHours > 0 || quotaUpdated > 0
          ? `השיבוץ הושלם (הוספנו ${addedHours} שעות ל-${quotaUpdated} מורים)`
          : 'השיבוץ הושלם';
        toast.success(prefix);
      } else {
        // Still gaps — reopen the diagnostic with the updated numbers
        setEmptyCellsState(emptyCells);
        setErrorCount(emptyCells);
        setShowDiagnostic(true);
        setSuccessAlert(true);
        toast.warning(`נותרו ${emptyCells} משבצות לא משובצות לאחר התיקון האוטומטי`);
      }
    } catch (e) {
      console.error('runRecoveryAndRetry failed', e);
      toast.error('שגיאה בתיקון האוטומטי');
    } finally {
      setRecoveryBusy(false);
      setIsLoading(false);
    }
  }

  async function doAutoAddTeacherHours(): Promise<{ added: number; teachers: number; details: string[] } | null> {
    try {
      const raw = await fetch('/WebService.asmx/Teacher_AutoAddHours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
        body: '',
        credentials: 'include',
      });
      if (!raw.ok) return null;
      const data = await raw.json();
      if (!data || typeof data !== 'object') return null;
      return {
        added: Number(data.Added || 0),
        teachers: Number(data.Teachers || 0),
        details: Array.isArray(data.Details) ? data.Details : [],
      };
    } catch (e) {
      console.error('Teacher_AutoAddHours failed', e);
      return null;
    }
  }

  async function doAutoSetHoursBtn() {
    setLoadingTitle('מגדיר שעות עבודה אוטומטית למורים');
    setIsLoading(true);
    try {
      const res = await doAutoAddTeacherHours();
      if (!res) {
        toast.error('הגדרת שעות אוטומטית נכשלה');
        return;
      }
      if (res.added === 0) {
        toast.info('לא נמצאו מורים שדורשים הוספת שעות עבודה');
        return;
      }
      toast.success(
        `הוגדרו ${res.added} שעות עבודה ל-${res.teachers} מורים`,
      );
      // Refresh the diagnostic if visible
      if (showDiagnostic) {
        const diag = await fetchDiagnostic();
        setDiagnostic(diag);
        if (diag.length === 0) setShowDiagnostic(false);
      }
    } catch (e) {
      console.error(e);
      toast.error('שגיאה בהגדרת שעות אוטומטית');
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

  async function showLastErrorsReport() {
    try {
      const result = await fetchShibutzErrors();
      setErrors(result.errors);
      setSavedCount(result.savedCount);
      setErrorCount(result.errorCount);
      setResultMode(result.errors.length > 0 || result.errorCount > 0 ? 'errors' : 'empty');
      setShowResults(true);
    } catch (e) {
      console.error(e);
      toast.error('לא ניתן לטעון את דוח השגיאות האחרון');
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
      {isLoading && (
        <div className="action-loading" role="status" aria-live="polite">
          <div className="action-loading__card assign-loading-card">
            <div className="assign-loading-spinner" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="action-loading__title">{loadingTitle}...</div>
            <div className="action-loading__sub">אנא המתן, התהליך עשוי לקחת מספר שניות</div>
            <div className="action-loading__bar" />
            <div className="assign-loading-timer" aria-live="off">
              <i className="fa fa-clock-o" /> {formatElapsed(elapsedSec)}
            </div>
          </div>
        </div>
      )}

      <div className="assign-auto">
        <div className="assign-auto__card">
          <div className="assign-auto__header">
            <div>
              <div className="assign-auto__kicker">פעולת שיבוץ</div>
              <h2 className="assign-auto__title">שיבוץ אוטומטי</h2>
            </div>
            <div className="assign-auto__warning">
              <i className="fa fa-exclamation-triangle" />
              <span>שיבוץ אוטומטי מוחק את כל השיבוצים שנעשו עד כה.</span>
            </div>
          </div>

          <div className="assign-auto__actions">
            <button
              type="button"
              className="assign-auto__btn assign-auto__btn--primary"
              onClick={doAssign}
            >
              <i className="fa fa-magic" />
              <span>שבץ אוטומטית</span>
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
              onClick={showLastErrorsReport}
            >
              <i className="fa fa-file-text-o" />
              <span>הצג דוח שגיאות אחרון</span>
            </button>
          </div>

          {successAlert && (
            <div className="assign-auto__success">
              <i className="fa fa-check-circle" />
              <span>שיבוץ אוטומטי לשכבה בוצע בהצלחה!</span>
            </div>
          )}
        </div>
      </div>


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
                  <strong style={{ color: '#d32f2f' }}>{emptyCellsState}</strong> משבצות.{' '}
                  {diagnostic.length > 0 ? (
                    <>בדוק את ההמלצות מטה.</>
                  ) : (
                    <>לא זוהה חוסר ברמת מורה-כיתה — ייתכן שמדובר בהתנגשות מבנית (הקבצה/איחוד/יום חופשי). פירוט המשבצות והסיבות מטה.</>
                  )}
                </div>

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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <strong>
                          <i className="fa fa-user-times" /> חסרות שעות עבודה למורים:
                        </strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-warning"
                          onClick={async () => {
                            await doAutoSetHoursBtn();
                            // Re-run diagnostic to refresh the view
                            const diag = await fetchDiagnostic();
                            setDiagnostic(diag);
                            if (diag.length === 0) setShowDiagnostic(false);
                          }}
                          title="הגדר אוטומטית שעות עבודה לכל המורים שחסרות להם"
                        >
                          <i className="fa fa-magic" /> הגדר שעות אוטומטית לכולם
                        </button>
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
                <table className="table table-bordered table-hover table-striped">
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
                    {diagnostic.map((r, i) => {
                      const tips: string[] = [];
                      if (r.Hakbatza > 0) {
                        tips.push(
                          `המורה חלק/ה מהקבצה ${r.Hakbatza} - בדוק שכל המורים בהקבצה זמינים באותן שעות`,
                        );
                      }
                      if (r.Ihud > 0) {
                        tips.push(
                          `המורה חלק/ה מאיחוד ${r.Ihud} עם כיתות אחרות - בדוק זמינות בכיתות השותפות`,
                        );
                      }
                      if (r.IsHomeroom === 1) {
                        tips.push('המורה היא המחנכת של כיתה זו - לרוב נעולה בשעה הראשונה');
                      }
                      if (r.FreeDay > 0) {
                        tips.push(
                          `יום חופשי של המורה: יום ${DAY_NAMES[r.FreeDay - 1] || r.FreeDay} - יתכן חוסם שעות`,
                        );
                      }
                      if (r.TotalRequiredAllClasses > r.AvailableHourSlots) {
                        tips.push(
                          `למורה ${r.TotalRequiredAllClasses} שעות שבועיות נדרשות, אך רק ${r.AvailableHourSlots} שעות עבודה זמינות - הוסף שעות עבודה למורה`,
                        );
                      }
                      if (tips.length === 0) {
                        tips.push('התנגשות שעות - המורה תפוסה בשעות אחרות בכיתות אחרות');
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
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: 15, padding: 10, background: '#f5f5f5', borderRadius: 4 }}>
                  <strong>סיכום כולל:</strong>
                  <ul style={{ marginTop: 8, marginBottom: 0 }}>
                    <li>
                      שובצו {savedCount} שעות מתוך{' '}
                      {savedCount + diagnostic.reduce((a, r) => a + r.Missing, 0)} שעות דרושות
                    </li>
                    <li>
                      ניתן ללחוץ "שבץ בכל זאת" כדי לנסות לשבץ את החוסרים בכפייה (תתכן התנגשות
                      במערכת)
                    </li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => runRecoveryAndRetry()}
                  disabled={recoveryBusy}
                  style={{ background: '#d97706', color: '#fff', fontWeight: 700, border: 'none', padding: '8px 16px', borderRadius: 6, opacity: recoveryBusy ? 0.7 : 1, cursor: recoveryBusy ? 'wait' : 'pointer' }}
                >
                  {recoveryBusy ? (
                    <><span className="spinner" style={{ marginLeft: 6 }} />מנסה לפתור...</>
                  ) : (
                    <><i className="fa fa-magic" style={{ marginLeft: 6 }} /> תקן שעות מורים אוטומטית ונסה שוב</>
                  )}
                </button>
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

      {/* Results modal */}
      {/* Hours-added report — shown after auto-fix recovery runs */}
      {recoveryReport && recoveryReport.length > 0 && (() => {
        const DAY_LBL = ['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
        // Group hours per teacher by day for readability
        const bucketed = recoveryReport
          .slice()
          .sort((a, b) => b.Added - a.Added)
          .map((e) => {
            const perDay = new Map<number, number[]>();
            for (const hid of e.HourIds) {
              const day = Math.floor(hid / 10);
              const hour = hid % 10;
              const arr = perDay.get(day) ?? [];
              arr.push(hour);
              perDay.set(day, arr);
            }
            return { entry: e, perDay };
          });
        const totalAdded = recoveryReport.reduce((a, e) => a + e.Added, 0);
        return (
          <div
            className="modal"
            style={{ display: 'block', background: 'rgba(0,0,0,0.55)', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1070, overflow: 'auto' }}
            onClick={() => setRecoveryReport(null)}
          >
            <div
              className="modal-dialog"
              style={{ direction: 'rtl', maxWidth: 720, marginTop: '5vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-content" style={{ borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)', padding: '16px 22px', color: '#fff' }}>
                  <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    <i className="fa fa-clock-o" style={{ marginLeft: 8 }} />
                    דוח הגדרת שעות — {totalAdded} שעות נוספו ל-{recoveryReport.length} מורים
                  </h4>
                  <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                    הפירוט הבא מראה לכל מורה אילו שעות עבודה נוספו לו
                  </div>
                </div>
                <div className="modal-body" style={{ padding: '16px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
                  {bucketed.map(({ entry, perDay }) => (
                    <div
                      key={entry.TeacherId}
                      style={{
                        marginBottom: 10,
                        padding: '10px 12px',
                        background: entry.IsHomeroom ? '#fef3c7' : '#f1f5f9',
                        border: `1px solid ${entry.IsHomeroom ? '#fcd34d' : '#cbd5e1'}`,
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <strong style={{ color: '#0f172a' }}>{entry.TeacherName}</strong>
                        {entry.IsHomeroom && (
                          <span style={{ fontSize: 11, background: '#f59e0b', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>מחנך</span>
                        )}
                        <span style={{ marginInlineStart: 'auto', fontSize: 13, color: '#047857', fontWeight: 700 }}>
                          + {entry.Added} שעות
                        </span>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>(דרוש {entry.Required})</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {Array.from(perDay.entries())
                          .sort((a, b) => a[0] - b[0])
                          .map(([day, hours]) => (
                            <span
                              key={day}
                              style={{
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                color: '#334155',
                              }}
                            >
                              <strong>{DAY_LBL[day] || '?'}</strong>:{' '}
                              {hours.sort((a, b) => a - b).join(', ')}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb' }}>
                  <button
                    type="button"
                    className="btn btn-info"
                    onClick={() => setRecoveryReport(null)}
                  >
                    סגור
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showResults && (
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
