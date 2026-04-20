import { useEffect, useMemo, useState } from 'react';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import PageLoader from '../../lib/PageLoader';

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

interface TeacherHoursRow {
  TeacherId: number;
  TeacherName?: string;
  ClassId: number;
  ClassName?: string;
  Assigned?: number;
  Expected?: number;
  [key: string]: unknown;
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const HOURS_PER_DAY = 9;

// ---- Component ----

export default function AssignMatrix() {
  const { user } = useAuth();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [assignment, setAssignment] = useState<AssignmentRow[]>([]);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [teacherHours, setTeacherHours] = useState<TeacherHoursRow[]>([]);
  const [loadingTeacherHours, setLoadingTeacherHours] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load
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

  // Load per-teacher hours on selection change
  useEffect(() => {
    const tid = Number(selectedTeacherId);
    if (!tid || tid <= 0) {
      setTeacherHours([]);
      return;
    }
    let cancelled = false;
    setLoadingTeacherHours(true);

    const configId = user?.ConfigurationId ?? '';
    ajax<TeacherHoursRow[]>('Assign_GetTeacherHoursPerClass', {
      TeacherId: tid,
      configId,
    })
      .then((rows) => {
        if (cancelled) return;
        setTeacherHours(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Assign_GetTeacherHoursPerClass failed', e);
        setTeacherHours([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTeacherHours(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTeacherId, user]);

  // Build lookup: classId -> hourId (NUMBER form day*10+hour) -> assignment rows
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

  // Classes sorted by LayerId then ClassName
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.LayerId !== b.LayerId) return a.LayerId - b.LayerId;
      return (a.ClassName || '').localeCompare(b.ClassName || '');
    });
  }, [classes]);

  function renderCell(classId: number, day: number, hour: number) {
    const hourId = day * 10 + hour;
    const rows = matrix.get(classId)?.get(hourId) ?? [];
    if (rows.length === 0) {
      return <span>&nbsp;</span>;
    }
    const names = rows
      .map((r) => r.TeacherName)
      .filter((n): n is string => !!n)
      .join(' / ');
    const professional = rows[0]?.Professional ? rows[0].Professional + ' - ' : '';
    return (
      <span title={professional + names}>
        {professional}
        {names || <em>&nbsp;</em>}
      </span>
    );
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
    <div style={{ direction: 'rtl', padding: 10 }}>
      <div className="col-md-12">
        <div className="panel panel-info">
          <div className="panel-heading">
            <h3 className="panel-title">&nbsp;מטריצת שיבוץ - תצוגה בלבד</h3>
          </div>
          <div className="panel-body">
            <div className="col-md-4" style={{ marginBottom: 15 }}>
              <div className="input-group ls-group-input">
                <span className="input-group-addon">בחר מורה לצפייה בשעות</span>
                <select
                  className="form-control"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                >
                  <option value="">-- הצג כל השיבוצים --</option>
                  {teachers.map((t) => (
                    <option key={t.TeacherId} value={t.TeacherId}>
                      {t.FullText || `${t.FirstName ?? ''} ${t.LastName ?? ''}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedTeacherId && (
              <div className="col-md-12" style={{ marginBottom: 15 }}>
                <div className="panel panel-default">
                  <div className="panel-heading">
                    <strong>שעות המורה לפי כיתה</strong>
                  </div>
                  <div className="panel-body">
                    {loadingTeacherHours ? (
                      <p>טוען...</p>
                    ) : teacherHours.length === 0 ? (
                      <p>אין נתונים עבור המורה שנבחר.</p>
                    ) : (
                      <table className="table table-bordered table-striped">
                        <thead>
                          <tr className="info">
                            <th>כיתה</th>
                            <th>שעות משובצות</th>
                            <th>שעות צפויות</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teacherHours.map((r, i) => (
                            <tr key={i}>
                              <td>{r.ClassName ?? r.ClassId}</td>
                              <td style={{ textAlign: 'center' }}>
                                {r.Assigned ?? '-'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {r.Expected ?? '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Main class x hour matrix, separated per day */}
            <div className="col-md-12" style={{ overflow: 'auto' }}>
              {[1, 2, 3, 4, 5, 6].map((day) => {
                const rowSpanClasses = sortedClasses;
                return (
                  <div key={day} style={{ marginBottom: 25 }}>
                    <h4 style={{ background: '#428bca', color: 'white', padding: '5px 10px' }}>
                      יום {DAY_NAMES[day - 1]}
                    </h4>
                    <table
                      className="table table-bordered"
                      style={{ fontSize: 11, tableLayout: 'fixed' }}
                    >
                      <thead>
                        <tr className="info">
                          <th style={{ width: 100 }}>כיתה</th>
                          {Array.from({ length: HOURS_PER_DAY }, (_, i) => i + 1).map((hour) => (
                            <th key={hour} style={{ textAlign: 'center' }}>
                              שעה {hour}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rowSpanClasses.map((cls) => (
                          <tr key={cls.ClassId}>
                            <td>
                              <strong>{cls.ClassName}</strong>
                            </td>
                            {Array.from({ length: HOURS_PER_DAY }, (_, i) => i + 1).map(
                              (hour) => (
                                <td
                                  key={hour}
                                  style={{ textAlign: 'center', verticalAlign: 'middle' }}
                                >
                                  {renderCell(cls.ClassId, day, hour)}
                                </td>
                              )
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
