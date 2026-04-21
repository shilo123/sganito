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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState<DeleteType>(-1);

  const [diagnostic, setDiagnostic] = useState<DiagnosticRow[]>([]);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);

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
      // Final snapshot once done
      const finalSt = await fetchLiveStatus();
      if (finalSt) setLiveStatus(finalSt);
      await new Promise((r) => setTimeout(r, 300));
      const result = await fetchShibutzErrors();
      const diag = await fetchDiagnostic();
      setDiagnostic(diag);
      if (diag.length > 0) {
        setSavedCount(result.savedCount);
        setErrorCount(diag.length);
        setShowDiagnostic(true);
        setSuccessAlert(true);
      } else {
        handleResult(result);
      }
    } catch (e) {
      if (pollHandle) clearInterval(pollHandle);
      console.error('Assign_ShibutzAuto failed', e);
      toast.error('אירעה שגיאה בזמן ביצוע השיבוץ האוטומטי. אנא נסה שוב.');
    } finally {
      if (pollHandle) clearInterval(pollHandle);
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

  function deleteType(action: DeleteType) {
    setShowDeleteModal(false);
    if (action === -1) return;
    setConfirmDeletion(action);
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

  return (
    <div style={{ direction: 'rtl' }}>
      {isLoading && (
        <div className="action-loading" role="status" aria-live="polite">
          <div className="action-loading__card" style={{ maxWidth: 720, width: '90%' }}>
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
              className="assign-auto__btn assign-auto__btn--warning"
              onClick={doFixMissing}
            >
              <i className="fa fa-wrench" />
              <span>תקן חוסרים (הזזות)</span>
            </button>
            <button
              type="button"
              className="assign-auto__btn assign-auto__btn--warning"
              onClick={doAutoSetHoursBtn}
              title="הוסף אוטומטית שעות עבודה למורים שדרושות להם יותר שעות ממה שמוגדר"
            >
              <i className="fa fa-magic" />
              <span>הגדר שעות אוטומטית</span>
            </button>
            <button
              type="button"
              className="assign-auto__btn assign-auto__btn--danger"
              onClick={() => setShowDeleteModal(true)}
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
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={() => {
                    setShowDiagnostic(false);
                    doForceAssign();
                  }}
                  style={{ marginLeft: 8 }}
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

      {/* Delete type modal */}
      {showDeleteModal && (
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
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="modal-dialog"
            style={{ direction: 'rtl' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header label-info">
                <button
                  type="button"
                  className="close"
                  onClick={() => setShowDeleteModal(false)}
                  aria-label="Close"
                >
                  &times;
                </button>
                <h4 className="modal-title">בחירת סוג מחיקה</h4>
              </div>
              <div className="modal-body">
                <button
                  type="button"
                  className="btn btn-info"
                  style={{ margin: 4 }}
                  onClick={() => deleteType(-1)}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ margin: 4 }}
                  onClick={() => deleteType(0)}
                >
                  מחיקה מלאה
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ margin: 4 }}
                  onClick={() => deleteType(1)}
                >
                  מחיקה של אוטמטי
                </button>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-info btn-xs"
                  onClick={() => setShowDeleteModal(false)}
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
            <h3 className="confirm-modal__title">מחיקת שיבוץ</h3>
            <p className="confirm-modal__text">
              {confirmDeletion === 1
                ? <>פעולה זו תמחק את <strong>כל נתוני השיבוץ האוטומטי</strong>. האם להמשיך?</>
                : <>פעולה זו תמחק את <strong>כל נתוני השיבוץ</strong>, כולל הגדרות שהייה, פרטני ונעיצה. האם להמשיך?</>
              }
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
