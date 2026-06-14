import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ajax } from '../../api/client';
import PoweredByBizit from '../../lib/PoweredByBizit';
import './landing.css';

/* פרטי קשר — מרוכז במקום אחד */
const CONTACT = {
  phone: '050-000-0000',
  phoneHref: 'tel:0500000000',
  email: 'info@sganit.co.il',
  address: 'ישראל',
  hours: "א'–ה' 08:00–18:00",
};

const FEATURES = [
  { ic: 'fa-clock-o', t: 'שעות בית הספר', d: 'מגדירים את מבנה השבוע — ימים, שעות, ושעות שהייה — בלחיצות ספורות. הבסיס לכל מערכת.' },
  { ic: 'fa-users', t: 'ניהול מורים', d: 'כל מורה עם מכסת השעות, המקצוע הראשי, יום החופש והאילוצים האישיים — במקום אחד מסודר.' },
  { ic: 'fa-sitemap', t: 'כיתות והקבצות', d: 'שכבות, מקבילות, מחנכים והקבצות מרובות-שכבה — כולל חלוקה חכמה לקבוצות לימוד.' },
  { ic: 'fa-bolt', t: 'שיבוץ אוטומטי חכם', d: 'מנוע שמבין אילוצים אמיתיים ובונה את כל המערכת תוך דקות — מאזן עומסים ומונע התנגשויות.' },
  { ic: 'fa-th', t: 'תצוגת מטריצה', d: 'לראות את כל בית הספר במבט אחד, לגרור ולשנות ידנית, ולתפוס פערים בזמן אמת.' },
  { ic: 'fa-check-circle', t: 'מעקב כיסוי חי', d: 'אחוז שיבוץ מדויק לכל שכבה וכיתה — יודעים בכל רגע מה הושלם ומה עוד חסר.' },
];

const STEPS = [
  { t: 'מגדירים את בית הספר', d: 'אשף קצר מקים מקצועות, מורים, כיתות ושעות — או טוענים הכל מאקסל.' },
  { t: 'משייכים מורים וכיתות', d: 'קובעים מי מלמד מה וכמה שעות, מגדירים מחנכים והקבצות.' },
  { t: 'מריצים שיבוץ אוטומטי', d: 'המנוע בונה את המערכת המלאה בהתאם לכל האילוצים — בלי התנגשויות.' },
  { t: 'מכווננים ידנית', d: 'עריכה עדינה בתצוגת המטריצה, ומעקב כיסוי חי עד 100%.' },
];

const MARQUEE = [
  'אילוצים אמיתיים', 'איזון עומסים', 'הקבצות מרובות-שכבה', 'ימי חופש',
  'שעות שהייה', 'מעקב כיסוי חי', 'טעינה מאקסל', 'אפס התנגשויות', 'עברית מלאה · RTL',
];

/* ---- hook: חשיפה בגלילה ---- */
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const d = delay ? ` d${delay}` : '';
  return <div ref={ref} className={`lp-reveal${d}${seen ? ' is-in' : ''} ${className}`}>{children}</div>;
}

/* ---- hook: מונה מונפש ---- */
function useCountUp(target: number, run: boolean, dur = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, dur]);
  return val;
}

function StatCounter({ to, suffix, label }: { to: number; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setRun(true); io.disconnect(); } }), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const v = useCountUp(to, run);
  return (
    <div className="lp-stat" ref={ref}>
      <div className="lp-stat-v">{v}{suffix && <small>{suffix}</small>}</div>
      <div className="lp-stat-l">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const [form, setForm] = useState({ FullName: '', Phone: '', Email: '', SchoolName: '', Message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');

  function upd<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.FullName.trim() || (!form.Phone.trim() && !form.Email.trim())) {
      setStatus('err'); setErrMsg('נא למלא שם מלא ולפחות טלפון או אימייל.'); return;
    }
    setStatus('sending'); setErrMsg('');
    try {
      const res = await ajax<Array<{ ok?: number; Message?: string }>>('Contact_Insert', form);
      const row = Array.isArray(res) ? res[0] : undefined;
      if (row && Number(row.ok) === 1) setStatus('ok');
      else { setStatus('err'); setErrMsg(row?.Message || 'אירעה שגיאה בשליחה. נסו שוב.'); }
    } catch {
      setStatus('err'); setErrMsg('לא הצלחנו לשלוח את הפנייה. בדקו את החיבור ונסו שוב.');
    }
  }

  /* גרירת קרוסלת היכולות בעכבר */
  const carRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = carRef.current;
    if (!el) return;
    let down = false, startX = 0, startScroll = 0, moved = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; startX = e.clientX; startScroll = el.scrollLeft; el.classList.add('is-drag');
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      el.scrollLeft = startScroll + dx; // RTL: גרירה טבעית
    };
    const onUp = () => { down = false; el.classList.remove('is-drag'); };
    const onClick = (e: MouseEvent) => { if (moved) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, true);
    };
  }, []);

  /* מערכת שעות מדומה להירו */
  const schedFill = [
    ['f1', 'f2', 'f1', 'f3', 'f1'],
    ['f3', 'f1', 'f4', 'f1', 'f2'],
    ['f1', 'f4', 'f1', 'f2', 'f3'],
    ['f2', 'f1', 'f3', 'f1', 'f1'],
    ['f1', 'f3', 'f2', 'f4', 'f1'],
  ];
  const subjLabel: Record<string, string> = { f1: 'חשבון', f2: 'עברית', f3: 'תורה', f4: 'אנגלית' };
  const days = ["א'", "ב'", "ג'", "ד'", "ה'"];

  return (
    <div className="lp">
      {/* ניווט */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <div className="lp-brand-mark">ס</div>
            <div>
              <div className="lp-brand-name">סגנית</div>
              <PoweredByBizit height={13} style={{ fontSize: 10.5 }} />
            </div>
          </div>
          <div className="lp-nav-links">
            <a className="lp-nav-link is-hideable" href="#features">יכולות</a>
            <a className="lp-nav-link is-hideable" href="#how">איך זה עובד</a>
            <a className="lp-nav-link is-hideable" href="#contact">צרו קשר</a>
            <Link className="lp-btn lp-btn-primary" to="/Login">כניסה למערכת</Link>
          </div>
        </div>
      </nav>

      {/* הירו */}
      <header className="lp-hero">
        <div className="lp-blob b1" />
        <div className="lp-blob b2" />
        <div className="lp-blob b3" />
        <div className="lp-wrap lp-hero-grid">
          <div>
            <span className="lp-eyebrow lp-reveal is-in">שיבוץ שעות שעובד בשבילכם</span>
            <h1 className="lp-reveal is-in d1">
              מערכת שעות שלמה,<br />
              <span className="lp-grad-text">תוך דקות</span> —<br />
              לא שבועות.
            </h1>
            <p className="lp-hero-lead lp-reveal is-in d2">
              סגנית היא מערכת לסגני מנהל בבתי ספר יסודיים, שבונה את כל מערכת השעות
              באופן אוטומטי — מתחשבת בכל מורה, כיתה, הקבצה ואילוץ אישי, ומאזנת את העומסים
              בלי התנגשות אחת.
            </p>
            <div className="lp-hero-cta lp-reveal is-in d3">
              <a className="lp-btn lp-btn-glow lp-btn-lg" href="#contact"><i className="fa fa-paper-plane" /> דברו איתנו</a>
              <Link className="lp-btn lp-btn-ghost-light lp-btn-lg" to="/Login"><i className="fa fa-sign-in" /> כניסה למערכת</Link>
            </div>
            <div className="lp-hero-trust lp-reveal is-in d4">
              <span><i className="fa fa-check" /> שיבוץ ללא התנגשויות</span>
              <span><i className="fa fa-check" /> מותאם לבתי ספר יסודיים</span>
              <span><i className="fa fa-check" /> טעינה מאקסל</span>
            </div>
          </div>

          <div className="lp-reveal is-in d2">
            <div className="lp-sched">
              <div className="lp-sched-head">
                <span className="lp-sched-title">מערכת שכבה א׳</span>
                <span className="lp-sched-cov">100% כיסוי</span>
              </div>
              <div className="lp-sched-table">
                <div className="lp-sched-cell lp-sched-corner" />
                {days.map((d) => <div key={d} className="lp-sched-cell lp-sched-hd">{d}</div>)}
                {[1, 2, 3, 4, 5].map((h, ri) => (
                  <div key={`row-${h}`} style={{ display: 'contents' }}>
                    <div className="lp-sched-cell lp-sched-rowh">{h}</div>
                    {days.map((_, ci) => {
                      const cls = schedFill[ri][ci];
                      return (
                        <div key={`${ri}-${ci}`} className={`lp-sched-cell lp-sched-slot ${cls}`}
                          style={{ animationDelay: `${0.4 + (ri * 5 + ci) * 0.03}s` }}>
                          {subjLabel[cls]}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* מרקיזה אופקית */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span className="lp-marquee-item" key={i}><i className="fa fa-star" /> {m}</span>
          ))}
        </div>
      </div>

      {/* סטטיסטיקה */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-stats">
            <StatCounter to={100} suffix="%" label="כיסוי מערכת השעות" />
            <StatCounter to={0} label="התנגשויות בשיבוץ" />
            <StatCounter to={6} label="ימי לימוד נתמכים בשבוע" />
          </div>
        </div>
      </section>

      {/* בעיה → פתרון */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-section-head">
              <span className="lp-eyebrow">למה סגנית</span>
              <h2>שיבוץ ידני גוזל שבועות. אצלנו זה עניין של דקות.</h2>
              <p>כל סגן מנהל מכיר את הכאב — לוח גדול, פתקים, ושעות שלא מסתדרות. סגנית הופכת את כל התהליך לרגוע, מדויק ומהיר.</p>
            </div>
          </Reveal>
          <div className="lp-prob">
            <Reveal className="lp-prob-card lp-prob-before">
              <div className="lp-prob-tag">בלי סגנית</div>
              <h3>הדרך הישנה</h3>
              <ul className="lp-prob-list">
                <li><i className="fa fa-times-circle" /> ימים שלמים של עבודה ידנית בגיליונות</li>
                <li><i className="fa fa-times-circle" /> התנגשויות שמתגלות מאוחר מדי</li>
                <li><i className="fa fa-times-circle" /> עומס לא מאוזן בין המורים</li>
                <li><i className="fa fa-times-circle" /> כל שינוי קטן מפיל את כל הלוח</li>
              </ul>
            </Reveal>
            <Reveal className="lp-prob-card lp-prob-after" delay={2}>
              <div className="lp-prob-tag">עם סגנית</div>
              <h3>הדרך החדשה</h3>
              <ul className="lp-prob-list">
                <li><i className="fa fa-check-circle" /> שיבוץ מלא אוטומטי בלחיצת כפתור</li>
                <li><i className="fa fa-check-circle" /> אפס התנגשויות — המנוע מבטיח זאת</li>
                <li><i className="fa fa-check-circle" /> חלוקת עומסים הוגנת ומחושבת</li>
                <li><i className="fa fa-check-circle" /> שינויים מתעדכנים מיד בכל המערכת</li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* יכולות — קרוסלה אופקית */}
      <section className="lp-section lp-feat-band" id="features">
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-section-head">
              <span className="lp-eyebrow">היכולות</span>
              <h2>כל מה שצריך כדי לבנות מערכת</h2>
              <div className="lp-feat-hint"><i className="fa fa-arrow-left" /> גללו הצידה לגלות עוד</div>
            </div>
          </Reveal>
        </div>
        <div className="lp-wrap">
          <div className="lp-carousel" ref={carRef}>
            {FEATURES.map((f, i) => (
              <div className="lp-feat-card" key={f.t}>
                <div className="lp-feat-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="lp-feat-ic"><i className={`fa ${f.ic}`} /></div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* איך זה עובד */}
      <section className="lp-section" id="how">
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-section-head center">
              <span className="lp-eyebrow">התהליך</span>
              <h2>ארבעה שלבים עד מערכת מוכנה</h2>
            </div>
          </Reveal>
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.t} className="lp-step" delay={(i % 4) + 1}>
                <div className="lp-step-n">{i + 1}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ציטוט */}
      <section className="lp-section lp-quote-band">
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-quote">
              <p>
                <span className="lp-q-mark">”</span>
                סגנית נותנת לסגן המנהל בחזרה את הדבר היקר ביותר — את הזמן.
                במקום להילחם בגיליונות, אתם מנהלים בית ספר.
                <span className="lp-q-mark">“</span>
              </p>
              <cite>— הפילוסופיה שמאחורי המערכת</cite>
            </div>
          </Reveal>
        </div>
      </section>

      {/* טופס יצירת קשר */}
      <section className="lp-section lp-contact-band" id="contact">
        <div className="lp-blob bc" />
        <div className="lp-wrap lp-contact">
          <Reveal className="lp-contact-intro">
            <span className="lp-eyebrow">צרו קשר</span>
            <h2>רוצים לראות את סגנית בפעולה?</h2>
            <p>השאירו פרטים ונחזור אליכם עם הדגמה אישית, מותאמת לבית הספר שלכם.</p>
            <ul className="lp-contact-points">
              <li><span className="lp-cp-ic"><i className="fa fa-bolt" /></span><div><b>הדגמה חיה</b><span>סיור מודרך בכל יכולות המערכת</span></div></li>
              <li><span className="lp-cp-ic"><i className="fa fa-life-ring" /></span><div><b>ליווי והטמעה</b><span>עזרה בהקמת בית הספר וטעינת הנתונים</span></div></li>
              <li><span className="lp-cp-ic"><i className="fa fa-comments" /></span><div><b>מענה אישי</b><span>נחזור אליכם בהקדם, בלי בוטים</span></div></li>
            </ul>
          </Reveal>

          <Reveal delay={2}>
            <form className="lp-form" onSubmit={submit} noValidate>
              {status === 'ok' ? (
                <div className="lp-success">
                  <div className="lp-success-ic"><i className="fa fa-check" /></div>
                  <h3>הפנייה נשלחה!</h3>
                  <p>תודה ששלחתם. נחזור אליכם בהקדם האפשרי.</p>
                  <button type="button" className="lp-btn lp-btn-primary" style={{ marginTop: 18 }}
                    onClick={() => { setStatus('idle'); setForm({ FullName: '', Phone: '', Email: '', SchoolName: '', Message: '' }); }}>
                    שליחת פנייה נוספת
                  </button>
                </div>
              ) : (
                <>
                  <div className="lp-form-grid">
                    <div className="lp-field">
                      <label htmlFor="lpf-name">שם מלא <span className="lp-req">*</span></label>
                      <input id="lpf-name" className="lp-input" value={form.FullName} onChange={(e) => upd('FullName', e.target.value)} placeholder="שם פרטי ומשפחה" />
                    </div>
                    <div className="lp-field">
                      <label htmlFor="lpf-school">בית ספר</label>
                      <input id="lpf-school" className="lp-input" value={form.SchoolName} onChange={(e) => upd('SchoolName', e.target.value)} placeholder="שם בית הספר" />
                    </div>
                    <div className="lp-field">
                      <label htmlFor="lpf-phone">טלפון</label>
                      <input id="lpf-phone" className="lp-input" type="tel" value={form.Phone} onChange={(e) => upd('Phone', e.target.value)} placeholder="050-0000000" />
                    </div>
                    <div className="lp-field">
                      <label htmlFor="lpf-email">אימייל</label>
                      <input id="lpf-email" className="lp-input" type="email" value={form.Email} onChange={(e) => upd('Email', e.target.value)} placeholder="name@example.com" />
                    </div>
                    <div className="lp-field lp-col-2">
                      <label htmlFor="lpf-msg">הודעה</label>
                      <textarea id="lpf-msg" className="lp-textarea" value={form.Message} onChange={(e) => upd('Message', e.target.value)} placeholder="ספרו לנו קצת על בית הספר ומה אתם מחפשים..." />
                    </div>
                    {status === 'err' && <div className="lp-form-msg err"><i className="fa fa-exclamation-circle" /> {errMsg}</div>}
                  </div>
                  <div className="lp-form-foot">
                    <button type="submit" className="lp-btn lp-btn-glow lp-btn-lg" disabled={status === 'sending'}>
                      {status === 'sending' ? <><span className="lp-spin" /> שולח...</> : <><i className="fa fa-paper-plane" /> שליחת פנייה</>}
                    </button>
                    <span className="lp-form-note">חובה למלא שם, ולפחות טלפון או אימייל.</span>
                  </div>
                </>
              )}
            </form>
          </Reveal>
        </div>
      </section>

      {/* פוטר — פרטי קשר הכי למטה */}
      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-grid">
          <div className="lp-footer-about">
            <div className="lp-brand" style={{ marginBottom: 13 }}>
              <div className="lp-brand-mark">ס</div>
              <div>
                <div className="lp-brand-name">סגנית</div>
                <PoweredByBizit height={14} />
              </div>
            </div>
            <p>המערכת שמלווה את סגן המנהל בבניית מערכת השעות — מהקמה ועד שיבוץ מלא, בלי התנגשויות ובלי כאב ראש.</p>
          </div>
          <div>
            <h4>ניווט</h4>
            <ul className="lp-footer-list">
              <li><a href="#features">יכולות המערכת</a></li>
              <li><a href="#how">איך זה עובד</a></li>
              <li><a href="#contact">צרו קשר</a></li>
              <li><Link to="/Login">כניסה למערכת</Link></li>
            </ul>
          </div>
          <div>
            <h4>פרטי קשר</h4>
            <ul className="lp-footer-list">
              <li><i className="fa fa-phone" /> <a href={CONTACT.phoneHref}>{CONTACT.phone}</a></li>
              <li><i className="fa fa-envelope" /> <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
              <li><i className="fa fa-map-marker" /> {CONTACT.address}</li>
              <li><i className="fa fa-clock-o" /> {CONTACT.hours}</li>
            </ul>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} סגנית · כל הזכויות שמורות</span>
          <span>נבנה באהבה לעולם החינוך</span>
        </div>
      </footer>
    </div>
  );
}
