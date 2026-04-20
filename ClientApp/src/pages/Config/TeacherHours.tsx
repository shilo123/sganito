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
  const [tafkidOptions, setTafkidOptions] = useState<Array<{ TafkidId: number; Name: string }>>([]);
  const [classOptions, setClassOptions] = useState<Array<{ ClassId: number; ClassName: string }>>([]);
  const [filterName, setFilterName] = useState('');
  const [filterTafkid, setFilterTafkid] = useState<string>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
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
    const data = await ajax<Teacher[]>('Teacher_GetTeacherList', { TeacherId: '' });
    setTeachers(Array.isArray(data) ? data : []);
  }, [configurationId]);

  const loadTeacherHours = useCallback(async (teacherId: Teacher['TeacherId']) => {
    const data = await ajax<TeacherHourRow[]>('Teacher_GetTeacherHours', { TeacherId: teacherId });
    setTeacherHours(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    Promise.allSettled([
      loadTeachers(),
      ajax<Array<{ TafkidId: number; Name: string }>>('Gen_GetTable', { TableName: 'Tafkid', Condition: '' })
        .then((rows) => { if (!cancelled) setTafkidOptions(Array.isArray(rows) ? rows : []); }),
      ajax<Array<{ ClassId: number; ClassName: string; LayerId?: number }>>('Class_GetAllClass')
        .then((rows) => { if (!cancelled) setClassOptions(Array.isArray(rows) ? rows : []); }),
    ]).finally(() => {
      if (!cancelled) setInitialLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadTeachers]);

  const sortedTeachers = useMemo(() => {
    const toStr = (v: unknown) => (v == null ? '' : String(v));
    return [...teachers].sort((a, b) => {
      const ta = Number(a.TafkidId ?? 999);
      const tb = Number(b.TafkidId ?? 999);
      if (ta !== tb) return ta - tb;
      return toStr(a.FullText).localeCompare(toStr(b.FullText), 'he');
    });
  }, [teachers]);

  const tableTeachers = useMemo(() => {
    const nameQ = filterName.trim().toLowerCase();
    const tafQ = filterTafkid.trim();
    const clsQ = filterClass.trim();
    return sortedTeachers.filter((t) => {
      if (nameQ) {
        const hay = String(t.FullText ?? `${t.FirstName ?? ''} ${t.LastName ?? ''}`).toLowerCase();
        if (!hay.includes(nameQ)) return false;
      }
      if (tafQ && String(t.TafkidId ?? '') !== tafQ) return false;
      if (clsQ) {
        const mc = (t as { ManageClassId?: unknown }).ManageClassId;
        if (mc == null || String(mc) !== clsQ) return false;
      }
      return true;
    });
  }, [sortedTeachers, filterName, filterTafkid, filterClass]);

  useEffect(() => {
    if (selectedTeacher) {
      loadTeacherHours(selectedTeacher.TeacherId);
    } else {
      setTeacherHours([]);
    }
  }, [selectedTeacher, loadTeacherHours]);

  useEffect(() => {
    if (!selectedTeacher) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetTeacher();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacher]);

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
      {initialLoading && (
        <div className="page-loading-overlay" role="status" aria-live="polite" aria-label="טוען">
          <div className="page-loading-overlay__card">
            <div className="page-loading-overlay__orb">
              <span /><span /><span />
            </div>
            <div className="page-loading-overlay__title">טוען הגדרות מורים</div>
            <div className="page-loading-overlay__subtitle">מאחזר רשימת מורים, תפקידים וכיתות...</div>
            <div className="page-loading-overlay__bar"><div /></div>
          </div>
        </div>
      )}
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
        <div
          className="th-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`שעות למורה - ${teacherFullName}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) resetTeacher();
          }}
        >
          <div className="th-modal__shell" id="dvAllDays">
            <div className="th-modal__header">
              <div className="th-modal__heading">
                <div className="th-modal__kicker">הגדרת שעות שבועיות</div>
                <h2 className="th-modal__title">{teacherFullName}</h2>
              </div>
              <div className="th-modal__stats">
                <div className="th-stat th-stat--primary">
                  <span className="th-stat__val">{String(frontaly)}</span>
                  <span className="th-stat__label">שעות פרונטלי</span>
                </div>
              </div>
              <button
                type="button"
                className="th-modal__close"
                onClick={resetTeacher}
                aria-label="סגור"
                title="סגור (Esc)"
              >
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="th-modal__hint">
              <i className="fa fa-info-circle" />
              <span>בחר שעות על־ידי לחיצה וגרירה; לחיצה ימנית פותחת תפריט הגדרות (שהייה/פרטני).</span>
            </div>
            <div className="th-modal__legend">
              <span className="th-legend__item th-legend__item--regular"><i /> שיבוץ כיתה</span>
              <span className="th-legend__item th-legend__item--shehya"><i /> שהייה</span>
              <span className="th-legend__item th-legend__item--partani"><i /> פרטני</span>
              <span className="th-legend__item th-legend__item--empty"><i /> פנוי</span>
            </div>
            <div className="th-modal__body">
              <div className="th-grid">
                {DAYS.map((d) => {
                  const cells = dayCells[d.num] ?? [];
                  const dayCount = cells.filter((c) => c.HourTypeId === 1).length;
                  return (
                    <div className="th-day" key={d.num}>
                      <div className="th-day__header">
                        <span className="th-day__name">{d.label}</span>
                        <span className="th-day__badge" title="שיבוצי כיתה ביום זה">
                          {dayCount}
                        </span>
                      </div>
                      <div className="th-day__body" id={`dv${d.num}`}>
                        {SLOTS_PER_DAY(d.num).map((seq) => {
                          const hourId = `${d.num}${seq}`;
                          const cell = cells.find((c) => c.seq === seq);
                          if (cell) {
                            const variant = hourTypeVariant(cell.HourTypeId);
                            return (
                              <div
                                key={cell.hourId}
                                id={cell.hourId}
                                className={`th-cell th-cell--${variant} dv_HourTypeId_${cell.HourTypeId} selected`}
                                onMouseDown={(e) => onCellMouseDown(e, cell.hourId)}
                                onMouseEnter={() => onCellMouseEnter(cell.hourId)}
                                onContextMenu={(e) => onCellContextMenu(e, cell)}
                              >
                                <div className="th-cell__meta">
                                  <span className="th-cell__seq">{seq}</span>
                                  <span className="th-cell__time">{HOUR_TIME_RANGES[seq]}</span>
                                </div>
                                <div className="th-cell__label" id={`spHourType_${hourId}`}>
                                  {cell.label}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={`empty-${hourId}`}
                              id={hourId}
                              className="th-cell th-cell--empty dv_empty"
                              onMouseDown={(e) => onCellMouseDown(e, hourId)}
                              onMouseEnter={() => onCellMouseEnter(hourId)}
                            >
                              <div className="th-cell__meta">
                                <span className="th-cell__seq">{seq}</span>
                                <span className="th-cell__time">{HOUR_TIME_RANGES[seq]}</span>
                              </div>
                              <div className="th-cell__plus">
                                <i className="fa fa-plus" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="col-md-12">
        <div className="teacher-filter-bar">
          <div className="teacher-filter-bar__title">
            <i className="fa fa-filter" /> סנן לפי
          </div>
          <div className="teacher-filter-bar__field">
            <label htmlFor="fltName">שם</label>
            <input
              id="fltName"
              type="text"
              className="form-control"
              placeholder="חפש לפי שם"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
          <div className="teacher-filter-bar__field">
            <label htmlFor="fltTafkid">תפקיד</label>
            <select
              id="fltTafkid"
              className="form-control"
              value={filterTafkid}
              onChange={(e) => setFilterTafkid(e.target.value)}
            >
              <option value="">כל התפקידים</option>
              {tafkidOptions.map((o) => (
                <option key={o.TafkidId} value={o.TafkidId}>{o.Name}</option>
              ))}
            </select>
          </div>
          <div className="teacher-filter-bar__field">
            <label htmlFor="fltClass">כיתה (מחנך/ת)</label>
            <select
              id="fltClass"
              className="form-control"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="">כל הכיתות</option>
              {classOptions.map((c) => (
                <option key={c.ClassId} value={c.ClassId}>{c.ClassName}</option>
              ))}
            </select>
          </div>
          {(filterName || filterTafkid || filterClass) && (
            <button
              type="button"
              className="btn btn-default btn-sm"
              onClick={() => { setFilterName(''); setFilterTafkid(''); setFilterClass(''); }}
            >
              <i className="fa fa-times" /> נקה
            </button>
          )}
          <div className="teacher-filter-bar__count">
            מציג {tableTeachers.length} מתוך {teachers.length}
          </div>
        </div>
        <div id="dvTeacherTable" style={{ paddingTop: 8 }}>
          <div className="col-md-2 dvRequireTitle">שם מורה</div>
          <div className="col-md-2 dvRequireTitle">תפקיד</div>
          <div className="col-md-2 dvRequireTitle">מקצוע</div>
          <div className="col-md-2 dvRequireTitle">יום חופשי</div>
          <div className="col-md-2 dvRequireTitle">שעות שהייה</div>
          <div className="col-md-1 dvRequireTitle">שעות פרטני</div>
          <div className="col-md-1 dvRequireTitle">&nbsp;</div>
          <div id="dvReqContainer" className="dvPanelReq clear">
            {tableTeachers.map((t) => (
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

const HOUR_TIME_RANGES: Record<number, string> = {
  1: '08:00 – 09:00',
  2: '09:00 – 09:40',
  3: '10:05 – 10:55',
  4: '10:56 – 11:40',
  5: '12:00 – 12:45',
  6: '12:46 – 13:30',
  7: '13:45 – 14:30',
  8: '14:31 – 15:15',
  9: '15:16 – 16:00',
};

function hourTypeVariant(id: number): string {
  if (id === 1) return 'regular';
  if (id === 2) return 'shehya';
  if (id === 3) return 'partani';
  return 'other';
}
