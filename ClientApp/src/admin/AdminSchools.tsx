import { useEffect, useState } from 'react';
import { ajax } from '../api/client';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import AddSchoolModal from './AddSchoolModal';
import './admin.css';

interface SchoolRow {
  SchoolId: number;
  SchoolName: string;
  UsersCount: number;
  ConfigsCount: number;
  TeachersCount: number;
  ClassesCount: number;
  OpenIssuesCount: number;
}

export default function AdminSchools() {
  const toast = useToast();
  const confirm = useConfirm();
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function reload() {
    setLoading(true);
    ajax<SchoolRow[]>('Admin_GetSchoolsDashboard')
      .then((rows) => setSchools(Array.isArray(rows) ? rows : []))
      .catch(() => setSchools([]))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  async function impersonate(schoolId: number) {
    try {
      const data = await ajax<Array<Record<string, unknown>>>('Admin_ImpersonateSchool', { SchoolId: schoolId });
      if (Array.isArray(data) && data.length > 0) {
        toast.success('מתחבר כמנהל בית הספר...');
        // טעינת UserData cookie נקבעה בשרת - מנווט לעמוד הראשי של המשתמש
        window.location.href = '/Config/SchoolHours';
      } else {
        toast.error('אין משתמש פעיל בבית ספר זה');
      }
    } catch {
      toast.error('שגיאה בהתחזות');
    }
  }

  async function deleteSchool(schoolId: number, name: string) {
    const ok = await confirm({
      title: 'מחיקת בית ספר',
      message: `למחוק את בית הספר "${name}" וכל הנתונים שלו? פעולה זו אינה הפיכה.`,
      danger: true,
      confirmText: 'מחק לצמיתות',
      cancelText: 'ביטול',
    });
    if (!ok) return;
    setDeletingId(schoolId);
    try {
      const data = await ajax<Array<{ Success: number; Message: string }>>('Admin_DeleteSchool', { SchoolId: schoolId });
      const r = Array.isArray(data) && data[0];
      if (r && r.Success) {
        toast.success(`בית הספר "${name}" נמחק`);
        reload();
      } else {
        toast.error(r ? r.Message : 'מחיקה נכשלה');
      }
    } catch {
      toast.error('שגיאה במחיקה');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">בתי ספר</h1>
          <div className="admin-page-sub">ניהול בתי הספר הרשומים במערכת</div>
        </div>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => setShowAdd(true)}>
          <i className="fa fa-plus"></i> הוסף בית ספר
        </button>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="admin-loading-block">
            <span className="admin-spinner"></span>
            <div style={{ marginTop: 10 }}>טוען בתי ספר...</div>
          </div>
        ) : schools.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">🏫</div>
            <div className="admin-empty-title">אין בתי ספר במערכת</div>
            <div>לחץ "הוסף בית ספר" כדי להתחיל</div>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>בית הספר</th>
                <th>משתמשים</th>
                <th>מורים</th>
                <th>כיתות</th>
                <th>תקלות פתוחות</th>
                <th style={{ width: 220 }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.SchoolId}>
                  <td>
                    <div className="admin-school-name">
                      <div className="admin-school-avatar">{(s.SchoolName || '?').charAt(0)}</div>
                      <div>
                        <div>{s.SchoolName}</div>
                        <div style={{ fontSize: 12, color: '#6b6675', fontWeight: 400 }}>#{s.SchoolId}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="admin-mini-badge purple">{s.UsersCount}</span></td>
                  <td><span className="admin-mini-badge cyan">{s.TeachersCount}</span></td>
                  <td><span className="admin-mini-badge pink">{s.ClassesCount}</span></td>
                  <td>
                    {s.OpenIssuesCount > 0
                      ? <span className="admin-mini-badge amber">{s.OpenIssuesCount}</span>
                      : <span style={{ color: '#a8a2b5', fontSize: 13 }}>—</span>}
                  </td>
                  <td>
                    <div className="admin-action-buttons">
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        onClick={() => void impersonate(s.SchoolId)}
                        title="היכנס כמנהל בית ספר כדי לעזור עם הנתונים"
                      >
                        <i className="fa fa-sign-in"></i> כניסה
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost"
                        onClick={() => void deleteSchool(s.SchoolId, s.SchoolName)}
                        disabled={deletingId === s.SchoolId}
                        title="מחק את בית הספר וכל הנתונים שלו"
                        style={{ color: '#e11d48' }}
                      >
                        {deletingId === s.SchoolId ? <span className="admin-spinner"></span> : <i className="fa fa-trash"></i>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddSchoolModal
          onClose={() => setShowAdd(false)}
          onSaved={() => reload()}
        />
      )}
    </div>
  );
}
