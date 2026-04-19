import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

interface SchoolHourRow {
  HourId: string | number;
  IsOnlyShehya?: string | number | null;
  IsActive?: string | number | null;
  // additional fields from the DataTable are preserved but unused here
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
  const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, hourId: '' });

  // גרירה לבחירה
  const dragMode = useRef<null | 'add' | 'remove'>(null);
  const dragStarted = useRef(false);

  const loadData = useCallback(async () => {
    if (!configurationId) return;
    const data = await ajax<SchoolHourRow[]>('Gen_GetTable', {
      TableName: 'SchoolHours',
      Condition: `ConfigurationId=${configurationId}`,
    });
    setRows(Array.isArray(data) ? data : []);

    const active: Record<string, boolean> = {};
    const shehya: Record<string, boolean> = {};
    for (const r of data || []) {
      const id = String(r.HourId);
      active[id] = true; // השורות שחוזרות הן השעות המוגדרות
      if (String(r.IsOnlyShehya ?? '') === '1') shehya[id] = true;
    }
    setActiveMap(active);
    setShehyaOnlyMap(shehya);
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

  const onCellMouseDown = (e: React.MouseEvent, hourId: string) => {
    if (e.button !== 0) return; // רק לחיצה שמאלית
    dragStarted.current = true;
    const isActive = !!activeMap[hourId];
    dragMode.current = isActive ? 'remove' : 'add';
    setActive(hourId, !isActive);
  };

  const onCellMouseEnter = (hourId: string) => {
    if (!dragStarted.current || !dragMode.current) return;
    const isActive = !!activeMap[hourId];
    if (dragMode.current === 'add' && !isActive) setActive(hourId, true);
    else if (dragMode.current === 'remove' && isActive) setActive(hourId, false);
  };

  useEffect(() => {
    const stop = () => {
      dragStarted.current = false;
      dragMode.current = null;
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
                        if (isActive) style.backgroundColor = '#B8C0DC';
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

      {/* שומר שדה גולמי לצורך debug בעתיד - rows.length: {rows.length} */}
      <span style={{ display: 'none' }}>{rows.length}</span>
    </div>
  );
}
