import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

interface Teacher {
  TeacherId: number | string;
  FullText?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  TafkidId?: number | string | null;
  Tafkid?: string | null;
  ProfessionalId?: number | string | null;
  Professional?: string | null;
  Email?: string | null;
  FreeDay?: number | string | null;
  Frontaly?: number | string | null;
  Tz?: string | null;
  Shehya?: number | string | null;
  Partani?: number | string | null;
  [k: string]: unknown;
}

interface TeacherHourRow {
  HourId: number | string;
  HourTypeId?: number | string | null;
  HourType?: string | null;
  ClassId?: number | string | null;
  ClassNameAssign?: string | null;
  className?: string | null;
  Professional?: string | null;
  [k: string]: unknown;
}

const DAYS: { num: number; label: string }[] = [
  { num: 1, label: 'יום ראשון' },
  { num: 2, label: 'יום שני' },
  { num: 3, label: 'יום שלישי' },
  { num: 4, label: 'יום רביעי' },
  { num: 5, label: 'יום חמישי' },
  { num: 6, label: 'יום שישי' },
];

function getDayInWeekString(v: string | number | null | undefined): string {
  const n = Number(v);
  switch (n) {
    case 1: return 'יום ראשון';
    case 2: return 'יום שני';
    case 3: return 'יום שלישי';
    case 4: return 'יום רביעי';
    case 5: return 'יום חמישי';
    case 6: return 'יום שישי';
    default: return '';
  }
}

function isNullDB(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

// תאי שעות מקובצים לפי יום עם תצוגת label לכל שעה
interface HourCell {
  hourId: string;
  day: number;
  seq: number;
  HourTypeId: number;
  label: string;
}

function buildHourCellsForDay(day: number, rawRows: TeacherHourRow[]): HourCell[] {
  // מיזוג כפילויות על אותו HourId (תרחיש מחצית כיתה) - בדומה ל-while j+1 המקורי
  const byId = new Map<string, HourCell>();
  const sorted = rawRows.filter((r) => {
    const d = Number(String(r.HourId).charAt(0));
    return d === day;
  });

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const HourIdStr = String(row.HourId);
    const seq = Number(HourIdStr.slice(1));
    const HourTypeId = Number(row.HourTypeId ?? 0);
    const HourTypeText = row.HourType ?? '';
    let ClassNameAssign = row.ClassNameAssign ?? '';
    let classHalf = row.className ?? '';

    let j = i;
    while (
      sorted[j + 1] &&
      sorted[j].ClassId !== sorted[j + 1].ClassId &&
      sorted[j].HourId === sorted[j + 1].HourId
    ) {
      classHalf += '/' + (sorted[j + 1].className ?? '');
      j++;
      ClassNameAssign = classHalf;
    }
    i = j;

    let label = String(HourTypeText ?? '');
    if (HourTypeId === 1) {
      const prof = row.Professional ? row.Professional : 'מקצוע';
      label = `${ClassNameAssign} - ${prof}`;
    }

    byId.set(HourIdStr, {
      hourId: HourIdStr,
      day,
      seq,
      HourTypeId,
      label,
    });
  }

  return Array.from(byId.values()).sort((a, b) => a.seq - b.seq);
}

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  hourId: string;
  HourTypeId: number;
};

export default function TeacherHours() {
  const { user } = useAuth();
  const configurationId = user?.ConfigurationId ?? '';

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [teacherHours, setTeacherHours] = useState<TeacherHourRow[]>([]);
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    hourId: '',
    HourTypeId: 0,
  });

  const dragMode = useRef<null | 'add' | 'remove'>(null);
  const dragStarted = useRef(false);

  const loadTeachers = useCallback(async () => {
    if (!configurationId) return;
    const data = await ajax<Teacher[]>('Teacher_GetTeacherList', { TeacherId: 0 });
    setTeachers(Array.isArray(data) ? data : []);
  }, [configurationId]);

  const loadTeacherHours = useCallback(async (teacherId: Teacher['TeacherId']) => {
    const data = await ajax<TeacherHourRow[]>('Teacher_GetTeacherHours', { TeacherId: teacherId });
    setTeacherHours(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    if (selectedTeacher) {
      loadTeacherHours(selectedTeacher.TeacherId);
    } else {
      setTeacherHours([]);
    }
  }, [selectedTeacher, loadTeacherHours]);

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      String(t.FullText ?? `${t.FirstName ?? ''} ${t.LastName ?? ''}`).toLowerCase().includes(q),
    );
  }, [teachers, search]);

  // מפת שעות לפי HourId לצורך זיהוי מהיר אם השעה משובצת
  const hourMap = useMemo(() => {
    const m: Record<string, TeacherHourRow> = {};
    for (const r of teacherHours) m[String(r.HourId)] = r;
    return m;
  }, [teacherHours]);

  const dayCells = useMemo(() => {
    const out: Record<number, HourCell[]> = {};
    for (const d of DAYS) out[d.num] = buildHourCellsForDay(d.num, teacherHours);
    return out;
  }, [teacherHours]);

  const setHour = useCallback(
    async (hourId: string, type: 1 | 2) => {
      if (!selectedTeacher) return;
      try {
        await ajax('Teacher_SetTeacherHours', {
          TeacherId: selectedTeacher.TeacherId,
          HourId: hourId,
          Type: type,
        });
        await loadTeacherHours(selectedTeacher.TeacherId);
      } catch (e) {
        console.error('Teacher_SetTeacherHours failed', e);
      }
    },
    [selectedTeacher, loadTeacherHours],
  );

  const onCellMouseDown = (e: React.MouseEvent, hourId: string) => {
    if (e.button !== 0 || !selectedTeacher) return;
    const existing = hourMap[hourId];
    dragStarted.current = true;
    if (existing) {
      // CallBackRemove: אם יש טקסט מקצוע/כיתה (כלומר HourTypeId==1 עם שיבוץ), אל תסיר
      if (Number(existing.HourTypeId) === 1 && existing.ClassNameAssign) {
        dragMode.current = null;
        return;
      }
      dragMode.current = 'remove';
      setHour(hourId, 2);
    } else {
      dragMode.current = 'add';
      setHour(hourId, 1);
    }
  };

  const onCellMouseEnter = (hourId: string) => {
    if (!dragStarted.current || !dragMode.current || !selectedTeacher) return;
    const existing = hourMap[hourId];
    if (dragMode.current === 'add' && !existing) setHour(hourId, 1);
    else if (dragMode.current === 'remove' && existing) {
      if (Number(existing.HourTypeId) === 1 && existing.ClassNameAssign) return;
      setHour(hourId, 2);
    }
  };

  useEffect(() => {
    const stop = () => {
      dragStarted.current = false;
      dragMode.current = null;
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const onCellContextMenu = (e: React.MouseEvent, cell: HourCell) => {
    e.preventDefault();
    // תפריט ימני רק לשעות שאינן HourTypeId==1 (שיבוץ רגיל), כמו במקור
    if (cell.HourTypeId === 1) return;
    if (!selectedTeacher) return;
    setMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      hourId: cell.hourId,
      HourTypeId: cell.HourTypeId,
    });
  };

  useEffect(() => {
    if (!menu.visible) return;
    const close = () => setMenu((m) => ({ ...m, visible: false }));
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu.visible]);

  // פעולות תפריט ימני - שימו לב: הגדרת שהייה/פרטני מלאה דורשת חלון מודלי
  // ופעולות Teacher_SetPartani / Teacher_SetGroupShehya. כאן מביאים את הבסיס
  // ומפעילים את Teacher_SetPartani כפי שעושה SetPartani באסמ"י המקורית.
  const callSetPartani = useCallback(
    async (hourId: string, type: 1 | 2) => {
      if (!selectedTeacher) return;
      try {
        const res = await ajax<{ res: number }[]>('Teacher_SetPartani', {
          HourId: hourId,
          TeacherId: selectedTeacher.TeacherId,
          Type: type,
        });
        const code = Number(res?.[0]?.res ?? 0);
        if (code === 1) {
          alert('מורה משובץ לשעה זו');
        } else if (code === 2) {
          alert('נגמרה הקצאת שעות פרטני למורה');
        } else {
          await loadTeacherHours(selectedTeacher.TeacherId);
        }
      } catch (e) {
        console.error('Teacher_SetPartani failed', e);
      }
    },
    [selectedTeacher, loadTeacherHours],
  );

  const onMenuDefineShehya = () => {
    // במקור OpenShyaPartani(Obj, 1) פותח חלון מודלי לבחירת קבוצה ומורים.
    // השארנו כאן הודעה שמציינת שדרושה הגדרת שהייה מלאה; ניתן להרחיב בהמשך.
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    alert('הגדרת שהייה - חלון מודלי של קבוצות שהייה עדיין לא הותמר. יש להוסיף אותו בנפרד.');
    void id;
  };

  const onMenuSetPartani = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    callSetPartani(id, 1);
  };

  const onMenuClearPartani = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    callSetPartani(id, 2);
  };

  const pickTeacher = (t: Teacher) => {
    setSelectedTeacher(t);
    setSearch(String(t.FullText ?? `${t.FirstName ?? ''} ${t.LastName ?? ''}`));
  };

  const resetTeacher = () => {
    setSelectedTeacher(null);
    setSearch('');
  };

  const frontaly = selectedTeacher?.Frontaly ?? 0;
  const teacherFullName = selectedTeacher
    ? `${selectedTeacher.FirstName ?? ''} ${selectedTeacher.LastName ?? ''}`.trim()
    : '';

  return (
    <>
      <div className="col-md-12">
        <div className="row dvWeek">
          <div className="panel panel-info">
            <div className="panel-heading">
              <h3 className="panel-title">&nbsp;בחירת מורה</h3>
            </div>
            <div className="panel-body">
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="חיפוש שם או שם משפחה"
                  value={search}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearch(v);
                    if (!v) resetTeacher();
                  }}
                />
                {search && !selectedTeacher && filteredTeachers.length > 0 && (
                  <ul
                    className="dropdown-menu"
                    style={{
                      display: 'block',
                      position: 'static',
                      width: '100%',
                      maxHeight: 240,
                      overflowY: 'auto',
                    }}
                  >
                    {filteredTeachers.slice(0, 15).map((t) => (
                      <li key={String(t.TeacherId)}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            pickTeacher(t);
                          }}
                        >
                          {String(t.FullText ?? `${t.FirstName ?? ''} ${t.LastName ?? ''}`)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedTeacher && (
        <div className="col-md-12" id="dvAllDays">
          <div className="row dvWeek">
            <div className="panel panel-info">
              <div className="panel-heading">
                <h3 className="panel-title">
                  &nbsp; שעות למורה- <span className="spTeacherName">{teacherFullName}</span>
                </h3>
              </div>
              <div className="panel-body">
                <div className="col-md-10">
                  <h5 style={{ fontStyle: 'italic' }}>
                    בחר שעות ע"י לחיצה וגרירה , לביטול לחץ וגרור שוב.
                  </h5>
                </div>
                <div className="col-md-2" style={{ textAlign: 'left' }}>
                  <div className="btn btn-info btn-round" style={{ margin: 1 }}>
                    סה"כ שעות פרונטלי{' '}
                    <span className="badge" id="spFrontalyTotals">
                      {String(frontaly)}
                    </span>
                  </div>
                </div>
                <div className="dvDaysCotainer">
                  {DAYS.map((d) => (
                    <div className="col-md-2" key={d.num}>
                      <div className="panel panel-info">
                        <div className="panel-heading">
                          <h3 className="panel-title">&nbsp; {d.label}</h3>
                        </div>
                        <div className="panel-body" id={`dv${d.num}`}>
                          {(dayCells[d.num] ?? []).map((cell) => (
                            <div
                              key={cell.hourId}
                              id={cell.hourId}
                              className={`dv_HourTypeId_${cell.HourTypeId} selected`}
                              style={{ userSelect: 'none', cursor: 'pointer' }}
                              onMouseDown={(e) => onCellMouseDown(e, cell.hourId)}
                              onMouseEnter={() => onCellMouseEnter(cell.hourId)}
                              onContextMenu={(e) => onCellContextMenu(e, cell)}
                            >
                              <span className="spSeqNumber">
                                {cell.seq}){' '}
                                <span id={`spHourType_${cell.hourId}`}>{cell.label}</span>
                              </span>
                              &nbsp;
                            </div>
                          ))}
                          {/* תאי ריקים ללחיצה על שעות שאינן מוגדרות ביום (מאפשר הוספה) */}
                          {SLOTS_PER_DAY(d.num).map((seq) => {
                            const hourId = `${d.num}${seq}`;
                            if (hourMap[hourId]) return null;
                            return (
                              <div
                                key={`empty-${hourId}`}
                                id={hourId}
                                className="dv_empty"
                                style={{
                                  userSelect: 'none',
                                  cursor: 'pointer',
                                  color: '#aaa',
                                  fontStyle: 'italic',
                                }}
                                onMouseDown={(e) => onCellMouseDown(e, hourId)}
                                onMouseEnter={() => onCellMouseEnter(hourId)}
                              >
                                <span className="spSeqNumber">{seq})</span>&nbsp;
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="clear">&nbsp;</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="col-md-12">
        <div id="dvTeacherTable" style={{ paddingTop: 20 }}>
          <div className="col-md-2 dvRequireTitle">שם מורה</div>
          <div className="col-md-2 dvRequireTitle">תפקיד</div>
          <div className="col-md-2 dvRequireTitle">מקצוע</div>
          <div className="col-md-2 dvRequireTitle">יום חופשי</div>
          <div className="col-md-2 dvRequireTitle">שעות שהייה</div>
          <div className="col-md-1 dvRequireTitle">שעות פרטני</div>
          <div className="col-md-1 dvRequireTitle">&nbsp;</div>
          <div id="dvReqContainer" className="dvPanelReq clear">
            {teachers.map((t) => (
              <div key={String(t.TeacherId)}>
                <div className="col-md-2 dvRequireDetails">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      pickTeacher(t);
                    }}
                  >
                    {isNullDB(t.FullText)}
                  </a>
                </div>
                <div className="col-md-2 dvRequireDetails">{isNullDB(t.Tafkid)}</div>
                <div className="col-md-2 dvRequireDetails">{isNullDB(t.Professional)}</div>
                <div className="col-md-2 dvRequireDetails">{getDayInWeekString(t.FreeDay)}</div>
                <div className="col-md-2 dvRequireDetails">{isNullDB(t.Shehya)}</div>
                <div className="col-md-1 dvRequireDetails">{isNullDB(t.Partani)}</div>
                <div className="col-md-1 dvRequireDetails">&nbsp;</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {menu.visible && (
        <ul
          className="dropdown-menu dropdown-menu-right"
          role="menu"
          style={{
            display: 'block',
            position: 'fixed',
            top: menu.y,
            left: menu.x,
            zIndex: 2000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <li>
            <a
              id="li1"
              tabIndex={-1}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onMenuDefineShehya();
              }}
            >
              הגדרת שהייה
            </a>
          </li>
          <li>
            <a
              id="li2"
              tabIndex={-1}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onMenuSetPartani();
              }}
            >
              הגדרת פרטני
            </a>
          </li>
          <li>
            <a
              id="li3"
              tabIndex={-1}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onMenuClearPartani();
              }}
            >
              ביטול פרטני
            </a>
          </li>
          <li className="divider" />
          <li>
            <a
              tabIndex={-1}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMenu((m) => ({ ...m, visible: false }));
              }}
            >
              סגור
            </a>
          </li>
        </ul>
      )}
    </>
  );
}

function SLOTS_PER_DAY(day: number): number[] {
  // יום שישי - 6 שעות, שאר הימים - 9 שעות (תואם ל-SchoolHours.aspx המקורי)
  const max = day === 6 ? 6 : 9;
  return Array.from({ length: max }, (_, i) => i + 1);
}
