import type { CSSProperties } from 'react';

/**
 * תג מיתוג "מבית BIZIT" — מציג את הלוגו של Bizit ליד הטקסט.
 * variant 'light' לרקע בהיר, 'dark' לרקע כהה.
 */
export default function PoweredByBizit({
  variant = 'light',
  height = 15,
  style,
}: {
  variant?: 'light' | 'dark';
  height?: number;
  style?: CSSProperties;
}) {
  const color = variant === 'dark' ? 'rgba(255,255,255,0.82)' : '#7a738c';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '.02em',
        color,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      מבית
      <img
        src="/bizit-logo.svg"
        alt="BIZIT"
        style={{ height, width: 'auto', display: 'block' }}
      />
    </span>
  );
}
