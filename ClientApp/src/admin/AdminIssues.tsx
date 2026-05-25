import { useEffect, useMemo, useState } from 'react';
import { ajax } from '../api/client';
import { useToast } from '../lib/toast';
import './admin.css';

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
  SchoolId: number;
  SchoolName: string;
  UserId: number;
  UserFullName: string;
  UserName: string;
  AdminFullName: string | null;
}

const STATUS_FILTERS = ['הכל', 'פתוח', 'בטיפול', 'טופל', 'נסגר'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

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

function timeAgo(iso: string): string {
  if (!iso) return '';
  let d: Date;
  const dm = iso.match(/\/Date\((\d+)\)\//);
  if (dm) d = new Date(Number(dm[1]));
  else d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'הרגע';
  if (m < 60) return `לפני ${m} דק'`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שעות`;
  const days = Math.floor(h / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return d.toLocaleDateString('he-IL');
}

export default function AdminIssues() {
  const toast = useToast();
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('הכל');
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [responseText, setResponseText] = useState('');

  function reload() {
    setLoading(true);
    ajax<IssueRow[]>('Admin_GetIssues', { StatusFilter: filter === 'הכל' ? '' : filter })
      .then((rows) => setIssues(Array.isArray(rows) ? rows : []))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [filter]);

  const counts = useMemo(() => {
    const all = issues.length;
    const open = issues.filter((i) => i.Status === 'פתוח').length;
    const progress = issues.filter((i) => i.Status === 'בטיפול').length;
    const resolved = issues.filter((i) => i.Status === 'טופל').length;
    return { all, open, progress, resolved };
  }, [issues]);

  async function updateStatus(issueId: number, status: string, response?: string) {
    try {
      await ajax('Admin_RespondIssue', {
        IssueId: issueId,
        Status: status,
        AdminResponse: response ?? '',
      });
      toast.success('הסטטוס עודכן');
      setRespondingTo(null);
      setResponseText('');
      reload();
    } catch {
      toast.error('שגיאה בעדכון');
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">תקלות ופניות</h1>
          <div className="admin-page-sub">
            כל ({counts.all}) · פתוחות ({counts.open}) · בטיפול ({counts.progress}) · טופלו ({counts.resolved})
          </div>
        </div>
      </div>

      <div className="admin-filter-bar">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            className={`admin-filter-chip${filter === s ? ' is-active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-card">
          <div className="admin-loading-block">
            <span className="admin-spinner"></span>
            <div style={{ marginTop: 10 }}>טוען תקלות...</div>
          </div>
        </div>
      ) : issues.length === 0 ? (
        <div className="admin-card">
          <div className="admin-empty">
            <div className="admin-empty-icon">🎉</div>
            <div className="admin-empty-title">אין תקלות {filter !== 'הכל' ? `במצב "${filter}"` : 'במערכת'}</div>
            <div>הכל נראה תקין</div>
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
                      <i className="fa fa-graduation-cap"></i> {it.SchoolName}
                    </span>
                    <span className="admin-issue-meta-item">
                      <i className="fa fa-user"></i> {it.UserFullName} ({it.UserName})
                    </span>
                    <span className="admin-issue-meta-item">
                      <i className="fa fa-clock-o"></i> {timeAgo(it.CreatedAt)}
                    </span>
                    <span className={`admin-priority-pill ${priorityClass(it.Priority)}`}>
                      {it.Priority}
                    </span>
                    <span className="admin-mini-badge purple">
                      {it.Category}
                    </span>
                  </div>
                </div>
                <div className={`admin-status-pill ${statusClass(it.Status)}`}>
                  {it.Status}
                </div>
              </div>

              <div className="admin-issue-body">{it.Description}</div>

              {it.AdminResponse && (
                <div className="admin-issue-response">
                  <div className="admin-issue-response-head">
                    <i className="fa fa-reply"></i> תגובת אדמין
                    {it.AdminFullName && ` · ${it.AdminFullName}`}
                    {it.RespondedAt && ` · ${timeAgo(it.RespondedAt)}`}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{it.AdminResponse}</div>
                </div>
              )}

              {respondingTo === it.IssueId ? (
                <div style={{ marginTop: 14 }}>
                  <textarea
                    className="admin-textarea"
                    placeholder="כתוב כאן תגובה למשתמש..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    autoFocus
                  />
                  <div className="admin-issue-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      onClick={() => updateStatus(it.IssueId, it.Status === 'פתוח' ? 'בטיפול' : it.Status, responseText)}
                      disabled={!responseText.trim()}
                    >
                      <i className="fa fa-paper-plane"></i> שלח תגובה
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => updateStatus(it.IssueId, 'טופל', responseText)}
                      disabled={!responseText.trim()}
                    >
                      <i className="fa fa-check"></i> שלח וסמן כטופל
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => { setRespondingTo(null); setResponseText(''); }}
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                <div className="admin-issue-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={() => { setRespondingTo(it.IssueId); setResponseText(it.AdminResponse || ''); }}
                  >
                    <i className="fa fa-reply"></i> {it.AdminResponse ? 'עדכן תגובה' : 'הגב'}
                  </button>
                  {it.Status === 'פתוח' && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => updateStatus(it.IssueId, 'בטיפול')}
                    >
                      <i className="fa fa-spinner"></i> סמן בטיפול
                    </button>
                  )}
                  {it.Status !== 'טופל' && it.Status !== 'נסגר' && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => updateStatus(it.IssueId, 'טופל')}
                    >
                      <i className="fa fa-check"></i> סמן טופל
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
