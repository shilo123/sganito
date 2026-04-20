import { useEffect, useState } from 'react';
import { ajax } from '../../api/client';
import PageLoader from '../../lib/PageLoader';

interface BetKnesetRow {
  BetHTML: string;
  TypeId: string;
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

export default function BetKneset() {
  const [typeId, setTypeId] = useState<string>('0');
  const [html, setHtml] = useState<string>('');
  const [fontSize, setFontSize] = useState<number>(16);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ajax<BetKnesetRow[]>('BetKneset_GetHTML', { Type: typeId, IsFromScreen: 0 })
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0 && data[0]) {
          setHtml(data[0].BetHTML || '');
          if (data[0].TypeId && typeId === '0') {
            setTypeId(String(data[0].TypeId));
          }
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

  return (
    <div style={{ padding: 20 }} dir="rtl">
      <div style={{ marginBottom: 15, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, marginLeft: 20 }}>בית כנסת - מעגלים</h2>

        <select
          id="ddlType"
          className="form-control"
          style={{ width: 'auto', display: 'inline-block' }}
          value={typeId === '0' ? '1' : typeId}
          onChange={(e) => setTypeId(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="btn-group" role="group" aria-label="font-size">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setFontSize((s) => s + 1)}
            title="הגדל גופן"
          >
            +
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setFontSize((s) => Math.max(6, s - 1))}
            title="הקטן גופן"
          >
            -
          </button>
          <button
            type="button"
            className="btn btn-default btn-sm"
            onClick={() => setFontSize(16)}
            title="אפס גופן"
          >
            איפוס
          </button>
        </div>
        <span style={{ color: '#888' }}>גודל גופן: {fontSize}px</span>
      </div>

      {loading && <PageLoader title="טוען לוח בית כנסת" subtitle="מאחזר את מעגלי התפילה..." />}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && (
        <div
          className="dvInMain"
          id="dvInMain"
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
