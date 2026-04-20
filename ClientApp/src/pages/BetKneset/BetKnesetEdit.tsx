import { useEffect, useState } from 'react';
import { ajax } from '../../api/client';
import PageLoader from '../../lib/PageLoader';

interface BetKnesetRow {
  BetHTML: string;
  TypeId: string;
}

interface UpdateResult {
  res: string;
}

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1', label: 'שבת' },
  { value: '2', label: 'חג פסח' },
  { value: '3', label: 'שביעי של פסח' },
  { value: '4', label: 'חג עצמאות' },
  { value: '5', label: 'חג שבועות' },
  { value: '6', label: 'ראש השנה' },
  { value: '7', label: 'יום הכיפורים' },
  { value: '8', label: 'חג סוכות' },
  { value: '9', label: 'שמחת תורה' },
];

export default function BetKnesetEdit() {
  const [typeId, setTypeId] = useState<string>('1');
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessage(null);
    ajax<BetKnesetRow[]>('BetKneset_GetHTML', { Type: typeId, IsFromScreen: 1 })
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0 && data[0]) {
          setHtml(data[0].BetHTML || '');
        } else {
          setHtml('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'שגיאה בטעינת הלוח');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [typeId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const cleaned = html.replace(/&nbsp;/g, ' ');
      const result = await ajax<UpdateResult[]>('BetKneset_UpdateHTML', { Type: typeId, html: cleaned });
      if (Array.isArray(result) && result.length > 0 && result[0]?.res === '1') {
        setMessage('הלוח נשמר בהצלחה !!');
      } else {
        setError('השמירה נכשלה');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 20 }} dir="rtl">
      <div style={{ marginBottom: 15, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, marginLeft: 20 }}>בית כנסת - עריכה</h2>

        <select
          id="ddlType"
          className="form-control"
          style={{ width: 'auto', display: 'inline-block' }}
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'שומר...' : 'שמור לוח'}
        </button>
      </div>

      {loading && <PageLoader title="טוען לוח לעריכה" subtitle="מאחזר את תוכן המעגלים..." />}
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {!loading && (
        <div className="row">
          <div className="col-md-6">
            <label htmlFor="htmlEditor"><strong>HTML</strong></label>
            <textarea
              id="htmlEditor"
              className="form-control"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              style={{ minHeight: 500, fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}
              spellCheck={false}
            />
          </div>
          <div className="col-md-6">
            <label><strong>תצוגה מקדימה</strong></label>
            <div
              className="dvInMain"
              style={{
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: 10,
                minHeight: 500,
                background: '#fff',
                overflow: 'auto',
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
