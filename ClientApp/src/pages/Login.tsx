import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ajax } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      const data = await ajax<Array<Record<string, unknown>>>('User_GetUserEnter', { UserName: userName, Password: password });
      if (Array.isArray(data) && data.length > 0) {
        refresh();
        navigate('/Config/SchoolHours', { replace: true });
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: 100 }}>
      <div className="panel panel-default">
        <div className="panel-heading"><h3 className="panel-title">סגנית - כניסה למערכת</h3></div>
        <div className="panel-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="txtUserName">שם משתמש</label>
              <input
                id="txtUserName"
                className="form-control"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="txtPassword">סיסמה</label>
              <input
                id="txtPassword"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div id="spEnterAlert" className="alert alert-danger">שם משתמש או סיסמה שגויים</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'מתחבר...' : 'כניסה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
