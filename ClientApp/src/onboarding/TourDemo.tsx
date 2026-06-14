import { useEffect, useRef, useState } from 'react';

/* ============================================================
   הדגמות למדריך — משתמשות ב-UI המקורי ממש (אותם class-ים מ-index.css),
   אך עם דאטה מומצא במקום דאטה מה-DB. כך ההדגמה נראית בדיוק כמו המערכת
   האמיתית ועובדת גם בבית ספר ריק לגמרי.
   כל הדגמה רצה בלולאה חלקה (requestAnimationFrame).
   ============================================================ */

export type DemoKind = 'subject' | 'dragClass' | 'homeroom' | 'hakbatza';

const STAGE_W = 780;
const STAGE_H = 430;

const CYCLE: Record<DemoKind, number> = {
  subject: 6400,
  dragClass: 4600,
  homeroom: 5200,
  hakbatza: 9800,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

interface WP { p: number; x: number; y: number }
function pathPos(p: number, pts: WP[]): { x: number; y: number } {
  if (p <= pts[0].p) return { x: pts[0].x, y: pts[0].y };
  const last = pts[pts.length - 1];
  if (p >= last.p) return { x: last.x, y: last.y };
  for (let i = 0; i < pts.length - 1; i++) {
    if (p >= pts[i].p && p <= pts[i + 1].p) {
      const t = ease((p - pts[i].p) / (pts[i + 1].p - pts[i].p));
      return { x: lerp(pts[i].x, pts[i + 1].x, t), y: lerp(pts[i].y, pts[i + 1].y, t) };
    }
  }
  return { x: last.x, y: last.y };
}
const clickAt = (p: number, c: number, w = 0.05) => (Math.abs(p - c) < w ? 1 - Math.abs(p - c) / w : 0);

function useLoop(kind: DemoKind): number {
  const [p, setP] = useState(0);
  const start = useRef<number>(0);
  useEffect(() => {
    let raf = 0;
    start.current = performance.now();
    const tick = (now: number) => {
      setP(((now - start.current) % CYCLE[kind]) / CYCLE[kind]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind]);
  return p;
}

/* ---------- סמן עכבר ---------- */
function Cursor({ x, y, click = 0 }: { x: number; y: number; click?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 40, pointerEvents: 'none' }}>
      {click > 0 && (
        <span style={{
          position: 'absolute', left: -16, top: -16, width: 32, height: 32, borderRadius: '50%',
          border: '3px solid rgba(124,58,237,0.75)', transform: `scale(${1 + click * 1.7})`, opacity: 1 - click,
        }} />
      )}
      <i className="fa fa-mouse-pointer" style={{
        fontSize: 25, color: '#0f1733', position: 'absolute', top: -2, left: -2,
        textShadow: '0 1px 3px rgba(255,255,255,.95), 0 2px 8px rgba(0,0,0,.35)',
      }} />
    </div>
  );
}

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="tc-page" style={{ position: 'relative', width: STAGE_W, height: STAGE_H, direction: 'rtl', fontFamily: "'Rubik', sans-serif" }}>
      {children}
    </div>
  );
}

/* ---------- פאנל המורים האמיתי, עם מורים מומצאים ---------- */
const FAKE_TEACHERS = [
  { name: 'כהן רותי', hours: 24, theme: 'primary' },
  { name: 'לוי דנה', hours: 22, theme: 'success' },
  { name: 'מזרחי אבי', hours: 20, theme: 'primary' },
];

function TeachersPanel({ left, hideIndex }: { left: number; hideIndex?: number }) {
  return (
    <div className="tc-page__teachers" style={{ position: 'absolute', left, top: 24, width: 220 }}>
      <div className="row dvWeek" style={{ margin: 0 }}>
        <div className="panel panel-info tc-teachers-panel" style={{ margin: 0 }}>
          <div className="panel-heading">
            <div className="tc-teachers-panel__heading">
              <span className="tc-teachers-panel__title-text">מורים</span>
              <button type="button" className="tc-teachers-panel__add"><i className="fa fa-plus" /><span>הוספה</span></button>
            </div>
          </div>
          <div className="panel-body droppable" style={{ height: 322, overflow: 'hidden' }}>
            <div className="tc-teachers-group">
              <div className="tc-teachers-group__header">
                <span className="tc-teachers-group__title">
                  <span className="tc-teachers-group__dot" style={{ background: '#4f46e5' }} />
                  מחנכ/ת כיתה
                </span>
                <span className="tc-teachers-group__count">{FAKE_TEACHERS.length}</span>
              </div>
              <div className="tc-teachers-grid">
                {FAKE_TEACHERS.map((t, i) => (
                  <div key={t.name} className={`btn btn-${t.theme} draggable`} style={{ opacity: hideIndex === i ? 0.2 : 1 }}>
                    {t.name}<span style={{ marginInlineStart: 4, opacity: 0.85, fontSize: '0.92em' }}>({t.hours})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- כותרת כיתה אמיתית ---------- */
function ClassHeading({ homeroom }: { homeroom: 'none' | 'set' }) {
  const isSet = homeroom === 'set';
  return (
    <div className="panel-heading tc-class-heading">
      <div className="tc-class-heading__topbar">
        <button type="button" className="btn btn-xs tc-class-edit-pill"><i className="fa fa-pencil" /> ערוך</button>
        <h3 className="tc-class-heading__title"><span className="tc-class-name">א' 1</span></h3>
        <button type="button" className="tc-class-close" aria-label="מחק כיתה"><i className="fa fa-times" /></button>
      </div>
      <div style={{
        width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', columnGap: 8,
        padding: '6px 10px', marginTop: 6, borderRadius: 8, textAlign: 'right', direction: 'rtl',
        background: isSet ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : 'linear-gradient(135deg, #fef2f2, #fee2e2)',
        border: `1.5px solid ${isSet ? '#10b981' : '#ef4444'}`,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 800, color: isSet ? '#065f46' : '#991b1b', whiteSpace: 'nowrap' }}>
          <i className={`fa ${isSet ? 'fa-graduation-cap' : 'fa-exclamation-triangle'}`} /> מחנך/ת
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: isSet ? '#065f46' : '#991b1b' }}>{isSet ? 'כהן רותי' : 'לא נקבע מחנך/ת'}</span>
        <i className="fa fa-pencil" style={{ fontSize: 11, color: isSet ? '#065f46' : '#991b1b', opacity: 0.7 }} />
      </div>
    </div>
  );
}

function ClassCard({ left, homeroom = 'none', bodyHeight = 150, children }: { left: number; homeroom?: 'none' | 'set'; bodyHeight?: number; children?: React.ReactNode }) {
  return (
    <div className="tc-page__classes" style={{ position: 'absolute', left, top: 24, width: 332 }}>
      <div className="tc-grid-4" style={{ display: 'block' }}>
        <div className="tc-grid-4__cell">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#dcfce7', color: '#16a34a', border: '1px solid #16a34a30', borderRadius: 4, marginBottom: 2, fontSize: 12, fontWeight: 700 }}>
            <span>סה"כ פרונטלי</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#0f172a', fontWeight: 800 }}>
              <span className="spTotal">{children ? 1 : 0}</span><span style={{ opacity: 0.6 }}>/</span><span>37</span>
            </span>
          </div>
          <div className="row dvWeek" style={{ width: '100%' }}>
            <div className="panel panel-primary">
              <ClassHeading homeroom={homeroom} />
              <div className="panel-body droppable" style={{ minHeight: bodyHeight, padding: 14 }}>
                {children ?? (
                  <div className="tc-drop-placeholder"><i className="fa fa-plus-circle" /><span>שחרר כאן להוספת המורה לכיתה</span></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ 1) גרירת מורה לכיתה ============ */
function DemoDragClass() {
  const p = useLoop('dragClass');
  const cur = pathPos(p, [
    { p: 0, x: 650, y: 380 }, { p: 0.12, x: 635, y: 150 }, { p: 0.2, x: 635, y: 150 },
    { p: 0.58, x: 200, y: 250 }, { p: 0.66, x: 200, y: 250 }, { p: 0.85, x: 200, y: 250 },
    { p: 1, x: 650, y: 380 },
  ]);
  const grabbed = p >= 0.18 && p < 0.64;
  const dropped = p >= 0.64;
  return (
    <Stage>
      <ClassCard left={30} homeroom="set" bodyHeight={150}>
        {dropped ? <div className="btn btn-primary" style={{ width: '100%' }}>כהן רותי</div> : undefined}
      </ClassCard>
      <TeachersPanel left={540} hideIndex={grabbed || dropped ? 0 : undefined} />
      {grabbed && (
        <div className="btn btn-primary" style={{ position: 'absolute', left: cur.x - 75, top: cur.y - 18, width: 150, zIndex: 30, transform: 'rotate(-3deg)', boxShadow: '0 16px 30px -8px rgba(124,58,237,.7)' }}>כהן רותי</div>
      )}
      <Cursor x={cur.x} y={cur.y} click={clickAt(p, 0.65)} />
    </Stage>
  );
}

/* ============ 2) קביעת מחנכ/ת ============ */
function DemoHomeroom() {
  const p = useLoop('homeroom');
  const cur = pathPos(p, [
    { p: 0, x: 520, y: 380 }, { p: 0.15, x: 390, y: 140 }, { p: 0.2, x: 390, y: 140 },
    { p: 0.45, x: 390, y: 250 }, { p: 0.5, x: 390, y: 250 }, { p: 0.7, x: 390, y: 140 },
    { p: 1, x: 520, y: 380 },
  ]);
  const pickerOpen = p >= 0.22 && p < 0.52;
  const isSet = p >= 0.52;
  return (
    <Stage>
      <ClassCard left={224} homeroom={isSet ? 'set' : 'none'} bodyHeight={90} />
      {/* פופאפ בחירת מחנך/ת — בסגנון מודאל המערכת */}
      {pickerOpen && (
        <div className="tm-modal__card" style={{ position: 'absolute', left: 250, top: 205, width: 280, zIndex: 35, maxWidth: 'none' }}>
          <div style={{ padding: '10px 14px', background: '#f6f3fe', fontSize: 12.5, fontWeight: 800, color: '#5b21b6' }}><i className="fa fa-search" /> בחר/י מחנך/ת</div>
          {['כהן רותי', 'לוי דנה'].map((n, i) => (
            <div key={n} style={{ padding: '11px 14px', fontSize: 14, fontWeight: 600, color: '#2d3658', background: i === 0 && p >= 0.45 ? '#ede9fe' : '#fff', borderTop: i ? '1px solid #f0ecfb' : 'none' }}>{n}</div>
          ))}
        </div>
      )}
      <Cursor x={cur.x} y={cur.y} click={Math.max(clickAt(p, 0.2), clickAt(p, 0.5))} />
    </Stage>
  );
}

/* ============ 3) הגדרת מקצוע (מודאל המערכת האמיתי) ============ */
function DemoSubject() {
  const p = useLoop('subject');
  const cur = pathPos(p, [
    { p: 0, x: 560, y: 350 }, { p: 0.1, x: 600, y: 70 }, { p: 0.14, x: 600, y: 70 },
    { p: 0.44, x: 300, y: 250 }, { p: 0.5, x: 300, y: 250 },
    { p: 0.64, x: 305, y: 320 }, { p: 0.7, x: 305, y: 320 },
    { p: 1, x: 560, y: 350 },
  ]);
  const modalOpen = p >= 0.16 && p < 0.8;
  const typed = p >= 0.3;
  const toggleOn = p >= 0.5;
  const saved = p >= 0.8;
  return (
    <Stage>
      <div className="btn btn-primary" style={{ position: 'absolute', left: 520, top: 52, width: 150 }}>
        <i className="fa fa-plus" /> מקצוע חדש
      </div>
      {modalOpen && (
        <div className="tm-modal__card" style={{ position: 'absolute', left: 180, top: 120, width: 420, maxWidth: 'none', zIndex: 30 }}>
          <header className="tm-modal__header">
            <div className="tm-modal__header-side">
              <span className="tm-modal__avatar"><i className="fa fa-plus" /></span>
              <div><h2 className="tm-modal__title">מקצוע חדש</h2></div>
            </div>
            <button type="button" className="tm-modal__close"><i className="fa fa-times" /></button>
          </header>
          <div className="tm-modal__body">
            <section className="tm-section">
              <label className="tm-field">
                <span className="tm-field__label">שם המקצוע <span className="tm-field__required">*</span></span>
                <span className="tm-field__input" style={{ display: 'block', minHeight: 20 }}>
                  {typed ? 'אנגלית' : <span style={{ color: '#b6bcd0' }}>לדוגמה: מתמטיקה</span>}
                </span>
              </label>
            </section>
            <section className="tm-section">
              <label className="pro-toggle">
                <span className="pro-toggle__track" style={{ background: toggleOn ? '#7c3aed' : undefined }}>
                  <span className="pro-toggle__thumb" style={{ transform: toggleOn ? 'translateX(18px)' : undefined }} />
                </span>
                <span className="pro-toggle__label">
                  <span className="pro-toggle__title">שעתיים ברצף</span>
                  <span className="pro-toggle__hint">המקצוע מועבר תמיד בשתי שעות צמודות</span>
                </span>
              </label>
            </section>
          </div>
          <footer className="tm-modal__footer">
            <div className="tm-modal__footer-primary">
              <button type="button" className="tm-btn tm-btn--primary"><i className="fa fa-plus" /> צור מקצוע</button>
              <button type="button" className="tm-btn tm-btn--ghost">ביטול</button>
            </div>
          </footer>
        </div>
      )}
      {saved && (
        <div style={{ position: 'absolute', left: 250, top: 200, background: '#dcfce7', color: '#065f46', fontWeight: 800, fontSize: 15, padding: '14px 22px', borderRadius: 12, border: '1.5px solid #10b981', zIndex: 30 }}>
          <i className="fa fa-check-circle" /> המקצוע "אנגלית" נוסף!
        </div>
      )}
      <Cursor x={cur.x} y={cur.y} click={Math.max(clickAt(p, 0.12), clickAt(p, 0.5), clickAt(p, 0.7))} />
    </Stage>
  );
}

/* ============ 4) יצירת הקבצה — מקצה לקצה ============ */
function HakCard({ teachers, showDrop }: { teachers: string[]; showDrop: boolean }) {
  return (
    <div className="hak-card" style={{ borderTop: '4px solid #059669', width: '100%' }}>
      <div className="hak-card__header" style={{ background: 'linear-gradient(135deg, #059669 0%, #059669dd 100%)', color: '#fff' }}>
        <div className="hak-card__title-row">
          <span className="hak-card__title-main"><i className="fa fa-object-group" /> אנגלית</span>
          <span className="hak-card__title-sub">#1</span>
        </div>
        <div className="hak-card__meta">
          <span className="hak-card__chip hak-card__chip--count"><i className="fa fa-user" /> {teachers.length}</span>
        </div>
        <div className="hak-card__classes">
          <span className="hak-card__class-pill">א'1</span>
          <span className="hak-card__class-pill">א'2</span>
        </div>
      </div>
      <div className="hak-card__body droppable">
        <div className="hak-card__teacher-list">
          {teachers.map((n) => (
            <div key={n} className="hak-card__teacher-row draggable">
              <div className="hak-card__teacher-pill" style={{ background: '#059669', color: '#fff' }}>{n}</div>
            </div>
          ))}
        </div>
        {showDrop && (
          <div className="hak-card__dropzone"><i className="fa fa-plus-circle" /> גררו מורים לכאן</div>
        )}
      </div>
    </div>
  );
}

function DemoHakbatza() {
  const p = useLoop('hakbatza');
  const wizardPhase = p < 0.52;
  const box1 = p >= 0.12, box2 = p >= 0.24;
  const ddOpen = p >= 0.3 && p < 0.42;
  const subjChosen = p >= 0.42;

  const t2 = (p - 0.52) / 0.48;
  const drag1Grab = t2 >= 0.12 && t2 < 0.42;
  const drag1Done = t2 >= 0.42;
  const drag2Grab = t2 >= 0.5 && t2 < 0.82;
  const drag2Done = t2 >= 0.82;
  const teachers = [drag1Done ? 'כהן רותי' : '', drag2Done ? 'לוי דנה' : ''].filter(Boolean);

  const curWizard = pathPos(p, [
    { p: 0, x: 520, y: 350 }, { p: 0.08, x: 210, y: 150 }, { p: 0.12, x: 210, y: 150 },
    { p: 0.2, x: 330, y: 150 }, { p: 0.24, x: 330, y: 150 },
    { p: 0.32, x: 440, y: 220 }, { p: 0.36, x: 440, y: 220 },
    { p: 0.42, x: 440, y: 272 }, { p: 0.46, x: 440, y: 220 },
    { p: 0.5, x: 390, y: 318 }, { p: 0.52, x: 390, y: 318 },
  ]);
  const curDrag = pathPos(t2, [
    { p: 0, x: 640, y: 370 }, { p: 0.12, x: 635, y: 150 }, { p: 0.18, x: 635, y: 150 },
    { p: 0.42, x: 190, y: 250 }, { p: 0.46, x: 190, y: 250 },
    { p: 0.5, x: 635, y: 200 }, { p: 0.56, x: 635, y: 200 },
    { p: 0.82, x: 190, y: 280 }, { p: 0.86, x: 190, y: 280 },
    { p: 1, x: 640, y: 370 },
  ]);

  return (
    <Stage>
      {wizardPhase ? (
        <>
          <div className="tm-modal__card" style={{ position: 'absolute', left: 110, top: 36, width: 560, maxWidth: 'none' }}>
            <header className="tm-modal__header">
              <div className="tm-modal__header-side">
                <span className="tm-modal__avatar"><i className="fa fa-object-group" /></span>
                <div><h2 className="tm-modal__title">יצירת הקבצה חדשה</h2></div>
              </div>
            </header>
            <div className="tm-modal__body">
              <section className="tm-section">
                <span className="tm-field__label" style={{ display: 'block', marginBottom: 8 }}>1. בחרו כיתות (לפחות 2)</span>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  {["א'1", "א'2", "א'3", "א'4"].map((c, i) => {
                    const on = (i === 0 && box1) || (i === 1 && box2);
                    return (
                      <div key={c} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 9, fontWeight: 700, fontSize: 14, border: `2px solid ${on ? '#7c3aed' : '#dcd6f0'}`, background: on ? '#ede9fe' : '#fff', color: on ? '#5b21b6' : '#6b7280' }}>
                        {on && <i className="fa fa-check" style={{ marginInlineStart: 4 }} />}{c}
                      </div>
                    );
                  })}
                </div>
                <span className="tm-field__label" style={{ display: 'block', marginBottom: 8 }}>2. בחרו מקצוע</span>
                <div style={{ position: 'relative' }}>
                  <div className="tm-field__input" style={{ display: 'flex', justifyContent: 'space-between', color: subjChosen ? '#2d3658' : '#b6bcd0' }}>
                    <span>{subjChosen ? 'אנגלית' : 'בחר מקצוע...'}</span><i className="fa fa-chevron-down" style={{ opacity: 0.5 }} />
                  </div>
                  {ddOpen && (
                    <div className="tm-modal__card" style={{ position: 'absolute', top: '108%', left: 0, right: 0, zIndex: 20, maxWidth: 'none' }}>
                      {['אנגלית', 'חשבון', 'תורה'].map((s, i) => (
                        <div key={s} style={{ padding: '10px 14px', fontSize: 14, fontWeight: 600, color: '#2d3658', background: i === 0 ? '#ede9fe' : '#fff' }}>{s}</div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
            <footer className="tm-modal__footer">
              <div className="tm-modal__footer-primary">
                <button type="button" className="tm-btn tm-btn--primary"><i className="fa fa-plus" /> צור הקבצה</button>
              </div>
            </footer>
          </div>
          <Cursor x={curWizard.x} y={curWizard.y} click={Math.max(clickAt(p, 0.12), clickAt(p, 0.24), clickAt(p, 0.36), clickAt(p, 0.46), clickAt(p, 0.51))} />
        </>
      ) : (
        <>
          <div className="tc-page__classes" style={{ position: 'absolute', left: 30, top: 30, width: 320 }}>
            <HakCard teachers={teachers} showDrop={!drag2Done} />
          </div>
          <TeachersPanel left={540} hideIndex={drag1Grab ? 0 : drag2Grab ? 1 : (drag1Done && !drag2Done ? 0 : undefined)} />
          {(drag1Grab || drag2Grab) && (
            <div className="hak-card__teacher-pill" style={{ position: 'absolute', left: curDrag.x - 70, top: curDrag.y - 16, width: 140, background: '#059669', color: '#fff', zIndex: 30, transform: 'rotate(-3deg)', boxShadow: '0 16px 30px -8px rgba(5,150,105,.7)' }}>
              {drag1Grab ? 'כהן רותי' : 'לוי דנה'}
            </div>
          )}
          <Cursor x={curDrag.x} y={curDrag.y} click={Math.max(clickAt(t2, 0.43), clickAt(t2, 0.83))} />
        </>
      )}
    </Stage>
  );
}

export default function TourDemo({ kind }: { kind: DemoKind }) {
  if (kind === 'dragClass') return <DemoDragClass />;
  if (kind === 'homeroom') return <DemoHomeroom />;
  if (kind === 'subject') return <DemoSubject />;
  return <DemoHakbatza />;
}
