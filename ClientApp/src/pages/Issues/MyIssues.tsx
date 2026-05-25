import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ajax } from '../../api/client';
import { useToast } from '../../lib/toast';
import '../../admin/admin.css';

interface IssueRow {
  IssueId: number;
  Category: string;
  Priority: string;
  Title: string;
  Description: string;
  Status: string;
  CreatedAt: string;
  UpdatedAt: string;
  AdminResponse: string | null;
  RespondedAt: string | null;
  AdminFullName: string | null;
}

const CATEGORIES = ['כללי', 'באג', 'הצעה', 'שאלה'];
const PRIORITIES = ['נמוך', 'רגיל', 'גבוה', 'דחוף'];

function statusClass(s: string): string {
  if (s === 'פתוח') return 'admin-status-open';
  if (s === 'בטיפול') return 'admin-status-progress';
  if (s === 'טופל') return 'admin-status-resolved';
  return 'admin-status-closed';
}
function priorityClass(p: string): string {
  if (p === 'נמוך') return 'admin-priority-low';
  if (p === 'גבוה') return 'admin-priority-high';
  if (p === 'דחוף') return 'admin-priority-urgent';
  return 'admin-priority-normal';
}
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    // ASP.NET JavaScriptSerializer produces "/Date(milliseconds)/" instead of ISO
    let d: Date;
    const m = iso.match(/\/Date\((\d+)\)\//);
    if (m) d = new Date(Number(m[1]));
    else d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function MyIssues() {
  const toast = useToast();
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('כללי');
  const [priority, setPriority] = useState('רגיל');
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    ajax<IssueRow[]>('Issue_GetMine')
      .then((rows) => setIssues(Array.isArray(rows) ? rows : []))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.warning('יש למלא כותרת ותיאור');
      return;
    }
    setSubmitting(true);
    try {
      await ajax('Issue_Insert', { Title: title.trim(), Description: description.trim(), Category: category, Priority: priority });
      toast.success('התקלה נשלחה לאדמין - נחזור אליך בהקדם!');
      setTitle(''); setDescription(''); setCategory('כללי'); setPriority('רגיל');
      setShowForm(false);
      reload();
    } catch {
      toast.error('שגיאה בשליחת התקלה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">דיווח תקלות ופניות</h1>
          <div className="admin-page-sub">שלח תקלה, הצעה לשיפור או שאלה - האדמין יקבל ויגיב</div>
        </div>
        {!showForm && (
          <button type="button" className="admin-btn admin-btn-primary" onClick={() => setShowForm(true)}>
            <i className="fa fa-plus"></i> דיווח חדש
          </button>
        )}
      </div>

      {showForm && (
        <div className="admin-card" style={{ marginBottom: 24 }}>
          <div className="admin-card-header">
            <div className="admin-card-title">📝 דיווח תקלה חדשה</div>
            <button type="button" className="admin-modal-close" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <form onSubmit={submit}>
            <div className="admin-modal-body" style={{ padding: 24 }}>
              <div className="admin-grid-2">
                <div className="admin-form-group">
                  <label>סוג הפנייה</label>
                  <select className="admin-form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>דחיפות</label>
                  <select className="admin-form-control" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="admin-form-group">
                <label>כותרת *</label>
                <input className="admin-form-control" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="תיאור קצר של הבעיה / הפנייה" maxLength={200} autoFocus />
              </div>

              <div className="admin-form-group">
                <label>תיאור מפורט *</label>
                <textarea className="admin-textarea" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="ספר לנו מה קרה, איפה זה קרה, ומה הציפייה. כל פרט עוזר!" rows={6} />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                {submitting ? <><span className="admin-spinner"></span> שולח...</> : <><i className="fa fa-paper-plane"></i> שלח</>}
              </button>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="admin-card">
          <div className="admin-loading-block">
            <span className="admin-spinner"></span>
            <div style={{ marginTop: 10 }}>טוען...</div>
          </div>
        </div>
      ) : issues.length === 0 ? (
        <div className="admin-card">
          <div className="admin-empty">
            <div className="admin-empty-icon">📭</div>
            <div className="admin-empty-title">אין דיווחים עדיין</div>
            <div>לחץ "דיווח חדש" כדי לשלוח את הראשון</div>
          </div>
        </div>
      ) : (
        <div className="admin-issue-list">
          {issues.map((it) => (
            <div key={it.IssueId} className="admin-issue-card">
              <div className="admin-issue-card-head">
                <div style={{ flex: 1 }}>
                  <div className="admin-issue-title">{it.Title}</div>
                  <div className="admin-issue-meta">
                    <span className="admin-issue-meta-item">
                      <i className="fa fa-clock-o"></i> נשלח {fmtDate(it.CreatedAt)}
                    </span>
                    <span className={`admin-priority-pill ${priorityClass(it.Priority)}`}>{it.Priority}</span>
                    <span className="admin-mini-badge purple">{it.Category}</span>
                  </div>
                </div>
                <div className={`admin-status-pill ${statusClass(it.Status)}`}>{it.Status}</div>
              </div>

              <div className="admin-issue-body">{it.Description}</div>

              {it.AdminResponse && (
                <div className="admin-issue-response">
                  <div className="admin-issue-response-head">
                    <i className="fa fa-reply"></i> תגובת אדמין
                    {it.AdminFullName && ` · ${it.AdminFullName}`}
                    {it.RespondedAt && ` · ${fmtDate(it.RespondedAt)}`}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{it.AdminResponse}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
