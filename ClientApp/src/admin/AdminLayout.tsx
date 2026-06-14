import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { ajax } from '../api/client';
import { useAdminAuth } from './AdminAuthContext';
import './admin.css';

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const [openIssuesCount, setOpenIssuesCount] = useState<number>(0);
  const [newContactsCount, setNewContactsCount] = useState<number>(0);

  useEffect(() => {
    if (!admin) return;
    type IssueRow = { Status?: string };
    ajax<IssueRow[]>('Admin_GetIssues', { StatusFilter: '' })
      .then((rows) => {
        const open = Array.isArray(rows)
          ? rows.filter((r) => r?.Status === 'פתוח' || r?.Status === 'בטיפול').length
          : 0;
        setOpenIssuesCount(open);
      })
      .catch(() => setOpenIssuesCount(0));

    type ContactRow = { Status?: string };
    ajax<ContactRow[]>('Admin_GetContacts', { StatusFilter: '' })
      .then((rows) => {
        const fresh = Array.isArray(rows)
          ? rows.filter((r) => r?.Status === 'חדש').length
          : 0;
        setNewContactsCount(fresh);
      })
      .catch(() => setNewContactsCount(0));
  }, [admin]);

  if (!admin) return <Navigate to="/admin/login" replace />;

  const initials = admin.FullName?.trim().charAt(0) || 'A';

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <div className="admin-topbar-mark">⚙</div>
          <div>
            <div className="admin-topbar-title">סגנית · אדמין</div>
            <div className="admin-topbar-sub">פאנל ניהול מערכת</div>
          </div>
        </div>

        <nav className="admin-tabs">
          <NavLink to="/admin" end className={({ isActive }) => `admin-tab${isActive ? ' is-active' : ''}`}>
            <i className="fa fa-home"></i> דשבורד
          </NavLink>
          <NavLink to="/admin/schools" className={({ isActive }) => `admin-tab${isActive ? ' is-active' : ''}`}>
            <i className="fa fa-graduation-cap"></i> בתי ספר
          </NavLink>
          <NavLink to="/admin/issues" className={({ isActive }) => `admin-tab${isActive ? ' is-active' : ''}`}>
            <i className="fa fa-exclamation-circle"></i> תקלות
            {openIssuesCount > 0 && <span className="admin-tab-badge">{openIssuesCount}</span>}
          </NavLink>
          <NavLink to="/admin/contacts" className={({ isActive }) => `admin-tab${isActive ? ' is-active' : ''}`}>
            <i className="fa fa-envelope"></i> פניות
            {newContactsCount > 0 && <span className="admin-tab-badge">{newContactsCount}</span>}
          </NavLink>
        </nav>

        <div className="admin-user">
          <div style={{ textAlign: 'right' }}>
            <div className="admin-user-name">{admin.FullName}</div>
            <div className="admin-user-sub">{admin.Email || admin.UserName}</div>
          </div>
          <div className="admin-user-avatar">{initials}</div>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => void logout()}
            title="יציאה"
            style={{ padding: '8px 12px' }}
          >
            <i className="fa fa-sign-out"></i>
          </button>
        </div>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
