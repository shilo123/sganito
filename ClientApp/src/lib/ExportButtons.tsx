import type { CSSProperties } from 'react';

interface Props {
  onExcel: () => void;
  onWord: () => void;
  onPdf: () => void;
  style?: CSSProperties;
  compact?: boolean;
  disabled?: boolean;
}

// Labeled "export zone" — the user asked for a clearly-separated area with
// a "ליצוא" heading so these buttons don't get mixed with action controls
// like "מחק" / "ערוך" / "שמור". Renders as a pill-shaped box:
//
//    ┌─ ליצוא ────────────────────┐
//    │ [Excel] [Word] [PDF]        │
//    └─────────────────────────────┘
export default function ExportButtons({ onExcel, onWord, onPdf, style, compact, disabled }: Props) {
  const padding = compact ? '4px 10px' : '6px 12px';
  const fontSize = compact ? 12 : 13;
  const btnBase: CSSProperties = {
    padding,
    fontSize,
    fontWeight: 600,
    border: 'none',
    borderRadius: 5,
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    transition: 'transform 0.1s ease, box-shadow 0.1s ease',
  };

  const containerStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    gap: 6,
    padding: compact ? '10px 10px 6px' : '14px 12px 8px',
    border: '1.5px dashed #94a3b8',
    borderRadius: 8,
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    ...style,
  };

  const labelStyle: CSSProperties = {
    position: 'absolute',
    top: -9,
    insetInlineStart: 12,
    background: '#fff',
    padding: '0 8px',
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    letterSpacing: 0.5,
    textTransform: 'none',
  };

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>
        <i className="fa fa-download" style={{ marginInlineEnd: 4 }} />
        ליצוא
      </span>
      <button
        type="button"
        onClick={onExcel}
        disabled={disabled}
        title="ייצוא ל-Excel"
        style={{ ...btnBase, background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
      >
        <i className="fa fa-file-excel-o" /> Excel
      </button>
      <button
        type="button"
        onClick={onWord}
        disabled={disabled}
        title="ייצוא ל-Word"
        style={{ ...btnBase, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
      >
        <i className="fa fa-file-word-o" /> Word
      </button>
      <button
        type="button"
        onClick={onPdf}
        disabled={disabled}
        title="ייצוא ל-PDF (דרך חלון הדפסה)"
        style={{ ...btnBase, background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
      >
        <i className="fa fa-file-pdf-o" /> PDF
      </button>
    </div>
  );
}
