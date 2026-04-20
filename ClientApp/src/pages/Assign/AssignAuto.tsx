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

  async function doAssign() {
    setSuccessAlert(false);
    setShowResults(false);
    setLoadingTitle('מבצע שיבוץ אוטומטי');
    setIsLoading(true);
    try {
      await ajax('Assign_ShibutzAuto');
      // Small delay to allow session to settle, mirroring original 500ms setTimeout
      await new Promise((r) => setTimeout(r, 500));
      const result = await fetchShibutzErrors();
      handleResult(result);
    } catch (e) {
      console.error('Assign_ShibutzAuto failed', e);
      toast.error('אירעה שגיאה בזמן ביצוע השיבוץ האוטומטי. אנא נסה שוב.');
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
      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.65)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg,#fff 0%,#f8fbff 100%)',
              borderRadius: 16,
              padding: '45px 55px',
              textAlign: 'center',
              boxShadow: '0 15px 50px rgba(0,0,0,0.25)',
              maxWidth: 420,
              direction: 'rtl',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1565C0', marginBottom: 10 }}>
              {loadingTitle}...
            </div>
            <div style={{ fontSize: 14, color: '#607D8B', marginBottom: 18 }}>
              אנא המתן, התהליך עשוי לקחת מספר שניות
            </div>
            <div
              style={{
                height: 4,
                background: '#e0e0e0',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: '40%',
                  background: 'linear-gradient(90deg,#2196F3,#00BCD4)',
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="col-md-12">
        <div className="row dvWeek">
          <div className="panel panel-info">
            <div className="panel-heading">
              <h3 className="panel-title">&nbsp;שיבוץ אוטמטי</h3>
            </div>
            <div className="panel-body">
              <div
                className="col-md-12"
                style={{ fontSize: 18, color: 'brown', fontWeight: 'bold' }}
              >
                שים לב!!! שיבוץ אוטמטי מוחק את כל השיבוצים שנעשו עד כה.
                <br />
                <br />
              </div>

              <div className="col-md-3">
                <div
                  className="btn btn-primary btn-round"
                  style={{ width: '100%', fontSize: 20, fontWeight: 'bold' }}
                  onClick={doAssign}
                >
                  שבץ אוטמטית
                </div>
              </div>

              <div className="col-md-3">
                <div
                  className="btn btn-warning btn-round"
                  style={{ width: '100%', fontSize: 18, fontWeight: 'bold', color: '#fff' }}
                  onClick={doFixMissing}
                >
                  תקן חוסרים (הזזות)
                </div>
              </div>

              <div className="col-md-2">
                <div
                  className="btn btn-danger btn-round"
                  style={{ width: '100%', fontSize: 20, fontWeight: 'bold' }}
                  onClick={() => setShowDeleteModal(true)}
                >
                  מחק שיבוץ!!!
                </div>
              </div>

              <div className="col-md-2">
                <div
                  className="btn btn-info btn-round"
                  style={{ width: '100%', fontSize: 18, fontWeight: 'bold' }}
                  onClick={showLastErrorsReport}
                >
                  הצג דוח שגיאות אחרון
                </div>
              </div>

              {successAlert && (
                <div
                  className="col-md-12"
                  style={{
                    fontSize: 28,
                    color: 'brown',
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}
                >
                  שיבוץ אוטמטי לשכבה בוצע בהצלחה!!
                  <br />
                  <br />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
