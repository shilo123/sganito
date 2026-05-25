import { useState, type FormEvent } from 'react';
import { ajax } from '../api/client';
import { useToast } from '../lib/toast';
import './admin.css';

interface Props {
  onClose: () => void;
  onSaved: (created: { SchoolId: number; UserId: number }) => void;
}

interface AddSchoolResult {
  Success: number;
  Message: string;
  SchoolId: number;
  UserId: number;
}

export default function AddSchoolModal({ onClose, onSaved }: Props) {
  const toast = useToast();
  const [schoolName, setSchoolName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!schoolName.trim() || !userName.trim() || !password.trim()) {
      setErr('יש למלא לפחות שם בית ספר, שם משתמש וסיסמה');
      return;
    }
    if (password.length < 4) { setErr('הסיסמה קצרה מדי (לפחות 4 תווים)'); return; }
    setBusy(true);
    try {
      const data = await ajax<AddSchoolResult[]>('Admin_AddSchool', {
        SchoolName: schoolName.trim(),
        UserName: userName.trim(),
        Password: password,
        AdminFirstName: firstName.trim() || userName.trim(),
        AdminLastName: lastName.trim() || '',
        Email: email.trim(),
      });
      const r = Array.isArray(data) && data[0];
      if (r && r.Success) {
        toast.success(`בית הספר "${schoolName}" נוצר בהצלחה`);
        onSaved({ SchoolId: r.SchoolId, UserId: r.UserId });
        onClose();
      } else {
        setErr(r ? r.Message : 'יצירת בית ספר נכשלה');
      }
    } catch {
      setErr('שגיאת תקשורת עם השרת');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <div>
            <div className="admin-modal-title">הוספת בית ספר חדש</div>
            <div style={{ fontSize: 13, color: '#6b6675', marginTop: 2 }}>
              ייווצרו: בית ספר, Configuration לשנת לימודים, ומשתמש מנהל
            </div>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit}>
          <div className="admin-modal-body">
            {err && <div className="admin-alert admin-alert-danger">{err}</div>}

            <div className="admin-form-group">
              <label htmlFor="schoolName">שם בית הספר *</label>
              <input
                id="schoolName"
                className="admin-form-control"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="לדוגמה: בית ספר היובל"
                autoFocus
                maxLength={50}
              />
            </div>

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px dashed #e1d5fb' }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#4a2db2' }}>
                <i className="fa fa-user-circle"></i> פרטי משתמש מנהל
              </div>

              <div className="admin-grid-2">
                <div className="admin-form-group">
                  <label htmlFor="firstName">שם פרטי</label>
                  <input id="firstName" className="admin-form-control"
                    value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={50} />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="lastName">שם משפחה</label>
                  <input id="lastName" className="admin-form-control"
                    value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={50} />
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="email">דוא"ל</label>
                <input id="email" type="email" className="admin-form-control"
                  value={email} onChange={(e) => setEmail(e.target.value)} maxLength={100} />
              </div>

              <div className="admin-grid-2">
                <div className="admin-form-group">
                  <label htmlFor="userName">שם משתמש *</label>
                  <input
                    id="userName"
                    className="admin-form-control"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="לדוגמה: yuval"
                    maxLength={50}
                    autoComplete="off"
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="password">סיסמה *</label>
                  <input
                    id="password"
                    type="text"
                    className="admin-form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="לפחות 4 תווים"
                    maxLength={50}
                    autoComplete="new-password"
                  />
                  <div className="admin-help-text">
                    שמרו את הסיסמה במקום בטוח - תינתן למנהל בית הספר
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
              {busy ? <><span className="admin-spinner"></span> יוצר...</> : <><i className="fa fa-check"></i> צור בית ספר</>}
            </button>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose} disabled={busy}>
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
