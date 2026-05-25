import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ajax } from '../api/client';
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

export default function AdminDashboard() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIssuesTotal, setOpenIssuesTotal] = useState(0);

  useEffect(() => {
    Promise.all([
      ajax<SchoolRow[]>('Admin_GetSchoolsDashboard'),
      ajax<Array<{ Status?: string }>>('Admin_GetIssues', { StatusFilter: '' }),
    ])
      .then(([s, issues]) => {
        setSchools(Array.isArray(s) ? s : []);
        const open = Array.isArray(issues)
          ? issues.filter((i) => i?.Status === 'פתוח' || i?.Status === 'בטיפול').length
          : 0;
        setOpenIssuesTotal(open);
      })
      .catch(() => { setSchools([]); setOpenIssuesTotal(0); })
      .finally(() => setLoading(false));
  }, []);

  const totalSchools = schools.length;
  const totalTeachers = schools.reduce((s, r) => s + (Number(r.TeachersCount) || 0), 0);
  const totalClasses = schools.reduce((s, r) => s + (Number(r.ClassesCount) || 0), 0);
  const totalUsers = schools.reduce((s, r) => s + (Number(r.UsersCount) || 0), 0);

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">דשבורד</h1>
          <div className="admin-page-sub">תמונת מצב על כל בתי הספר במערכת</div>
        </div>
        <Link to="/admin/schools" className="admin-btn admin-btn-primary">
          <i className="fa fa-plus"></i> ניהול בתי ספר
        </Link>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card" style={{ ['--accent' as never]: 'rgba(113, 71, 193, 0.08)' }}>
          <div className="admin-stat-icon purple"><i className="fa fa-graduation-cap"></i></div>
          <div className="admin-stat-value">{loading ? '…' : totalSchools}</div>
          <div className="admin-stat-label">בתי ספר במערכת</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon cyan"><i className="fa fa-users"></i></div>
          <div className="admin-stat-value">{loading ? '…' : totalTeachers}</div>
          <div className="admin-stat-label">סך מורים</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon pink"><i className="fa fa-th-large"></i></div>
          <div className="admin-stat-value">{loading ? '…' : totalClasses}</div>
          <div className="admin-stat-label">סך כיתות</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon amber"><i className="fa fa-exclamation-circle"></i></div>
          <div className="admin-stat-value">{loading ? '…' : openIssuesTotal}</div>
          <div className="admin-stat-label">תקלות פתוחות</div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">בתי ספר ({totalSchools})</div>
          <div className="admin-page-sub">סה"כ {totalUsers} משתמשים פעילים</div>
        </div>
        {loading ? (
          <div className="admin-loading-block">
            <span className="admin-spinner"></span>
            <div style={{ marginTop: 10 }}>טוען נתונים...</div>
          </div>
        ) : schools.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">🏫</div>
            <div className="admin-empty-title">אין בתי ספר במערכת</div>
            <div>עברו לדף "בתי ספר" כדי להוסיף את הראשון</div>
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
                    {s.OpenIssuesCount > 0 ? (
                      <span className="admin-mini-badge amber">{s.OpenIssuesCount}</span>
                    ) : (
                      <span style={{ color: '#a8a2b5', fontSize: 13 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
