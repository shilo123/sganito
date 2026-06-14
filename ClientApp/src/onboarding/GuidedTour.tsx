import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TourDemo, { type DemoKind } from './TourDemo';
import './guidedTour.css';

interface Props {
  onClose: () => void;
  onExpandSidebar?: () => void;
}

interface Step {
  route?: string;        // הדף האמיתי שאליו מנווטים (רקע/הקשר)
  selector?: string;     // פקד אמיתי להצבעה (אופציונלי)
  demo?: DemoKind;       // הדגמה עצמאית עם דאטה מומצא — לא תלוי במסד הנתונים
  icon: string;
  title: string;
  text: string;
  hero?: boolean;
  emoji?: string;
}

/* רצף השלבים — ממוקד בארבע הפעולות שבונות את לב המערכת.
   כל הדגמה היא עצמאית (TourDemo) עם דאטה מומצא, כך שהיא עובדת
   זהה גם בבית ספר ריק לגמרי שאין בו עדיין מורים/כיתות/הקבצות. */
const STEPS: Step[] = [
  {
    hero: true, emoji: '🎓', icon: 'fa-graduation-cap',
    title: 'מדריך סגנית — איך בונים מערכת',
    text: 'נראה לכם בהדגמה חיה את ארבע הפעולות החשובות באמת: הגדרת מקצוע, גרירת מורים לכיתות, קביעת מחנכ/ת, ויצירת הקבצה — מההתחלה ועד הסוף. כל הדגמה רצה לבד, פשוט צפו ולמדו.',
  },

  {
    route: '/Config/Professional', demo: 'subject',
    icon: 'fa-book', title: 'הגדרת מקצוע',
    text: 'לוחצים "מקצוע חדש", מקלידים שם, ושומרים. אם המקצוע דורש שתי שעות צמודות (כמו מלאכה או מדעים במעבדה) — מסמנים "שעתיים ברצף", והמנוע תמיד ישבץ אותן יחד.',
  },
  {
    route: '/Config/TeacherClass', demo: 'dragClass',
    icon: 'fa-hand-pointer-o', title: 'גרירת מורה לכיתה',
    text: 'בפאנל המורים תופסים מורה עם העכבר, גוררים אותו אל כרטיס הכיתה ומשחררים — והמורה משויך/ת לכיתה. רוצים להסיר? גוררים את המורה בחזרה לפאנל המורים.',
  },
  {
    route: '/Config/TeacherClass', demo: 'homeroom',
    icon: 'fa-graduation-cap', title: 'קביעת מחנכ/ת',
    text: 'בראש כל כיתה יש שורת "מחנך/ת". לוחצים עליה, נפתח חלון בחירה, ובוחרים מורה — והוא/היא הופך/ת למחנך/ת הכיתה. אדום = עוד לא נקבע, ירוק = נקבע.',
  },
  {
    route: '/Config/TeacherClass', demo: 'hakbatza',
    icon: 'fa-object-group', title: 'יצירת הקבצה — מההתחלה לסוף',
    text: 'לוחצים "צור הקבצה חדשה", בוחרים לפחות שתי כיתות ומקצוע, ולוחצים "צור". ההקבצה נוצרת ריקה — ואז גוררים אליה מורה לכל קבוצת רמה. המנוע ישבץ את כל הקבוצות באותה שעה.',
  },

  {
    hero: true, emoji: '🎉', icon: 'fa-check',
    title: 'זהו — אלו הפעולות שבונות מערכת',
    text: 'הגדרתם מקצוע, גררתם מורים לכיתות, קבעתם מחנכ/ת ויצרתם הקבצה. עכשיו אפשר להריץ שיבוץ אוטומטי וליהנות ממערכת מלאה. אפשר להפעיל את המדריך שוב בכל רגע מכפתור "מדריך" בסרגל העליון.',
  },
];

const CONTENT_COUNT = STEPS.filter((s) => !s.hero).length;

interface Box { top: number; left: number; width: number; height: number; }

export default function GuidedTour({ onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [idx, setIdx] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [card, setCard] = useState<{ top: number; left: number; center: boolean }>({ top: 0, left: 0, center: true });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [clicking, setClicking] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;
  const isDemo = !!step.demo;

  /* ניווט לדף ההקשר של השלב */
  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [idx, step.route, location.pathname, navigate]);

  const cardFor = useCallback((rect: Box | null): { top: number; left: number; center: boolean } => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const cardH = cardRef.current?.offsetHeight ?? 320;
    const cardW = Math.min(step.hero ? 440 : 360, vw - 28);
    if (!rect) return { top: vh / 2, left: vw / 2, center: true };
    const gap = 18;
    let left: number, top: number;
    if (vw < 620) {
      left = Math.max(14, Math.min((vw - cardW) / 2, vw - cardW - 14));
      const below = rect.top + rect.height + gap;
      top = below + cardH <= vh - 12 ? below : Math.max(12, rect.top - gap - cardH);
    } else {
      const spaceLeft = rect.left;
      const spaceRight = vw - (rect.left + rect.width);
      if (spaceLeft >= cardW + gap + 8) left = rect.left - gap - cardW;
      else if (spaceRight >= cardW + gap + 8) left = rect.left + rect.width + gap;
      else left = Math.max(14, (vw - cardW) / 2);
      top = Math.max(14, Math.min(rect.top, vh - cardH - 14));
    }
    return { top, left, center: false };
  }, [step.hero]);

  const place = useCallback((rect: Box | null) => {
    if (!rect) { setSpot(null); setCursorPos(null); setCard(cardFor(null)); return; }
    setSpot(rect);
    setCursorPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setCard(cardFor(rect));
  }, [cardFor]);

  /* הצבה לפי סוג השלב */
  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    // הדגמה עצמאית או hero → אין צורך לאתר DOM; הכרטיס יוצב בנפרד
    if (step.hero || isDemo) { setSpot(null); setCursorPos(null); return; }

    if (!step.selector) { place(null); return; }
    const pad = 8;
    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        window.setTimeout(() => {
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          place({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
        }, 260);
        return;
      }
      tries += 1;
      if (tries < 24) window.setTimeout(tick, 150);
      else place(null);
    };
    const start = window.setTimeout(tick, 220);
    return () => { cancelled = true; window.clearTimeout(start); };
  }, [idx, step.selector, step.hero, isDemo, place]);

  /* פעימת "קליק" של הסמן (רק בשלב הצבעה רגיל) */
  useEffect(() => {
    if (!cursorPos) return;
    const beat = () => { setClicking(true); window.setTimeout(() => setClicking(false), 550); };
    const t0 = window.setTimeout(beat, 650);
    const iv = window.setInterval(beat, 1900);
    return () => { window.clearTimeout(t0); window.clearInterval(iv); };
  }, [cursorPos]);

  /* מקלדת */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' || e.key === 'Enter') setIdx((i) => Math.min(i + 1, STEPS.length - 1));
      else if (e.key === 'ArrowRight') setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const next = () => { if (isLast) onClose(); else setIdx((i) => i + 1); };
  const prev = () => setIdx((i) => Math.max(i - 1, 0));

  // בשלב הדגמה הכרטיס יושב בתחתית-מרכז כדי לא להסתיר את הבמה
  const cardClass = step.hero ? ' is-center' : isDemo ? ' is-bottom' : (card.center ? ' is-center' : '');
  const cardStyle: CSSProperties = (step.hero || isDemo || card.center) ? {} : { top: card.top, left: card.left };
  const stepNo = STEPS.slice(0, idx + 1).filter((s) => !s.hero).length;

  return (
    <div className="gt-root" role="dialog" aria-modal="true" aria-label="מדריך אינטראקטיבי">
      {isDemo ? (
        <>
          <div className="gt-demo-scrim" onClick={onClose} />
          <div className="gt-demo-wrap">
            <TourDemo kind={step.demo!} />
          </div>
        </>
      ) : spot ? (
        <div className="gt-spot" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} />
      ) : (
        <div className="gt-dim" onClick={onClose} />
      )}

      {cursorPos && !isDemo && (
        <div className="gt-cursor" style={{ left: cursorPos.x, top: cursorPos.y }}>
          <span className={`gt-cursor-ring${clicking ? ' is-click' : ''}`} />
        </div>
      )}

      <div ref={cardRef} className={`gt-card${cardClass}`} style={cardStyle}>
        {step.hero ? (
          <div className="gt-hero">
            <div className="gt-hero-emoji">{step.emoji}</div>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </div>
        ) : (
          <>
            <div className="gt-card-head">
              <div className="gt-card-icon"><i className={`fa ${step.icon}`} /></div>
              <div className="gt-step-badge"><i className="fa fa-map-signs" /> שלב {stepNo} מתוך {CONTENT_COUNT}</div>
              <h3 className="gt-card-title">{step.title}</h3>
            </div>
            <div className="gt-card-body">
              <p className="gt-card-desc">{step.text}</p>
              {isDemo && (
                <div className="gt-demo-hint"><i className="fa fa-play-circle" /> ההדגמה רצה למעלה — צפו איך עושים זאת</div>
              )}
            </div>
          </>
        )}

        <div className="gt-card-foot">
          <div className="gt-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`gt-dot${i === idx ? ' is-on' : ''}${i < idx ? ' is-done' : ''}`} />
            ))}
          </div>
          <div className="gt-actions">
            {idx > 0 && (
              <button type="button" className="gt-btn gt-btn-ghost" onClick={prev}>
                <i className="fa fa-arrow-right" /> חזור
              </button>
            )}
            <button type="button" className="gt-btn gt-btn-primary" onClick={next}>
              {isLast ? <><i className="fa fa-check" /> סיום</> : <>המשך <i className="fa fa-arrow-left" /></>}
            </button>
          </div>
        </div>

        {!isLast && (
          <button type="button" className="gt-skip-inline" onClick={onClose}>
            <i className="fa fa-times" /> דלג על המדריך
          </button>
        )}
      </div>
    </div>
  );
}
