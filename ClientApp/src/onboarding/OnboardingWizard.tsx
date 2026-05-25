import { useCallback, useEffect, useMemo, useState } from 'react';
import { ajax } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../lib/toast';
import './onboarding.css';

interface ProfessionalRow { ProfessionalId: number; Name: string; IsTwo: string; }
interface TeacherRow { TeacherId: number; FirstName: string; LastName: string; }
interface ClassRow { ClassId: number; Name: string; LayerId: number; }

const STEPS = [
  { key: 'welcome',  title: 'ברוכים הבאים' },
  { key: 'subjects', title: 'מקצועות' },
  { key: 'teachers', title: 'מורים' },
  { key: 'classes',  title: 'כיתות' },
  { key: 'hours',    title: 'שעות בית הספר' },
  { key: 'done',     title: 'סיום' },
] as const;

const LAYERS = [
  { id: 1, label: "א'" },
  { id: 2, label: "ב'" },
  { id: 3, label: "ג'" },
  { id: 4, label: "ד'" },
  { id: 5, label: "ה'" },
  { id: 6, label: "ו'" },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  // Data loaded from server
  const [subjects, setSubjects] = useState<ProfessionalRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classes,  setClasses]  = useState<ClassRow[]>([]);

  // Form state
  const [newSubject, setNewSubject] = useState('');
  const [newSubjectIsTwo, setNewSubjectIsTwo] = useState(false);

  const [newTeacherFirst, setNewTeacherFirst] = useState('');
  const [newTeacherLast,  setNewTeacherLast]  = useState('');

  const [newClassLayer, setNewClassLayer] = useState<number>(1);
  const [newClassName,  setNewClassName]  = useState('');

  // Excel paste state per step
  const [subjectsPaste, setSubjectsPaste] = useState('');
  const [teachersPaste, setTeachersPaste] = useState('');
  const [classesPaste,  setClassesPaste]  = useState('');

  const reloadAll = useCallback(async () => {
    try {
      const [sub, tch, cls] = await Promise.all([
        ajax<ProfessionalRow[]>('Professional_DML', { Type: 0, ProfessionalId: '', Name: '', isTwoHour: '' }),
        ajax<TeacherRow[]>('Teacher_GetTeacherList', { TeacherId: '' }),
        ajax<ClassRow[]>('Class_GetAllClass'),
      ]);
      setSubjects(Array.isArray(sub) ? sub : []);
      setTeachers(Array.isArray(tch) ? tch : []);
      setClasses(Array.isArray(cls) ? cls : []);
    } catch {
      // ignore - lists will stay empty
    }
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      await ajax('User_SetOnboardingState', { IsFirstLogin: 0, OnboardingStep: STEPS.length });
    } catch { /* ignore */ }
    setBusy(false);
    onComplete();
  }, [onComplete]);

  const goNext = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const goPrev = () => setStepIdx((i) => Math.max(i - 1, 0));

  async function addSubject() {
    if (!newSubject.trim()) return;
    try {
      await ajax('Professional_DML', {
        Type: 1, ProfessionalId: '', Name: newSubject.trim(), isTwoHour: newSubjectIsTwo ? 1 : 0,
      });
      setNewSubject(''); setNewSubjectIsTwo(false);
      await reloadAll();
    } catch { toast.error('שגיאה בהוספת מקצוע'); }
  }

  async function removeSubject(id: number) {
    try {
      await ajax('Professional_DML', { Type: 2, ProfessionalId: id, Name: '', isTwoHour: '' });
      await reloadAll();
    } catch { toast.error('שגיאה במחיקה'); }
  }

  async function addTeacher() {
    const f = newTeacherFirst.trim(), l = newTeacherLast.trim();
    if (!f && !l) return;
    try {
      await ajax('Teacher_DML', {
        Type: 1, TeacherId: '', FirstName: f, LastName: l,
        Tafkid: 1, ProfessionalId: '', Email: '', Frontaly: '', FreeDay: '',
        Tz: '', Shehya: '', Partani: '',
      });
      setNewTeacherFirst(''); setNewTeacherLast('');
      await reloadAll();
    } catch { toast.error('שגיאה בהוספת מורה'); }
  }

  async function removeTeacher(id: number) {
    try {
      await ajax('Teacher_DML', {
        Type: 2, TeacherId: id, FirstName: '', LastName: '', Tafkid: '', ProfessionalId: '',
        Email: '', Frontaly: '', FreeDay: '', Tz: '', Shehya: '', Partani: '',
      });
      await reloadAll();
    } catch { toast.error('שגיאה במחיקה'); }
  }

  async function addClass() {
    if (!newClassName.trim()) return;
    const inLayer = classes.filter((c) => c.LayerId === newClassLayer).length;
    try {
      await ajax('Class_SetClassData', {
        ClassId: '', LayerId: newClassLayer,
        ClassName: newClassName.trim(), Seq: inLayer + 1, mode: 1,
      });
      setNewClassName('');
      await reloadAll();
    } catch { toast.error('שגיאה בהוספת כיתה'); }
  }

  async function removeClass(id: number) {
    try {
      await ajax('Class_SetClassData', {
        ClassId: id, LayerId: '', ClassName: '', Seq: '', mode: 2,
      });
      await reloadAll();
    } catch { toast.error('שגיאה במחיקה'); }
  }

  // Excel paste - quick mode (one per line)
  async function importSubjectsPaste() {
    const names = subjectsPaste.split('\n').map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    setBusy(true);
    for (const name of names) {
      try {
        await ajax('Professional_DML', { Type: 1, ProfessionalId: '', Name: name, isTwoHour: 0 });
      } catch { /* continue */ }
    }
    setBusy(false);
    setSubjectsPaste('');
    toast.success(`נוספו ${names.length} מקצועות`);
    await reloadAll();
  }

  async function importTeachersPaste() {
    // קבל שורות "שם פרטי <tab> שם משפחה" או "שם פרטי שם משפחה"
    const lines = teachersPaste.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setBusy(true);
    let cnt = 0;
    for (const line of lines) {
      const parts = line.split(/\t|  +| /).filter(Boolean);
      const first = parts[0] || '';
      const last = parts.slice(1).join(' ') || '';
      if (!first && !last) continue;
      try {
        await ajax('Teacher_DML', {
          Type: 1, TeacherId: '', FirstName: first, LastName: last,
          Tafkid: 1, ProfessionalId: '', Email: '', Frontaly: '', FreeDay: '',
          Tz: '', Shehya: '', Partani: '',
        });
        cnt++;
      } catch { /* continue */ }
    }
    setBusy(false);
    setTeachersPaste('');
    toast.success(`נוספו ${cnt} מורים`);
    await reloadAll();
  }

  async function importClassesPaste() {
    // קבל שורות "שכבה <tab> שם כיתה" או "שם כיתה" (שכבה לפי האות הראשונה)
    const lines = classesPaste.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const layerByLetter: Record<string, number> = { "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6 };
    setBusy(true);
    let cnt = 0;
    for (const line of lines) {
      const parts = line.split(/\t|  +/).filter(Boolean);
      let layerId = 1;
      let name = parts[0] || '';
      if (parts.length >= 2) {
        const letter = (parts[0] || '').trim().charAt(0);
        if (layerByLetter[letter]) { layerId = layerByLetter[letter]; name = parts[1]; }
      } else {
        // ניחוש לפי האות הראשונה של השם
        const letter = (parts[0] || '').trim().charAt(0);
        if (layerByLetter[letter]) layerId = layerByLetter[letter];
      }
      if (!name) continue;
      const inLayer = classes.filter((c) => c.LayerId === layerId).length + cnt;
      try {
        await ajax('Class_SetClassData', {
          ClassId: '', LayerId: layerId, ClassName: name, Seq: inLayer + 1, mode: 1,
        });
        cnt++;
      } catch { /* continue */ }
    }
    setBusy(false);
    setClassesPaste('');
    toast.success(`נוספו ${cnt} כיתות`);
    await reloadAll();
  }

  const classesByLayer = useMemo(() => {
    const m: Record<number, ClassRow[]> = {};
    for (const c of classes) {
      const k = Number(c.LayerId) || 0;
      (m[k] = m[k] || []).push(c);
    }
    return m;
  }, [classes]);

  const cur = STEPS[stepIdx];

  function renderBody() {
    if (cur.key === 'welcome') {
      return (
        <div className="onb-welcome">
          <div className="onb-welcome-hero">👋</div>
          <h2>שלום {user?.UserName?.split(' ')[0] || ''} — ברוכים הבאים לסגנית!</h2>
          <p className="onb-welcome-lead">
            סגנית היא מערכת לניהול שיבוץ שעות בית הספר.
            נעבור יחד על כמה שלבים קצרים שיגדירו את בית הספר שלך — מקצועות, מורים, וכיתות.
            את כל השלבים אפשר לדלג, להמשיך מאוחר יותר, או לטעון מאקסל.
          </p>
          <div className="onb-features">
            <div className="onb-feature">
              <div className="onb-feature-icon">📚</div>
              <div className="onb-feature-title">מקצועות לימוד</div>
              <div className="onb-feature-desc">הגדר את כל המקצועות שמלמדים בבית הספר</div>
            </div>
            <div className="onb-feature">
              <div className="onb-feature-icon">👥</div>
              <div className="onb-feature-title">מורים</div>
              <div className="onb-feature-desc">הוסף את צוות ההוראה ופרטיהם</div>
            </div>
            <div className="onb-feature">
              <div className="onb-feature-icon">🏫</div>
              <div className="onb-feature-title">כיתות</div>
              <div className="onb-feature-desc">הגדר את הכיתות מסודרות לפי שכבות</div>
            </div>
            <div className="onb-feature">
              <div className="onb-feature-icon">⏰</div>
              <div className="onb-feature-title">שעות בית הספר</div>
              <div className="onb-feature-desc">לוח הזמנים השבועי - 6 ימים</div>
            </div>
          </div>
        </div>
      );
    }

    if (cur.key === 'subjects') {
      return (
        <div className="onb-two-col">
          <div>
            <div className="onb-form-row-multi">
              <div>
                <label className="onb-input-label">שם המקצוע</label>
                <input
                  className="onb-input"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="לדוגמה: מתמטיקה"
                  onKeyDown={(e) => { if (e.key === 'Enter') addSubject(); }}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="onb-input-label">&nbsp;</label>
                <label className="onb-checkbox" style={{ height: 44, alignItems: 'center' }}>
                  <input type="checkbox" checked={newSubjectIsTwo} onChange={(e) => setNewSubjectIsTwo(e.target.checked)} />
                  שעה כפולה
                </label>
              </div>
              <button type="button" className="onb-btn onb-btn-add" onClick={addSubject}>
                <i className="fa fa-plus"></i> הוסף
              </button>
            </div>

            <div className="onb-list">
              {subjects.length === 0 && <div className="onb-list-empty">עדיין לא נוספו מקצועות</div>}
              {subjects.map((s) => (
                <div key={s.ProfessionalId} className="onb-list-item">
                  <span className="onb-list-item-name">{s.Name}</span>
                  {s.IsTwo === 'כן' && <span className="onb-list-item-meta">שעה כפולה</span>}
                  <button className="onb-list-item-remove" onClick={() => removeSubject(s.ProfessionalId)} title="מחק">
                    <i className="fa fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>

            <div className="onb-paste-area">
              <div className="onb-paste-area-title">
                <i className="fa fa-table"></i> הדבקה מאקסל
              </div>
              <div className="onb-paste-hint">העתק עמודה מאקסל והדבק כאן - כל שורה תוסף כמקצוע</div>
              <textarea
                className="onb-paste-textarea"
                value={subjectsPaste}
                onChange={(e) => setSubjectsPaste(e.target.value)}
                placeholder="מתמטיקה&#10;עברית&#10;אנגלית&#10;..."
              />
              <button type="button" className="onb-btn onb-btn-add" style={{ marginTop: 10 }}
                onClick={importSubjectsPaste} disabled={!subjectsPaste.trim() || busy}>
                {busy ? <span className="onb-spinner"></span> : <i className="fa fa-upload"></i>} ייבא
              </button>
            </div>
          </div>

          <div className="onb-side-card">
            <h4>💡 על מקצועות</h4>
            <p>מקצוע הוא נושא הוראה כמו "מתמטיקה" או "תורה". כל מורה יכול ללמד מקצוע ראשי.</p>
            <ul>
              <li>"שעה כפולה" - מקצוע שדורש 2 שעות רצופות (כמו מלאכה).</li>
              <li>בהמשך תוכל לשייך כל מורה למקצוע ראשי.</li>
            </ul>
            <div className="onb-helper-strip">
              <i className="fa fa-info-circle"></i>
              <div>אפשר תמיד לחזור ולהוסיף עוד מקצועות בכל זמן מתפריט "הגדרות מקצועות בית ספר".</div>
            </div>
          </div>
        </div>
      );
    }

    if (cur.key === 'teachers') {
      return (
        <div className="onb-two-col">
          <div>
            <div className="onb-form-row-multi">
              <div>
                <label className="onb-input-label">שם פרטי</label>
                <input className="onb-input" value={newTeacherFirst} onChange={(e) => setNewTeacherFirst(e.target.value)}
                  placeholder="שם פרטי" style={{ width: '100%' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') addTeacher(); }} />
              </div>
              <div>
                <label className="onb-input-label">שם משפחה</label>
                <input className="onb-input" value={newTeacherLast} onChange={(e) => setNewTeacherLast(e.target.value)}
                  placeholder="שם משפחה" style={{ width: '100%' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') addTeacher(); }} />
              </div>
              <button type="button" className="onb-btn onb-btn-add" onClick={addTeacher}>
                <i className="fa fa-plus"></i> הוסף
              </button>
            </div>

            <div className="onb-list">
              {teachers.length === 0 && <div className="onb-list-empty">עדיין לא נוספו מורים</div>}
              {teachers.map((t) => (
                <div key={t.TeacherId} className="onb-list-item">
                  <span className="onb-list-item-name">{t.FirstName} {t.LastName}</span>
                  <button className="onb-list-item-remove" onClick={() => removeTeacher(t.TeacherId)} title="מחק">
                    <i className="fa fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>

            <div className="onb-paste-area">
              <div className="onb-paste-area-title">
                <i className="fa fa-table"></i> הדבקה מאקסל
              </div>
              <div className="onb-paste-hint">שתי עמודות (שם פרטי, שם משפחה) או "שם משפחה שם פרטי" בכל שורה</div>
              <textarea
                className="onb-paste-textarea"
                value={teachersPaste}
                onChange={(e) => setTeachersPaste(e.target.value)}
                placeholder="שרה כהן&#10;דוד לוי&#10;..."
              />
              <button type="button" className="onb-btn onb-btn-add" style={{ marginTop: 10 }}
                onClick={importTeachersPaste} disabled={!teachersPaste.trim() || busy}>
                {busy ? <span className="onb-spinner"></span> : <i className="fa fa-upload"></i>} ייבא
              </button>
            </div>
          </div>

          <div className="onb-side-card">
            <h4>👥 על מורים</h4>
            <p>הוסף בשלב זה רק שמות מורים. את הפרטים המלאים (שעות, מקצוע, יום חופש) תוכל למלא מאוחר יותר ב"ניהול מורים".</p>
            <ul>
              <li>בית ספר טיפוסי: 20-50 מורים</li>
              <li>אפשר לדלג ולמלא בהמשך</li>
            </ul>
            <div className="onb-helper-strip">
              <i className="fa fa-magic"></i>
              <div>טיפ: ב"ניהול מורים" יש כלי ייבוא אקסל מתקדם יותר עם תמיכה בכל השדות.</div>
            </div>
          </div>
        </div>
      );
    }

    if (cur.key === 'classes') {
      return (
        <div className="onb-two-col">
          <div>
            <div className="onb-form-row-multi">
              <div>
                <label className="onb-input-label">שכבה</label>
                <select className="onb-input" value={newClassLayer}
                  onChange={(e) => setNewClassLayer(Number(e.target.value))} style={{ width: '100%' }}>
                  {LAYERS.map((l) => <option key={l.id} value={l.id}>שכבה {l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="onb-input-label">שם הכיתה</label>
                <input className="onb-input" value={newClassName} onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="לדוגמה: א'1" style={{ width: '100%' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') addClass(); }} />
              </div>
              <button type="button" className="onb-btn onb-btn-add" onClick={addClass}>
                <i className="fa fa-plus"></i> הוסף
              </button>
            </div>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 360, overflowY: 'auto', padding: 4 }}>
              {LAYERS.map((l) => {
                const list = classesByLayer[l.id] || [];
                if (list.length === 0) return null;
                return (
                  <div key={l.id} style={{ background: '#faf6ff', borderRadius: 12, padding: 12, border: '1px solid #ede4ff' }}>
                    <div style={{ fontWeight: 700, color: '#4a2db2', fontSize: 13, marginBottom: 8 }}>
                      שכבה {l.label} ({list.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {list.map((c) => (
                        <div key={c.ClassId} className="onb-list-item" style={{ padding: '6px 10px', flex: 'none' }}>
                          <span className="onb-list-item-name" style={{ fontSize: 13 }}>{c.Name || `כיתה ${c.ClassId}`}</span>
                          <button className="onb-list-item-remove" onClick={() => removeClass(c.ClassId)} title="מחק">
                            <i className="fa fa-times"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {classes.length === 0 && <div className="onb-list-empty">עדיין לא נוספו כיתות</div>}
            </div>

            <div className="onb-paste-area">
              <div className="onb-paste-area-title">
                <i className="fa fa-table"></i> הדבקה מאקסל
              </div>
              <div className="onb-paste-hint">שתי עמודות: שכבה (א/ב/ג/ד/ה/ו) + שם הכיתה. או רק שם כיתה כשהאות הראשונה היא השכבה.</div>
              <textarea
                className="onb-paste-textarea"
                value={classesPaste}
                onChange={(e) => setClassesPaste(e.target.value)}
                placeholder="א&#9;א'1&#10;א&#9;א'2&#10;ב&#9;ב'1&#10;..."
              />
              <button type="button" className="onb-btn onb-btn-add" style={{ marginTop: 10 }}
                onClick={importClassesPaste} disabled={!classesPaste.trim() || busy}>
                {busy ? <span className="onb-spinner"></span> : <i className="fa fa-upload"></i>} ייבא
              </button>
            </div>
          </div>

          <div className="onb-side-card">
            <h4>🏫 על כיתות</h4>
            <p>כיתות מסודרות לפי שכבות (א'-ו'). בכל שכבה יכולות להיות כמה מקבילות.</p>
            <ul>
              <li>בית ספר יסודי טיפוסי: 4-8 כיתות בכל שכבה</li>
              <li>השם הוא חופשי (א'1, א'2, או כל שם אחר)</li>
            </ul>
          </div>
        </div>
      );
    }

    if (cur.key === 'hours') {
      return (
        <div className="onb-two-col">
          <div>
            <div className="onb-side-card" style={{ background: 'linear-gradient(135deg, #cffafe 0%, #e0faff 100%)', borderColor: '#a5f3fc' }}>
              <h4 style={{ color: '#0e7490' }}>⏰ לוח שעות בית הספר</h4>
              <p style={{ color: '#0e7490' }}>
                יצרנו עבורך כבר לוח בסיסי של 6 ימי לימוד (א'-ו') עם 9 שעות בכל יום
                (יום שישי 6 שעות בלבד). אפשר להתאים את המבנה בכל זמן.
              </p>
            </div>
            <div className="onb-helper-strip" style={{ marginTop: 14 }}>
              <i className="fa fa-cog"></i>
              <div>במסך "הגדרות שעות בית ספר" אפשר להגדיר אילו שעות פעילות, ואילו רק לשהייה.</div>
            </div>

            {/* Visual grid preview */}
            <div style={{ marginTop: 18, background: 'white', borderRadius: 14, padding: 14, border: '1px solid #ede4ff' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4a2db2', marginBottom: 10 }}>תצוגה מקדימה</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(9, 1fr)', gap: 4, fontSize: 11 }}>
                <div></div>
                {[1,2,3,4,5,6,7,8,9].map((h) => (
                  <div key={h} style={{ textAlign: 'center', fontWeight: 700, color: '#6b6675' }}>{h}</div>
                ))}
                {[
                  { name: "א'", count: 9 },
                  { name: "ב'", count: 9 },
                  { name: "ג'", count: 9 },
                  { name: "ד'", count: 9 },
                  { name: "ה'", count: 9 },
                  { name: "ו'", count: 6 },
                ].map((day) => (
                  <>
                    <div key={`d-${day.name}`} style={{ fontWeight: 700, color: '#6b6675', padding: '6px 4px' }}>{day.name}</div>
                    {[1,2,3,4,5,6,7,8,9].map((h) => (
                      <div key={`${day.name}-${h}`} style={{
                        height: 24, borderRadius: 4,
                        background: h <= day.count ? 'linear-gradient(135deg, #b89af5, #7147c1)' : '#f5f0ff',
                        opacity: h <= day.count ? 1 : 0.4,
                      }} />
                    ))}
                  </>
                ))}
              </div>
            </div>
          </div>

          <div className="onb-side-card">
            <h4>📋 שלב כמעט אחרון!</h4>
            <p>סיימת את ההגדרות הבסיסיות. בשלב הבא אפשר להמשיך לדפים השונים כדי להמשיך לעבוד.</p>
            <ul>
              <li><b>ניהול מורים</b> - השלמת פרטי מורים (שעות, מקצוע ראשי, יום חופש)</li>
              <li><b>הגדרות כיתות ומורים</b> - שיוך מורים לכיתות עם שעות</li>
              <li><b>שיבוץ אוטומטי</b> - יצירת מערכת השעות אוטומטית</li>
            </ul>
          </div>
        </div>
      );
    }

    if (cur.key === 'done') {
      return (
        <div className="onb-success">
          <div className="onb-success-icon">🎉</div>
          <h2>הכל מוכן!</h2>
          <p className="onb-success-lead">
            הגדרות הבסיס של בית הספר נשמרו. אפשר להתחיל לעבוד ולבנות את מערכת השעות.
          </p>
          <div className="onb-counts-grid">
            <div className="onb-count-pill">
              <div className="onb-count-pill-val">{subjects.length}</div>
              <div className="onb-count-pill-lbl">מקצועות</div>
            </div>
            <div className="onb-count-pill">
              <div className="onb-count-pill-val">{teachers.length}</div>
              <div className="onb-count-pill-lbl">מורים</div>
            </div>
            <div className="onb-count-pill">
              <div className="onb-count-pill-val">{classes.length}</div>
              <div className="onb-count-pill-lbl">כיתות</div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  const totalSteps = STEPS.length;
  const isLast = stepIdx === totalSteps - 1;

  return (
    <div className="onb-backdrop" role="dialog" aria-modal="true">
      <div className="onb-shell">
        <div className="onb-header">
          <div className="onb-brand">
            <div className="onb-brand-mark">ס</div>
            <div>
              <div className="onb-brand-name">אשף התחלה מהירה</div>
              <div className="onb-brand-sub">סגנית · ניהול שיבוץ</div>
            </div>
          </div>
          <div className="onb-stepper">
            {STEPS.map((s, i) => (
              <span key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
                <div className={`onb-step${i === stepIdx ? ' is-active' : ''}${i < stepIdx ? ' is-done' : ''}`}>
                  <div className="onb-step-num">{i < stepIdx ? <i className="fa fa-check"></i> : i + 1}</div>
                  <span>{s.title}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`onb-step-connect${i < stepIdx ? ' is-done' : ''}`}></div>}
              </span>
            ))}
          </div>
          <button type="button" className="onb-skip-all" onClick={finish} disabled={busy} title="דלג על הכל וסיים">
            דלג על האשף
          </button>
        </div>

        <div className="onb-body">
          <div className="onb-step-title">{cur.title}</div>
          <div className="onb-step-desc">
            {cur.key === 'welcome' && 'נכוון אותך בכמה שלבים קצרים — אפשר לדלג בכל שלב.'}
            {cur.key === 'subjects' && 'הוסף את המקצועות שמלמדים בבית הספר (אפשר גם להדביק מאקסל).'}
            {cur.key === 'teachers' && 'הוסף את צוות ההוראה — מספיק שם פרטי + שם משפחה לכל מורה.'}
            {cur.key === 'classes' && 'הגדר את הכיתות בכל שכבה. כל שכבה יכולה לכלול מספר מקבילות.'}
            {cur.key === 'hours' && 'מבנה ברירת המחדל של שעות הלימוד מוכן — אפשר להתאימו בכל זמן.'}
            {cur.key === 'done' && 'המערכת מוכנה לעבודה. אפשר להמשיך לדפי הניהול השונים.'}
          </div>
          {renderBody()}
        </div>

        <div className="onb-footer">
          <div className="onb-footer-info">
            שלב {stepIdx + 1} מתוך {totalSteps}
          </div>
          <div className="onb-footer-actions">
            {stepIdx > 0 && !isLast && (
              <button type="button" className="onb-btn onb-btn-ghost" onClick={goPrev} disabled={busy}>
                <i className="fa fa-arrow-right"></i> חזור
              </button>
            )}
            {!isLast && stepIdx > 0 && (
              <button type="button" className="onb-btn onb-btn-secondary" onClick={goNext} disabled={busy}>
                דלג על שלב זה
              </button>
            )}
            {!isLast && (
              <button type="button" className="onb-btn onb-btn-primary" onClick={goNext} disabled={busy}>
                {stepIdx === 0 ? 'בואו נתחיל' : 'המשך'} <i className="fa fa-arrow-left"></i>
              </button>
            )}
            {isLast && (
              <button type="button" className="onb-btn onb-btn-primary" onClick={finish} disabled={busy}>
                {busy ? <><span className="onb-spinner"></span> שומר...</> : <><i className="fa fa-check"></i> סיום והתחלה</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
