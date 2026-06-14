import { useEffect, useMemo, useState } from 'react';
import { ajax } from '../api/client';
import { useToast } from '../lib/toast';
import './admin.css';

interface ContactRow {
  ContactId: number;
  FullName: string;
  Phone: string | null;
  Email: string | null;
  SchoolName: string | null;
  Message: string | null;
  Status: string;
  CreatedAt: string;
  HandledAt: string | null;
  AdminNote: string | null;
}

const STATUS_FILTERS = ['הכל', 'חדש', 'בטיפול', 'טופל'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function statusClass(s: string): string {
  if (s === 'חדש') return 'admin-status-open';
  if (s === 'בטיפול') return 'admin-status-progress';
  if (s === 'טופל') return 'admin-status-resolved';
  return 'admin-status-closed';
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

export default function AdminContacts() {
  const toast = useToast();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('הכל');
  const [notingId, setNotingId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');

  function reload() {
    setLoading(true);
    ajax<ContactRow[]>('Admin_GetContacts', { StatusFilter: filter === 'הכל' ? '' : filter })
      .then((rows) => setContacts(Array.isArray(rows) ? rows : []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [filter]);

  const counts = useMemo(() => {
    const all = contacts.length;
    const fresh = contacts.filter((c) => c.Status === 'חדש').length;
    const progress = contacts.filter((c) => c.Status === 'בטיפול').length;
    const done = contacts.filter((c) => c.Status === 'טופל').length;
    return { all, fresh, progress, done };
  }, [contacts]);

  async function updateStatus(contactId: number, status: string, note?: string) {
    try {
      await ajax('Admin_UpdateContactStatus', {
        ContactId: contactId,
        Status: status,
        AdminNote: note ?? '',
      });
      toast.success('הסטטוס עודכן');
      setNotingId(null);
      setNoteText('');
      reload();
    } catch {
      toast.error('שגיאה בעדכון');
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">פניות יצירת קשר</h1>
          <div className="admin-page-sub">
            פניות שהתקבלו מדף הנחיתה · הכל ({counts.all}) · חדשות ({counts.fresh}) · בטיפול ({counts.progress}) · טופלו ({counts.done})
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
            <div style={{ marginTop: 10 }}>טוען פניות...</div>
          </div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="admin-card">
          <div className="admin-empty">
            <div className="admin-empty-icon">📭</div>
            <div className="admin-empty-title">אין פניות {filter !== 'הכל' ? `במצב "${filter}"` : 'עדיין'}</div>
            <div>פניות חדשות מדף הנחיתה יופיעו כאן</div>
          </div>
        </div>
      ) : (
        <div className="admin-issue-list">
          {contacts.map((c) => (
            <div key={c.ContactId} className="admin-issue-card">
              <div className="admin-issue-card-head">
                <div style={{ flex: 1 }}>
                  <div className="admin-issue-title">{c.FullName}</div>
                  <div className="admin-issue-meta">
                    {c.SchoolName && (
                      <span className="admin-issue-meta-item">
                        <i className="fa fa-graduation-cap"></i> {c.SchoolName}
                      </span>
                    )}
                    {c.Phone && (
                      <a className="admin-issue-meta-item" href={`tel:${c.Phone}`} style={{ textDecoration: 'none' }}>
                        <i className="fa fa-phone"></i> {c.Phone}
                      </a>
                    )}
                    {c.Email && (
                      <a className="admin-issue-meta-item" href={`mailto:${c.Email}`} style={{ textDecoration: 'none' }}>
                        <i className="fa fa-envelope"></i> {c.Email}
                      </a>
                    )}
                    <span className="admin-issue-meta-item">
                      <i className="fa fa-clock-o"></i> {timeAgo(c.CreatedAt)}
                    </span>
                  </div>
                </div>
                <div className={`admin-status-pill ${statusClass(c.Status)}`}>
                  {c.Status}
                </div>
              </div>

              {c.Message && <div className="admin-issue-body">{c.Message}</div>}

              {c.AdminNote && (
                <div className="admin-issue-response">
                  <div className="admin-issue-response-head">
                    <i className="fa fa-sticky-note"></i> הערה פנימית
                    {c.HandledAt && ` · ${timeAgo(c.HandledAt)}`}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{c.AdminNote}</div>
                </div>
              )}

              {notingId === c.ContactId ? (
                <div style={{ marginTop: 14 }}>
                  <textarea
                    className="admin-textarea"
                    placeholder="הערה פנימית (לא נשלחת לפונה)..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    autoFocus
                  />
                  <div className="admin-issue-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      onClick={() => updateStatus(c.ContactId, c.Status === 'חדש' ? 'בטיפול' : c.Status, noteText)}
                    >
                      <i className="fa fa-save"></i> שמור הערה
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => { setNotingId(null); setNoteText(''); }}
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
                    onClick={() => { setNotingId(c.ContactId); setNoteText(c.AdminNote || ''); }}
                  >
                    <i className="fa fa-sticky-note"></i> {c.AdminNote ? 'עדכן הערה' : 'הוסף הערה'}
                  </button>
                  {c.Status === 'חדש' && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => updateStatus(c.ContactId, 'בטיפול')}
                    >
                      <i className="fa fa-spinner"></i> סמן בטיפול
                    </button>
                  )}
                  {c.Status !== 'טופל' && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => updateStatus(c.ContactId, 'טופל')}
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
