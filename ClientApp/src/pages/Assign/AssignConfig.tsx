import { useEffect, useState, useRef } from 'react';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../lib/toast';
import PageLoader from '../../lib/PageLoader';
import AssignAuto from './AssignAuto';

// ---- Types ----

interface ConfigurationRow {
  ConfigurationId: string;
  MaxHourInShibutz: string;
  MinForPitzul: string;
  SchoolId?: string;
}

interface TeacherRow {
  TeacherId: number | string;
  FullText: string;
}

interface ClassRow {
  ClassId: number | string;
  ClassName: string;
}

interface DayRow {
  DayId: number | string;
  Name: string;
}

interface HourExtraRow {
  HourExtraId: number | string;
  FullName: string;
  ClassName: string;
  Day: string;
  HourExtra: string;
}

// ---- Component ----

export default function AssignConfig() {
  const { user } = useAuth();
  const toast = useToast();

  const [maxHourInShibutz, setMaxHourInShibutz] = useState<string>('');
  const [minForPitzul, setMinForPitzul] = useState<string>('');
  const [schoolId, setSchoolId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showExtra, setShowExtra] = useState(false);
  const [extraRows, setExtraRows] = useState<HourExtraRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [selTeacher, setSelTeacher] = useState<string>('');
  const [selClass, setSelClass] = useState<string>('');
  const [selDay, setSelDay] = useState<string>('');
  const [extraValue, setExtraValue] = useState<string>('');

  const [showLogo, setShowLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [logoKey, setLogoKey] = useState<number>(Date.now());
  const [logoOk, setLogoOk] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmDeleteLogo, setConfirmDeleteLogo] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const rows = await ajax<ConfigurationRow[]>('Gen_GetTable', {
          TableName: 'Configuration',
          Condition: 'ConfigurationId=' + user.ConfigurationId,
        });
        if (cancelled) return;
        if (Array.isArray(rows) && rows.length > 0) {
          setMaxHourInShibutz(rows[0].MaxHourInShibutz ?? '');
          setMinForPitzul(rows[0].MinForPitzul ?? '');
          setSchoolId(rows[0].SchoolId ?? user.SchoolId ?? '');
        }
      } catch (e) {
        console.error('Load Configuration failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const canManageLogo = user?.RoleId === '1';
  const logoSrc = schoolId ? `/assets/images/SchoolLogo/${schoolId}_.png?v=${logoKey}` : '';

  useEffect(() => {
    if (!logoSrc) {
      setLogoOk(false);
      return;
    }
    const img = new Image();
    img.onload = () => setLogoOk(true);
    img.onerror = () => setLogoOk(false);
    img.src = logoSrc;
  }, [logoSrc]);

  function stepValue(
    current: string,
    delta: number,
    setter: (v: string) => void,
    min = 0,
    max = 99,
  ) {
    const n = Number(current);
    const base = isNaN(n) ? 0 : n;
    const next = Math.max(min, Math.min(max, base + delta));
    setter(String(next));
  }

  async function handleSave() {
    if (isNaN(Number(minForPitzul)) || isNaN(Number(maxHourInShibutz))) {
      toast.warning('יש להזין ערכים מספריים בלבד', { title: 'קלט לא תקין' });
      return;
    }
    setSaving(true);
    try {
      await ajax('Assign_SetConfiguration', {
        MaxHourInShibutz: maxHourInShibutz,
        MinForPitzul: minForPitzul,
      });
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (e) {
      console.error('Assign_SetConfiguration failed', e);
      toast.error('אירעה שגיאה בשמירת ההגדרות');
    } finally {
      setSaving(false);
    }
  }

  async function loadExtraData() {
    try {
      const [rows, t, c, d] = await Promise.all([
        ajax<HourExtraRow[]>('HourExtra_DML', {
          Type: 0,
          HourExtraId: '',
          TeacherId: '',
          ClassId: '',
          DayId: '',
          HourExtra: '',
        }),
        ajax<TeacherRow[]>('Teacher_GetTeacherList', { TeacherId: '' }),
        ajax<ClassRow[]>('Class_GetAllClass'),
        ajax<DayRow[]>('Gen_GetTable', { TableName: 'Days', Condition: '' }),
      ]);
      setExtraRows(Array.isArray(rows) ? rows : []);
      setTeachers(Array.isArray(t) ? t : []);
      setClasses(Array.isArray(c) ? c : []);
      setDays(Array.isArray(d) ? d : []);
    } catch (e) {
      console.error('load HourExtra data failed', e);
      toast.error('שגיאה בטעינת נתוני רשימת המורים');
    }
  }

  async function openExtra() {
    setShowExtra(true);
    await loadExtraData();
  }

  async function addExtra() {
    if (!selTeacher || !selClass || !selDay || !extraValue) {
      toast.warning('יש לבחור מורה, כיתה, יום, ולהזין שעות');
      return;
    }
    if (isNaN(Number(extraValue))) {
      toast.warning('שעות חייב להיות מספר');
      return;
    }
    try {
      await ajax('HourExtra_DML', {
        Type: 1,
        HourExtraId: '',
        TeacherId: selTeacher,
        ClassId: selClass,
        DayId: selDay,
        HourExtra: extraValue,
      });
      setSelTeacher('');
      setSelClass('');
      setSelDay('');
      setExtraValue('');
      await loadExtraData();
      toast.success('נוסף בהצלחה');
    } catch (e) {
      console.error('HourExtra add failed', e);
      toast.error('שגיאה בהוספה');
    }
  }

  async function deleteExtra(id: number | string) {
    try {
      await ajax('HourExtra_DML', {
        Type: 2,
        HourExtraId: id,
        TeacherId: '',
        ClassId: '',
        DayId: '',
        HourExtra: '',
      });
      await loadExtraData();
      toast.success('נמחק בהצלחה');
    } catch (e) {
      console.error('HourExtra delete failed', e);
      toast.error('שגיאה במחיקה');
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onLogoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function cancelPendingLogo() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function closeLogoModal() {
    cancelPendingLogo();
    setShowLogo(false);
  }

  async function uploadLogo() {
    if (!pendingFile) {
      toast.warning('בחר קובץ תחילה');
      return;
    }
    if (!schoolId) {
      toast.error('לא נמצא מזהה בית ספר');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('SchoolId', schoolId);
      fd.append('File', pendingFile);
      const res = await fetch('/WebService.asmx/UploadFile', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      toast.success('הלוגו הועלה בהצלחה');
      cancelPendingLogo();
      setLogoOk(true);
      setLogoKey(Date.now());
    } catch (e) {
      console.error('UploadFile failed', e);
      toast.error('שגיאה בהעלאת הלוגו');
    } finally {
      setUploading(false);
    }
  }

  async function deleteLogoConfirmed() {
    setConfirmDeleteLogo(false);
    try {
      await ajax('DeleteFile', { SchoolId: schoolId });
      toast.success('הלוגו נמחק');
      cancelPendingLogo();
      setLogoOk(false);
      setLogoKey(Date.now());
    } catch (e) {
      console.error('DeleteFile failed', e);
      toast.error('שגיאה במחיקת הלוגו');
    }
  }

  return (
    <div style={{ direction: 'rtl' }}>
      {loading && <PageLoader title="טוען הגדרות" subtitle="מאחזר את הגדרות השיבוץ האוטומטי..." />}

      <div className="assign-config">
        <AssignAuto />

        <div className="assign-config__card">
          <div className="assign-config__header assign-config__header--blue">
            <div>
              <div className="assign-config__kicker">הגדרות שיבוץ</div>
              <h2 className="assign-config__title">
                <i className="fa fa-cog" />
                הגדרות כלליות
              </h2>
            </div>
            <button
              type="button"
              className="assign-config__btn assign-config__btn--ghost"
              onClick={openExtra}
              style={{ background: 'rgba(255,255,255,0.92)' }}
              title="רשימת מורים המורשים לעבוד יותר מ-2 שעות"
            >
              <i className="fa fa-users" />
              חריגים — מורים עם יותר מ-2 שעות
            </button>
          </div>

          <div className="assign-config__body">
            <div className="assign-config__grid">
              <div className="cfg-stat">
                <div className="cfg-stat__top">
                  <div className="cfg-stat__icon cfg-stat__icon--primary">
                    <i className="fa fa-clock-o" />
                  </div>
                  <div className="cfg-stat__label">מקסימום שעות למורה ביום</div>
                </div>
                <div className="cfg-stat__stepper">
                  <button
                    type="button"
                    className="cfg-stat__step-btn"
                    onClick={() => stepValue(maxHourInShibutz, -1, setMaxHourInShibutz)}
                    aria-label="הפחת"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    id="txtRetzef"
                    className="cfg-stat__input"
                    value={maxHourInShibutz}
                    onChange={(e) => setMaxHourInShibutz(e.target.value)}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="cfg-stat__step-btn"
                    onClick={() => stepValue(maxHourInShibutz, 1, setMaxHourInShibutz)}
                    aria-label="הוסף"
                  >
                    +
                  </button>
                  <span className="cfg-stat__unit">שעות</span>
                </div>
                <div className="cfg-stat__hint">
                  מספר שעות הוראה מקסימלי שאפשר להקצות למורה בודד ביום אחד
                </div>
              </div>

              <div className="cfg-stat">
                <div className="cfg-stat__top">
                  <div className="cfg-stat__icon cfg-stat__icon--teal">
                    <i className="fa fa-calendar" />
                  </div>
                  <div className="cfg-stat__label">סף פיזור שעות למספר ימים</div>
                </div>
                <div className="cfg-stat__stepper">
                  <button
                    type="button"
                    className="cfg-stat__step-btn"
                    onClick={() => stepValue(minForPitzul, -1, setMinForPitzul)}
                    aria-label="הפחת"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    id="txtMin"
                    className="cfg-stat__input"
                    value={minForPitzul}
                    onChange={(e) => setMinForPitzul(e.target.value)}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="cfg-stat__step-btn"
                    onClick={() => stepValue(minForPitzul, 1, setMinForPitzul)}
                    aria-label="הוסף"
                  >
                    +
                  </button>
                  <span className="cfg-stat__unit">שעות</span>
                </div>
                <div className="cfg-stat__hint">
                  מורה עם עד X שעות בכיתה — השעות יפוזרו ליותר מיום אחד
                </div>
              </div>
            </div>
          </div>

          <div className="assign-config__footer">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
              ערכים אלה ישפיעו על תהליך השיבוץ האוטומטי
            </div>
            <button
              type="button"
              className="assign-config__btn assign-config__btn--primary"
              onClick={handleSave}
              disabled={saving}
            >
              <i className="fa fa-save" />
              {saving ? 'שומר...' : 'שמור הגדרות'}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Logo FAB */}
      {canManageLogo && (
        <button
          type="button"
          className="logo-fab"
          onClick={() => setShowLogo(true)}
          aria-label="ניהול לוגו בית ספר"
        >
          {logoOk && logoSrc ? (
            <img src={logoSrc} alt="לוגו" />
          ) : (
            <i className="fa fa-image" />
          )}
          <span className="logo-fab__hint">ניהול לוגו</span>
        </button>
      )}

      {/* Logo Modal */}
      {showLogo && (
        <div
          className="modal"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.55)',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1100,
            backdropFilter: 'blur(3px)',
          }}
          onClick={closeLogoModal}
        >
          <div
            className="logo-modal__card"
            style={{ direction: 'rtl' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="logo-modal__header">
              <h3 className="logo-modal__title">
                <i className="fa fa-image" />
                לוגו בית ספר
              </h3>
              <button
                type="button"
                className="logo-modal__close"
                onClick={closeLogoModal}
                aria-label="סגור"
              >
                ×
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onLogoChosen}
            />

            <div className="logo-modal__body">
              <div className={`logo-modal__preview${(previewUrl || (logoSrc && logoOk)) ? '' : ' is-empty'}`}>
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="תמונה חדשה" />
                    <div className="logo-modal__badge">תצוגה מקדימה</div>
                  </>
                ) : logoOk ? (
                  <img src={logoSrc} alt="לוגו בית ספר" />
                ) : (
                  <div className="logo-modal__empty">
                    <i className="fa fa-image" />
                    <span>עדיין לא הועלה לוגו</span>
                  </div>
                )}
              </div>
            </div>

            <div className="logo-modal__actions">
              {previewUrl ? (
                <>
                  <button
                    type="button"
                    className="assign-config__btn assign-config__btn--success"
                    onClick={uploadLogo}
                    disabled={uploading}
                  >
                    <i className="fa fa-check" />
                    {uploading ? 'מעלה...' : 'אשר העלאה'}
                  </button>
                  <button
                    type="button"
                    className="assign-config__btn assign-config__btn--neutral"
                    onClick={cancelPendingLogo}
                    disabled={uploading}
                  >
                    <i className="fa fa-times" />
                    ביטול
                  </button>
                </>
              ) : logoOk ? (
                <>
                  <button
                    type="button"
                    className="assign-config__btn assign-config__btn--primary"
                    onClick={openFilePicker}
                  >
                    <i className="fa fa-refresh" />
                    שנה תמונה
                  </button>
                  <button
                    type="button"
                    className="assign-config__btn assign-config__btn--neutral"
                    onClick={() => setConfirmDeleteLogo(true)}
                  >
                    <i className="fa fa-trash" />
                    מחק
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="assign-config__btn assign-config__btn--success"
                  onClick={openFilePicker}
                >
                  <i className="fa fa-upload" />
                  העלה לוגו
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete logo */}
      {confirmDeleteLogo && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDeleteLogo(false);
          }}
          style={{ zIndex: 1200 }}
        >
          <div className="confirm-modal__card">
            <div className="confirm-modal__icon">
              <i className="fa fa-exclamation-triangle" />
            </div>
            <h3 className="confirm-modal__title">מחיקת לוגו</h3>
            <p className="confirm-modal__text">האם למחוק את לוגו בית הספר?</p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setConfirmDeleteLogo(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={deleteLogoConfirmed}
                autoFocus
              >
                <i className="fa fa-trash" /> מחק
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HourExtra Modal */}
      {showExtra && (
        <div
          className="modal"
          style={{
            display: 'block',
            background: 'rgba(15, 23, 42, 0.55)',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1050,
            overflow: 'auto',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setShowExtra(false)}
        >
          <div
            className="modal-dialog modal-lg"
            style={{ direction: 'rtl', marginTop: '3.5rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="assign-config__card" style={{ overflow: 'hidden' }}>
              <div className="assign-config__header assign-config__header--blue">
                <div>
                  <div className="assign-config__kicker">ניהול חריגים</div>
                  <h2 className="assign-config__title">
                    <i className="fa fa-users" />
                    מורים המורשים ליותר מ-2 שעות
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExtra(false)}
                  aria-label="Close"
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: 'white',
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    fontSize: 20,
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              <div className="hx-modal__body">
                <h4 className="hx-modal__section-title">הוספת חריג חדש</h4>
                <div className="hx-modal__form">
                  <select
                    value={selTeacher}
                    onChange={(e) => setSelTeacher(e.target.value)}
                  >
                    <option value="">בחר מורה</option>
                    {teachers.map((t) => (
                      <option key={String(t.TeacherId)} value={String(t.TeacherId)}>
                        {t.FullText}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selClass}
                    onChange={(e) => setSelClass(e.target.value)}
                  >
                    <option value="">בחר כיתה</option>
                    {classes.map((c) => (
                      <option key={String(c.ClassId)} value={String(c.ClassId)}>
                        {c.ClassName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selDay}
                    onChange={(e) => setSelDay(e.target.value)}
                  >
                    <option value="">בחר יום</option>
                    {days.map((d) => (
                      <option key={String(d.DayId)} value={String(d.DayId)}>
                        {d.Name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="שעות"
                    value={extraValue}
                    onChange={(e) => setExtraValue(e.target.value)}
                    inputMode="numeric"
                  />
                  <button type="button" className="hx-modal__add-btn" onClick={addExtra}>
                    <i className="fa fa-plus" />
                    הוסף
                  </button>
                </div>

                <h4 className="hx-modal__section-title">רשומות קיימות</h4>
                {extraRows.length === 0 ? (
                  <div className="hx-modal__empty">אין רשומות להצגה</div>
                ) : (
                  <table className="hx-modal__table">
                    <thead>
                      <tr>
                        <th>שם מורה</th>
                        <th>שם כיתה</th>
                        <th>יום בשבוע</th>
                        <th>שעות</th>
                        <th>פעולה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extraRows.map((row) => (
                        <tr key={String(row.HourExtraId)}>
                          <td>{row.FullName}</td>
                          <td>{row.ClassName}</td>
                          <td>{row.Day}</td>
                          <td>{row.HourExtra}</td>
                          <td>
                            <button
                              type="button"
                              className="hx-modal__del-btn"
                              onClick={() => deleteExtra(row.HourExtraId)}
                            >
                              <i className="fa fa-trash" />
                              מחק
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="assign-config__footer">
                <div style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
                  סה"כ {extraRows.length} רשומות
                </div>
                <button
                  type="button"
                  className="assign-config__btn assign-config__btn--neutral"
                  onClick={() => setShowExtra(false)}
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
