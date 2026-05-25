import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ajax } from '../api/client';
import { useAdminAuth } from './AdminAuthContext';
import './admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { refresh } = useAdminAuth();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await ajax<Array<Record<string, unknown>>>('Admin_Login', { UserName: userName, Password: password });
      if (Array.isArray(data) && data.length > 0) {
        refresh();
        navigate('/admin', { replace: true });
      } else {
        setError('שם משתמש או סיסמה שגויים');
      }
    } catch {
      setError('שגיאת תקשורת עם השרת');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <div className="admin-login-brand-mark">⚙</div>
          <div>
            <div className="admin-login-brand-name">סגנית · אדמין</div>
            <div className="admin-login-brand-sub">פאנל ניהול מערכת</div>
          </div>
        </div>

        <h1>שלום מנהל 👋</h1>
        <p className="admin-login-lead">היכנס לפאנל הניהול כדי לראות בתי ספר ולנהל תקלות.</p>

        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label htmlFor="adminUser">שם משתמש</label>
            <input
              id="adminUser"
              className="admin-form-control"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="admin-form-group">
            <label htmlFor="adminPass">סיסמה</label>
            <input
              id="adminPass"
              type="password"
              className="admin-form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <div className="admin-alert admin-alert-danger">{error}</div>}
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-block" disabled={loading}>
            {loading ? <><span className="admin-spinner"></span> מתחבר...</> : 'כניסה לפאנל'}
          </button>
        </form>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #f5f0ff', textAlign: 'center' }}>
          <a href="/Login" style={{ color: '#6b6675', fontSize: 13, textDecoration: 'none' }}>
            ← חזור לכניסה רגילה
          </a>
        </div>
      </div>
    </div>
  );
}
