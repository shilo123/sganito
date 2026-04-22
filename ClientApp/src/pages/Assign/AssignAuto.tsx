import { useState } from 'react';
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

interface LiveStatusClass {
  ClassId: number;
  ClassName: string;
  TotalSlots: number;
  FilledSlots: number;
}
interface LiveStatus {
  IsRunning: boolean;
  ElapsedMs: number;
  TotalSlots: number;
  RedSlots: number;
  CurrentStep: string;
  Classes: LiveStatusClass[];
}

type DeleteType = -1 | 0 | 1;

// ---- Constants ----

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

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

  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);

  // Recovery prompt - shown when the scheduler finished with gaps that
  // could potentially be fixed by adding more TeacherHours and re-running.
  const [recoveryPrompt, setRecoveryPrompt] = useState<{
    missingCount: number;
    teachersToFix: number;  // distinct teachers with missing assignments
    alreadyTried: boolean;  // true if we already tried fixing once
  } | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryAutoSetFreeDay, setRecoveryAutoSetFreeDay] = useState(false);

  // Conflict resolution modal - second tier of auto-fix for hard conflicts
  interface ResolutionProposals {
    TotalMissing: number;
    AffectedTeachers: number;
    Proposals: {
      ClearFreeDayTeachers: Array<{ TeacherId: number; Name: string; FreeDay: number; Missing: number }>;
      ReduceClassTeacherRows: Array<{ ClassId: number; TeacherId: number; ClassName: string; TeacherName: string; From: number; To: number; Delta: number }>;
      SyncHakbatzaFreeDay: Array<{ GroupKey: string; MajorityFreeDay: number; Members: Array<{ TeacherId: number; FreeDay: number }> }>;
    };
  }
  const [conflictModal, setConflictModal] = useState<ResolutionProposals | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [cfOptClearFreeDay, setCfOptClearFreeDay] = useState(false);
  const [cfOptReduceCT, setCfOptReduceCT] = useState(true);
  const [cfOptSyncHak, setCfOptSyncHak] = useState(true);

  // Cancellation: shown only during the main Assign_ShibutzAuto run.
  const [cancelSent, setCancelSent] = useState(false);
  async function cancelCurrentShibutz() {
    if (cancelSent) return;
    setCancelSent(true);
    try {
      await fetch('/WebService.asmx/Assign_CancelShibutz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
        body: '',
        credentials: 'include',
      });
      toast.info('בקשת עצירה נשלחה — ממתין שהשיבוץ יסיים את הצעד הנוכחי...');
    } catch (e) {
      console.error('cancel shibutz failed', e);
      toast.error('לא ניתן לשלוח בקשת עצירה');
      setCancelSent(false);
    }
  }

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

  async function fetchLiveStatus(): Promise<LiveStatus | null> {
    try {
      const raw = await fetch('/WebService.asmx/Assign_GetShibutzLiveStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
        body: '',
        credentials: 'include',
      });
      if (!raw.ok) return null;
      const data = await raw.json();
      return (data && typeof data === 'object') ? (data as LiveStatus) : null;
    } catch {
      return null;
    }
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
    setLiveStatus(null);
    setCancelSent(false);
    setLoadingTitle('מבצע שיבוץ אוטומטי');
    setIsLoading(true);

    // Start live polling every 1s while the main call runs
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      pollHandle = setInterval(async () => {
        const st = await fetchLiveStatus();
        if (st) setLiveStatus(st);
      }, 1000);
    };
    startPolling();

    try {
      await ajax('Assign_ShibutzAuto');
      if (pollHandle) clearInterval(pollHandle);
      // Switch the loading screen to an honest "verifying" state and stop
      // showing the stale in-memory LiveStatus (which counts filled slots,
      // not unmet ClassTeacher requirements — those can differ).
      setLoadingTitle('מאמת תוצאות מול נתונים');
      setLiveStatus(null);

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

      // Single source of truth: DB state. Only "success" if BOTH the grid
      // is fully filled AND every ClassTeacher requirement is met.
      const fullyComplete = emptyCells === 0 && diag.length === 0;

      // Hide the loading overlay BEFORE opening the next modal so the user
      // never sees the old "805/805 all green" next to a "80 חוסרים" popup.
      setIsLoading(false);

      if (fullyComplete) {
        setResultMode('success');
        setShowResults(true);
        setSuccessAlert(true);
      } else {
        // Partial success - offer auto-recovery (add teacher hours + retry)
        const distinctTeachers = new Set(diag.map((d) => d.TeacherId)).size;
        setRecoveryPrompt({
          missingCount: diag.length,
          teachersToFix: distinctTeachers,
          alreadyTried: false,
        });
      }
    } catch (e) {
      if (pollHandle) clearInterval(pollHandle);
      console.error('Assign_ShibutzAuto failed', e);
      toast.error('אירעה שגיאה בזמן ביצוע השיבוץ האוטומטי. אנא נסה שוב.');
      setIsLoading(false);
    } finally {
      if (pollHandle) clearInterval(pollHandle);
      // safety net only; normal flow already cleared isLoading above
      setIsLoading(false);
    }
  }

  // Recovery flow: auto-add TeacherHours (smart) + re-run the scheduler.
  // Called from the "try to fix automatically" button in the recovery prompt.
  async function runRecoveryAndRetry() {
    if (recoveryBusy) return;
    const alreadyTried = recoveryPrompt?.alreadyTried === true;
    setRecoveryBusy(true);
    setLoadingTitle('מוסיף שעות עבודה למורים ומנסה שוב...');
    setIsLoading(true);
    try {
      // Step 1: smart auto-assign of teacher working hours
      let addedHours = 0;
      let quotaUpdated = 0;
      try {
        const raw = await fetch('/WebService.asmx/Teacher_AutoAssignHoursSmart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
          body: 'AutoSetHomeroomFreeDay=' + (recoveryAutoSetFreeDay ? '1' : '0'),
          credentials: 'include',
        });
        if (raw.ok) {
          const data = await raw.json();
          addedHours = Number(data?.Added || 0);
          quotaUpdated = Number(data?.QuotaUpdated || 0);
        }
      } catch (e) {
        console.error('Teacher_AutoAssignHoursSmart (recovery) failed', e);
      }

      // Step 2: re-run the scheduler
      setLoadingTitle('מריץ שוב את השיבוץ האוטומטי...');
      setLiveStatus(null);
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

      // Hide loading BEFORE opening the next modal
      setRecoveryPrompt(null);
      setIsLoading(false);
      setRecoveryBusy(false);

      if (emptyCells === 0 && diag.length === 0) {
        setResultMode('success');
        setShowResults(true);
        setSuccessAlert(true);
        const prefix = addedHours > 0 || quotaUpdated > 0
          ? `השיבוץ הושלם (הוספנו ${addedHours} שעות ל-${quotaUpdated} מורים)`
          : 'השיבוץ הושלם';
        toast.success(prefix);
        return;
      } else if (alreadyTried) {
        // Already retried once - show the diagnostic without another prompt
        setErrorCount(diag.length);
        setShowDiagnostic(true);
        setSuccessAlert(true);
        toast.warning('לא ניתן היה לפתור אוטומטית את כל החוסרים. מוצגים החוסרים שנותרו.');
      } else {
        // Offer ONE more round
        const distinctTeachers = new Set(diag.map((d) => d.TeacherId)).size;
        setRecoveryPrompt({
          missingCount: diag.length,
          teachersToFix: distinctTeachers,
          alreadyTried: true,
        });
      }
    } catch (e) {
      console.error('runRecoveryAndRetry failed', e);
      toast.error('שגיאה בתיקון האוטומטי');
    } finally {
      setRecoveryBusy(false);
      setIsLoading(false);
    }
  }

  async function openConflictResolutions() {
    try {
      const raw = await fetch('/WebService.asmx/Assign_GetConflictResolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
        body: '',
        credentials: 'include',
      });
      if (!raw.ok) throw new Error('HTTP ' + raw.status);
      const data = (await raw.json()) as ResolutionProposals;
      setShowDiagnostic(false);
      setConflictModal(data);
      // Sensible defaults: if there are hakbatza conflicts, sync them; if any
      // teacher has a FreeDay + missing hours, clear them; always offer
      // reduce-CT as the guaranteed-success fallback (defaults off).
      setCfOptSyncHak((data?.Proposals?.SyncHakbatzaFreeDay?.length ?? 0) > 0);
      setCfOptClearFreeDay((data?.Proposals?.ClearFreeDayTeachers?.length ?? 0) > 0);
      setCfOptReduceCT(false);
    } catch (e) {
      console.error('Assign_GetConflictResolutions failed', e);
      toast.error('לא ניתן לטעון את הצעות פתרון הקונפליקטים');
    }
  }

  async function applyConflictsAndRetry() {
    if (!conflictModal || conflictBusy) return;
    if (!cfOptClearFreeDay && !cfOptReduceCT && !cfOptSyncHak) {
      toast.warning('בחר לפחות שינוי אחד להחלה');
      return;
    }
    setConflictBusy(true);
    setLoadingTitle('מחיל שינויים ומריץ שיבוץ מחדש...');
    setIsLoading(true);
    try {
      // Apply selected resolutions
      const body =
        'ClearFreeDay=' + (cfOptClearFreeDay ? '1' : '0') +
        '&ReduceCT=' + (cfOptReduceCT ? '1' : '0') +
        '&SyncHakbatza=' + (cfOptSyncHak ? '1' : '0');
      const raw = await fetch('/WebService.asmx/Assign_ApplyConflictResolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
        body,
        credentials: 'include',
      });
      if (!raw.ok) throw new Error('HTTP ' + raw.status);
      const applied = await raw.json();

      // Rerun scheduler
      setLoadingTitle('מריץ את השיבוץ מחדש...');
      await ajax('Assign_ShibutzAuto');
      await new Promise((r) => setTimeout(r, 400));

      // Verify
      setLoadingTitle('מאמת תוצאות מול נתונים');
      const diag = await fetchDiagnostic();
      setDiagnostic(diag);
      let emptyCells = 0;
      try {
        const es = await ajax<{ EmptySlots?: number }>('Assign_GetEmptySlotsCount');
        emptyCells = Number(es?.EmptySlots ?? 0);
      } catch { emptyCells = diag.length; }
      const result = await fetchShibutzErrors();
      setSavedCount(Math.max(0, result.savedCount));

      setConflictModal(null);
      setIsLoading(false);
      setConflictBusy(false);

      const summary = [
        `${applied?.ClearedFreeDay ?? 0} ימי חופשי בוטלו`,
        `${applied?.ReducedClassTeacher ?? 0} דרישות הופחתו`,
        `${applied?.SyncedHakbatzaFreeDay ?? 0} סנכרוני הקבצה`,
      ].filter((s) => !s.startsWith('0 ')).join(' | ') || 'השינויים הוחלו';

      if (emptyCells === 0 && diag.length === 0) {
        setResultMode('success');
        setShowResults(true);
        setSuccessAlert(true);
        toast.success('השיבוץ הושלם! (' + summary + ')');
      } else {
        setErrorCount(diag.length);
        setShowDiagnostic(true);
        toast.warning(summary + ' | עדיין ' + diag.length + ' חוסרים');
      }
    } catch (e) {
      console.error('applyConflictsAndRetry failed', e);
      toast.error('שגיאה בהחלת השינויים');
      setIsLoading(false);
      setConflictBusy(false);
    }
  }

  function dismissRecoveryAndShowDiagnostic() {
    const diagLen = recoveryPrompt?.missingCount ?? diagnostic.length;
    setRecoveryPrompt(null);
    setErrorCount(diagLen);
    setShowDiagnostic(true);
    setSuccessAlert(true);
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
          <div className="action-loading__card" style={{ maxWidth: 720, width: '90%', position: 'relative' }}>
            {liveStatus && (
              <button
                type="button"
                onClick={cancelCurrentShibutz}
                disabled={cancelSent}
                title="עצור את השיבוץ האוטומטי"
                style={{
                  position: 'absolute',
                  bottom: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: cancelSent ? '#9ca3af' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: cancelSent ? 'wait' : 'pointer',
                  zIndex: 2,
                  boxShadow: '0 2px 8px -2px rgba(0,0,0,0.25)',
                }}
              >
                <i className="fa fa-stop" style={{ marginLeft: 6 }} />
                {cancelSent ? 'עוצר...' : 'עצור שיבוץ'}
              </button>
            )}
            <div className="action-loading__title">{loadingTitle}...</div>
            {liveStatus ? (
              <>
                <div className="action-loading__sub">
                  {liveStatus.CurrentStep || 'מעבד...'}
                  {liveStatus.ElapsedMs > 0 && ` • ${Math.round(liveStatus.ElapsedMs / 1000)}s`}
                </div>
                {liveStatus.TotalSlots > 0 && (
                  <div style={{ margin: '12px 0', fontSize: 14, textAlign: 'center' }}>
                    <strong style={{ color: '#2e7d32' }}>
                      {liveStatus.TotalSlots - liveStatus.RedSlots}
                    </strong>{' '}
                    משבצות שובצו מתוך <strong>{liveStatus.TotalSlots}</strong>
                    {liveStatus.RedSlots > 0 && (
                      <>
                        {' '}· נותרו <strong style={{ color: '#d32f2f' }}>{liveStatus.RedSlots}</strong>
                      </>
                    )}
                  </div>
                )}
                {liveStatus.Classes && liveStatus.Classes.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                      gap: 6,
                      marginTop: 10,
                      maxHeight: 220,
                      overflowY: 'auto',
                      padding: 4,
                    }}
                  >
                    {[...liveStatus.Classes]
                      .sort((a, b) => a.ClassName.localeCompare(b.ClassName, 'he'))
                      .map((c) => {
                        const pct = c.TotalSlots > 0 ? (c.FilledSlots / c.TotalSlots) * 100 : 0;
                        const done = c.FilledSlots === c.TotalSlots;
                        return (
                          <div
                            key={c.ClassId}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: done
                                ? 'linear-gradient(135deg, #a5d6a7, #66bb6a)'
                                : 'linear-gradient(135deg, #fff3e0, #ffcc80)',
                              color: done ? '#1b5e20' : '#e65100',
                              fontSize: 12,
                              fontWeight: 600,
                              textAlign: 'center',
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                            title={`${c.FilledSlots}/${c.TotalSlots}`}
                          >
                            <div style={{ position: 'relative', zIndex: 2 }}>
                              {c.ClassName}
                              <br />
                              <span style={{ fontSize: 10, fontWeight: 400 }}>
                                {c.FilledSlots}/{c.TotalSlots}
                              </span>
                            </div>
                            {!done && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: 3,
                                  background: '#4caf50',
                                  width: `${pct}%`,
                                  transition: 'width 0.4s ease',
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="action-loading__sub">אנא המתן, התהליך עשוי לקחת מספר שניות</div>
                <div className="action-loading__bar" />
              </>
            )}
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

      {/* Recovery prompt - offered when the scheduler finished with gaps
          that might be fixable by auto-adding more working hours to teachers. */}
      {recoveryPrompt && (
        <div
          className="modal"
          style={{
            display: 'block',
            background: 'rgba(0,0,0,0.55)',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1060,
            overflow: 'auto',
          }}
          onClick={() => { if (!recoveryBusy) dismissRecoveryAndShowDiagnostic(); }}
        >
          <div
            className="modal-dialog"
            style={{ direction: 'rtl', maxWidth: 560, marginTop: '8vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content" style={{ borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', padding: '16px 22px', color: '#fff' }}>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  <i className="fa fa-exclamation-triangle" style={{ marginLeft: 8 }} />
                  השיבוץ הסתיים עם חוסרים
                </h4>
              </div>
              <div className="modal-body" style={{ padding: '20px 22px' }}>
                <p style={{ fontSize: 15, marginBottom: 14 }}>
                  <strong>{recoveryPrompt.missingCount}</strong> דרישות של{' '}
                  <strong>{recoveryPrompt.teachersToFix}</strong> מורים לא שובצו במלואן.
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 6, color: '#374151' }}>
                  אנחנו יכולים לנסות לפתור את זה אוטומטית:
                </p>
                <ul style={{ fontSize: 13, lineHeight: 1.8, color: '#4b5563', marginBottom: 16, paddingInlineStart: 22 }}>
                  <li>נוסיף שעות עבודה לכל מורה שצריך יותר שעות</li>
                  <li>נעדכן מכסות (Frontaly) במורים עם מכסה ישנה</li>
                  <li>נריץ את השיבוץ שוב אוטומטית</li>
                  <li>יום חופשי, הקבצה/איחוד ישמרו</li>
                </ul>
                {recoveryPrompt.alreadyTried && (
                  <div style={{ padding: 10, background: '#fef3c7', borderRadius: 6, fontSize: 13, marginBottom: 12, color: '#92400e' }}>
                    <i className="fa fa-info-circle" style={{ marginLeft: 6 }} />
                    ניסינו כבר תיקון אחד. זה ניסיון נוסף עם יותר התאמות.
                  </div>
                )}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    cursor: recoveryBusy ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    opacity: recoveryBusy ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={recoveryAutoSetFreeDay}
                    disabled={recoveryBusy}
                    onChange={(e) => setRecoveryAutoSetFreeDay(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'inherit', marginTop: 2 }}
                  />
                  <span style={{ flex: 1, textAlign: 'right', lineHeight: 1.5 }}>
                    <strong>הגדר אוטומטית יום חופשי למחנכים</strong>
                    <br />
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      למחנכים ללא יום חופשי - ייבחר יום עם הכי פחות שעות קיימות
                    </span>
                  </span>
                </label>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => runRecoveryAndRetry()}
                  disabled={recoveryBusy}
                  style={{
                    background: '#d97706',
                    color: '#fff',
                    fontWeight: 700,
                    padding: '9px 18px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 14,
                    cursor: recoveryBusy ? 'wait' : 'pointer',
                    opacity: recoveryBusy ? 0.7 : 1,
                  }}
                >
                  {recoveryBusy ? (
                    <><span className="spinner" /> מנסה...</>
                  ) : (
                    <><i className="fa fa-magic" style={{ marginLeft: 6 }} />כן, נסה לפתור אוטומטית</>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={dismissRecoveryAndShowDiagnostic}
                  disabled={recoveryBusy}
                  style={{ padding: '9px 18px', fontSize: 14 }}
                >
                  לא, הצג לי את החוסרים
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conflict resolution modal - admin-approved structural fixes */}
      {conflictModal && (
        <div
          className="modal"
          style={{
            display: 'block',
            background: 'rgba(0,0,0,0.55)',
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            zIndex: 1065, overflow: 'auto',
          }}
          onClick={() => { if (!conflictBusy) setConflictModal(null); }}
        >
          <div
            className="modal-dialog"
            style={{ direction: 'rtl', maxWidth: 720, marginTop: '5vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content" style={{ borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', padding: '16px 22px', color: '#fff' }}>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  <i className="fa fa-wrench" style={{ marginLeft: 8 }} />
                  פתרון קונפליקטים מתקדם
                </h4>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                  עדיין חסרים {conflictModal.TotalMissing} דרישות של {conflictModal.AffectedTeachers} מורים.
                  סמן אילו שינויים לבצע:
                </div>
              </div>
              <div className="modal-body" style={{ padding: '18px 22px', maxHeight: '55vh', overflowY: 'auto' }}>

                {/* Option 1: sync hakbatza free days */}
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, marginBottom: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cfOptSyncHak}
                    onChange={(e) => setCfOptSyncHak(e.target.checked)}
                    disabled={conflictBusy || conflictModal.Proposals.SyncHakbatzaFreeDay.length === 0}
                    style={{ width: 18, height: 18, marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#5b21b6' }}>
                      סנכרון יום חופשי בקבוצות הקבצה/איחוד ({conflictModal.Proposals.SyncHakbatzaFreeDay.length} קבוצות)
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      מורים באותה הקבצה/איחוד חייבים ללמד יחד. אם יש להם ימי חופשי שונים — הם חוסמים אחד את השני.
                      נשנה את כולם ליום חופשי של הרוב בקבוצה.
                    </div>
                  </div>
                </label>

                {/* Option 2: clear free day for teachers with gaps */}
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cfOptClearFreeDay}
                    onChange={(e) => setCfOptClearFreeDay(e.target.checked)}
                    disabled={conflictBusy || conflictModal.Proposals.ClearFreeDayTeachers.length === 0}
                    style={{ width: 18, height: 18, marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
                      ביטול יום חופשי ({conflictModal.Proposals.ClearFreeDayTeachers.length} מורים)
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      מורים עם חוסרים + יום חופשי קבוע. ביטול היום החופשי ייתן למתזמן יותר גמישות.
                    </div>
                    {conflictModal.Proposals.ClearFreeDayTeachers.length > 0 && (
                      <details style={{ fontSize: 12, marginTop: 6 }}>
                        <summary style={{ cursor: 'pointer', color: '#78350f' }}>ראה רשימה</summary>
                        <div style={{ maxHeight: 110, overflowY: 'auto', fontSize: 11, marginTop: 4, color: '#57534e' }}>
                          {conflictModal.Proposals.ClearFreeDayTeachers.map((t) => (
                            <div key={t.TeacherId}>• {t.Name} (חסרים {t.Missing})</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </label>

                {/* Option 3: reduce ClassTeacher to match actual */}
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cfOptReduceCT}
                    onChange={(e) => setCfOptReduceCT(e.target.checked)}
                    disabled={conflictBusy || conflictModal.Proposals.ReduceClassTeacherRows.length === 0}
                    style={{ width: 18, height: 18, marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b' }}>
                      הפחתת דרישות כיתה למה שהושג בפועל ({conflictModal.Proposals.ReduceClassTeacherRows.length} שורות)
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      מקבל את המצב: ClassTeacher.Hour יעודכן לכמות שכבר שובצה. <strong>מבטיח הצלחה 100%</strong>, אבל זו החלטה אמיתית להוריד דרישות.
                    </div>
                    {conflictModal.Proposals.ReduceClassTeacherRows.length > 0 && (
                      <details style={{ fontSize: 12, marginTop: 6 }}>
                        <summary style={{ cursor: 'pointer', color: '#7f1d1d' }}>ראה רשימה</summary>
                        <div style={{ maxHeight: 110, overflowY: 'auto', fontSize: 11, marginTop: 4, color: '#57534e' }}>
                          {conflictModal.Proposals.ReduceClassTeacherRows.map((r) => (
                            <div key={r.ClassId + '_' + r.TeacherId}>• {r.TeacherName} ב-{r.ClassName}: {r.From}→{r.To}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </label>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  type="button"
                  onClick={applyConflictsAndRetry}
                  disabled={conflictBusy}
                  style={{
                    background: '#7c3aed', color: '#fff', fontWeight: 700,
                    padding: '9px 18px', borderRadius: 6, border: 'none', fontSize: 14,
                    cursor: conflictBusy ? 'wait' : 'pointer', opacity: conflictBusy ? 0.7 : 1,
                  }}
                >
                  {conflictBusy ? (<><span className="spinner" /> מחיל...</>) : (
                    <><i className="fa fa-check" style={{ marginLeft: 6 }} />החל ונסה שוב</>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setConflictModal(null)}
                  disabled={conflictBusy}
                  style={{ padding: '9px 18px', fontSize: 14 }}
                >
                  ביטול
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
                  <strong>שובצו {savedCount} שעות.</strong> לא ניתן היה לשבץ את{' '}
                  <strong>{diagnostic.length}</strong> השעות הבאות. בדוק את ההמלצות מטה.
                </div>

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
                  onClick={() => {
                    const distinct = new Set(diagnostic.map((d) => d.TeacherId)).size;
                    setShowDiagnostic(false);
                    setRecoveryPrompt({
                      missingCount: diagnostic.length,
                      teachersToFix: distinct,
                      alreadyTried: false,
                    });
                  }}
                  style={{ background: '#d97706', color: '#fff', fontWeight: 700, border: 'none', padding: '8px 16px', borderRadius: 6 }}
                >
                  <i className="fa fa-magic" style={{ marginLeft: 6 }} /> תקן שעות מורים אוטומטית ונסה שוב
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={openConflictResolutions}
                  style={{ background: '#7c3aed', color: '#fff', fontWeight: 700, border: 'none', padding: '8px 16px', borderRadius: 6 }}
                >
                  <i className="fa fa-wrench" style={{ marginLeft: 6 }} /> פתרון קונפליקטים מתקדם
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={() => {
                    setShowDiagnostic(false);
                    doForceAssign();
                  }}
                >
                  <i className="fa fa-bolt" /> שבץ בכל זאת
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
