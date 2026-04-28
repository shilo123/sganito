import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../lib/toast';
import ExportButtons from '../../lib/ExportButtons';
import { buildExportHandlers } from '../../lib/export';

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
  TotalRequired?: number | string | null;
  AssignedCount?: number | string | null;
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

interface AssignmentRow {
  AssignmentId: number | string;
  HourId: number | string;
  ClassId: number | string;
  TeacherId: number | string;
  ProfessionalId?: number | string | null;
  Hakbatza?: number | string | null;
  Ihud?: number | string | null;
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
  teacherHas: boolean;     // האם המורה משובץ/סימן שעה זו
  schoolHasHour: boolean;  // האם השעה קיימת כלל בבית הספר
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
      teacherHas: row.TeacherId != null,
      schoolHasHour: true,
    });
  }

  // מציגים רק תאים שיש להם משמעות ויזואלית: שיבוץ כיתה, שהייה, פרטני.
  // תאים "מסומנים למורה בלבד" (TeacherHours ללא HourTypeId) נבלעים ב-render
  // הרגיל של תא ריק - משאירים אותם ב-hourMap לצורך לוגיקה אבל לא מציגים אותם.
  return Array.from(byId.values())
    .filter((c) => c.HourTypeId === 1 || c.HourTypeId === 2 || c.HourTypeId === 3)
    .sort((a, b) => a.seq - b.seq);
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
  const toast = useToast();
  const configurationId = user?.ConfigurationId ?? '';

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [teacherHours, setTeacherHours] = useState<TeacherHourRow[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<AssignmentRow[]>([]);
  const [hoursLoading, setHoursLoading] = useState(false);

  // Which (day*10+seq) IDs exist as actual school hours, and which are shehya-only
  const [schoolHourIds, setSchoolHourIds] = useState<Set<string>>(new Set());
  const [shehyaOnlyHourIds, setShehyaOnlyHourIds] = useState<Set<string>>(new Set());
  const [tafkidOptions, setTafkidOptions] = useState<Array<{ TafkidId: number; Name: string }>>([]);
  const [professionalOptions, setProfessionalOptions] = useState<Array<{ ProfessionalId: number; Name: string }>>([]);
  const [classOptions, setClassOptions] = useState<Array<{ ClassId: number; ClassName: string }>>([]);

  // Edit-teacher modal state. Opened by the "פרטים" pencil button on every
  // row in the teacher list. Saves through Teacher_DML (Type=1 = update).
  const [editTeacher, setEditTeacher] = useState<{
    TeacherId: number | string;
    Tafkid: string;
    ProfessionalId: string;
    FirstName: string;
    LastName: string;
    Email: string;
    Frontaly: string;
    FreeDay: string;
    Tz: string;
    Shehya: string;
    Partani: string;
  } | null>(null);
  const [editTeacherBusy, setEditTeacherBusy] = useState(false);

  // Delete-teacher confirmation popup. Stores enough to render a friendly
  // message and to fire Teacher_DML(Type=3) once the user approves.
  const [deleteTeacher, setDeleteTeacher] = useState<{
    teacherId: number | string;
    fullText: string;
  } | null>(null);
  const [deleteTeacherBusy, setDeleteTeacherBusy] = useState(false);
  // Classes the currently-selected teacher is linked to in TeacherClass
  // (regular, hakbatza, or ihud). Picker uses this to constrain options.
  const [teacherClasses, setTeacherClasses] = useState<Array<{ ClassId: number; ClassName: string; Hakbatza: number; Ihud: number; LayerId: number }>>([]);
  const [filterName, setFilterName] = useState('');
  const [filterTafkid, setFilterTafkid] = useState<string>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [classPicker, setClassPicker] = useState<{ hourId: string; day: number; seq: number } | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [quotaModal, setQuotaModal] = useState<{
    hourId: string;
    day: number;
    seq: number;
    manageClassId: number;
  } | null>(null);
  const [quotaValue, setQuotaValue] = useState<number>(0);
  const [quotaBusy, setQuotaBusy] = useState(false);
  const [freeDayBusy, setFreeDayBusy] = useState(false);
  const [maxHoursEdit, setMaxHoursEdit] = useState<string>('');
  const [maxHoursBusy, setMaxHoursBusy] = useState(false);
  const [busyCells, setBusyCells] = useState<Set<string>>(new Set());
  // Confirmation modal shown before removing a TeacherHours row that already
  // has a TeacherAssignment riding on it — removing the hour wipes the
  // assignment, so the admin must explicitly approve.
  const [removeAssignConfirm, setRemoveAssignConfirm] = useState<{
    hourId: string;
    day: number;
    hour: number;
    classNames: string[];
  } | null>(null);

  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    hourId: '',
    HourTypeId: 0,
  });

  const dragMode = useRef<null | 'add' | 'remove'>(null);
  const dragClassId = useRef<number>(0);
  const dragActive = useRef(false);
  const draggedCells = useRef<Set<string>>(new Set());
  const busyCellsRef = useRef<Set<string>>(new Set());
  const needsReload = useRef(false);
  const dragFailCount = useRef(0);
  const dragSummary = useRef<{ mode: 'add' | 'remove'; count: number } | null>(null);

  const toastRef = useRef(toast);
  toastRef.current = toast;

  const showDragSummaryIfReady = useCallback(() => {
    if (!dragSummary.current) return;
    if (busyCellsRef.current.size > 0) return;
    const { mode, count } = dragSummary.current;
    const failed = dragFailCount.current;
    const ok = count - failed;
    dragSummary.current = null;
    dragFailCount.current = 0;
    const t = toastRef.current;
    if (mode === 'add') {
      if (count > 1 && failed === 0) t.success(`${ok} שעות שובצו בהצלחה`);
      else if (count > 1 && failed > 0 && ok > 0) t.warning(`${ok} שובצו, ${failed} נכשלו`);
      else if (failed > 0 && ok === 0) {
        t.warning(count === 1 ? 'שיבוץ השעה נכשל — ייתכן חריגה ממגבלה' : `שיבוץ של ${failed} שעות נכשל`);
      }
    } else if (mode === 'remove') {
      if (count > 1 && failed === 0) t.success(`${ok} שיבוצים הוסרו`);
      else if (count > 1 && failed > 0 && ok > 0) t.warning(`${ok} הוסרו, ${failed} נכשלו`);
      else if (failed > 0 && ok === 0) {
        t.error(count === 1 ? 'הסרת השיבוץ נכשלה' : `הסרה של ${failed} שיבוצים נכשלה`);
      }
    }
  }, []);

  const addBusy = useCallback((id: string) => {
    busyCellsRef.current.add(id);
    setBusyCells(new Set(busyCellsRef.current));
  }, []);
  const delBusy = useCallback((id: string) => {
    busyCellsRef.current.delete(id);
    setBusyCells(new Set(busyCellsRef.current));
    // כשכל התאים סיימו - הצגת summary ו-reload
    if (busyCellsRef.current.size === 0) {
      showDragSummaryIfReady();
    }
  }, [showDragSummaryIfReady]);

  const loadTeachers = useCallback(async () => {
    if (!configurationId) return;
    const data = await ajax<Teacher[]>('Teacher_GetTeacherList', { TeacherId: '' });
    const list = Array.isArray(data) ? data : [];
    setTeachers(list);

    // If URL has ?teacherId=X, auto-open that teacher's hours modal
    try {
      const url = new URL(window.location.href);
      const tid = url.searchParams.get('teacherId');
      if (tid) {
        const found = list.find((t) => String(t.TeacherId) === String(tid));
        if (found) {
          setSelectedTeacher(found);
          setSearch(String(found.FullText ?? `${found.FirstName ?? ''} ${found.LastName ?? ''}`));
          // Remove the param so it doesn't re-apply on next navigation
          url.searchParams.delete('teacherId');
          window.history.replaceState(null, '', url.pathname + (url.search || ''));
        }
      }
    } catch {
      /* ignore URL parsing errors */
    }
  }, [configurationId]);

  const loadTeacherHours = useCallback(async (teacherId: Teacher['TeacherId']) => {
    setHoursLoading(true);
    try {
      const [hoursData, assignData, classesData] = await Promise.all([
        ajax<TeacherHourRow[]>('Teacher_GetTeacherHours', { TeacherId: teacherId }),
        ajax<AssignmentRow[]>('Teacher_GetAssignmentsForTeacher', { TeacherId: teacherId }),
        ajax<Array<{ ClassId: number; ClassName: string; Hakbatza: number; Ihud: number; LayerId: number }>>(
          'Teacher_GetClassesForTeacher', { TeacherId: teacherId },
        ),
      ]);
      setTeacherHours(Array.isArray(hoursData) ? hoursData : []);
      setTeacherAssignments(Array.isArray(assignData) ? assignData : []);
      setTeacherClasses(Array.isArray(classesData) ? classesData : []);
    } finally {
      setHoursLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    Promise.allSettled([
      loadTeachers(),
      ajax<Array<{ TafkidId: number; Name: string }>>('Gen_GetTable', { TableName: 'Tafkid', Condition: '' })
        .then((rows) => { if (!cancelled) setTafkidOptions(Array.isArray(rows) ? rows : []); }),
      ajax<Array<{ ProfessionalId: number; Name: string }>>('Gen_GetTable', { TableName: 'Professional', Condition: '' })
        .then((rows) => { if (!cancelled) setProfessionalOptions(Array.isArray(rows) ? rows : []); }),
      ajax<Array<{ ClassId: number; ClassName: string; LayerId?: number }>>('Class_GetAllClass')
        .then((rows) => { if (!cancelled) setClassOptions(Array.isArray(rows) ? rows : []); }),
      ajax<Array<{ HourId: number | string; IsOnlyShehya?: number | string | boolean | null }>>(
        'Gen_GetTable',
        { TableName: 'SchoolHours', Condition: `ConfigurationId=${configurationId}` },
      ).then((rows) => {
        if (cancelled) return;
        const all = new Set<string>();
        const shehyaOnly = new Set<string>();
        for (const r of rows || []) {
          const id = String(r.HourId);
          all.add(id);
          const v = String(r.IsOnlyShehya ?? '');
          if (v === '1' || v.toLowerCase() === 'true') shehyaOnly.add(id);
        }
        setSchoolHourIds(all);
        setShehyaOnlyHourIds(shehyaOnly);
      }),
    ]).finally(() => {
      if (!cancelled) setInitialLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadTeachers, configurationId]);

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
      setTeacherHours([]);
      setHoursLoading(true);
      loadTeacherHours(selectedTeacher.TeacherId);
      setMaxHoursEdit(String(selectedTeacher.Frontaly ?? 0));
    } else {
      setTeacherHours([]);
      setMaxHoursEdit('');
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

  // Map HourId -> { Hakbatza } from teacher assignments. Lets each cell
  // know if it's part of a hakbatza so we can render a small badge.
  const groupByHourId = useMemo(() => {
    const m = new Map<string, { hak: number }>();
    for (const a of teacherAssignments) {
      const hid = String(a.HourId);
      const hak = Number(a.Hakbatza ?? 0);
      if (hak > 0) {
        const prev = m.get(hid);
        m.set(hid, { hak: prev ? (prev.hak || hak) : hak });
      }
    }
    return m;
  }, [teacherAssignments]);

  // Same palette logic as TeacherClass so the colors match across screens.
  function thGroupColor(n: number): { bg: string; fg: string } {
    if (!n) return { bg: 'transparent', fg: '#6b7280' };
    const hPalette = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#ddd6fe', '#a7f3d0', '#fecaca'];
    const color = hPalette[(n - 1) % hPalette.length];
    return { bg: color, fg: '#1f2937' };
  }

  const dayCells = useMemo(() => {
    const out: Record<number, HourCell[]> = {};
    for (const d of DAYS) out[d.num] = buildHourCellsForDay(d.num, teacherHours);
    return out;
  }, [teacherHours]);

  const frontalCount = useMemo(() => {
    const ids = new Set<string>();
    for (const r of teacherHours) {
      if (Number(r.HourTypeId) === 1) ids.add(String(r.HourId));
    }
    return ids.size;
  }, [teacherHours]);

  // Live counts of shehya/partani assigned via the schedule grid. Pair
  // these against the teacher's quota (Shehya / Partani columns) so the
  // overview tags show "used / quota" in real time.
  // Per HourType: 2=פרטני, 3=שהייה.
  const partaniCount = useMemo(() => {
    const ids = new Set<string>();
    for (const r of teacherHours) {
      if (Number(r.HourTypeId) === 2) ids.add(String(r.HourId));
    }
    return ids.size;
  }, [teacherHours]);

  const shehyaCount = useMemo(() => {
    const ids = new Set<string>();
    for (const r of teacherHours) {
      if (Number(r.HourTypeId) === 3) ids.add(String(r.HourId));
    }
    return ids.size;
  }, [teacherHours]);


  const maybeReload = useCallback(async () => {
    if (
      busyCellsRef.current.size === 0 &&
      !dragActive.current &&
      needsReload.current &&
      selectedTeacher
    ) {
      needsReload.current = false;
      await loadTeacherHours(selectedTeacher.TeacherId);
    }
  }, [selectedTeacher, loadTeacherHours]);

  // פעולה ברמה נמוכה: שיבוץ שעה לכיתה. מחזירה קוד res מהשרת (0/1 הצלחה).
  const doAssignOp = useCallback(
    async (hourId: string, classId: number): Promise<number> => {
      if (!selectedTeacher) return -1;
      addBusy(hourId);
      try {
        try {
          await ajax('Teacher_SetTeacherHours', {
            TeacherId: selectedTeacher.TeacherId,
            HourId: hourId,
            Type: 1,
          });
        } catch {
          /* row already exists - proceed */
        }
        const result = await ajax<Array<{ res: number }>>('Assign_SetAssignManual', {
          Type: 1,
          SourceId: selectedTeacher.TeacherId,
          SourceTeacherId: selectedTeacher.TeacherId,
          SourceClassId: '',
          SourceHourId: '',
          SourceProfessionalId: '',
          SourceHakbatza: '',
          SourceIhud: '',
          TargetId: '',
          TargetTeacherId: '',
          TargetClassId: classId,
          TargetHourId: hourId,
          TargetProfessionalId: '',
          TargetHakbatza: '',
          TargetIhud: '',
        });
        const res = Array.isArray(result) && result[0] ? Number(result[0].res ?? 0) : 0;
        needsReload.current = true;
        return res;
      } catch (err) {
        console.error('doAssignOp failed', err);
        return -1;
      } finally {
        delBusy(hourId);
        maybeReload();
      }
    },
    [selectedTeacher, addBusy, delBusy, maybeReload],
  );

  const doRemoveOp = useCallback(
    async (hourId: string): Promise<boolean> => {
      if (!selectedTeacher) return false;
      addBusy(hourId);
      try {
        const row = hourMap[hourId];
        const hourType = Number(row?.HourTypeId ?? 0);
        // שיבוץ כיתה (רגילה) - מוחקים את כל שורות ה-TeacherAssignment המתאימות
        // (ה-SP דורש SourceId = AssignmentId; ללא זה הוא מחזיר res:0 אך לא מוחק).
        if (hourType === 1) {
          const matches = teacherAssignments.filter(
            (a) => String(a.HourId) === String(hourId),
          );
          for (const a of matches) {
            try {
              await ajax('Assign_SetAssignManual', {
                Type: 3,
                SourceId: String(a.AssignmentId),
                SourceTeacherId: selectedTeacher.TeacherId,
                SourceClassId: String(a.ClassId ?? ''),
                SourceHourId: hourId,
                SourceProfessionalId: String(a.ProfessionalId ?? ''),
                SourceHakbatza: String(a.Hakbatza ?? ''),
                SourceIhud: String(a.Ihud ?? ''),
                TargetId: '',
                TargetTeacherId: '',
                TargetClassId: '',
                TargetHourId: '',
                TargetProfessionalId: '',
                TargetHakbatza: '',
                TargetIhud: '',
              });
            } catch (err) {
              console.error('Assign_SetAssignManual Type=3 failed', err);
            }
          }
        }
        // פרטני - ביטול דרך Teacher_SetPartani Type=2
        if (hourType === 2) {
          try {
            await ajax('Teacher_SetPartani', {
              HourId: hourId,
              TeacherId: selectedTeacher.TeacherId,
              Type: 2,
            });
          } catch {
            /* ignore */
          }
        }
        // תמיד להסיר גם את סימון ה-TeacherHours כדי שהתא ייראה ריק לגמרי
        try {
          await ajax('Teacher_SetTeacherHours', {
            TeacherId: selectedTeacher.TeacherId,
            HourId: hourId,
            Type: 2,
          });
        } catch {
          /* כבר אין שורה - זה בסדר */
        }
        needsReload.current = true;
        return true;
      } catch (err) {
        console.error('doRemoveOp failed', err);
        return false;
      } finally {
        delBusy(hourId);
        maybeReload();
      }
    },
    [selectedTeacher, hourMap, teacherAssignments, addBusy, delBusy, maybeReload],
  );

  const onCellMouseDown = (e: React.MouseEvent, hourId: string) => {
    if (e.button !== 0 || !selectedTeacher) return;
    if (busyCellsRef.current.has(hourId)) return;
    // Block interaction on hours that aren't defined in SchoolHours for this config
    if (schoolHourIds.size > 0 && !schoolHourIds.has(hourId)) {
      toast.warning('שעה זו אינה מוגדרת כשעת לימוד בבית הספר. הוסף אותה תחילה במסך "שעות בית הספר"', { title: 'שעה לא זמינה' });
      return;
    }
    if (shehyaOnlyHourIds.has(hourId)) {
      toast.info('שעה זו מוגדרת כ"שהייה בלבד". ניתן להגדיר רק שהייה/פרטני דרך תפריט קליק-ימני');
      return;
    }
    const existing = hourMap[hourId];
    // תא נחשב "מסומן" רק אם יש לו HourTypeId (1=שיבוץ, 2=פרטני, 3=שהייה).
    // רשומות ללא HourTypeId הן רק מידע על שעות פתוחות בביה"ס - תא ריק למשתמש.
    const existingType = existing ? Number(existing.HourTypeId ?? 0) : 0;
    const isMarked = existingType === 1 || existingType === 2 || existingType === 3;
    // לחיצה על שעה מסומנת (שיבוץ כיתה/שהייה/פרטני) - הופכת אותה לריקה
    if (isMarked) {
      // If this is a class assignment and there's a real TeacherAssignment
      // backing it, removing the working hour will wipe the assignment too.
      // Pause and ask the admin to confirm before doing damage to the schedule.
      if (existingType === 1) {
        const linkedAssignments = teacherAssignments.filter(
          (a) => String(a.HourId) === String(hourId),
        );
        if (linkedAssignments.length > 0) {
          const classNames = Array.from(
            new Set(
              linkedAssignments
                .map((a) => {
                  const cid = (a as { ClassId?: number | string | null }).ClassId;
                  if (!cid) return '';
                  const cls = classOptions.find((c) => String(c.ClassId) === String(cid));
                  return cls?.ClassName ?? `כיתה ${cid}`;
                })
                .filter((s) => s.length > 0),
            ),
          );
          setRemoveAssignConfirm({
            hourId,
            day: Number(hourId.charAt(0)),
            hour: Number(hourId.slice(1)),
            classNames,
          });
          return;
        }
      }
      dragMode.current = 'remove';
      dragActive.current = true;
      draggedCells.current = new Set([hourId]);
      dragFailCount.current = 0;
      doRemoveOp(hourId).then((ok) => {
        if (!ok) dragFailCount.current += 1;
      });
      return;
    }
    const manageClassId = Number((selectedTeacher as { ManageClassId?: unknown }).ManageClassId ?? 0);
    // מכסה מלאה - מודל מכסה (לא מתחילים גרירה)
    const frontalyQuota = Number(selectedTeacher.Frontaly ?? 0);
    if (frontalyQuota > 0 && frontalCount >= frontalyQuota) {
      const day = Number(hourId.charAt(0));
      const seq = Number(hourId.slice(1));
      setQuotaValue(frontalyQuota + 1);
      setQuotaModal({ hourId, day, seq, manageClassId });
      return;
    }
    // Pick the option list before deciding the flow:
    // - 0 options → fall back to all classes (legacy behaviour) so the user
    //   isn't blocked when classes haven't been linked yet
    // - 1 option → assign immediately, no popup
    // - 2+ options → open the picker constrained to those classes
    const linkedClasses = teacherClasses.length > 0
      ? teacherClasses
      : classOptions.map((c) => ({ ClassId: c.ClassId, ClassName: c.ClassName, Hakbatza: 0, Ihud: 0, LayerId: 0 }));

    if (manageClassId === 0) {
      if (linkedClasses.length === 1) {
        // Single class — drag-assign directly to it
        const onlyClass = linkedClasses[0].ClassId;
        dragMode.current = 'add';
        dragClassId.current = onlyClass;
        dragActive.current = true;
        draggedCells.current = new Set([hourId]);
        dragFailCount.current = 0;
        doAssignOp(hourId, onlyClass).then((res) => {
          if (res !== 0 && res !== 1) dragFailCount.current += 1;
        });
        return;
      }
      const day = Number(hourId.charAt(0));
      const seq = Number(hourId.slice(1));
      setClassPicker({ hourId, day, seq });
      return;
    }
    // מורה מחנכת - מתחילים גרירת שיבוץ לכיתה שלה
    dragMode.current = 'add';
    dragClassId.current = manageClassId;
    dragActive.current = true;
    draggedCells.current = new Set([hourId]);
    dragFailCount.current = 0;
    doAssignOp(hourId, manageClassId).then((res) => {
      if (res !== 0 && res !== 1) dragFailCount.current += 1;
    });
  };

  const onCellMouseEnter = (hourId: string) => {
    if (!dragActive.current || !dragMode.current || !selectedTeacher) return;
    if (draggedCells.current.has(hourId)) return;
    if (busyCellsRef.current.has(hourId)) return;
    // Don't drag over non-school-hour or shehya-only cells
    if (schoolHourIds.size > 0 && !schoolHourIds.has(hourId)) return;
    if (shehyaOnlyHourIds.has(hourId)) return;
    const existing = hourMap[hourId];
    const existingType = existing ? Number(existing.HourTypeId ?? 0) : 0;
    const isMarked = existingType === 1 || existingType === 2 || existingType === 3;

    if (dragMode.current === 'add') {
      if (isMarked) return; // בגרירת שיבוץ מדלגים על תאים כבר מסומנים
      const quota = Number(selectedTeacher.Frontaly ?? 0);
      if (quota > 0 && frontalCount + draggedCells.current.size >= quota) return;
      draggedCells.current.add(hourId);
      doAssignOp(hourId, dragClassId.current).then((res) => {
        if (res !== 0 && res !== 1) dragFailCount.current += 1;
      });
    } else if (dragMode.current === 'remove') {
      if (!isMarked) return; // בגרירת הסרה מדלגים על תאים ריקים
      draggedCells.current.add(hourId);
      doRemoveOp(hourId).then((ok) => {
        if (!ok) dragFailCount.current += 1;
      });
    }
  };

  async function assignHourToClass(hourId: string, classId: number) {
    if (!selectedTeacher) return;
    setPickerBusy(true);
    try {
      const res = await doAssignOp(hourId, classId);
      if (res !== 0 && res !== 1) {
        if (res === 2) toast.warning('השעה כבר משובצת לכיתה אחרת', { title: 'שיבוץ נכשל' });
        else if (res === 3) toast.warning('יש לקשר את המורה לכיתה תחילה במסך "הגדרות כיתות ומורים"', { title: 'שיבוץ נכשל' });
        else if (res === 4) toast.warning('לא ניתן לשבץ — חריגה ממגבלות המערכת', { title: 'שיבוץ נכשל' });
        else if (res === -1) toast.error('שיבוץ נכשל — בעיית רשת או שרת');
        else toast.error(`שיבוץ נכשל (קוד ${res})`);
      } else {
        toast.success('השעה שובצה לכיתה בהצלחה');
        setClassPicker(null);
      }
    } finally {
      setPickerBusy(false);
    }
  }

  async function updateMaxHours(newVal: number) {
    if (!selectedTeacher) return;
    if (maxHoursBusy) return;
    if (!Number.isFinite(newVal) || newVal <= 0) {
      toast.warning('הזן מספר חיובי של שעות');
      return;
    }
    if (newVal < frontalCount) {
      toast.warning(
        `המורה משובצת כבר ל-${frontalCount} שעות — הסר שיבוצים לפני הקטנת המכסה`,
      );
      setMaxHoursEdit(String(selectedTeacher.Frontaly ?? 0));
      return;
    }
    setMaxHoursBusy(true);
    try {
      const t = selectedTeacher;
      await ajax('Teacher_DML', {
        TeacherId: t.TeacherId,
        Tafkid: t.TafkidId ?? '',
        ProfessionalId: t.ProfessionalId ?? '',
        FirstName: t.FirstName ?? '',
        LastName: t.LastName ?? '',
        Email: t.Email ?? '',
        Frontaly: String(newVal),
        FreeDay: t.FreeDay ?? '',
        Tz: t.Tz ?? '',
        Shehya: t.Shehya ?? '',
        Partani: t.Partani ?? '',
        Type: 1,
      });
      const updated: Teacher = { ...t, Frontaly: newVal };
      setSelectedTeacher(updated);
      setTeachers((prev) =>
        prev.map((x) => (String(x.TeacherId) === String(updated.TeacherId) ? updated : x)),
      );
      toast.success(`המכסה עודכנה ל-${newVal} שעות`);
    } catch (err) {
      console.error('updateMaxHours failed', err);
      toast.error('עדכון המכסה נכשל');
    } finally {
      setMaxHoursBusy(false);
    }
  }

  async function updateFreeDay(newFreeDay: number | '') {
    if (!selectedTeacher) return;
    if (freeDayBusy) return;
    setFreeDayBusy(true);
    try {
      const t = selectedTeacher;
      await ajax('Teacher_DML', {
        TeacherId: t.TeacherId,
        Tafkid: t.TafkidId ?? '',
        ProfessionalId: t.ProfessionalId ?? '',
        FirstName: t.FirstName ?? '',
        LastName: t.LastName ?? '',
        Email: t.Email ?? '',
        Frontaly: t.Frontaly ?? '',
        FreeDay: newFreeDay === '' ? '' : String(newFreeDay),
        Tz: t.Tz ?? '',
        Shehya: t.Shehya ?? '',
        Partani: t.Partani ?? '',
        Type: 1,
      });
      const updated: Teacher = { ...t, FreeDay: newFreeDay === '' ? null : newFreeDay };
      setSelectedTeacher(updated);
      setTeachers((prev) =>
        prev.map((x) => (String(x.TeacherId) === String(updated.TeacherId) ? updated : x)),
      );
      if (newFreeDay === '') {
        toast.success('בוטל יום חופשי');
      } else {
        toast.success(`יום חופשי עודכן ל${DAYS[Number(newFreeDay) - 1]?.label || 'יום ' + newFreeDay}`);
      }
    } catch (err) {
      console.error('updateFreeDay failed', err);
      toast.error('עדכון יום חופשי נכשל');
    } finally {
      setFreeDayBusy(false);
    }
  }

  async function updateFrontalyQuota(newVal: number) {
    if (!selectedTeacher || !quotaModal) return;
    if (!Number.isFinite(newVal) || newVal <= 0) {
      toast.warning('הזן מספר חיובי של שעות');
      return;
    }
    if (newVal < frontalCount) {
      toast.warning(`המורה משובצת כבר ל-${frontalCount} שעות פרונטלי — הסר שיבוצים קודם`);
      return;
    }
    setQuotaBusy(true);
    try {
      const t = selectedTeacher;
      await ajax('Teacher_DML', {
        TeacherId: t.TeacherId,
        Tafkid: t.TafkidId ?? '',
        ProfessionalId: t.ProfessionalId ?? '',
        FirstName: t.FirstName ?? '',
        LastName: t.LastName ?? '',
        Email: t.Email ?? '',
        Frontaly: String(newVal),
        FreeDay: t.FreeDay ?? '',
        Tz: t.Tz ?? '',
        Shehya: t.Shehya ?? '',
        Partani: t.Partani ?? '',
        Type: 1,
      });
      const updated: Teacher = { ...t, Frontaly: newVal };
      setSelectedTeacher(updated);
      setTeachers((prev) =>
        prev.map((x) => (String(x.TeacherId) === String(updated.TeacherId) ? updated : x)),
      );
      toast.success(`המכסה עודכנה ל-${newVal} שעות פרונטלי`);
      const pending = quotaModal;
      setQuotaModal(null);
      // אחרי עדכון מוצלח - ממשיכים אוטומטית לשיבוץ שהתבקש
      if (pending.manageClassId > 0) {
        assignHourToClass(pending.hourId, pending.manageClassId);
      } else {
        setClassPicker({ hourId: pending.hourId, day: pending.day, seq: pending.seq });
      }
    } catch (err) {
      console.error('updateFrontalyQuota failed', err);
      toast.error('עדכון המכסה נכשל');
    } finally {
      setQuotaBusy(false);
    }
  }

  async function removeAssignment(hourId: string) {
    if (!selectedTeacher) return;
    setPickerBusy(true);
    try {
      const ok = await doRemoveOp(hourId);
      if (ok) {
        setClassPicker(null);
        toast.success('השיבוץ הוסר');
      } else {
        toast.error('הסרת השיבוץ נכשלה');
      }
    } finally {
      setPickerBusy(false);
    }
  }

  useEffect(() => {
    const stop = () => {
      if (!dragActive.current) return;
      const mode = dragMode.current;
      const count = draggedCells.current.size;
      dragActive.current = false;
      dragMode.current = null;
      dragClassId.current = 0;
      draggedCells.current = new Set();
      if (mode && count > 0) {
        dragSummary.current = { mode, count };
      }
      // אם כבר אין תאים בעבודה, הצגת הסיכום מיידית; אחרת delBusy האחרון יטפל
      showDragSummaryIfReady();
      maybeReload();
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, [showDragSummaryIfReady, maybeReload]);

  const onCellContextMenu = (e: React.MouseEvent, cell: HourCell) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    // Skip the menu if the school doesn't have this hour at all.
    if (schoolHourIds.size > 0 && !schoolHourIds.has(cell.hourId)) return;
    setMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      hourId: cell.hourId,
      HourTypeId: cell.HourTypeId,
    });
  };

  // Right-click on a cell that doesn't have any teacher-hour row yet:
  // surfaces the same shehya/partani menu so the user can mark it
  // directly without first toggling it as a regular (frontaly) cell.
  const onEmptyCellContextMenu = (e: React.MouseEvent, hourId: string) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    if (schoolHourIds.size > 0 && !schoolHourIds.has(hourId)) return;
    setMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      hourId,
      HourTypeId: 0,
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

  // Unified shehya/partani toggling. Calls Teacher_SetHourType which
  // replaces any existing non-class row so the user can flip directly
  // between shehya/partani — no need to clear first.
  const callSetHourType = useCallback(
    async (hourId: string, action: 'shehya' | 'partani' | 'clear', force: boolean = false) => {
      if (!selectedTeacher) return;
      try {
        const res = await ajax<{ res: number }[]>('Teacher_SetHourType', {
          HourId: hourId,
          TeacherId: selectedTeacher.TeacherId,
          Action: action,
          Force: force ? '1' : '0',
        });
        const code = Number(res?.[0]?.res ?? 0);
        if (code === 2) {
          toast.warning('השעה משובצת לכיתה. בטל את השיבוץ קודם', { title: 'שיבוץ קיים' });
        } else if (code === 1) {
          toast.error('השמירה נכשלה');
        } else {
          await loadTeacherHours(selectedTeacher.TeacherId);
        }
      } catch (e) {
        console.error('Teacher_SetHourType failed', e);
        toast.error('השמירה נכשלה');
      }
    },
    [selectedTeacher, loadTeacherHours, toast],
  );

  // Open the per-teacher edit modal pre-populated with the row's values.
  // We pull a fresh copy from Teacher_GetTeacherList so the form stays
  // accurate even after other fields change in the same session.
  const openEditTeacher = useCallback(async (teacherId: number | string) => {
    try {
      const data = await ajax<Teacher[]>('Teacher_GetTeacherList', { TeacherId: teacherId });
      const t = Array.isArray(data) ? data[0] : null;
      if (!t) return;
      setEditTeacher({
        TeacherId: teacherId,
        Tafkid: String(t.TafkidId ?? '0'),
        ProfessionalId: String(t.ProfessionalId ?? '0'),
        FirstName: String(t.FirstName ?? ''),
        LastName: String(t.LastName ?? ''),
        Email: String(t.Email ?? ''),
        Frontaly: String(t.Frontaly ?? ''),
        FreeDay: String(t.FreeDay ?? '0'),
        Tz: String(t.Tz ?? ''),
        Shehya: String(t.Shehya ?? ''),
        Partani: String(t.Partani ?? ''),
      });
    } catch (e) {
      console.error('Teacher_GetTeacherList failed', e);
      toast.error('טעינת פרטי המורה נכשלה');
    }
  }, [toast]);

  const saveEditTeacher = useCallback(async () => {
    if (!editTeacher || editTeacherBusy) return;
    if (editTeacher.Tafkid === '0' || !editTeacher.FirstName || !editTeacher.LastName || !editTeacher.Frontaly) {
      toast.warning('יש למלא תפקיד, שם, שם משפחה ושעות פרונטלי', { title: 'חסרים שדות חובה' });
      return;
    }
    setEditTeacherBusy(true);
    try {
      await ajax('Teacher_DML', {
        TeacherId: editTeacher.TeacherId,
        Tafkid: editTeacher.Tafkid,
        ProfessionalId: editTeacher.ProfessionalId,
        FirstName: editTeacher.FirstName,
        LastName: editTeacher.LastName,
        Email: editTeacher.Email,
        Frontaly: editTeacher.Frontaly,
        FreeDay: editTeacher.FreeDay,
        Tz: editTeacher.Tz,
        Shehya: editTeacher.Shehya,
        Partani: editTeacher.Partani,
        Type: 1,
      });
      toast.success('פרטי המורה נשמרו');
      setEditTeacher(null);
      await loadTeachers();
    } catch (e) {
      console.error('Teacher_DML failed', e);
      toast.error('שמירת פרטי המורה נכשלה');
    } finally {
      setEditTeacherBusy(false);
    }
  }, [editTeacher, editTeacherBusy, loadTeachers, toast]);

  const onMenuDefineShehya = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    callSetHourType(id, 'shehya');
  };

  const onMenuClearShehya = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    callSetHourType(id, 'clear');
  };

  const onMenuSetPartani = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    callSetHourType(id, 'partani');
  };

  const onMenuClearPartani = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    callSetHourType(id, 'clear');
  };

  const confirmDeleteTeacher = useCallback(async () => {
    if (!deleteTeacher || deleteTeacherBusy) return;
    setDeleteTeacherBusy(true);
    try {
      await ajax('Teacher_DML', {
        TeacherId: deleteTeacher.teacherId,
        Tafkid: '',
        ProfessionalId: '',
        FirstName: '',
        LastName: '',
        Email: '',
        Frontaly: '',
        FreeDay: '',
        Tz: '',
        Shehya: '',
        Partani: '',
        Type: 3,
      });
      toast.success('המורה נמחק/ה');
      setDeleteTeacher(null);
      // If the deleted teacher was selected in the modal, close it
      if (selectedTeacher && String(selectedTeacher.TeacherId) === String(deleteTeacher.teacherId)) {
        setSelectedTeacher(null);
      }
      await loadTeachers();
    } catch (e) {
      console.error('Teacher_DML delete failed', e);
      toast.error('מחיקת המורה נכשלה');
    } finally {
      setDeleteTeacherBusy(false);
    }
  }, [deleteTeacher, deleteTeacherBusy, loadTeachers, selectedTeacher, toast]);

  // Used when right-clicking a class-assigned (frontaly) cell to convert
  // it to shehya/partani or just drop the class assignment. Force=true
  // makes Teacher_SetHourType wipe the underlying class row first.
  const onMenuForceShehya = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    callSetHourType(id, 'shehya', true);
  };
  const onMenuForcePartani = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    callSetHourType(id, 'partani', true);
  };
  const onMenuClearAssignment = () => {
    const id = menu.hourId;
    setMenu((m) => ({ ...m, visible: false }));
    callSetHourType(id, 'clear', true);
  };

  const pickTeacher = (t: Teacher) => {
    setSelectedTeacher(t);
    setSearch(String(t.FullText ?? `${t.FirstName ?? ''} ${t.LastName ?? ''}`));
  };

  const resetTeacher = () => {
    setSelectedTeacher(null);
    setSearch('');
  };

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
            <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 className="panel-title" style={{ margin: 0 }}>&nbsp;בחירת מורה</h3>
              <div style={{ marginInlineStart: 'auto' }}>
                {(() => {
                  // Export the full teacher list (management view)
                  const tafkidName = (id: unknown): string => {
                    const row = tafkidOptions.find((t) => String(t.TafkidId) === String(id));
                    return row?.Name ?? '';
                  };
                  const rows = teachers.map((t) => ({
                    FirstName: t.FirstName ?? '',
                    LastName: t.LastName ?? '',
                    Tafkid: t.Tafkid ?? tafkidName(t.TafkidId),
                    Professional: t.Professional ?? '',
                    Email: t.Email ?? '',
                    Frontaly: t.Frontaly ?? '',
                    FreeDay: getDayInWeekString(t.FreeDay as number | string | null) || 'אין יום חופשי',
                    Tz: t.Tz ?? '',
                    TotalRequired: t.TotalRequired ?? '',
                    AssignedCount: t.AssignedCount ?? '',
                  }));
                  const handlers = buildExportHandlers({
                    title: 'רשימת מורים',
                    subtitle: `הודפס ב-${new Date().toLocaleDateString('he-IL')}`,
                    filename: 'teachers-list',
                    rows,
                    columns: [
                      { key: 'FirstName', label: 'שם פרטי' },
                      { key: 'LastName', label: 'שם משפחה' },
                      { key: 'Tafkid', label: 'תפקיד' },
                      { key: 'Professional', label: 'מקצוע' },
                      { key: 'Frontaly', label: 'שעות שבועיות', align: 'center' },
                      { key: 'FreeDay', label: 'יום חופשי' },
                      { key: 'TotalRequired', label: 'נדרש', align: 'center' },
                      { key: 'AssignedCount', label: 'שובץ', align: 'center' },
                      { key: 'Email', label: 'דוא״ל' },
                      { key: 'Tz', label: 'ת״ז' },
                    ],
                  });
                  return <ExportButtons {...handlers} />;
                })()}
              </div>
            </div>
            <div className="panel-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div className="col-md-4" style={{ flex: '1 1 300px', minWidth: 260 }}>
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
                {(() => {
                  const t = selectedTeacher;
                  if (!t) return null;
                  const dayName = getDayInWeekString(t.FreeDay);
                  const items: Array<{ icon: string; label: string; value: string | number }> = [];
                  if (t.Tafkid) items.push({ icon: 'fa-id-badge', label: 'תפקיד', value: String(t.Tafkid) });
                  if (t.Professional) items.push({ icon: 'fa-book', label: 'מקצוע', value: String(t.Professional) });
                  if (t.Tz) items.push({ icon: 'fa-id-card', label: 'ת״ז', value: String(t.Tz) });
                  if (t.Email) items.push({ icon: 'fa-envelope', label: 'אימייל', value: String(t.Email) });
                  items.push({ icon: 'fa-calendar-times-o', label: 'יום חופשי', value: dayName || 'אין' });
                  if (t.Frontaly != null && String(t.Frontaly) !== '') items.push({ icon: 'fa-clock-o', label: 'פרונטלי', value: `${frontalCount}/${t.Frontaly}` });
                  if (t.Shehya != null && String(t.Shehya) !== '') items.push({ icon: 'fa-users', label: 'שהייה', value: `${shehyaCount}/${t.Shehya}` });
                  if (t.Partani != null && String(t.Partani) !== '') items.push({ icon: 'fa-user', label: 'פרטני', value: `${partaniCount}/${t.Partani}` });
                  if (items.length === 0) return null;
                  return (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 10,
                        maxWidth: 540,
                      }}
                    >
                      {items.map((it, idx) => (
                        <span
                          key={idx}
                          title={`${it.label}: ${it.value}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: 'rgba(255,255,255,0.18)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: 14,
                            padding: '3px 9px',
                            fontSize: 11,
                            color: '#fff',
                            fontWeight: 600,
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          <i className={`fa ${it.icon}`} style={{ fontSize: 10, opacity: 0.85 }} />
                          <span style={{ opacity: 0.7 }}>{it.label}:</span>
                          <strong>{it.value}</strong>
                        </span>
                      ))}
                    </div>
                  );
                })()}
                {selectedTeacher && (() => {
                  // Build a flat table of this teacher's hours with class/prof/
                  // hakbatza/ihud for export.
                  const rows = teacherHours
                    .filter((r) => r.HourId)
                    .map((r) => {
                      const hid = String(r.HourId);
                      const day = Number(hid.charAt(0));
                      const hourNum = Number(hid.slice(1));
                      const group = groupByHourId.get(hid);
                      return {
                        Day: getDayInWeekString(day),
                        Hour: hourNum,
                        ClassName: r.ClassNameAssign ?? r.className ?? '',
                        Professional: r.Professional ?? '',
                        HourType: r.HourType ?? '',
                        Hakbatza: group?.hak ? String(group.hak) : '',
                      };
                    });
                  const handlers = buildExportHandlers({
                    title: `שעות שבועיות — ${teacherFullName}`,
                    subtitle: `הודפס ב-${new Date().toLocaleDateString('he-IL')}`,
                    filename: `teacher-hours-${selectedTeacher.TeacherId}`,
                    rows,
                    columns: [
                      { key: 'Day', label: 'יום' },
                      { key: 'Hour', label: 'שעה', align: 'center' },
                      { key: 'ClassName', label: 'כיתה' },
                      { key: 'Professional', label: 'מקצוע' },
                      { key: 'HourType', label: 'סוג' },
                      { key: 'Hakbatza', label: 'הקבצה', align: 'center' },
                    ],
                  });
                  return <ExportButtons {...handlers} style={{ marginTop: 8 }} />;
                })()}
              </div>
              <div
                className="th-modal__stats"
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'stretch',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  className="th-stat th-stat--primary"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '10px 14px',
                    minWidth: 170,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      lineHeight: 1,
                    }}
                  >
                    <strong style={{ fontSize: 32, minWidth: 36, textAlign: 'center' }}>
                      {frontalCount}
                    </strong>
                    <span style={{ fontSize: 22, opacity: 0.8 }}>/</span>
                    <input
                      type="number"
                      min={1}
                      value={maxHoursEdit}
                      disabled={maxHoursBusy}
                      onChange={(e) => setMaxHoursEdit(e.target.value)}
                      onBlur={() => {
                        const n = Number(maxHoursEdit);
                        if (n > 0 && n !== Number(selectedTeacher?.Frontaly ?? 0)) {
                          updateMaxHours(n);
                        } else if (n <= 0) {
                          setMaxHoursEdit(String(selectedTeacher?.Frontaly ?? 0));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') {
                          setMaxHoursEdit(String(selectedTeacher?.Frontaly ?? 0));
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      style={{
                        width: 56,
                        height: 36,
                        fontSize: 22,
                        fontWeight: 700,
                        lineHeight: 1,
                        textAlign: 'center',
                        padding: '0 4px',
                        border: '1px solid rgba(255,255,255,0.45)',
                        borderRadius: 6,
                        background: maxHoursBusy ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)',
                        color: '#1f2937',
                        boxSizing: 'border-box',
                      }}
                      title="לחץ כדי לערוך את מקסימום השעות"
                    />
                  </div>
                  <span
                    className="th-stat__label"
                    style={{ whiteSpace: 'nowrap', fontSize: 12, opacity: 0.95 }}
                  >
                    שובצו / מקסימום
                  </span>
                </div>

                <div
                  className="th-stat"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '10px 14px',
                    minWidth: 170,
                  }}
                >
                  <span
                    className="th-stat__label"
                    style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12, opacity: 0.95 }}
                  >
                    יום חופשי
                  </span>
                  <select
                    value={
                      selectedTeacher?.FreeDay == null || selectedTeacher.FreeDay === ''
                        ? ''
                        : String(selectedTeacher.FreeDay)
                    }
                    disabled={freeDayBusy}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateFreeDay(v === '' ? '' : Number(v));
                    }}
                    style={{
                      height: 36,
                      padding: '0 8px',
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.45)',
                      fontSize: 14,
                      background: freeDayBusy ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)',
                      color: '#1f2937',
                      cursor: freeDayBusy ? 'wait' : 'pointer',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="" style={{ color: '#1f2937' }}>
                      בלי יום חופשי
                    </option>
                    {DAYS.map((d) => (
                      <option key={d.num} value={d.num} style={{ color: '#1f2937' }}>
                        {d.label}
                      </option>
                    ))}
                  </select>
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
              <span className="th-legend__item th-legend__item--regular"><i /> פרונטלי</span>
              <span className="th-legend__item th-legend__item--shehya"><i /> שהייה</span>
              <span className="th-legend__item th-legend__item--partani"><i /> פרטני</span>
              <span className="th-legend__item th-legend__item--available"><i /> פנוי בבי"ס</span>
              <span className="th-legend__item th-legend__item--empty"><i /> אין שעה בבי"ס</span>
            </div>
            <div className="th-modal__body">
              {hoursLoading && (
                <div className="th-modal__loading" role="status" aria-live="polite">
                  <div className="th-modal__loading-card">
                    <div className="th-modal__loading-orb">
                      <span /><span /><span />
                    </div>
                    <div className="th-modal__loading-title">טוען שעות המורה</div>
                    <div className="th-modal__loading-sub">מאחזר שיבוצים, שהייה ופרטני...</div>
                    <div className="th-modal__loading-bar"><div /></div>
                  </div>
                </div>
              )}
              <div className="th-grid">
                {DAYS.map((d) => {
                  const cells = dayCells[d.num] ?? [];
                  const dayCount = cells.filter((c) => c.HourTypeId === 1).length;
                  const isFreeDay = Number(selectedTeacher?.FreeDay ?? 0) === d.num;
                  return (
                    <div
                      className={`th-day${isFreeDay ? ' th-day--free' : ''}`}
                      key={d.num}
                      style={
                        isFreeDay
                          ? { opacity: 0.55, position: 'relative' }
                          : undefined
                      }
                    >
                      {isFreeDay && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            background: '#fbc02d',
                            color: '#000',
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            zIndex: 2,
                          }}
                        >
                          יום חופשי
                        </div>
                      )}
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
                          const isBusy = busyCells.has(hourId);
                          const schoolHas = schoolHourIds.size === 0 || schoolHourIds.has(hourId);
                          const isShehyaOnly = shehyaOnlyHourIds.has(hourId);
                          if (!schoolHas) {
                            return (
                              <div
                                key={`na-${hourId}`}
                                id={hourId}
                                className="th-cell th-cell--empty th-cell--unavailable"
                                title="שעה זו אינה מוגדרת כשעת לימוד בבית הספר"
                              >
                                <div className="th-cell__meta">
                                  <span className="th-cell__seq">{seq}</span>
                                  <span className="th-cell__time">{HOUR_TIME_RANGES[seq]}</span>
                                </div>
                                <div className="th-cell__na" style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 6 }}>
                                  לא קיים בבי"ס
                                </div>
                              </div>
                            );
                          }
                          if (isShehyaOnly && !cell) {
                            return (
                              <div
                                key={`so-${hourId}`}
                                id={hourId}
                                className="th-cell th-cell--empty th-cell--shehya-only"
                                title='שעה זו מוגדרת כ"שהייה בלבד"'
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  if (!selectedTeacher) return;
                                  setMenu({ visible: true, x: e.clientX, y: e.clientY, hourId, HourTypeId: 0 });
                                }}
                              >
                                <div className="th-cell__meta">
                                  <span className="th-cell__seq">{seq}</span>
                                  <span className="th-cell__time">{HOUR_TIME_RANGES[seq]}</span>
                                </div>
                                <div className="th-cell__na" style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 6 }}>
                                  שהייה בלבד
                                </div>
                              </div>
                            );
                          }
                          if (cell) {
                            const variant = hourTypeVariant(cell.HourTypeId, cell.teacherHas);
                            const group = groupByHourId.get(cell.hourId);
                            const hakNum = group?.hak ?? 0;
                            return (
                              <div
                                key={cell.hourId}
                                id={cell.hourId}
                                className={`th-cell th-cell--${variant} dv_HourTypeId_${cell.HourTypeId} selected${isBusy ? ' th-cell--busy' : ''}`}
                                onMouseDown={(e) => onCellMouseDown(e, cell.hourId)}
                                onMouseEnter={() => onCellMouseEnter(cell.hourId)}
                                onContextMenu={(e) => onCellContextMenu(e, cell)}
                              >
                                <div className="th-cell__meta">
                                  <span className="th-cell__seq">{seq}</span>
                                  <span className="th-cell__time">{HOUR_TIME_RANGES[seq]}</span>
                                  {hakNum > 0 && (() => {
                                    const col = thGroupColor(hakNum);
                                    return (
                                      <span style={{ marginInlineStart: 'auto' }}>
                                        <span
                                          title={`הקבצה ${hakNum}`}
                                          style={{
                                            background: col.bg,
                                            color: col.fg,
                                            padding: '1px 4px',
                                            borderRadius: 3,
                                            fontSize: 9,
                                            fontWeight: 700,
                                            lineHeight: 1.1,
                                          }}
                                        >
                                          ה{hakNum}
                                        </span>
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div className="th-cell__label" id={`spHourType_${hourId}`}>
                                  {cell.label}
                                </div>
                                {isBusy && (
                                  <div className="th-cell__busy" aria-hidden="true">
                                    <span className="spinner" />
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div
                              key={`empty-${hourId}`}
                              id={hourId}
                              className={`th-cell th-cell--empty dv_empty${isBusy ? ' th-cell--busy' : ''}`}
                              onMouseDown={(e) => onCellMouseDown(e, hourId)}
                              onMouseEnter={() => onCellMouseEnter(hourId)}
                              onContextMenu={(e) => onEmptyCellContextMenu(e, hourId)}
                            >
                              <div className="th-cell__meta">
                                <span className="th-cell__seq">{seq}</span>
                                <span className="th-cell__time">{HOUR_TIME_RANGES[seq]}</span>
                              </div>
                              <div className="th-cell__plus">
                                <i className="fa fa-plus" />
                              </div>
                              {isBusy && (
                                <div className="th-cell__busy" aria-hidden="true">
                                  <span className="spinner" />
                                </div>
                              )}
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
          <div className="col-md-1 dvRequireTitle">מקצוע</div>
          <div className="col-md-1 dvRequireTitle">יום חופשי</div>
          <div className="col-md-1 dvRequireTitle">שהייה</div>
          <div className="col-md-1 dvRequireTitle">פרטני</div>
          <div className="col-md-1 dvRequireTitle" title="סה״כ שעות מוקצבות בשבוע (סכום שעות כל הכיתות שהמורה מלמד/ת)">מוקצבות</div>
          <div className="col-md-1 dvRequireTitle" title="כמה שעות שובצו בפועל במערכת הסופית">שיבוץ</div>
          <div className="col-md-2 dvRequireTitle" style={{ textAlign: 'center' }}>אפשרויות</div>
          <div id="dvReqContainer" className="dvPanelReq clear">
            {tableTeachers.map((t) => {
              const required = Number(t.TotalRequired ?? 0);
              const assigned = Number(t.AssignedCount ?? 0);
              const gap = assigned - required;
              const assignedColor = required === 0 ? '#6b7280' : gap === 0 ? '#16a34a' : gap < 0 ? '#dc2626' : '#d97706';
              return (
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
                  <div className="col-md-1 dvRequireDetails">{isNullDB(t.Professional)}</div>
                  <div className="col-md-1 dvRequireDetails">
                    {(() => {
                      const day = getDayInWeekString(t.FreeDay);
                      return day || <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 12 }}>אין יום חופשי</span>;
                    })()}
                  </div>
                  <div className="col-md-1 dvRequireDetails">{isNullDB(t.Shehya)}</div>
                  <div className="col-md-1 dvRequireDetails">{isNullDB(t.Partani)}</div>
                  <div className="col-md-1 dvRequireDetails" style={{ fontWeight: 600 }}>{required}</div>
                  <div className="col-md-1 dvRequireDetails" style={{ color: assignedColor, fontWeight: 600 }}>
                    {assigned}
                    {required > 0 && gap !== 0 && (
                      <span style={{ fontSize: 11, marginInlineStart: 4, opacity: 0.8 }}>
                        ({gap > 0 ? '+' : ''}{gap})
                      </span>
                    )}
                  </div>
                  <div className="col-md-2 dvRequireDetails" style={{ textAlign: 'center', display: 'inline-flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      title="הגדרת שעות שבועיות"
                      onClick={(e) => {
                        e.stopPropagation();
                        pickTeacher(t);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '3px 8px',
                        background: '#dcfce7',
                        color: '#166534',
                        border: '1px solid #86efac',
                        borderRadius: 14,
                        fontWeight: 600,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <i className="fa fa-clock-o" /> שעות
                    </button>
                    <button
                      type="button"
                      title="עריכת פרטי מורה"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditTeacher(t.TeacherId);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '3px 8px',
                        background: '#ede9fe',
                        color: '#5b21b6',
                        border: '1px solid #c4b5fd',
                        borderRadius: 14,
                        fontWeight: 600,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <i className="fa fa-pencil" /> ערוך
                    </button>
                    <button
                      type="button"
                      title="מחיקת מורה"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTeacher({
                          teacherId: t.TeacherId,
                          fullText: String(t.FullText ?? `${t.FirstName ?? ''} ${t.LastName ?? ''}`.trim()),
                        });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '3px 8px',
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: '1px solid #fca5a5',
                        borderRadius: 14,
                        fontWeight: 600,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <i className="fa fa-trash" /> מחק
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {menu.visible && (() => {
        // 0 = empty, 1 = class assignment (frontaly), 2 = partani, 3 = shehya
        const ht = Number(menu.HourTypeId ?? 0);
        const isEmpty = ht === 0;
        const isClass = ht === 1;
        const isShehya = ht === 3;
        const isPartani = ht === 2;
        return (
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
            {/* Frontaly slot (assigned to a class): offer conversion +
                explicit unassign. Each option uses Force=true so the
                underlying class row is dropped before the new state is
                written. */}
            {isClass && (
              <>
                <li>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onMenuForceShehya();
                    }}
                  >
                    <i className="fa fa-exchange" style={{ color: '#0e7490', marginInlineEnd: 6 }} />
                    החלף לשהייה
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onMenuForcePartani();
                    }}
                  >
                    <i className="fa fa-exchange" style={{ color: '#d97706', marginInlineEnd: 6 }} />
                    החלף לפרטני
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onMenuClearAssignment();
                    }}
                  >
                    <i className="fa fa-trash" style={{ color: '#dc2626', marginInlineEnd: 6 }} />
                    בטל שיבוץ
                  </a>
                </li>
              </>
            )}
            {!isShehya && !isClass && (
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onMenuDefineShehya();
                  }}
                >
                  <i className={`fa ${isPartani ? 'fa-exchange' : 'fa-users'}`} style={{ color: '#0e7490', marginInlineEnd: 6 }} />
                  {isPartani ? 'החלף לשהייה' : 'הגדרת שהייה'}
                </a>
              </li>
            )}
            {isShehya && (
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onMenuClearShehya();
                  }}
                >
                  <i className="fa fa-times-circle" style={{ color: '#dc2626', marginInlineEnd: 6 }} />
                  ביטול שהייה
                </a>
              </li>
            )}
            {!isPartani && !isClass && (
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onMenuSetPartani();
                  }}
                >
                  <i className={`fa ${isShehya ? 'fa-exchange' : 'fa-user'}`} style={{ color: '#d97706', marginInlineEnd: 6 }} />
                  {isShehya ? 'החלף לפרטני' : 'הגדרת פרטני'}
                </a>
              </li>
            )}
            {isPartani && (
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onMenuClearPartani();
                  }}
                >
                  <i className="fa fa-times-circle" style={{ color: '#dc2626', marginInlineEnd: 6 }} />
                  ביטול פרטני
                </a>
              </li>
            )}
            <li className="divider" />
            <li>
              <a
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
        );
      })()}

      {removeAssignConfirm && selectedTeacher && (() => {
        const c = removeAssignConfirm;
        const dayLabel = getDayInWeekString(c.day);
        return (
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setRemoveAssignConfirm(null);
            }}
          >
            <div className="confirm-modal__card">
              <div className="confirm-modal__icon" style={{ color: '#dc2626' }}>
                <i className="fa fa-exclamation-triangle" />
              </div>
              <h3 className="confirm-modal__title">השעה משובצת במערכת</h3>
              <p className="confirm-modal__text" style={{ textAlign: 'right' }}>
                שעה זו (<strong>{dayLabel} · שעה {c.hour}</strong>) משובצת כעת ב
                {c.classNames.length === 1 ? 'כיתה' : 'כיתות'}{' '}
                <strong>{c.classNames.join(', ')}</strong>.
                <br />
                <br />
                הסרת השעה ממורה <strong>{teacherFullName}</strong> תמחק גם את השיבוץ
                במערכת ותפגע במערכת בית הספר.
                <br />
                <br />
                האם להמשיך?
              </p>
              <div className="confirm-modal__actions" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setRemoveAssignConfirm(null)}
                  autoFocus
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    const hourId = c.hourId;
                    setRemoveAssignConfirm(null);
                    doRemoveOp(hourId);
                  }}
                >
                  <i className="fa fa-trash" /> הסר בכל זאת
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {quotaModal && selectedTeacher && (() => {
        const cls = classOptions.find((c) => c.ClassId === quotaModal.manageClassId);
        const className = cls?.ClassName ?? '';
        const isHomeroom = quotaModal.manageClassId > 0 && !!className;
        return (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quotaModalTitle"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !quotaBusy) setQuotaModal(null);
          }}
        >
          <div className="confirm-modal__card quota-modal__card">
            <div className="confirm-modal__icon quota-modal__icon">
              <i className="fa fa-clock-o" />
            </div>
            <h3 className="confirm-modal__title" id="quotaModalTitle">
              {isHomeroom ? <>שעות המורה לכיתה {className}</> : <>הגדלת מכסת שעות פרונטלי</>}
            </h3>
            <p className="confirm-modal__text">
              {isHomeroom ? (
                <>
                  המורה <strong>{teacherFullName}</strong> משובצת כבר
                  {' '}ל־<strong>{frontalCount}</strong> שעות בכיתה
                  {' '}<strong>{className}</strong> מתוך
                  {' '}<strong>{String(selectedTeacher.Frontaly ?? 0)}</strong> שעות.
                  <br />
                  הזן מספר שעות חדש כדי לשבץ את השעה שבחרת.
                </>
              ) : (
                <>
                  המורה <strong>{teacherFullName}</strong> משובצת כבר
                  {' '}ל־<strong>{frontalCount}</strong> שעות פרונטלי מתוך מכסה של
                  {' '}<strong>{String(selectedTeacher.Frontaly ?? 0)}</strong>.
                  <br />
                  הגדל את המכסה כדי להוסיף את השעה שנבחרה.
                </>
              )}
            </p>
            <div className="quota-modal__field">
              <label htmlFor="quotaValueInput">מכסה חדשה</label>
              <div className="quota-modal__stepper">
                <button
                  type="button"
                  aria-label="הפחת"
                  disabled={quotaBusy || quotaValue <= 1}
                  onClick={() => setQuotaValue((v) => Math.max(1, v - 1))}
                >
                  <i className="fa fa-minus" />
                </button>
                <input
                  id="quotaValueInput"
                  type="number"
                  min={1}
                  value={quotaValue}
                  disabled={quotaBusy}
                  onChange={(e) => setQuotaValue(Math.max(0, Number(e.target.value) || 0))}
                />
                <button
                  type="button"
                  aria-label="הוסף"
                  disabled={quotaBusy}
                  onClick={() => setQuotaValue((v) => v + 1)}
                >
                  <i className="fa fa-plus" />
                </button>
              </div>
              <div className="quota-modal__hint">
                <i className="fa fa-info-circle" />
                <span>
                  ניצול יהיה {frontalCount} / {quotaValue || 0}
                </span>
              </div>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => !quotaBusy && setQuotaModal(null)}
                disabled={quotaBusy}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-info"
                onClick={() => updateFrontalyQuota(quotaValue)}
                disabled={quotaBusy || quotaValue <= 0}
                autoFocus
              >
                {quotaBusy ? (
                  <>
                    <span className="spinner" /> מעדכן…
                  </>
                ) : (
                  <>
                    <i className="fa fa-check" /> עדכן ושבץ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {classPicker && (
        <div
          className="class-picker"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !pickerBusy) setClassPicker(null);
          }}
        >
          <div className="class-picker__card">
            <div className="class-picker__header">
              <div>
                <div className="class-picker__kicker">שיבוץ לכיתה</div>
                <h3 className="class-picker__title">
                  {teacherFullName} · יום {['', 'ראשון','שני','שלישי','רביעי','חמישי','שישי'][classPicker.day]} · שעה {classPicker.seq}
                </h3>
              </div>
              <button
                type="button"
                className="class-picker__close"
                onClick={() => !pickerBusy && setClassPicker(null)}
                aria-label="סגור"
              >
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="class-picker__body">
              {(() => {
                // Only show classes the teacher is linked to in TeacherClass.
                // If nothing is linked yet, fall back to all classes so the
                // user can still proceed (they'll be informed by the
                // assignHourToClass response if it's blocked server-side).
                const opts = teacherClasses.length > 0
                  ? teacherClasses.map((c) => ({
                      ClassId: c.ClassId,
                      ClassName: c.ClassName,
                      isHakbatza: Number(c.Hakbatza) > 0,
                      isIhud: Number(c.Ihud) > 0,
                    }))
                  : classOptions.map((c) => ({
                      ClassId: c.ClassId,
                      ClassName: c.ClassName,
                      isHakbatza: false,
                      isIhud: false,
                    }));
                if (opts.length === 0) return <div className="class-picker__empty">לא נמצאו כיתות להצגה</div>;
                return (
                  <>
                    {teacherClasses.length === 0 && classOptions.length > 0 && (
                      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                        <i className="fa fa-info-circle" /> המורה לא מקושר לכיתה ב"הגדרות כיתות ומורים". מוצגות כל הכיתות כברירת מחדל.
                      </div>
                    )}
                    <div className="class-picker__grid">
                      {opts.map((c) => (
                        <button
                          key={c.ClassId + '_' + (c.isHakbatza ? 'H' : c.isIhud ? 'I' : 'R')}
                          type="button"
                          className="class-picker__chip"
                          disabled={pickerBusy}
                          onClick={() => classPicker && assignHourToClass(classPicker.hourId, c.ClassId)}
                          title={c.isHakbatza ? 'שיבוץ דרך הקבצה' : c.isIhud ? 'שיבוץ דרך איחוד' : 'שיבוץ רגיל'}
                          style={c.isHakbatza ? { borderColor: '#d97706', background: '#fef3c7' }
                            : c.isIhud ? { borderColor: '#7c3aed', background: '#ede9fe' } : undefined}
                        >
                          <i className={`fa ${c.isHakbatza ? 'fa-object-group' : c.isIhud ? 'fa-link' : 'fa-users'}`} /> {c.ClassName}
                          {c.isHakbatza && <span style={{ fontSize: 10, marginInlineStart: 4, opacity: 0.7 }}>הקבצה</span>}
                          {c.isIhud && <span style={{ fontSize: 10, marginInlineStart: 4, opacity: 0.7 }}>איחוד</span>}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="class-picker__footer">
              {hourMap[classPicker.hourId] && (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={pickerBusy}
                  onClick={() => removeAssignment(classPicker.hourId)}
                >
                  <i className="fa fa-trash" /> הסר שיבוץ
                </button>
              )}
              <button
                type="button"
                className="btn btn-default"
                disabled={pickerBusy}
                onClick={() => setClassPicker(null)}
              >
                ביטול
              </button>
              {pickerBusy && <span className="class-picker__busy"><span className="spinner" /> מעדכן…</span>}
            </div>
          </div>
        </div>
      )}

      {editTeacher && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !editTeacherBusy) setEditTeacher(null);
          }}
        >
          <div className="confirm-modal__card" style={{ maxWidth: 980, width: '92vw', padding: '24px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div className="confirm-modal__icon" style={{ background: '#ede9fe', color: '#5b21b6', width: 44, height: 44, fontSize: 18, margin: 0 }}>
                <i className="fa fa-user-circle" />
              </div>
              <div>
                <h3 className="confirm-modal__title" style={{ margin: 0, textAlign: 'right' }}>עריכת פרטי מורה</h3>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {editTeacher.FirstName} {editTeacher.LastName}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, textAlign: 'right' }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block' }}>ת״ז</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTeacher.Tz}
                  onChange={(e) => setEditTeacher((s) => s ? { ...s, Tz: e.target.value } : s)}
                  disabled={editTeacherBusy}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block' }}>שם פרטי</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTeacher.FirstName}
                  onChange={(e) => setEditTeacher((s) => s ? { ...s, FirstName: e.target.value } : s)}
                  disabled={editTeacherBusy}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block' }}>שם משפחה</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTeacher.LastName}
                  onChange={(e) => setEditTeacher((s) => s ? { ...s, LastName: e.target.value } : s)}
                  disabled={editTeacherBusy}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block' }}>תפקיד</label>
                <select
                  className="form-control"
                  value={editTeacher.Tafkid}
                  onChange={(e) => {
                    const newTafkid = e.target.value;
                    setEditTeacher((s) => {
                      if (!s) return s;
                      // If the chosen role is "מחנכ/ת כיתה", lock the
                      // profession to "מחנך" automatically — that's the
                      // implicit subject homeroom teachers always teach.
                      const isHomeroom = tafkidOptions.find((t) => String(t.TafkidId) === newTafkid)?.Name?.includes('מחנכ');
                      let nextProf = s.ProfessionalId;
                      if (isHomeroom) {
                        const homeroomProf = professionalOptions.find((p) => p.Name === 'מחנך');
                        if (homeroomProf) nextProf = String(homeroomProf.ProfessionalId);
                      }
                      return { ...s, Tafkid: newTafkid, ProfessionalId: nextProf };
                    });
                  }}
                  disabled={editTeacherBusy}
                >
                  <option value="0">-- בחר תפקיד --</option>
                  {tafkidOptions.map((t) => (
                    <option key={t.TafkidId} value={t.TafkidId}>{t.Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block' }}>מקצוע</label>
                <select
                  className="form-control"
                  value={editTeacher.ProfessionalId}
                  onChange={(e) => setEditTeacher((s) => s ? { ...s, ProfessionalId: e.target.value } : s)}
                  disabled={editTeacherBusy}
                >
                  <option value="0">-- בחר מקצוע --</option>
                  {professionalOptions.map((p) => (
                    <option key={p.ProfessionalId} value={p.ProfessionalId}>{p.Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block' }}>אימייל</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTeacher.Email}
                  onChange={(e) => setEditTeacher((s) => s ? { ...s, Email: e.target.value } : s)}
                  disabled={editTeacherBusy}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block' }}>יום חופשי</label>
                <select
                  className="form-control"
                  value={editTeacher.FreeDay}
                  onChange={(e) => setEditTeacher((s) => s ? { ...s, FreeDay: e.target.value } : s)}
                  disabled={editTeacherBusy}
                >
                  <option value="0">— ללא —</option>
                  <option value="1">יום ראשון</option>
                  <option value="2">יום שני</option>
                  <option value="3">יום שלישי</option>
                  <option value="4">יום רביעי</option>
                  <option value="5">יום חמישי</option>
                  <option value="6">יום שישי</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block', color: '#7c3aed' }}>שעות פרונטלי</label>
                <input
                  type="number"
                  min={0}
                  className="form-control"
                  value={editTeacher.Frontaly}
                  onChange={(e) => setEditTeacher((s) => s ? { ...s, Frontaly: e.target.value } : s)}
                  disabled={editTeacherBusy}
                  style={{ borderColor: '#c4b5fd' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block', color: '#0e7490' }}>שעות שהייה</label>
                <input
                  type="number"
                  min={0}
                  className="form-control"
                  value={editTeacher.Shehya}
                  onChange={(e) => setEditTeacher((s) => s ? { ...s, Shehya: e.target.value } : s)}
                  disabled={editTeacherBusy}
                  style={{ borderColor: '#67e8f9' }}
                />
              </div>
              <div style={{ gridColumn: '1 / 2' }}>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: 'block', color: '#d97706' }}>שעות פרטני</label>
                <input
                  type="number"
                  min={0}
                  className="form-control"
                  value={editTeacher.Partani}
                  onChange={(e) => setEditTeacher((s) => s ? { ...s, Partani: e.target.value } : s)}
                  disabled={editTeacherBusy}
                  style={{ borderColor: '#fcd34d' }}
                />
              </div>
            </div>
            <div className="confirm-modal__actions" style={{ marginTop: 18 }}>
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setEditTeacher(null)}
                disabled={editTeacherBusy}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveEditTeacher}
                disabled={editTeacherBusy}
              >
                {editTeacherBusy ? <><span className="spinner" /> שומר...</> : <><i className="fa fa-save" /> שמור</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTeacher && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleteTeacherBusy) setDeleteTeacher(null);
          }}
        >
          <div className="confirm-modal__card">
            <div className="confirm-modal__icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <i className="fa fa-exclamation-triangle" />
            </div>
            <h3 className="confirm-modal__title">מחיקת מורה</h3>
            <p className="confirm-modal__text">
              האם אתה בטוח שברצונך למחוק את <strong>{deleteTeacher.fullText}</strong>?
              <br />
              כל השעות והשיבוצים של המורה יוסרו ולא ניתן לשחזר את הפעולה.
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setDeleteTeacher(null)}
                disabled={deleteTeacherBusy}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDeleteTeacher}
                disabled={deleteTeacherBusy}
                autoFocus
              >
                {deleteTeacherBusy ? <><span className="spinner" /> מוחק...</> : <><i className="fa fa-trash" /> מחק לצמיתות</>}
              </button>
            </div>
          </div>
        </div>
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

function hourTypeVariant(id: number, teacherHas: boolean): string {
  // Per HourType table in DB: 1=רגילה (frontaly), 2=פרטני, 3=שהייה.
  if (id === 1) return 'regular';
  if (id === 2) return 'partani';
  if (id === 3) return 'shehya';
  return teacherHas ? 'marked' : 'available';
}
