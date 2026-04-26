import { useEffect, useMemo, useState } from 'react';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import PageLoader from '../../lib/PageLoader';
import ExportButtons from '../../lib/ExportButtons';
import { buildScheduleHandlers } from '../../lib/export';
import { readUserData } from '../../auth/userData';

// ---- Types ----

interface ClassRow {
  ClassId: number;
  ClassName: string;
  LayerId: number;
}

interface TeacherRow {
  TeacherId: number;
  FullText: string;
  FirstName?: string;
  LastName?: string;
}

interface AssignmentRow {
  AssignmentId: number | null;
  ClassId: number;
  ClassName?: string;
  classHalf?: string;
  HourId: number;
  TeacherId: number | null;
  TeacherName: string | null;
  LayerId: number;
  ProfessionalId: number | null;
  Professional: string | null;
  Hakbatza: number | null;
  Ihud: number | null;
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const HOURS_PER_DAY = 9;
const DAYS = [1, 2, 3, 4, 5, 6] as const;
const HOURS = Array.from({ length: HOURS_PER_DAY }, (_, i) => i + 1);

function teacherShort(fullName: string | null | undefined): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1];
}

// ---- Component ----

export default function AssignMatrix() {
  const { user } = useAuth();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [assignment, setAssignment] = useState<AssignmentRow[]>([]);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const [classData, teacherData, assignData] = await Promise.all([
          ajax<ClassRow[]>('Class_GetAllClass'),
          ajax<TeacherRow[]>('Teacher_GetTeacherList', { TeacherId: '' }),
          ajax<AssignmentRow[]>('Assign_GetAssignment', { LayerId: 0 }),
        ]);
        if (cancelled) return;
        setClasses(Array.isArray(classData) ? classData : []);
        setTeachers(Array.isArray(teacherData) ? teacherData : []);
        setAssignment(Array.isArray(assignData) ? assignData : []);
      } catch (e) {
        console.error('AssignMatrix load failed', e);
        if (!cancelled) setError('שגיאה בטעינת הנתונים');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // classId -> hourId -> assignment rows
  const matrix = useMemo(() => {
    const m = new Map<number, Map<number, AssignmentRow[]>>();
    for (const row of assignment) {
      if (!row) continue;
      if (!m.has(row.ClassId)) m.set(row.ClassId, new Map());
      const inner = m.get(row.ClassId)!;
      if (!inner.has(row.HourId)) inner.set(row.HourId, []);
      inner.get(row.HourId)!.push(row);
    }
    return m;
  }, [assignment]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.LayerId !== b.LayerId) return a.LayerId - b.LayerId;
      return (a.ClassName || '').localeCompare(b.ClassName || '');
    });
  }, [classes]);

  const selectedTid = selectedTeacherId ? Number(selectedTeacherId) : null;

  // Teacher hours counts (how many cells each teacher has)
  const teacherHourCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const row of assignment) {
      if (row.TeacherId == null) continue;
      m.set(row.TeacherId, (m.get(row.TeacherId) ?? 0) + 1);
    }
    return m;
  }, [assignment]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = teachers.filter((t) => teacherHourCounts.has(t.TeacherId));
    if (!q) return base;
    return base.filter((t) => {
      const full = (t.FullText || `${t.FirstName ?? ''} ${t.LastName ?? ''}`).toLowerCase();
      return full.includes(q);
    });
  }, [teachers, searchQuery, teacherHourCounts]);

  // Count total highlighted cells for the selected teacher
  const highlightedStats = useMemo(() => {
    if (!selectedTid) return null;
    let total = 0;
    const byDay: Record<number, number> = {};
    for (const row of assignment) {
      if (row.TeacherId === selectedTid) {
        total++;
        const day = Math.floor(row.HourId / 10);
        byDay[day] = (byDay[day] || 0) + 1;
      }
    }
    const teacher = teachers.find((t) => t.TeacherId === selectedTid);
    return { total, byDay, name: teacher?.FullText ?? '' };
  }, [selectedTid, assignment, teachers]);

  function handleCellClick(teacherId: number | null) {
    if (!teacherId) {
      setSelectedTeacherId('');
      return;
    }
    const cur = selectedTid;
    setSelectedTeacherId(teacherId === cur ? '' : String(teacherId));
  }

  if (loading) {
    return <PageLoader title="טוען מטריצת שיבוץ" subtitle="מאחזר את כל השיבוצים, הכיתות והמורים..." />;
  }

  if (error) {
    return (
      <div style={{ padding: 20, direction: 'rtl', color: 'red' }}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-page">
      <div className="mx-page__header">
        <div className="mx-page__filter">
          <div className="mx-page__search-row">
            <i className="fa fa-search" />
            <input
              type="text"
              className="mx-page__search-input"
              placeholder="חיפוש מורה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {(searchQuery || selectedTeacherId) && (
              <button
                type="button"
                className="mx-page__clear"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTeacherId('');
                }}
              >
                נקה
              </button>
            )}
          </div>
          <div className="mx-chips" dir="rtl">
            {filteredTeachers.length === 0 ? (
              <span className="mx-chips__empty">לא נמצאו מורים תואמים</span>
            ) : (
              filteredTeachers.map((t) => {
                const name = t.FullText || `${t.FirstName ?? ''} ${t.LastName ?? ''}`.trim();
                const count = teacherHourCounts.get(t.TeacherId) ?? 0;
                const isActive = selectedTid === t.TeacherId;
                return (
                  <button
                    key={t.TeacherId}
                    type="button"
                    className={`mx-chip${isActive ? ' is-active' : ''}`}
                    onClick={() =>
                      setSelectedTeacherId(isActive ? '' : String(t.TeacherId))
                    }
                  >
                    {name}
                    <span className="mx-chip__count">{count}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <h2 className="mx-page__title">
          <i className="fa fa-th" />
          מטריצת שיבוץ
        </h2>
        <div style={{ marginInlineStart: 'auto' }}>
          {(() => {
            const ud = readUserData();
            const schoolName = ud?.Name ?? 'בית הספר';
            const logoUrl = ud?.SchoolId ? window.location.origin + `/assets/images/SchoolLogo/${ud.SchoolId}_.png` : undefined;
            const classList = sortedClasses.map((c) => ({ ClassId: c.ClassId, ClassName: c.ClassName }));
            const handlers = buildScheduleHandlers({
              schoolName,
              title: 'מערכת שעות שבועית (מטריצה)',
              subtitle: 'מבט כולל לכל הכיתות',
              filename: 'schedule-matrix',
              classes: classList,
              assignments: assignment.map((a) => ({
                ClassId: a.ClassId,
                ClassName: a.ClassName ?? classes.find((c) => c.ClassId === a.ClassId)?.ClassName,
                HourId: a.HourId,
                TeacherName: a.TeacherName,
                Professional: a.Professional,
                Hakbatza: a.Hakbatza,
                Ihud: a.Ihud,
              })),
              logoUrl,
            });
            return <ExportButtons {...handlers} compact />;
          })()}
        </div>
      </div>

      {highlightedStats && (
        <div className="mx-teacher-bar">
          <div>
            <i className="fa fa-user" style={{ marginInlineEnd: 6 }} />
            מציג את שיבוצי המורה: <strong>{highlightedStats.name}</strong>
          </div>
          <div className="mx-teacher-bar__stats">
            <span className="mx-teacher-bar__stat">סה״כ {highlightedStats.total} שעות</span>
            {DAYS.map((d) => (
              <span key={d} className="mx-teacher-bar__stat">
                {DAY_NAMES[d - 1]}: {highlightedStats.byDay[d] || 0}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mx-scroll">
        <table className="mx-grid">
          <thead>
            <tr>
              <th rowSpan={2} className="mx-grid__class-hdr">כיתה</th>
              {DAYS.map((day) => (
                <th key={day} colSpan={HOURS_PER_DAY} className={`mx-grid__day-hdr day-${day}`}>
                  {DAY_NAMES[day - 1]}
                </th>
              ))}
            </tr>
            <tr>
              {DAYS.flatMap((day) =>
                HOURS.map((hour) => (
                  <th
                    key={`${day}-${hour}`}
                    className={`mx-grid__hour-hdr${hour === HOURS_PER_DAY ? ' hour-9' : ''}`}
                  >
                    {hour}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {sortedClasses.map((cls) => (
              <tr key={cls.ClassId}>
                <td className="mx-grid__class-cell">{cls.ClassName}</td>
                {DAYS.flatMap((day) =>
                  HOURS.map((hour) => {
                    const hourId = day * 10 + hour;
                    const rows = matrix.get(cls.ClassId)?.get(hourId) ?? [];
                    const isEmpty = rows.length === 0;
                    const firstTeacher = rows[0]?.TeacherId ?? null;
                    const isHighlighted = !!(
                      selectedTid && rows.some((r) => r.TeacherId === selectedTid)
                    );
                    const names = rows
                      .map((r) => r.TeacherName)
                      .filter((n): n is string => !!n)
                      .join(' / ');
                    const professional = rows[0]?.Professional ?? '';
                    const short = teacherShort(names.split(' / ')[0]);
                    const hakNum = Number(rows[0]?.Hakbatza ?? 0);
                    const ihudNum = Number(rows[0]?.Ihud ?? 0);
                    const titleParts = [
                      cls.ClassName,
                      `${DAY_NAMES[day - 1]} שעה ${hour}`,
                      names,
                      professional,
                      hakNum > 0 ? `הקבצה ${hakNum}` : '',
                      ihudNum > 0 ? `איחוד ${ihudNum}` : '',
                    ].filter(Boolean);
                    const classes = [
                      'mx-grid__cell',
                      `day-${day}`,
                      hour === HOURS_PER_DAY ? 'hour-9' : '',
                      isEmpty ? 'is-empty' : '',
                      isHighlighted ? 'is-highlighted' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    // Same palette as other screens for cross-UI consistency
                    const mxPalette = (kind: 'H' | 'I', n: number) => {
                      if (!n) return 'transparent';
                      const hP = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#ddd6fe', '#a7f3d0', '#fecaca'];
                      const iP = ['#c4b5fd', '#67e8f9', '#fcd34d', '#f9a8d4', '#86efac', '#fca5a5', '#93c5fd', '#fdba74'];
                      return (kind === 'H' ? hP : iP)[(n - 1) % 8];
                    };
                    const cellStyle: React.CSSProperties = ihudNum > 0
                      ? { boxShadow: `inset 0 0 0 2px ${mxPalette('I', ihudNum)}` }
                      : {};
                    return (
                      <td
                        key={`${cls.ClassId}-${day}-${hour}`}
                        className={classes}
                        style={cellStyle}
                        title={titleParts.join(' · ')}
                        onClick={() => !isEmpty && handleCellClick(firstTeacher)}
                      >
                        <span style={{ position: 'relative', display: 'inline-block' }}>
                          {isEmpty ? (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 10, fontWeight: 500 }}>
                              אין שיבוץ
                            </span>
                          ) : (
                            short
                          )}
                          {(hakNum > 0 || ihudNum > 0) && (
                            <span
                              style={{
                                position: 'absolute',
                                top: -6,
                                insetInlineEnd: -14,
                                display: 'inline-flex',
                                gap: 1,
                                pointerEvents: 'none',
                              }}
                            >
                              {hakNum > 0 && (
                                <span style={{ background: mxPalette('H', hakNum), color: '#1f2937', padding: '0 3px', borderRadius: 3, fontSize: 8, fontWeight: 700, lineHeight: 1 }}>
                                  ה{hakNum}
                                </span>
                              )}
                              {ihudNum > 0 && (
                                <span style={{ background: mxPalette('I', ihudNum), color: '#1f2937', padding: '0 3px', borderRadius: 3, fontSize: 8, fontWeight: 700, lineHeight: 1 }}>
                                  א{ihudNum}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
