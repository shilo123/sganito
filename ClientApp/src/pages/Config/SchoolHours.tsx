import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import PageLoader from '../../lib/PageLoader';

interface SchoolHourRow {
  HourId: string | number;
  IsOnlyShehya?: string | number | null;
  IsActive?: string | number | null;
  // additional fields from the DataTable are preserved but unused here
  [k: string]: unknown;
}

interface AssignmentLite {
  HourId: string | number;
  HourTypeId?: string | number | null;
}

const DAYS: { num: number; label: string }[] = [
  { num: 1, label: 'יום ראשון' },
  { num: 2, label: 'יום שני' },
  { num: 3, label: 'יום שלישי' },
  { num: 4, label: 'יום רביעי' },
  { num: 5, label: 'יום חמישי' },
  { num: 6, label: 'יום שישי' },
];

// שעות לכל יום. יום שישי מציג 6 שעות בלבד - כמו באסמ"י המקורית
const HOUR_SLOTS = [
  { seq: 1, time: '08:00 - 09:00' },
  { seq: 2, time: '09:00 - 09:40' },
  { seq: 3, time: '10:05 - 10:55' },
  { seq: 4, time: '10:56 - 11:40' },
  { seq: 5, time: '12:00 - 12:45' },
  { seq: 6, time: '12:46 - 13:30' },
  { seq: 7, time: '13:45 - 14:30' },
  { seq: 8, time: '14:31 - 15:15' },
  { seq: 9, time: '15:16 - 16:00' },
];

function hoursForDay(day: number) {
  return day === 6 ? HOUR_SLOTS.slice(0, 6) : HOUR_SLOTS;
}

function hourIdOf(day: number, seq: number): string {
  return `${day}${seq}`;
}

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  hourId: string;
};

export default function SchoolHours() {
  const { user } = useAuth();
  const configurationId = user?.ConfigurationId ?? '';

  const [rows, setRows] = useState<SchoolHourRow[]>([]);
  // מפה: HourId -> האם נבחר, האם פרטני/שהייה בלבד
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
  const [shehyaOnlyMap, setShehyaOnlyMap] = useState<Record<string, boolean>>({});
  // מפה: HourId -> כמה שיבוצים תלויים בשעה הזו. שעה במפה דורשת אישור לפני
  // הסרה כי המחיקה תפיל את כל ה-TeacherAssignment שמצביע על HourId זה.
  const [assignedHourCounts, setAssignedHourCounts] = useState<Record<string, number>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, hourId: '' });
  // פופאפ אישור — מופיע כש-מסירים שעה שמשובצת בה כיתה
  const [removeConfirm, setRemoveConfirm] = useState<{
    hourId: string;
    day: number;
    seq: number;
    count: number;
  } | null>(null);
  // פופאפ אישור — מופיע בלחיצה ראשונה להוסיף שעה. אחרי אישור פעם אחת
  // הסשן נפתח עד mouseup וה-drag עובד חופשי בלי אישורים נוספים.
  const [addConfirm, setAddConfirm] = useState<{
    hourId: string;
    day: number;
    seq: number;
  } | null>(null);
  const addConfirmedThisSession = useRef(false);

  // גרירה לבחירה
  const dragMode = useRef<null | 'add' | 'remove'>(null);
  const dragStarted = useRef(false);

  const loadData = useCallback(async () => {
    if (!configurationId) return;
    try {
      // Load schedule definition + assignment counts in parallel — the
      // assignment counts feed the "this hour is in use" warning popup.
      const [hoursData, assignmentsData] = await Promise.all([
        ajax<SchoolHourRow[]>('Gen_GetTable', {
          TableName: 'SchoolHours',
          Condition: `ConfigurationId=${configurationId}`,
        }),
        ajax<AssignmentLite[]>('Gen_GetTable', {
          TableName: 'TeacherAssignment',
          Condition: `ConfigurationId=${configurationId}`,
        }).catch(() => [] as AssignmentLite[]),
      ]);

      setRows(Array.isArray(hoursData) ? hoursData : []);

      const active: Record<string, boolean> = {};
      const shehya: Record<string, boolean> = {};
      for (const r of hoursData || []) {
        const id = String(r.HourId);
        active[id] = true;
        if (String(r.IsOnlyShehya ?? '') === '1') shehya[id] = true;
      }
      setActiveMap(active);
      setShehyaOnlyMap(shehya);

      // Count only real teaching slots (HourTypeId=1). Shehya/partani rows
      // (HourTypeId 2/3) are weaker links and don't justify a popup since
      // removing the school-hour just turns them into "ghost" rows.
      const counts: Record<string, number> = {};
      for (const a of assignmentsData || []) {
        if (Number(a.HourTypeId ?? 0) !== 1) continue;
        const id = String(a.HourId);
        counts[id] = (counts[id] || 0) + 1;
      }
      setAssignedHourCounts(counts);
    } finally {
      setInitialLoading(false);
    }
  }, [configurationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const total = useMemo(
    () => Object.values(activeMap).filter(Boolean).length,
    [activeMap],
  );

  // Mode=3 = הוסף, Mode=4 = הסר, Mode=1 = הפוך לפרטני/שהייה, Mode=2 = ביטול פרטני/שהייה
  const updateHour = useCallback(async (hourId: string, mode: 1 | 2 | 3 | 4) => {
    try {
      await ajax('School_UpdateHour', { HourId: hourId, Mode: mode });
    } catch (e) {
      console.error('School_UpdateHour failed', e);
    }
  }, []);

  const setActive = useCallback(
    (hourId: string, add: boolean) => {
      setActiveMap((prev) => {
        const was = !!prev[hourId];
        if (was === add) return prev;
        const next = { ...prev };
        if (add) next[hourId] = true;
        else delete next[hourId];
        return next;
      });
      if (!add) {
        // ביטול השעה מנקה גם דגל פרטני/שהייה
        setShehyaOnlyMap((prev) => {
          if (!prev[hourId]) return prev;
          const next = { ...prev };
          delete next[hourId];
          return next;
        });
      }
      updateHour(hourId, add ? 3 : 4);
    },
    [updateHour],
  );

  // Pop a confirmation dialog when removing an hour with assignments behind
  // it. Returns true if the popup was shown (and therefore the caller
  // shouldn't proceed with the actual removal).
  const guardRemoveAssigned = useCallback(
    (hourId: string): boolean => {
      const count = assignedHourCounts[hourId] || 0;
      if (count <= 0) return false;
      setRemoveConfirm({
        hourId,
        day: Number(hourId.charAt(0)),
        seq: Number(hourId.slice(1)),
        count,
      });
      // Cancel any in-progress drag so the user has to consciously confirm
      // before the next removal.
      dragStarted.current = false;
      dragMode.current = null;
      return true;
    },
    [assignedHourCounts],
  );

  const onCellMouseDown = (e: React.MouseEvent, hourId: string) => {
    if (e.button !== 0) return; // רק לחיצה שמאלית
    const isActive = !!activeMap[hourId];
    if (isActive && guardRemoveAssigned(hourId)) return;
    // First add in a fresh session needs explicit confirmation. Once
    // confirmed (or once the user finishes a drag and releases the mouse),
    // the rest of the drag-add session runs without further popups.
    if (!isActive && !addConfirmedThisSession.current) {
      setAddConfirm({
        hourId,
        day: Number(hourId.charAt(0)),
        seq: Number(hourId.slice(1)),
      });
      return;
    }
    dragStarted.current = true;
    dragMode.current = isActive ? 'remove' : 'add';
    setActive(hourId, !isActive);
  };

  const onCellMouseEnter = (hourId: string) => {
    if (!dragStarted.current || !dragMode.current) return;
    const isActive = !!activeMap[hourId];
    if (dragMode.current === 'add' && !isActive) {
      setActive(hourId, true);
    } else if (dragMode.current === 'remove' && isActive) {
      // While drag-removing, hitting an assigned hour pauses the drag and
      // asks the admin to confirm explicitly for that hour.
      if (guardRemoveAssigned(hourId)) return;
      setActive(hourId, false);
    }
  };

  useEffect(() => {
    const stop = () => {
      dragStarted.current = false;
      dragMode.current = null;
      // Re-arm the add confirmation for the next click. Without this the
      // user could keep adding hours indefinitely after a single approval.
      addConfirmedThisSession.current = false;
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // תפריט קליק-ימני
  const onCellContextMenu = (e: React.MouseEvent, hourId: string) => {
    e.preventDefault();
    if (!activeMap[hourId]) return; // תפריט רלוונטי רק על שעה פעילה
    setMenu({ visible: true, x: e.clientX, y: e.clientY, hourId });
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

  const onMenuSetShehya = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    setShehyaOnlyMap((prev) => ({ ...prev, [id]: true }));
    updateHour(id, 1);
  };

  const onMenuClearShehya = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    setShehyaOnlyMap((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    updateHour(id, 2);
  };

  return (
    <>
      {initialLoading && <PageLoader title="טוען שעות בית ספר" subtitle="מאחזר את מצבת השעות..." />}
    <div className="col-md-12">
      <div className="row dvWeek">
        <div className="panel panel-info">
          <div className="panel-heading">
            <h3 className="panel-title">&nbsp; מצבת שעות בית ספר</h3>
          </div>
          <div className="panel-body">
            <div className="col-md-10">
              <h5 style={{ fontStyle: 'italic' }}>
                בחר שעות ע"י לחיצה וגרירה , לביטול לחץ וגרור שוב.
              </h5>
            </div>
            <div className="col-md-2" style={{ textAlign: 'left' }}>
              <div className="btn btn-info btn-round" style={{ margin: 1 }}>
                סה"כ שעות בית ספר <span className="badge" id="spTotals">{total}</span>
              </div>
            </div>
            <div className="dvDaysCotainer">
              {DAYS.map((d) => (
                <div className="col-md-2" key={d.num}>
                  <div className="panel panel-info">
                    <div className="panel-heading">
                      <h3 className="panel-title">&nbsp; {d.label}</h3>
                    </div>
                    <div
                      className="panel-body dvForRIGHT"
                      onMouseLeave={() => { /* מאפשר לסיים גרירה מחוץ לעמודה */ }}
                    >
                      {hoursForDay(d.num).map((h) => {
                        const id = hourIdOf(d.num, h.seq);
                        const isActive = !!activeMap[id];
                        const isShehya = !!shehyaOnlyMap[id];
                        const style: React.CSSProperties = {
                          userSelect: 'none',
                          cursor: 'pointer',
                        };
                        return (
                          <div
                            key={id}
                            id={id}
                            className={isActive ? 'selected' : ''}
                            style={style}
                            onMouseDown={(e) => onCellMouseDown(e, id)}
                            onMouseEnter={() => onCellMouseEnter(id)}
                            onContextMenu={(e) => onCellContextMenu(e, id)}
                          >
                            <span className="spSeqNumber">{h.seq}.</span> {h.time}
                            {isShehya && (
                              <span
                                className="spPartani"
                                style={{ float: 'left', fontWeight: 'bold' }}
                              >
                                פ
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <div className="clear">&nbsp;</div>
            </div>
            <div className="col-md-10" />
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
                onMenuSetShehya();
              }}
            >
              שעה פרטנית\שהייה בלבד
            </a>
          </li>
          <li>
            <a
              id="li2"
              tabIndex={-1}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onMenuClearShehya();
              }}
            >
              ביטול פרטנית\שהייה
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

      {removeConfirm && (() => {
        const c = removeConfirm;
        const dayLabel = DAYS.find((d) => d.num === c.day)?.label || `יום ${c.day}`;
        const timeRange = HOUR_SLOTS.find((h) => h.seq === c.seq)?.time || '';
        return (
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setRemoveConfirm(null);
            }}
          >
            <div className="confirm-modal__card">
              <div className="confirm-modal__icon" style={{ color: '#dc2626' }}>
                <i className="fa fa-exclamation-triangle" />
              </div>
              <h3 className="confirm-modal__title">השעה משובצת במערכת</h3>
              <p className="confirm-modal__text" style={{ textAlign: 'right' }}>
                שעה זו (<strong>{dayLabel} · שעה {c.seq}{timeRange ? `, ${timeRange}` : ''}</strong>)
                משמשת כעת ב-<strong>{c.count}</strong>{' '}
                {c.count === 1 ? 'שיבוץ של מורה לכיתה' : 'שיבוצים של מורים לכיתות'}.
                <br />
                <br />
                ביטול השעה ממצבת בית הספר ימחק את כל השיבוצים בה ויפגע
                במערכת השבועית.
                <br />
                <br />
                האם להמשיך?
              </p>
              <div className="confirm-modal__actions" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setRemoveConfirm(null)}
                  autoFocus
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    const hid = c.hourId;
                    setRemoveConfirm(null);
                    setActive(hid, false);
                    // The teaching slot is gone — drop it from the
                    // assignment-count map so further drag actions on the
                    // same cell don't re-trigger the popup.
                    setAssignedHourCounts((prev) => {
                      if (!prev[hid]) return prev;
                      const next = { ...prev };
                      delete next[hid];
                      return next;
                    });
                  }}
                >
                  <i className="fa fa-trash" /> בטל בכל זאת
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {addConfirm && (() => {
        const c = addConfirm;
        const dayLabel = DAYS.find((d) => d.num === c.day)?.label || `יום ${c.day}`;
        const timeRange = HOUR_SLOTS.find((h) => h.seq === c.seq)?.time || '';
        return (
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setAddConfirm(null);
            }}
          >
            <div className="confirm-modal__card">
              <div className="confirm-modal__icon" style={{ color: '#0ea5e9' }}>
                <i className="fa fa-info-circle" />
              </div>
              <h3 className="confirm-modal__title">הוספת שעה למצבת בית הספר</h3>
              <p className="confirm-modal__text" style={{ textAlign: 'right' }}>
                אתה עומד להוסיף את השעה{' '}
                <strong>{dayLabel} · שעה {c.seq}{timeRange ? `, ${timeRange}` : ''}</strong>{' '}
                למצבת בית הספר.
                <br />
                <br />
                כל הכיתות יקבלו משבצת ריקה חדשה בשעה זו, ויידרש שיבוץ מורים
                כדי למלא אותן. אישור פעם אחת מאפשר להוסיף עוד שעות בגרירה
                ללא אישורים נוספים בלחיצה הזו.
                <br />
                <br />
                האם להמשיך?
              </p>
              <div className="confirm-modal__actions" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setAddConfirm(null)}
                  autoFocus
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const hid = c.hourId;
                    setAddConfirm(null);
                    // Mark the session as confirmed so a follow-up drag can
                    // keep adding hours without re-prompting.
                    addConfirmedThisSession.current = true;
                    dragStarted.current = true;
                    dragMode.current = 'add';
                    setActive(hid, true);
                  }}
                >
                  <i className="fa fa-plus" /> הוסף שעה
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* שומר שדה גולמי לצורך debug בעתיד - rows.length: {rows.length} */}
      <span style={{ display: 'none' }}>{rows.length}</span>
    </div>
    </>
  );
}
