import { useCallback, useEffect, useRef, useState } from 'react';
import { ajax } from '../../api/client';
import { useToast } from '../../lib/toast';
import ExportButtons from '../../lib/ExportButtons';
import { buildExportHandlers } from '../../lib/export';
import ExcelImportModal, { type ExcelColumnSpec, type ParseRowResult, type ExcelImportTemplate, type ParsedRowsResult, type ExcelPreviewSheet } from '../../lib/ExcelImportModal';
import * as XLSX from 'xlsx';

// ---------- types returned by backend SPs ----------
interface TafkidRow {
  TafkidId: number;
  Name: string;
}
interface ProfessionalOption {
  ProfessionalId: number;
  Name: string;
}
interface TeacherRow {
  TeacherId: number;
  TafkidId: number;
  FullText: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Frontaly: string;
  FreeDay: string;
  Tz: string;
  Shehya: string;
  Partani: string;
  ProfessionalId: number | null;
  ManageClassId?: number | null;
  TotalRequired?: number;
}
interface ClassRow {
  ClassId: number;
  ClassName: string;
  ClassFOREdit: string;
  ClassCountHour: number;
  Seq: number;
  ClassTeacherId: number | null;
  TeacherId: number | null;
  TeacherName: string;
  TafkidId: number | null;
  Hakbatza: string | null;
  Ihud: string | null;
  Hour: number | string | null;
}
interface TeacherHourRow {
  TeacherId: number;
  TeacherName: string;
  HourId: number;
  ClassId: number | null;
  ClassNameAssign?: string;
  className?: string;
  Professional?: string;
  HourTypeId?: string | number;
  HourType?: string;
  SheyaGroupName?: string;
  isWork?: boolean | number;
}
interface DmlResult {
  res: number;
}

// ---------- context menu (right click) ----------
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  teacherId: number | null;
}

const LAYERS: Array<{ id: number; label: string }> = [
  { id: 1, label: "שכבה א'" },
  { id: 2, label: "שכבה ב'" },
  { id: 3, label: "שכבה ג'" },
  { id: 4, label: "שכבה ד'" },
  { id: 5, label: "שכבה ה'" },
  { id: 6, label: "שכבה ו'" },
];

const DAY_LABELS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי'];

function tafkidTheme(tafkidId: number | string | null | undefined): string {
  if (String(tafkidId) === '2') return 'success';
  if (String(tafkidId) === '3') return 'danger';
  return 'primary';
}

export default function TeacherClass() {
  const toast = useToast();
  const [layerId, setLayerId] = useState<number>(1);
  const [tafkidOpts, setTafkidOpts] = useState<TafkidRow[]>([]);
  const [professionalOpts, setProfessionalOpts] = useState<ProfessionalOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  // refs מתעדכנים שמשמשים את ייבוא ה-Excel כדי לקבל תמיד את המצב העדכני (גם אחרי הוספה אוטומטית של מורים/כיתות)
  const teachersRef = useRef<TeacherRow[]>([]);
  const classesRef = useRef<ClassRow[]>([]);
  const importClassesRef = useRef<ClassRow[]>([]); // כל הכיתות מכל השכבות — לאשף הייבוא
  useEffect(() => { teachersRef.current = teachers; }, [teachers]);
  useEffect(() => { classesRef.current = classes; }, [classes]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Sidebar quick-filter — narrows the teacher panel without removing groups
  const [teacherSearch, setTeacherSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ classId: number; className: string } | null>(null);
  const [confirmDeleteTeacher, setConfirmDeleteTeacher] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<{
    kind: 'H' | 'I';
    layerId: number;
    number: number;
    label: string;
  } | null>(null);
  const [confirmHourOverflow, setConfirmHourOverflow] = useState<{
    projected: number;
    maxHours: number;
    onConfirm: () => void;
  } | null>(null);
  const [confirmTeacherOverflow, setConfirmTeacherOverflow] = useState<{
    teacherName: string;
    projected: number;
    quota: number;
    onConfirm: () => void;
  } | null>(null);

  // teacher modal
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherModalType, setTeacherModalType] = useState<1 | 2>(2); // 1=edit, 2=new
  const [teacherForm, setTeacherForm] = useState<{
    TeacherId: number | '';
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
  }>({
    TeacherId: '',
    Tafkid: '0',
    ProfessionalId: '0',
    FirstName: '',
    LastName: '',
    Email: '',
    Frontaly: '',
    FreeDay: '0',
    Tz: '',
    Shehya: '',
    Partani: '',
  });
  const [teacherModalTitle, setTeacherModalTitle] = useState('');
  void teacherModalTitle;

  // class modal — שמירת שם, מספר רץ, ומחנך/ת בפופאפ אחיד.
  // TeacherIdOriginal משמש להחלטה האם לקרוא ל-Class_SetHomeroom (שינוי) או לדלג.
  const [showClassModal, setShowClassModal] = useState(false);
  const [classModalMode, setClassModalMode] = useState<1 | 2>(1); // 1=new,2=edit
  const [classForm, setClassForm] = useState<{
    ClassId: number | '';
    ClassName: string;
    Seq: string;
    TeacherId: number; // המחנך/ת הנבחר (0 = ללא מחנך/ת)
    TeacherIdOriginal: number; // מה היה לפני פתיחת הפופאפ — להשוואה לפני שמירה
  }>({
    ClassId: '',
    ClassName: '',
    Seq: '',
    TeacherId: 0,
    TeacherIdOriginal: 0,
  });
  const [classModalTitle, setClassModalTitle] = useState('');
  const [classModalBusy, setClassModalBusy] = useState(false);

  // ---------- homeroom picker (פופאפ משני, נפתח מתוך פופאפ עריכת כיתה) ----------
  // חלון יפה עם שדה חיפוש לבחירת מחנך/ת מתוך כל המורים בעלי תפקיד "מחנך/ת".
  // allClassesById משמש לתרגום ManageClassId לשם הכיתה גם אם הכיתה בשכבה אחרת
  // מהשכבה הנוכחית — כדי שמורה ש"תפוס" כמחנך כיתה ב/ג יראה את שם הכיתה
  // המתאימה ב-tag האדום, ולא רק "תפוס/ה".
  const [homeroomPickerOpen, setHomeroomPickerOpen] = useState(false);
  const [homeroomSearch, setHomeroomSearch] = useState('');
  const [allClassesById, setAllClassesById] = useState<Map<number, string>>(new Map());

  // טעינה ראשונית של כל הכיתות (מכל השכבות) — Map קטן של ClassId → ClassName.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await ajax<Array<{ ClassId: number; ClassName: string }>>('Class_GetAllClass');
        if (cancelled) return;
        const m = new Map<number, string>();
        for (const r of rows ?? []) {
          m.set(Number(r.ClassId), String(r.ClassName ?? ''));
        }
        setAllClassesById(m);
      } catch (err) {
        console.error('Class_GetAllClass failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // teacher hours modal
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [hoursData, setHoursData] = useState<TeacherHourRow[]>([]);
  const [hoursTitle, setHoursTitle] = useState('');

  // context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    teacherId: null,
  });

  // drag/drop — simple HTML5 drag state
  const dragInfo = useRef<{
    sourceType: 'teacher' | 'teacherInClass';
    teacherId: number;
    classId?: number | null;
    hakbatza?: string | null;
    classTeacherId?: number | null;
  } | null>(null);
  // איזו כיתה מקבלת hover במהלך גרירה — מציג placeholder ויזואלי בתוך הכיתה
  const [dragHoverClassId, setDragHoverClassId] = useState<number | null>(null);

  // ---------- group (hakbatza) edit modal ----------
  const [groupModal, setGroupModal] = useState<{
    classId: number;
    className: string;
    // All ClassTeacherIds that currently share this pill (hakbatza members)
    memberClassTeacherIds: number[];
    teacherNames: string; // for display
    currentHakbatza: number;
  } | null>(null);
  const [groupKind, setGroupKind] = useState<'none' | 'hakbatza'>('none');
  const [groupNumber, setGroupNumber] = useState<string>('');
  const [groupBusy, setGroupBusy] = useState(false);

  // Create-group wizard state. Single-step: pick classes, click create.
  // The hakbatza is created empty and teachers are added afterwards by
  // dragging them onto the hakbatza card.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSelectedClasses, setWizardSelectedClasses] = useState<Set<number>>(new Set());
  const [wizardName, setWizardName] = useState<string>('');
  // ProfessionalId חובה לכל הקבצה — קובע את המקצוע שמלמדים בה.
  const [wizardProfessional, setWizardProfessional] = useState<string>('');
  const [wizardBusy, setWizardBusy] = useState(false);

  function openWizard() {
    setWizardOpen(true);
    setWizardSelectedClasses(new Set());
    setWizardName('');
    setWizardProfessional('');
  }
  function closeWizard() {
    if (wizardBusy) return;
    setWizardOpen(false);
  }
  function toggleWizardClass(classId: number) {
    setWizardSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  async function saveWizard() {
    if (!wizardOpen || wizardBusy) return;
    const selected = Array.from(wizardSelectedClasses);
    if (selected.length < 2) {
      toast.warning('צריך לבחור לפחות 2 כיתות בהקבצה');
      return;
    }
    if (!wizardProfessional || wizardProfessional === '0') {
      toast.warning('צריך לבחור מקצוע להקבצה', { title: 'חסר שדה חובה' });
      return;
    }

    setWizardBusy(true);
    try {
      const res = await ajax<{ Number?: number; Error?: string }>('Hakbatza_Create', {
        LayerId: String(layerId),
        ClassIds: selected.join(','),
        Name: wizardName.trim(),
        ProfessionalId: wizardProfessional,
      });
      if (res?.Error) {
        toast.error('יצירת ההקבצה נכשלה: ' + res.Error);
        return;
      }
      const n = Number(res?.Number ?? 0);
      toast.success(`הקבצה ${n} נוצרה עם ${selected.length} כיתות. גרור מורים לתוכה.`);
      setWizardOpen(false);
      loadHakbatzaList();
      loadClasses(layerId);
    } catch (err) {
      console.error('Hakbatza_Create failed', err);
      toast.error('יצירת ההקבצה נכשלה');
    } finally {
      setWizardBusy(false);
    }
  }

  // ---- Hakbatza list with drag-target cards ----
  interface HakbatzaRow {
    ClassTeacherId: number;
    Hakbatza: number;
    ClassId: number;
    ClassName: string;
    LayerId: number;
    TeacherId: number;
    TeacherName: string;
    Name?: string;
    ProfessionalId?: number;
    ProfessionalName?: string;
  }
  const [hakbatzaRows, setHakbatzaRows] = useState<HakbatzaRow[]>([]);
  // Ihud — לוגיקה הוסרה. השארנו stubs כדי לא להשבית את ה-render הקיים. בכל מקום
  // שמשתמש בהם — הוא לא יציג כלום ולא יבצע פעולה.
  const ihudRows: Array<{
    ClassTeacherId: number; Ihud: number; ClassId: number; ClassName: string;
    LayerId: number; TeacherId: number; TeacherName: string; Hour: number; Name?: string;
  }> = [];
  const ihudWizardOpen = false;
  const ihudWizardClasses = new Set<number>();
  const ihudWizardTeacher: number | null = null;
  const ihudWizardName = '';
  const ihudWizardBusy = false;
  const setIhudWizardClasses = (_v: Set<number>) => { void _v; };
  const setIhudWizardTeacher = (_v: number | null) => { void _v; };
  const setIhudWizardName = (_v: string) => { void _v; };
  const closeIhudWizard = () => {};
  const toggleIhudWizardClass = (_id: number) => { void _id; };
  const saveIhudWizard = () => {};
  const deleteIhud = (_l: number, _n: number) => { void _l; void _n; };
  const [maxHours, setMaxHours] = useState<number>(0);
  // סטטוס שיבוץ לכל שכבה: כמה כיתות בכל שכבה ומהן כמה מלאות (Hour == Capacity).
  interface LayerStatus { LayerId: number; ClassCount: number; FullyBookedCount: number; Capacity: number }
  const [layerStatus, setLayerStatus] = useState<LayerStatus[]>([]);

  // PreCheck issues — מציג בbanner את אותן בעיות שמופיעות בטאב השיבוץ האוטומטי,
  // כך שגם בעמוד "הגדרות כיתות ומורים" המשתמש רואה מה לא הגיוני בדטא.
  interface PreCheckIssue { Kind: string; Id1: number; Id2: number; Label: string; Detail: string }
  const [preCheckIssues, setPreCheckIssues] = useState<PreCheckIssue[]>([]);
  const [showPreCheckDetails, setShowPreCheckDetails] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [primary, freeDay] = await Promise.all([
          ajax<PreCheckIssue[]>('Assign_PreCheck').catch(() => [] as PreCheckIssue[]),
          ajax<PreCheckIssue[]>('Assign_FreeDayPreCheck').catch(() => [] as PreCheckIssue[]),
        ]);
        if (cancelled) return;
        const merged: PreCheckIssue[] = [
          ...(Array.isArray(primary) ? primary : []),
          ...(Array.isArray(freeDay) ? freeDay : []),
        ];
        setPreCheckIssues(merged);
      } catch (err) {
        console.error('PreCheck failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [layerStatus]);
  const loadHakbatzaList = useCallback(async () => {
    try {
      const data = await ajax<HakbatzaRow[]>('Hakbatza_GetAll');
      const list = Array.isArray(data) ? data : [];
      // אותה בעיית null של TeacherName שיש ב-Class_GetClassByLayerId קיימת
      // גם כאן — עוטפים בלאוקאפ למפת תצוגת המורים.
      const m = teacherDisplayMapRef.current;
      const enriched = list.map((r) => {
        const tid = Number(r.TeacherId ?? 0);
        if (!tid) return r;
        const cur = String(r.TeacherName ?? '').trim();
        if (cur) return r;
        const disp = m.get(tid);
        return disp ? { ...r, TeacherName: disp } : r;
      });
      setHakbatzaRows(enriched);
    } catch (err) {
      console.error('Hakbatza_GetAll failed', err);
    }
  }, []);
  const loadLayerStatus = useCallback(async () => {
    try {
      const data = await ajax<LayerStatus[]>('Class_GetLayersStatus');
      setLayerStatus(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Class_GetLayersStatus failed', err);
    }
  }, []);
  const loadMaxHours = useCallback(async () => {
    try {
      const data = await ajax<{ MaxHours: number }>('Class_GetMaxHours');
      setMaxHours(Number(data?.MaxHours ?? 0));
    } catch (err) {
      console.error('Class_GetMaxHours failed', err);
    }
  }, []);
  useEffect(() => {
    loadHakbatzaList();
    loadMaxHours();
    loadLayerStatus();
  }, [loadHakbatzaList, loadMaxHours, loadLayerStatus]);
  // רענון סטטוס שכבה אחרי שינוי כיתות (הוספת שעה, הקבצה וכו')
  useEffect(() => {
    loadLayerStatus();
  }, [classes, loadLayerStatus]);

  // Tracks which (layer, number) pair is the active drop target so we can
  // highlight it during a drag.
  const [dragHoverHak, setDragHoverHak] = useState<string | null>(null);

  async function addTeacherToHakbatza(layerIdArg: number, number: number, teacherId: number) {
    try {
      const res = await ajax<{ res?: number; Error?: string }>('Hakbatza_AddTeacher', {
        LayerId: String(layerIdArg),
        Number: String(number),
        TeacherId: String(teacherId),
      });
      if (res?.Error) {
        toast.error('הוספה נכשלה: ' + res.Error);
        return;
      }
      toast.success('המורה נוסף להקבצה');
      loadHakbatzaList();
      loadClasses(layerId);
    } catch (err) {
      console.error('Hakbatza_AddTeacher failed', err);
      toast.error('הוספת המורה נכשלה');
    }
  }

  async function removeTeacherFromHakbatza(layerIdArg: number, number: number, teacherId: number) {
    try {
      await ajax('Hakbatza_RemoveTeacher', {
        LayerId: String(layerIdArg),
        Number: String(number),
        TeacherId: String(teacherId),
      });
      toast.success('המורה הוסר מההקבצה');
      loadHakbatzaList();
      loadClasses(layerId);
    } catch (err) {
      console.error('Hakbatza_RemoveTeacher failed', err);
      toast.error('הסרת המורה נכשלה');
    }
  }

  async function deleteHakbatza(layerIdArg: number, number: number) {
    try {
      await ajax('Hakbatza_Delete', {
        LayerId: String(layerIdArg),
        Number: String(number),
      });
      toast.success(`הקבצה ${number} נמחקה`);
      loadHakbatzaList();
      loadClasses(layerId);
    } catch (err) {
      console.error('Hakbatza_Delete failed', err);
      toast.error('מחיקת ההקבצה נכשלה');
    }
  }

  async function setHakbatzaHour(layerIdArg: number, number: number, hour: number) {
    try {
      await ajax('Hakbatza_SetHour', {
        LayerId: String(layerIdArg),
        Number: String(number),
        Hour: String(hour),
      });
      loadHakbatzaList();
      loadClasses(layerId);
    } catch (err) {
      console.error('Hakbatza_SetHour failed', err);
      toast.error('עדכון שעות הקבצה נכשל');
    }
  }

  // Validation issues per group (pulled from Class_ValidateGroups). Key =
  // "H_<classId>_<number>" for hakbatza, "I_<number>" for ihud.
  interface GroupValidation {
    Kind: 'H' | 'I';
    Number: number;
    MemberCount: number;
    CommonDays: number;
    Severity: 'ok' | 'warning' | 'error';
    Message: string;
  }
  const [groupValidations, setGroupValidations] = useState<Map<string, GroupValidation>>(new Map());
  void groupValidations;

  const loadGroupValidations = useCallback(async () => {
    try {
      const data = await ajax<GroupValidation[]>('Class_ValidateGroups');
      const m = new Map<string, GroupValidation>();
      for (const g of data || []) {
        m.set(g.Kind + '_' + g.Number, g);
      }
      setGroupValidations(m);
    } catch (err) {
      console.error('Class_ValidateGroups failed', err);
    }
  }, []);

  useEffect(() => {
    loadGroupValidations();
  }, [loadGroupValidations, classes, hakbatzaRows, ihudRows]);

  // ---------- initial loads ----------
  const loadCombos = useCallback(async () => {
    try {
      const t = await ajax<TafkidRow[]>('Gen_GetTable', { TableName: 'Tafkid', Condition: '' });
      setTafkidOpts(Array.isArray(t) ? t : []);
    } catch (err) {
      console.error('Tafkid load failed', err);
    }
    try {
      const p = await ajax<ProfessionalOption[]>('Gen_GetTable', {
        TableName: 'Professional',
        Condition: '',
      });
      setProfessionalOpts(Array.isArray(p) ? p : []);
    } catch (err) {
      console.error('Professional load failed', err);
    }
  }, []);

  // ה-SP `Teacher_GetTeacherList` בונה את FullText כצירוף "LastName FirstName".
  // למורים שלא הוגדר להם LastName (מורים שנוצרו עם שם פרטי בלבד — למשל
  // דרך הייבוא מ-Excel) ה-FullText יוצא NULL, וכך גם TeacherName של שיבוצים.
  // התוצאה: בכרטיסי הכיתות ובפאנל המורים מופיע פס ריק. נתקן זאת מיד אחרי
  // הטעינה — נמלא fallback ל-FirstName ב-FullText, ונבנה מפת תצוגה לפי
  // TeacherId לשימוש ב-class rows.
  const normalizeTeacherDisplay = (list: TeacherRow[]): TeacherRow[] =>
    list.map((t) => {
      const first = String(t.FirstName ?? '').trim();
      const last = String(t.LastName ?? '').trim();
      const full = String(t.FullText ?? '').trim();
      const display = full || (first && last ? `${first} ${last}` : (first || last));
      return { ...t, FullText: display };
    });

  // מפת TeacherId → שם תצוגה, מחושבת מתוך teachers הנוכחיים — משמשת
  // להעשרת class rows כש-TeacherName חוזר ריק מה-SP.
  const teacherDisplayMapRef = useRef<Map<number, string>>(new Map());
  function rebuildTeacherDisplayMap(list: TeacherRow[]) {
    const m = new Map<number, string>();
    for (const t of list) m.set(Number(t.TeacherId), String(t.FullText ?? '').trim());
    teacherDisplayMapRef.current = m;
  }
  function enrichClassRows(rows: ClassRow[]): ClassRow[] {
    const m = teacherDisplayMapRef.current;
    return rows.map((r) => {
      const tid = Number(r.TeacherId ?? 0);
      if (!tid) return r;
      const cur = String(r.TeacherName ?? '').trim();
      if (cur) return r;
      const disp = m.get(tid);
      if (!disp) return r;
      return { ...r, TeacherName: disp };
    });
  }

  const loadTeachers = useCallback(async () => {
    try {
      const data = await ajax<TeacherRow[]>('Teacher_GetTeacherList', { TeacherId: -99 });
      const list = normalizeTeacherDisplay(Array.isArray(data) ? data : []);
      rebuildTeacherDisplayMap(list);
      setTeachers(list);
    } catch (err) {
      console.error('Teacher_GetTeacherList failed', err);
      setTeachers([]);
    }
  }, []);

  const loadClasses = useCallback(async (layer: number) => {
    // טוענים מורים תחילה כדי שמפת התצוגה תהיה מעודכנת לפני שמעשירים את class rows
    try {
      const tdata = await ajax<TeacherRow[]>('Teacher_GetTeacherList', { TeacherId: -99 });
      const list = normalizeTeacherDisplay(Array.isArray(tdata) ? tdata : []);
      rebuildTeacherDisplayMap(list);
      setTeachers(list);
    } catch (err) {
      console.error('Teacher_GetTeacherList (refresh) failed', err);
    }
    try {
      const data = await ajax<ClassRow[]>('Class_GetClassByLayerId', { LayerId: layer });
      setClasses(enrichClassRows(Array.isArray(data) ? data : []));
    } catch (err) {
      console.error('Class_GetClassByLayerId failed', err);
      setClasses([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    Promise.allSettled([loadCombos(), loadTeachers(), loadClasses(layerId)])
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCombos, loadTeachers]);

  useEffect(() => {
    loadClasses(layerId);
  }, [layerId, loadClasses]);

  // אשף הייבוא צריך כיתות מכל השכבות (א'–ו') — נטען אותן כשהמודאל נפתח
  const reloadImportClasses = useCallback(async () => {
    importClassesRef.current = await fetchAllClassRows();
  }, []);
  useEffect(() => {
    if (showImportModal) void reloadImportClasses();
  }, [showImportModal, reloadImportClasses]);

  // close context menu on any document click
  useEffect(() => {
    if (!contextMenu.visible) return;
    const close = () => setContextMenu((c) => ({ ...c, visible: false }));
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu.visible]);

  // ---------- teacher modal ----------
  async function openTeacherModal(type: 1 | 2, teacherId?: number) {
    setTeacherModalType(type);
    if (type === 1 && teacherId != null) {
      try {
        const data = await ajax<TeacherRow[]>('Teacher_GetTeacherList', { TeacherId: teacherId });
        const t = data[0];
        if (!t) return;
        setTeacherForm({
          TeacherId: teacherId,
          Tafkid: String(t.TafkidId ?? '0'),
          ProfessionalId: String(t.ProfessionalId ?? '0'),
          FirstName: t.FirstName ?? '',
          LastName: t.LastName ?? '',
          Email: t.Email ?? '',
          Frontaly: t.Frontaly ?? '',
          FreeDay: String(t.FreeDay ?? '0'),
          Tz: t.Tz ?? '',
          Shehya: t.Shehya ?? '',
          Partani: t.Partani ?? '',
        });
        setTeacherModalTitle(`עדכון פרטי מורה - ${t.FirstName} ${t.LastName}`);
      } catch (err) {
        console.error('Teacher_GetTeacherList failed', err);
        return;
      }
    } else {
      setTeacherForm({
        TeacherId: '',
        Tafkid: '0',
        ProfessionalId: '0',
        FirstName: '',
        LastName: '',
        Email: '',
        Frontaly: '',
        FreeDay: '0',
        Tz: '',
        Shehya: '',
        Partani: '',
      });
      setTeacherModalTitle(' הוספת מורה חדש/ה ');
    }
    setShowTeacherModal(true);
  }

  async function saveTeacher(type: 1 | 2 | 3) {
    const { Tafkid, FirstName, LastName, Frontaly } = teacherForm;
    if (type !== 3 && (Tafkid === '0' || !FirstName || !LastName || !Frontaly)) {
      toast.warning('יש למלא תפקיד, שם, שם משפחה ושעות פרונטלי', { title: 'חסרים שדות חובה' });
      return;
    }
    try {
      await ajax('Teacher_DML', {
        TeacherId: teacherForm.TeacherId === '' ? '' : teacherForm.TeacherId,
        Tafkid: teacherForm.Tafkid,
        ProfessionalId: teacherForm.ProfessionalId,
        FirstName: teacherForm.FirstName,
        LastName: teacherForm.LastName,
        Email: teacherForm.Email,
        Frontaly: teacherForm.Frontaly,
        FreeDay: teacherForm.FreeDay,
        Tz: teacherForm.Tz,
        Shehya: teacherForm.Shehya,
        Partani: teacherForm.Partani,
        Type: type,
      });
      setShowTeacherModal(false);
      loadTeachers();
      loadClasses(layerId);
    } catch (err) {
      console.error('Teacher_DML failed', err);
      toast.error('שגיאה בשמירת המורה');
    }
  }

  function deleteTeacher() {
    setConfirmDeleteTeacher(true);
  }
  function executeDeleteTeacher() {
    setConfirmDeleteTeacher(false);
    saveTeacher(3);
  }

  // ---------- class modal ----------
  function openClassWindow(classId: number | '', className: string, seq: number | string, mode: 1 | 2) {
    setClassModalMode(mode);
    // מצב עריכה: שולפים את המחנך/ת הנוכחי/ת לפי ManageClassId
    const currentHomeroom = mode === 2 && typeof classId === 'number'
      ? teachers.find((t) => Number(t.ManageClassId ?? 0) === classId)
      : null;
    const homeroomTid = currentHomeroom ? Number(currentHomeroom.TeacherId) : 0;
    setClassForm({
      ClassId: classId,
      ClassName: className,
      Seq: String(seq ?? ''),
      TeacherId: homeroomTid,
      TeacherIdOriginal: homeroomTid,
    });
    setClassModalTitle(mode === 1 ? 'כיתה חדשה' : `עריכת כיתה: ${className}`);
    setShowClassModal(true);
  }

  // שמירת הפופאפ — מעדכן שם/מספר כיתה ובמידת הצורך גם את המחנך/ת.
  // הזרימה: קודם Class_SetClassData (שם/מספר), אחר כך אם השתנה — Class_SetHomeroom.
  // הפעולה לא נוגעת בשאר המורים בכיתה או במורים מקצועיים — רק במחנך/ת.
  async function saveClass(mode: 1 | 2 | 3, classIdOverride?: number) {
    const classId = classIdOverride ?? (classForm.ClassId === '' ? '' : classForm.ClassId);
    if (mode !== 3) {
      if (!classForm.ClassName) {
        toast.warning('שם הכיתה הוא שדה חובה', { title: 'חסר שדה' });
        return;
      }
      if (!classForm.Seq || isNaN(Number(classForm.Seq))) {
        toast.warning('מספר הכיתה הוא שדה חובה', { title: 'חסר שדה' });
        return;
      }
    }
    setClassModalBusy(true);
    try {
      // שלב 1: עדכון פרטי כיתה (שם, Seq) — או מחיקה כשמדובר ב-Type=3.
      await ajax('Class_SetClassData', {
        ClassId: classId,
        LayerId: layerId,
        ClassName: mode === 3 ? '' : classForm.ClassName,
        Seq: mode === 3 ? '' : classForm.Seq,
        mode,
      });

      // שלב 2: עדכון מחנך/ת רק אם השתנה ולא מדובר במחיקה.
      // ב-mode=1 (כיתה חדשה) אין classId אמיתי עדיין, אז מדלגים גם כאן.
      if (mode === 2 && typeof classId === 'number' && classForm.TeacherId !== classForm.TeacherIdOriginal) {
        const res = await ajax<Array<{ res: number; msg: string }>>('Class_SetHomeroom', {
          ClassId: classId,
          TeacherId: classForm.TeacherId, // 0 = ניקוי המחנך/ת
        });
        const row = Array.isArray(res) ? res[0] : null;
        if (!row || Number(row.res) === 0) {
          const msg = row?.msg ?? '';
          if (msg === 'ALREADY_HOMEROOM_ELSEWHERE') {
            toast.error('המורה/ה כבר מחנכ/ת כיתה אחרת — לא ניתן לשייך לשתי כיתות');
          } else if (msg === 'TAFKID_NOT_HOMEROOM') {
            toast.error('רק מורים בעלי תפקיד "מחנך/ת" יכולים לחנך כיתה');
          } else {
            toast.error('עדכון המחנך/ת נכשל');
          }
          // הפופאפ נשאר פתוח כדי שהמשתמש יוכל לתקן
          return;
        }
      }

      setShowClassModal(false);
      await Promise.all([loadTeachers(), loadClasses(layerId)]);
      if (mode === 2) toast.success('פרטי הכיתה עודכנו');
    } catch (err) {
      console.error('saveClass failed', err);
      toast.error('שגיאה בשמירת הכיתה');
    } finally {
      setClassModalBusy(false);
    }
  }

  function requestDeleteClass(classId: number, className: string) {
    setConfirmDelete({ classId, className });
  }
  function confirmDeleteClass() {
    if (!confirmDelete) return;
    saveClass(3, confirmDelete.classId);
    setConfirmDelete(null);
  }

  // ---------- teacher-hour modal ----------
  async function openTeacherHours(teacherId: number) {
    try {
      const data = await ajax<TeacherHourRow[]>('Teacher_GetAllTeacherHours', { TeacherId: teacherId });
      setHoursData(Array.isArray(data) ? data : []);
      if (data && data.length > 0) {
        setHoursTitle(`שעות למורה - ${data[0].TeacherName}`);
      } else {
        setHoursTitle('שעות למורה');
      }
      setShowHoursModal(true);
    } catch (err) {
      console.error('Teacher_GetAllTeacherHours failed', err);
    }
  }

  // replicates the aspx per-day flattening loop
  function buildHoursByDay(): Record<number, Array<{ className: string; professional: string; isWork: boolean }>> {
    const byDay: Record<number, Array<{ className: string; professional: string; isWork: boolean }>> = {
      1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
    };
    const data = hoursData;
    for (let i = 0; i < data.length; i++) {
      const dayId = Number(String(data[i].HourId).substring(0, 1));
      let className = data[i].ClassNameAssign ?? '';
      let classHalf = data[i].className ?? '';
      let j = i;
      while (
        data[j + 1] &&
        data[j].ClassId !== data[j + 1].ClassId &&
        data[j].HourId === data[j + 1].HourId
      ) {
        classHalf += '/' + (data[j + 1].className ?? '');
        j++;
        className = classHalf;
      }
      let professional = data[i].Professional ?? '';
      const hourTypeId = String(data[i].HourTypeId ?? '');
      const hourType = data[i].HourType ?? '';
      const sheyaGroupName = data[i].SheyaGroupName ?? '';
      if (hourTypeId === '2' || hourTypeId === '3') className = hourType;
      if (hourTypeId === '3') professional = sheyaGroupName;
      const isWork = Boolean(data[i].isWork);
      if (byDay[dayId]) {
        byDay[dayId].push({ className, professional, isWork });
      }
      i = j;
    }
    return byDay;
  }

  // ---------- drag and drop ----------
  function onDragStartTeacher(e: React.DragEvent, teacherId: number) {
    dragInfo.current = { sourceType: 'teacher', teacherId };
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', `teacher_${teacherId}`);
  }

  function onDragStartTeacherInClass(
    e: React.DragEvent,
    row: { TeacherId: number; ClassId: number; Hakbatza: string | null; ClassTeacherId: number | null }
  ) {
    dragInfo.current = {
      sourceType: 'teacherInClass',
      teacherId: row.TeacherId,
      classId: row.ClassId,
      hakbatza: row.Hakbatza,
      classTeacherId: row.ClassTeacherId,
    };
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', `tic_${row.ClassId}_${row.TeacherId}`);
    e.stopPropagation();
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Drop on a class panel (target = class). מדיניות: רק להוסיף את המורה לכיתה.
  // אין הגדלת שעות אוטומטית, אין יצירת איחוד, אין העברה מכיתה אחרת — פשוט insert
  // של רישום ClassTeacher רגיל עם Hour=1 כברירת מחדל. ניתן לשנות שעות ידנית בכרטיס.
  async function onDropOnClass(e: React.DragEvent, targetClassId: number) {
    e.preventDefault();
    e.stopPropagation();
    setDragHoverClassId(null);
    const info = dragInfo.current;
    if (!info) return;
    dragInfo.current = null;

    const sourceTeacherId = info.teacherId;

    // אם המורה כבר רשום ככיתה רגילה (לא בהקבצה) באותה כיתה — לא לעשות שום דבר.
    const exists = classes.find((r) =>
      Number(r.ClassId) === Number(targetClassId)
      && Number(r.TeacherId ?? 0) === Number(sourceTeacherId)
      && Number(r.Hakbatza ?? 0) === 0
    );
    if (exists) {
      toast.info('המורה כבר משויך/ת לכיתה');
      return;
    }

    try {
      // Type=1: insert רישום חדש (Hour=NULL כי SP לא מקבל ערך כאן)
      await ajax<DmlResult[]>('Class_SetTeacherToClass', {
        ClassId: targetClassId,
        TeacherId: sourceTeacherId,
        Hour: '',
        TargetHakbatza: '',
        SourceHakbatza: '',
        TargetIhud: '',
        SourceIhud: '',
        TargetClassTeacherId: '',
        SourceClassTeacherId: '',
        Type: 1,
      });
      // אחרי insert, מצא את הרישום החדש והגדר Hour=1 כברירת-מחדל. בלי זה
      // ה-SP משאיר Hour=NULL ושורות "רוח" מטעות את ה-UI.
      try {
        const fresh = await ajax<ClassRow[]>('Class_GetClassByLayerId', { LayerId: layerId });
        const list = Array.isArray(fresh) ? fresh : [];
        const created = list.find((r) =>
          Number(r.ClassId) === Number(targetClassId)
          && Number(r.TeacherId ?? 0) === Number(sourceTeacherId)
          && Number(r.Hakbatza ?? 0) === 0
          && (r.Hour == null || Number(r.Hour) === 0)
        );
        if (created && created.ClassTeacherId != null) {
          await ajax<DmlResult[]>('Class_SetTeacherToClass', {
            ClassId: targetClassId,
            TeacherId: sourceTeacherId,
            Hour: '1',
            TargetHakbatza: '',
            SourceHakbatza: '',
            TargetIhud: '',
            SourceIhud: '',
            TargetClassTeacherId: '',
            SourceClassTeacherId: String(created.ClassTeacherId),
            Type: 4,
          });
        }
      } catch (err) {
        console.error('Class_SetTeacherToClass (post-insert hour) failed', err);
      }
      loadClasses(layerId);
    } catch (err) {
      console.error('Class_SetTeacherToClass failed', err);
    }
  }

  // Drop on teacher panel (delete when source is teacherInClass)
  async function onDropOnTeacherPanel(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragHoverClassId(null);
    const info = dragInfo.current;
    if (!info) return;
    dragInfo.current = null;
    if (info.sourceType !== 'teacherInClass' || info.classId == null) return;
    try {
      const res = await ajax<DmlResult[]>('Class_SetTeacherToClass', {
        ClassId: info.classId,
        TeacherId: info.teacherId,
        Hour: '',
        TargetHakbatza: '',
        SourceHakbatza: info.hakbatza ?? '',
        TargetIhud: '',
        SourceIhud: '',
        TargetClassTeacherId: '',
        SourceClassTeacherId: info.classTeacherId ?? '',
        Type: 5,
      });
      if (res && res[0] && res[0].res === 0) {
        loadClasses(layerId);
      }
    } catch (err) {
      console.error('Class_SetTeacherToClass (delete) failed', err);
    }
  }

  // ---------- group helpers ----------
  // Deterministic color from a group number so Hakbatza/Ihud groups stay
  // visually stable across renders (and across re-sorts) — the user
  // associates "green = Hakbatza 4" rather than having to read the number.
  function groupColor(kind: 'H' | 'I', n: number): { bg: string; fg: string } {
    if (!n) return { bg: 'transparent', fg: '#6b7280' };
    // צבעים מודרניים-saturated עם ניגודיות גבוהה (טקסט לבן). מבטיחים מראה
    // מקצועי וקריא במקום הפסטל החיוור הקודם.
    const hPalette = [
      '#7c3aed', // violet
      '#0891b2', // cyan
      '#059669', // emerald
      '#db2777', // pink
      '#ea580c', // orange
      '#4f46e5', // indigo
      '#0d9488', // teal
      '#dc2626', // red
    ];
    const iPalette = [
      '#6366f1', // indigo-500
      '#06b6d4', // cyan-500
      '#f59e0b', // amber-500
      '#ec4899', // pink-500
      '#10b981', // emerald-500
      '#ef4444', // red-500
      '#3b82f6', // blue-500
      '#f97316', // orange-500
    ];
    const palette = kind === 'H' ? hPalette : iPalette;
    const color = palette[(n - 1) % palette.length];
    return { bg: color, fg: '#ffffff' };
  }

  function openGroupModal(
    classId: number,
    className: string,
    memberIds: number[],
    teacherNames: string,
    hakbatza: number,
  ) {
    setGroupModal({
      classId,
      className,
      memberClassTeacherIds: memberIds,
      teacherNames,
      currentHakbatza: hakbatza,
    });
    if (hakbatza > 0) {
      setGroupKind('hakbatza');
      setGroupNumber(String(hakbatza));
    } else {
      setGroupKind('none');
      setGroupNumber('');
    }
  }

  async function saveGroupModal() {
    if (!groupModal || groupBusy) return;
    setGroupBusy(true);
    try {
      let hakVal = 0;
      if (groupKind === 'hakbatza') {
        hakVal = Number(groupNumber) || 0;
        if (hakVal <= 0) {
          toast.warning('יש להזין מספר הקבצה תקין (>0)');
          setGroupBusy(false);
          return;
        }
      }
      for (const ctId of groupModal.memberClassTeacherIds) {
        await ajax<DmlResult[]>('Class_SetGroupNumber', {
          ClassTeacherId: ctId,
          Hakbatza: hakVal,
          Ihud: 0,
        });
      }
      setGroupModal(null);
      loadClasses(layerId);
      toast.success('הקבוצה עודכנה');
    } catch (err) {
      console.error('Class_SetGroupNumber failed', err);
      toast.error('שמירת הקבוצה נכשלה');
    } finally {
      setGroupBusy(false);
    }
  }

  // Build a summary of all groups in the current layer from the loaded
  // class rows (no extra API call needed — the data is already here).
  // Edit hours inline (Type=4). Also runs a frontend pre-check so the
  // user gets immediate warning if the new value would exceed the
  // class's weekly cap (maxHours = active SchoolHours, non-shehya).
  async function setHourToTeacherInClass(
    classId: number,
    teacherId: number,
    hour: string,
    ihud: string | null,
    classTeacherId: number | null,
    hakbatza: string | null
  ) {
    if (!/^-?\d+(\.\d+)?$/.test(hour)) {
      toast.warning('יש להזין מספרים בלבד', { title: 'קלט לא תקין' });
      return;
    }

    const doSave = async () => {
      try {
        const res = await ajax<DmlResult[]>('Class_SetTeacherToClass', {
          ClassId: classId,
          TeacherId: teacherId,
          Hour: hour,
          TargetHakbatza: '',
          SourceHakbatza: hakbatza ?? '',
          TargetIhud: '',
          SourceIhud: ihud ?? '',
          TargetClassTeacherId: '',
          SourceClassTeacherId: classTeacherId ?? '',
          Type: 4,
        });
        if (res && res[0] && res[0].res === 1) {
          toast.warning('חריגה: המספר עולה על השעות המוגדרות למורה');
        }
        loadClasses(layerId);
      } catch (err) {
        console.error('Class_SetTeacherToClass (hour) failed', err);
      }
    };

    const newHour = Number(hour) || 0;

    // 1) Check class-level overflow against the SAME counting logic the UI
    //    uses for "סה״כ פרונטלי" (computeRealHours): solo rows sum normally,
    //    each Hakbatza/Ihud contributes MAX(Hour) once. A naive SUM here
    //    would falsely flag "overflow" when 2-3 parallel teachers share a
    //    single timeslot — they take ONE board cell, not N.
    if (maxHours > 0) {
      const hakMax = new Map<number, number>();
      const ihudMax = new Map<number, number>();
      let solo = 0;
      let foundOldRow = false;
      for (const r of classes) {
        if (r.ClassId !== classId) continue;
        const rHak = Number(r.Hakbatza ?? 0);
        const rIhud = Number(r.Ihud ?? 0);
        const isOldRow = r.ClassTeacherId != null && classTeacherId != null
          && Number(r.ClassTeacherId) === Number(classTeacherId);
        const effectiveHour = isOldRow ? newHour : Number(r.Hour ?? 0);
        if (isOldRow) foundOldRow = true;
        if (rHak > 0) {
          if (effectiveHour > (hakMax.get(rHak) ?? 0)) hakMax.set(rHak, effectiveHour);
        } else if (rIhud > 0) {
          if (effectiveHour > (ihudMax.get(rIhud) ?? 0)) ihudMax.set(rIhud, effectiveHour);
        } else {
          solo += effectiveHour;
        }
      }
      // If we're inserting a brand-new row (no existing CT id), add it now —
      // single-teacher inserts arrive with hak/ihud='', so it's solo.
      if (!foundOldRow) {
        const newHak = Number(hakbatza ?? 0);
        const newIhud = Number(ihud ?? 0);
        if (newHak > 0) {
          if (newHour > (hakMax.get(newHak) ?? 0)) hakMax.set(newHak, newHour);
        } else if (newIhud > 0) {
          if (newHour > (ihudMax.get(newIhud) ?? 0)) ihudMax.set(newIhud, newHour);
        } else {
          solo += newHour;
        }
      }
      let projected = solo;
      for (const v of hakMax.values()) projected += v;
      for (const v of ihudMax.values()) projected += v;
      if (projected > maxHours) {
        setConfirmHourOverflow({
          projected,
          maxHours,
          onConfirm: () => checkTeacherOverflowThenSave(),
        });
        return;
      }
    }

    checkTeacherOverflowThenSave();

    // 2) Check teacher-level overflow against the teacher's "frontaly" quota
    //    defined in TeacherHours / niohul-morim. We need to load the
    //    teacher's full list of hours across ALL layers, since `classes`
    //    only contains the currently-displayed layer.
    function checkTeacherOverflowThenSave() {
      const teacher = teachers.find((t) => Number(t.TeacherId) === Number(teacherId));
      const quota = Number(teacher?.Frontaly ?? 0);
      if (!teacher || quota <= 0) {
        doSave();
        return;
      }
      // Project by replacing the affected row's value with the new one.
      // We use the layer-scoped list because the teacher's layer-wide
      // assignments are what the user just edited; a richer cross-layer
      // projection would require an extra fetch.
      let projected = 0;
      let foundOldRow = false;
      for (const r of classes) {
        if (Number(r.TeacherId ?? 0) !== Number(teacherId)) continue;
        if (r.ClassTeacherId != null && classTeacherId != null && Number(r.ClassTeacherId) === Number(classTeacherId)) {
          projected += newHour;
          foundOldRow = true;
        } else {
          projected += Number(r.Hour ?? 0);
        }
      }
      if (!foundOldRow) projected += newHour;
      if (projected > quota) {
        const teacherName = `${teacher.FirstName ?? ''} ${teacher.LastName ?? ''}`.trim();
        setConfirmTeacherOverflow({
          teacherName,
          projected,
          quota,
          onConfirm: doSave,
        });
        return;
      }
      doSave();
    }
  }

  // ---------- context menu ----------
  function onTeacherContextMenu(e: React.MouseEvent, teacherId: number) {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, teacherId });
  }

  function contextMenuAction(action: 'hours') {
    if (contextMenu.teacherId != null && action === 'hours') {
      openTeacherHours(contextMenu.teacherId);
    }
    setContextMenu((c) => ({ ...c, visible: false }));
  }

  // ---------- build class panels (group teachers per class, collapse hakbatza groups) ----------
  interface ClassPanel {
    ClassId: number;
    ClassName: string;
    ClassFOREdit: string;
    Seq: number;
    ClassCountHour: number;
    teachers: Array<{
      ClassTeacherId: number | null;
      TeacherId: number;
      TeacherName: string; // can include <br> and <u> markers
      TafkidId: number | null;
      Hakbatza: string | null;
      Ihud: string | null;
      Hour: number | string | null;
      displayRaw: string; // pre-joined w/ <br>, optionally wrapped in <u>
      // All ClassTeacherIds collapsed into this pill (for hakbatza groups,
      // a pill may represent 2+ teachers — we need every id when the user
      // edits the group so all members stay in sync).
      memberClassTeacherIds: number[];
    }>;
  }

  // Recompute the "real" weekly hour count per class. The server-side
  // ClassCountHour just sums every ClassTeacher row, which double-counts
  // hakbatzaot (same lesson taught by N parallel teachers in level groups
  // counts N times) and over-counts ihudim (same lesson but split per class
  // row). Hakbatza/Ihud are scheduled in a single time slot so they should
  // contribute their hour value exactly once per class.
  //
  // For groups: take MAX(Hour) across all rows of the group (not the first
  // row's value) — partner rows added through drag-drop sometimes lag
  // behind on Hour, and picking the first row would silently drop the
  // group from the total.
  function computeRealHours(classId: number): number {
    let total = 0;
    const hakMax = new Map<string, number>();
    const ihudMax = new Map<string, number>();
    for (const r of classes) {
      if (r.ClassId !== classId) continue;
      if (r.ClassTeacherId == null || Number(r.ClassTeacherId) <= 0) continue;
      const hak = Number(r.Hakbatza ?? 0);
      const ihud = Number(r.Ihud ?? 0);
      const hr = Number(r.Hour ?? 0);
      if (hak > 0) {
        const key = classId + '_H_' + hak;
        if (hr > (hakMax.get(key) ?? 0)) hakMax.set(key, hr);
      } else if (ihud > 0) {
        const key = classId + '_I_' + ihud;
        if (hr > (ihudMax.get(key) ?? 0)) ihudMax.set(key, hr);
      } else {
        total += hr;
      }
    }
    for (const v of hakMax.values()) total += v;
    for (const v of ihudMax.values()) total += v;
    return total;
  }

  // Group bands shown above the regular teacher list inside each class
  // card. They visually summarise the Hakbatza/Ihud the class belongs to:
  // name, all teachers in the group, and the weekly hour count.
  interface GroupBand {
    kind: 'H' | 'I';
    number: number;
    name: string;
    classId: number;
    teacherNames: string[];
    hour: number;
  }

  function buildClassPanels(): { panels: ClassPanel[]; bandsByClass: Map<number, GroupBand[]> } {
    const panels: ClassPanel[] = [];
    const byClassId = new Map<number, ClassPanel>();
    const bandsByClass = new Map<number, GroupBand[]>();

    // Collect group bands first so the class panel can render them at
    // the top regardless of where the rows appear in the data.
    //
    // A Hakbatza is layer-scoped: every teacher with Hakbatza=N inside the
    // same LayerId belongs to ONE shared group, regardless of which class
    // they're contracted to. The card for each participating class needs to
    // show the same roster + the same hour count (MAX across the group), so
    // teachers who teach the partner class still appear here.
    //
    // STRICT: only rows with Hour>0 count as "real members". A row with
    // Hour=0/NULL means the teacher was tagged but isn't contracted to teach
    // — surfacing them as a band member misleads the user and feeds over-fill
    // into the scheduler. They get filtered out here entirely.
    const hakByLayerNum = new Map<number, { teachers: Map<number, string>; hour: number; name: string; classes: Set<number> }>();
    for (const r of classes) {
      const hak = Number(r.Hakbatza ?? 0);
      if (!hak) continue;
      const rowHour = Number(r.Hour ?? 0);
      if (rowHour <= 0) continue; // skip ghost members (no contracted hours)
      let b = hakByLayerNum.get(hak);
      if (!b) {
        b = { teachers: new Map(), hour: 0, name: '', classes: new Set() };
        hakByLayerNum.set(hak, b);
      }
      b.classes.add(r.ClassId);
      if (r.TeacherId != null && Number(r.TeacherId) > 0) {
        b.teachers.set(Number(r.TeacherId), r.TeacherName ?? '');
      }
      if (rowHour > b.hour) b.hour = rowHour;
    }
    // Hakbatza_GetAll covers every layer; bring in partner-class teachers
    // (and friendly group names) that the layer-scoped `classes` doesn't see.
    // Same Hour>0 guard applies — a row with no hours is metadata, not a member.
    for (const r of hakbatzaRows) {
      if (Number(r.LayerId) !== Number(layerId)) continue;
      const hak = Number(r.Hakbatza);
      if (!hak) continue;
      const rowHour = Number((r as { Hour?: number }).Hour ?? 0);
      let b = hakByLayerNum.get(hak);
      if (!b) {
        // Skip creating an empty bucket from a ghost row alone — a Hakbatza
        // with no real (Hour>0) members shouldn't surface in any class card.
        if (rowHour <= 0) continue;
        b = { teachers: new Map(), hour: 0, name: '', classes: new Set() };
        hakByLayerNum.set(hak, b);
      }
      if (r.Name) b.name = r.Name;
      if (rowHour <= 0) continue; // metadata row only
      if (rowHour > b.hour) b.hour = rowHour;
      if (r.TeacherId && Number(r.TeacherId) > 0) {
        b.teachers.set(Number(r.TeacherId), r.TeacherName ?? '');
      }
      if (r.ClassId) b.classes.add(Number(r.ClassId));
    }
    // Materialise per-class buckets — same group contents, replicated
    // across every class that participates.
    const hakBuckets = new Map<string, { classId: number; number: number; teachers: Map<number, string>; hour: number; name: string }>();
    for (const [hak, b] of hakByLayerNum) {
      for (const classId of b.classes) {
        hakBuckets.set(classId + '_H_' + hak, {
          classId,
          number: hak,
          teachers: b.teachers,
          hour: b.hour,
          name: b.name,
        });
      }
    }

    const ihudBuckets = new Map<string, { classId: number; number: number; teacherName: string; teacherId: number; hour: number; name: string }>();
    for (const r of classes) {
      const ihud = Number(r.Ihud ?? 0);
      if (!ihud) continue;
      const key = r.ClassId + '_I_' + ihud;
      let b = ihudBuckets.get(key);
      if (!b) {
        b = { classId: r.ClassId, number: ihud, teacherName: r.TeacherName ?? '', teacherId: Number(r.TeacherId ?? 0), hour: Number(r.Hour ?? 0), name: '' };
        ihudBuckets.set(key, b);
      }
    }
    for (const r of ihudRows) {
      if (Number(r.LayerId) !== Number(layerId)) continue;
      const key = r.ClassId + '_I_' + r.Ihud;
      const b = ihudBuckets.get(key);
      if (b && r.Name) b.name = r.Name;
    }

    for (const b of hakBuckets.values()) {
      const arr = bandsByClass.get(b.classId) ?? [];
      arr.push({
        kind: 'H',
        number: b.number,
        name: b.name,
        classId: b.classId,
        teacherNames: Array.from(b.teachers.values()).filter(Boolean),
        hour: b.hour,
      });
      bandsByClass.set(b.classId, arr);
    }
    for (const b of ihudBuckets.values()) {
      const arr = bandsByClass.get(b.classId) ?? [];
      arr.push({
        kind: 'I',
        number: b.number,
        name: b.name,
        classId: b.classId,
        teacherNames: b.teacherName ? [b.teacherName] : [],
        hour: b.hour,
      });
      bandsByClass.set(b.classId, arr);
    }

    // Build the regular teacher list — skip rows that belong to a group
    // (Hakbatza/Ihud), since those are shown in the band above.
    const rows = classes;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!byClassId.has(r.ClassId)) {
        const panel: ClassPanel = {
          ClassId: r.ClassId,
          ClassName: r.ClassName,
          ClassFOREdit: r.ClassFOREdit,
          Seq: r.Seq,
          ClassCountHour: computeRealHours(r.ClassId),
          teachers: [],
        };
        byClassId.set(r.ClassId, panel);
        panels.push(panel);
      }
      if (r.ClassTeacherId == null || Number(r.ClassTeacherId) <= 0) continue;
      // Skip rows that are part of a Hakbatza/Ihud — those are rendered
      // in the group band, not in the regular list.
      if (Number(r.Hakbatza ?? 0) > 0 || Number(r.Ihud ?? 0) > 0) continue;

      const memberIds: number[] = [Number(r.ClassTeacherId)];
      const teacherName = r.TeacherName ?? '';
      byClassId.get(r.ClassId)!.teachers.push({
        ClassTeacherId: r.ClassTeacherId,
        TeacherId: r.TeacherId!,
        TeacherName: teacherName,
        TafkidId: r.TafkidId,
        Hakbatza: r.Hakbatza,
        Ihud: r.Ihud,
        Hour: r.Hour,
        displayRaw: teacherName,
        memberClassTeacherIds: memberIds,
      });
    }
    return { panels, bandsByClass };
  }

  const { panels: classPanels, bandsByClass: classBandsByClass } = buildClassPanels();
  const hoursByDay = showHoursModal ? buildHoursByDay() : null;

  // group teachers by tafkid for row breaks (aspx inserts clear:both between tafkid groups)
  const teacherGroups: Array<{ tafkidId: number | string; teachers: TeacherRow[] }> = [];
  {
    const q = teacherSearch.trim().toLowerCase();
    const matches = (t: TeacherRow) => {
      if (!q) return true;
      const hay = [
        t.FullText,
        t.FirstName,
        t.LastName,
      ]
        .map((s) => String(s ?? '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    };
    let cur: { tafkidId: number | string; teachers: TeacherRow[] } | null = null;
    for (const t of teachers) {
      if (!matches(t)) continue;
      if (!cur || cur.tafkidId !== t.TafkidId) {
        cur = { tafkidId: t.TafkidId, teachers: [] };
        teacherGroups.push(cur);
      }
      cur.teachers.push(t);
    }
  }

  return (
    <div className="tc-page">
      {initialLoading && (
        <div className="page-loading-overlay" role="status" aria-live="polite" aria-label="טוען">
          <div className="page-loading-overlay__card">
            <div className="page-loading-overlay__orb">
              <span /><span /><span />
            </div>
            <div className="page-loading-overlay__title">טוען הגדרות כיתות</div>
            <div className="page-loading-overlay__subtitle">מאחזר מורים, מקצועות וכיתות...</div>
            <div className="page-loading-overlay__bar"><div /></div>
          </div>
        </div>
      )}
      <div className="col-md-9 tc-page__classes">
        {preCheckIssues.length > 0 && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <i className="fa fa-exclamation-triangle" style={{ color: '#d97706', fontSize: 18 }} />
            <span style={{ flex: 1, color: '#78350f' }}>
              ייתכן והשיבוץ האוטומטי לא יצליח במלואו ({preCheckIssues.length} בעיות פוטנציאליות בדטא).
            </span>
            <button
              type="button"
              style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}
              onClick={() => setShowPreCheckDetails(true)}
            >
              ראה עוד
            </button>
          </div>
        )}
        {showPreCheckDetails && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowPreCheckDetails(false); }}
          >
            <div style={{ background: '#fff', borderRadius: 12, maxWidth: 720, width: '90%', maxHeight: '80vh', overflow: 'auto', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}>בעיות שזוהו בדטא ({preCheckIssues.length})</h3>
                <button type="button" onClick={() => setShowPreCheckDetails(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
              </div>
              <ul style={{ paddingRight: 20, margin: 0 }}>
                {preCheckIssues.map((it, i) => (
                  <li key={i} style={{ marginBottom: 10, lineHeight: 1.5 }}>
                    <strong style={{ color: '#92400e' }}>{it.Label}</strong>
                    <div style={{ color: '#451a03', fontSize: 13 }}>{it.Detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="row dvWeek">
          <div className="panel panel-info">
            <div className="panel-heading tc-layer-bar">
              <div className="tc-layer-tabs" role="tablist" aria-label="בחירת שכבה">
                {LAYERS.map((layer) => {
                  const ls = layerStatus.find((s) => s.LayerId === layer.id);
                  const isFull = ls && ls.ClassCount > 0 && ls.FullyBookedCount === ls.ClassCount;
                  const hasGap = ls && ls.ClassCount > 0 && ls.FullyBookedCount < ls.ClassCount;
                  const statusIcon = isFull ? 'check-circle' : hasGap ? 'exclamation-triangle' : null;
                  const statusColor = isFull ? '#10b981' : hasGap ? '#f59e0b' : '#9ca3af';
                  const statusTitle = ls
                    ? `${ls.FullyBookedCount}/${ls.ClassCount} כיתות משובצות במלואן (${ls.Capacity} שעות לכיתה)`
                    : '';
                  return (
                    <label
                      className={`tc-layer-tab${layerId === layer.id ? ' is-active' : ''}`}
                      key={layer.id}
                      title={statusTitle}
                    >
                      <input
                        type="radio"
                        name="layer"
                        value={layer.id}
                        checked={layerId === layer.id}
                        onChange={() => setLayerId(layer.id)}
                      />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {layer.label}
                        {statusIcon && (
                          <i
                            className={`fa fa-${statusIcon}`}
                            style={{ color: statusColor, fontSize: 12 }}
                            aria-hidden="true"
                          />
                        )}
                        {ls && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, opacity: 0.9 }}>
                            {ls.FullyBookedCount}/{ls.ClassCount}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn btn-success btn-sm tc-add-class"
                onClick={() => openClassWindow('', '', '', 1)}
              >
                <i className="fa fa-plus" /> הוסף כיתה לשכבה המסומנת
              </button>
              <button
                type="button"
                className="excel-import-btn"
                style={{ marginInlineStart: 6 }}
                onClick={() => setShowImportModal(true)}
                title="ייבוא הקצאות מורים לכיתות מקובץ Excel"
              >
                <i className="fa fa-file-excel-o" />
                ייבוא מ-Excel
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm tc-add-class"
                style={{ marginInlineStart: 6 }}
                onClick={openWizard}
                title="צור הקבצה חדשה — בחר כיתות בשכבה ומורים שילמדו באותה שעה כקבוצות רמה"
              >
                <i className="fa fa-object-group" /> הקבצה חדשה
              </button>
              {/* Export zone — kept in its own pill on the far side so it never
                  gets confused with action controls like "הוסף כיתה". */}
              <div style={{ marginInlineStart: 'auto' }}>
                {(() => {
                  const currentLayer = LAYERS.find((l) => l.id === layerId);
                  const layerName = currentLayer?.label ?? '';
                  const exportRows = classes
                    .filter((r) => r.TeacherId && r.ClassTeacherId)
                    .map((r) => {
                      const teacher = teachers.find((t) => t.TeacherId === r.TeacherId);
                      const tafkid = tafkidOpts.find((x) => x.TafkidId === r.TafkidId)?.Name ?? '';
                      return {
                        ClassName: r.ClassName,
                        TeacherName: r.TeacherName,
                        Tafkid: tafkid,
                        Professional: teacher?.Frontaly ?? '',
                        Hour: r.Hour ?? '',
                        Hakbatza: r.Hakbatza ?? '',
                        Ihud: r.Ihud ?? '',
                      };
                    });
                  const handlers = buildExportHandlers({
                    title: 'הגדרות כיתות ומורים — ' + layerName,
                    subtitle: `הודפס ב-${new Date().toLocaleDateString('he-IL')}`,
                    filename: 'teacher-class-' + layerId,
                    rows: exportRows,
                    columns: [
                      { key: 'ClassName', label: 'כיתה' },
                      { key: 'TeacherName', label: 'מורה' },
                      { key: 'Tafkid', label: 'תפקיד' },
                      { key: 'Professional', label: 'מקצוע' },
                      { key: 'Hour', label: 'שעות', align: 'center' },
                      { key: 'Hakbatza', label: 'הקבצה', align: 'center' },
                      { key: 'Ihud', label: 'איחוד', align: 'center' },
                    ],
                  });
                  return <ExportButtons {...handlers} compact />;
                })()}
              </div>
            </div>
            <div className="panel-body" style={{ overflow: 'auto' }}>
              {(() => {
                // Build the Hakbatza/Ihud bucket lists once per render. Each
                // bucket is one card in the layer, exactly the same shape
                // as a class panel — header + drop zone for teachers.
                type HakBucket = {
                  layerId: number;
                  number: number;
                  name: string;
                  classes: Map<number, string>;
                  teachers: Map<number, string>;
                  hour: number;
                  professionalId: number;
                  professionalName: string;
                };
                const hakBuckets = new Map<string, HakBucket>();
                for (const r of hakbatzaRows) {
                  if (Number(r.LayerId) !== Number(layerId)) continue;
                  const key = r.LayerId + '_' + r.Hakbatza;
                  let b = hakBuckets.get(key);
                  // Initialise b.hour from the row itself — Hakbatza_GetAll
                  // returns ct.Hour for each row, so we don't depend on the
                  // (sometimes-late) classes load. We then take MAX across
                  // partner rows to surface the lesson length.
                  const rowHour = Number((r as { Hour?: number }).Hour ?? 0);
                  if (!b) {
                    b = {
                      layerId: r.LayerId,
                      number: r.Hakbatza,
                      name: r.Name ?? '',
                      classes: new Map(),
                      teachers: new Map(),
                      hour: rowHour,
                      professionalId: Number(r.ProfessionalId ?? 0),
                      professionalName: r.ProfessionalName ?? '',
                    };
                    hakBuckets.set(key, b);
                  } else {
                    if (!b.name && r.Name) b.name = r.Name;
                    if (!b.professionalId && r.ProfessionalId) {
                      b.professionalId = Number(r.ProfessionalId);
                      b.professionalName = r.ProfessionalName ?? '';
                    }
                    if (rowHour > b.hour) b.hour = rowHour;
                  }
                  b.classes.set(r.ClassId, r.ClassName);
                  if (r.TeacherId > 0) b.teachers.set(r.TeacherId, r.TeacherName);
                }
                // Defensive: also pick up Hour from `classes` if present —
                // covers cases where Hakbatza_GetAll didn't populate Hour
                // (older backend) but classes did.
                for (const r of classes) {
                  const hak = Number(r.Hakbatza ?? 0);
                  if (!hak) continue;
                  const key = layerId + '_' + hak;
                  const b = hakBuckets.get(key);
                  if (b && Number(r.Hour ?? 0) > b.hour) b.hour = Number(r.Hour);
                }
                const hakList = Array.from(hakBuckets.values()).sort((a, b) => a.number - b.number);

                type IhudBucket = {
                  layerId: number;
                  number: number;
                  name: string;
                  classes: Map<number, string>;
                  teacherId: number;
                  teacherName: string;
                  hour: number;
                };
                const ihudBuckets = new Map<string, IhudBucket>();
                for (const r of ihudRows) {
                  if (Number(r.LayerId) !== Number(layerId)) continue;
                  const key = r.LayerId + '_' + r.Ihud;
                  let b = ihudBuckets.get(key);
                  if (!b) {
                    b = { layerId: r.LayerId, number: r.Ihud, name: r.Name ?? '', classes: new Map(), teacherId: r.TeacherId, teacherName: r.TeacherName, hour: r.Hour };
                    ihudBuckets.set(key, b);
                  } else if (!b.name && r.Name) {
                    b.name = r.Name;
                  }
                  b.classes.set(r.ClassId, r.ClassName);
                  if (r.TeacherId > 0) {
                    b.teacherId = r.TeacherId;
                    b.teacherName = r.TeacherName;
                  }
                }
                const ihudList = Array.from(ihudBuckets.values()).sort((a, b) => a.number - b.number);

                // Compute "have / need" hours per class for the indicator
                // strip above each class card. ClassCountHour is the total
                // currently allocated. maxHours is the school's per-class
                // weekly total (count of non-shehya SchoolHours).
                const need = maxHours;

                const hasGroups = hakList.length > 0 || ihudList.length > 0;

                return (
                  <div className="droppable" onDragOver={allowDrop}>
                    {hasGroups && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700, marginBottom: 6, paddingInlineStart: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span><i className="fa fa-object-group" style={{ marginInlineEnd: 4 }} /> הקבצות ואיחודים</span>
                          {(hakList.length + ihudList.length) > 3 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'linear-gradient(90deg, #7c3aed, #6366f1)', padding: '4px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 6px -2px rgba(124,58,237,0.5)' }}>
                              <i className="fa fa-hand-o-left" />
                              גלול אופקית — {hakList.length + ihudList.length} הקבצות סה"כ
                              <i className="fa fa-arrow-left" />
                            </span>
                          )}
                        </div>
                        <div className="tc-grid-4-wrap">
                          {(hakList.length + ihudList.length) > 3 && (
                            <>
                              <button
                                type="button"
                                className="tc-grid-4-wrap__nav tc-grid-4-wrap__nav--right"
                                aria-label="גלול ימינה"
                                onClick={(e) => {
                                  const grid = e.currentTarget.parentElement?.querySelector('.tc-grid-4--wide') as HTMLElement | null;
                                  if (grid) grid.scrollBy({ left: 340, behavior: 'smooth' });
                                }}
                              >
                                <i className="fa fa-chevron-right" />
                              </button>
                              <button
                                type="button"
                                className="tc-grid-4-wrap__nav tc-grid-4-wrap__nav--left"
                                aria-label="גלול שמאלה"
                                onClick={(e) => {
                                  const grid = e.currentTarget.parentElement?.querySelector('.tc-grid-4--wide') as HTMLElement | null;
                                  if (grid) grid.scrollBy({ left: -340, behavior: 'smooth' });
                                }}
                              >
                                <i className="fa fa-chevron-left" />
                              </button>
                            </>
                          )}
                        <div className="tc-grid-4 tc-grid-4--wide">
                          {/* Hakbatza cards — same panel shape as class cards */}
                          {hakList.map((b) => {
                            const col = groupColor('H', b.number);
                            const isHover = dragHoverHak === (b.layerId + '_' + b.number);
                            const classList = Array.from(b.classes.values());
                            const teacherCount = b.teachers.size;
                            return (
                              <div className="tc-grid-4__cell" key={'hak_' + b.layerId + '_' + b.number}>
                                <div className="hak-card" style={{ borderTop: `4px solid ${col.bg}` }}>
                                  <div className="hak-card__header" style={{ background: `linear-gradient(135deg, ${col.bg} 0%, ${col.bg}dd 100%)`, color: col.fg }}>
                                    <button
                                      type="button"
                                      className="hak-card__close"
                                      onClick={() => setConfirmDeleteGroup({
                                        kind: 'H',
                                        layerId: b.layerId,
                                        number: b.number,
                                        label: b.name || `הקבצה ${b.number}`,
                                      })}
                                      title="מחק הקבצה"
                                      aria-label="מחק הקבצה"
                                    >
                                      <i className="fa fa-times" />
                                    </button>
                                    <div className="hak-card__title-row">
                                      <span className="hak-card__title-main">
                                        <i className="fa fa-object-group" />{' '}
                                        {b.professionalName || `הקבצה ${b.number}`}
                                      </span>
                                      <span className="hak-card__title-sub">#{b.number}</span>
                                    </div>
                                    <div className="hak-card__meta">
                                      <label className="hak-card__chip hak-card__chip--hours" title="שעות שבועיות שכל מורה ילמד בהקבצה — נקה את השדה כדי להזין ערך חדש">
                                        <i className="fa fa-clock-o" />
                                        <input
                                          key={`${b.layerId}_${b.number}_${b.hour}`}
                                          type="number"
                                          min={0}
                                          placeholder={String(b.hour ?? 0)}
                                          className="tc-hour-input"
                                          onFocus={(e) => e.currentTarget.select()}
                                          onBlur={(e) => {
                                            const raw = e.currentTarget.value.trim();
                                            if (raw === '') return; // empty → keep current value
                                            const v = Math.max(0, Math.floor(Number(raw) || 0));
                                            if (v !== b.hour) setHakbatzaHour(b.layerId, b.number, v);
                                          }}
                                        />
                                        <span>ש"ש</span>
                                      </label>
                                      <span className="hak-card__chip hak-card__chip--count" title="מספר מורים בהקבצה">
                                        <i className="fa fa-users" /> {teacherCount}
                                      </span>
                                    </div>
                                    <div className="hak-card__classes">
                                      {classList.length === 0 ? (
                                        <span className="hak-card__empty-classes">—</span>
                                      ) : (
                                        classList.map((cn) => (
                                          <span key={cn} className="hak-card__class-pill">{cn}</span>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                  <div
                                    className={`hak-card__body droppable${isHover ? ' hak-card__body--hover' : ''}`}
                                    onDragOver={(e) => {
                                      allowDrop(e);
                                      const key = b.layerId + '_' + b.number;
                                      if (dragHoverHak !== key) setDragHoverHak(key);
                                    }}
                                    onDragLeave={() => setDragHoverHak(null)}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDragHoverHak(null);
                                      const info = dragInfo.current;
                                      if (!info) return;
                                      dragInfo.current = null;
                                      const tid = info.teacherId;
                                      if (b.teachers.has(tid)) {
                                        toast.warning('המורה כבר בהקבצה');
                                        return;
                                      }
                                      addTeacherToHakbatza(b.layerId, b.number, tid);
                                    }}
                                  >
                                    <div className="hak-card__body-label">
                                      <i className="fa fa-graduation-cap" /> מורים מלמדים
                                    </div>
                                    {b.teachers.size === 0 ? (
                                      <div className="hak-card__dropzone">
                                        <i className="fa fa-hand-pointer-o" />
                                        <span>גרור מורים לכאן</span>
                                      </div>
                                    ) : (
                                      <div className="hak-card__teacher-list">
                                        {Array.from(b.teachers.entries()).map(([tid, tname]) => (
                                          <div key={tid} className="hak-card__teacher-row draggable">
                                            <div className="hak-card__teacher-pill" style={{ background: col.bg, color: col.fg }}>
                                              <i className="fa fa-user-circle" />
                                              <span>{tname}</span>
                                            </div>
                                            <button
                                              type="button"
                                              className="hak-card__teacher-remove"
                                              onClick={() => removeTeacherFromHakbatza(b.layerId, b.number, tid)}
                                              title="הסר מההקבצה"
                                              aria-label="הסר מההקבצה"
                                            >
                                              <i className="fa fa-times" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                        </div>
                        </div>
                        <div style={{ borderBottom: '1px dashed #e5e7eb', margin: '14px 0 4px' }} />
                      </div>
                    )}

                    {/* Class cards */}
                    <div className="tc-grid-4">
                    {classPanels.map((panel) => {
                      const have = panel.ClassCountHour;
                      const ratio = need > 0 ? have / need : 0;
                      const overflow = need > 0 && have > need;
                      const exact = need > 0 && have === need;
                      const mismatch = need > 0 && have !== need;
                      const indicatorColor = overflow ? '#dc2626' : exact ? '#16a34a' : '#374151';
                      const indicatorBg = overflow ? '#fee2e2' : exact ? '#dcfce7' : '#f3f4f6';
                      // Highlight the total-hours number itself: red whenever
                      // it doesn't match the school's per-class capacity
                      // (either overflow or under), black when it matches
                      // exactly. The indicator strip's background still uses
                      // the tri-color logic for context.
                      const totalNumberColor = mismatch ? '#dc2626' : '#0f172a';
                      return (
                  <div className="tc-grid-4__cell" key={panel.ClassId}>
                    <div
                      title={overflow ? 'חריגה: יש יותר שעות ממה שמותר לכיתה' : exact ? 'כיתה מלאה' : need > 0 ? `נדרשות עוד ${need - have} שעות` : 'הגדר שעות בית ספר כדי לראות מתוך כמה'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        background: indicatorBg,
                        color: indicatorColor,
                        border: `1px solid ${indicatorColor}30`,
                        borderRadius: 4,
                        marginBottom: 2,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <span title="שעות פרונטליות בלבד — לא כולל שהייה/פרטני">סה"כ פרונטלי</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: totalNumberColor, fontWeight: 800 }}>
                        {overflow && <i className="fa fa-exclamation-triangle" style={{ fontSize: 11, color: '#dc2626' }} />}
                        <span className="spTotal">{have}</span>
                        {need > 0 && (
                          <>
                            <span style={{ opacity: 0.6 }}>/</span>
                            <span>{need}</span>
                          </>
                        )}
                      </span>
                    </div>
                    {/* Slim progress bar reflecting fill ratio */}
                    {need > 0 && (
                      <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                        <div
                          style={{
                            height: '100%',
                            width: Math.min(100, ratio * 100) + '%',
                            background: overflow ? '#dc2626' : exact ? '#16a34a' : '#3b82f6',
                            transition: 'width 120ms',
                          }}
                        />
                      </div>
                    )}
                    <div className="row dvWeek" style={{ width: '100%' }}>
                      <div className="panel panel-primary">
                        {(() => {
                          const bands = classBandsByClass.get(panel.ClassId) ?? [];
                          const hakHours = bands
                            .filter((b) => b.kind === 'H')
                            .reduce((sum, b) => sum + Number(b.hour ?? 0), 0);
                          return (
                            <div className="panel-heading tc-class-heading">
                              <div className="tc-class-heading__topbar">
                                <button
                                  type="button"
                                  className="btn btn-xs tc-class-edit-pill"
                                  onClick={() =>
                                    openClassWindow(panel.ClassId, panel.ClassFOREdit, panel.Seq, 2)
                                  }
                                  title="ערוך פרטי כיתה"
                                >
                                  <i className="fa fa-pencil" /> ערוך
                                </button>
                                <h3 className="tc-class-heading__title">
                                  <span className="tc-class-name">{panel.ClassName}</span>
                                </h3>
                                <button
                                  type="button"
                                  className="tc-class-close"
                                  onClick={() => requestDeleteClass(panel.ClassId, panel.ClassName)}
                                  title="מחק כיתה"
                                  aria-label="מחק כיתה"
                                >
                                  <i className="fa fa-times" />
                                </button>
                              </div>
                              {hakHours > 0 && (
                                <div className="tc-class-heading__chips">
                                  <span
                                    className="tc-class-hak-total"
                                    title="סך השעות שמכוסות ע״י הקבצות בכיתה זו"
                                  >
                                    <i className="fa fa-object-group" />
                                    הקבצות: {hakHours}ש
                                  </span>
                                </div>
                              )}
                              {/* תווית מחנך/ת קריאה-בלבד. כדי לשנות מחנך/ת — לוחצים על "ערוך"
                                  בכותרת הכיתה ופותחים את הפופאפ. פתרון זה מבטל את ה-select
                                  האינלייני המבלבל שהציג כמה מורים TafkidId=1 כאילו כולם
                                  מועמדים שווי-זכויות. */}
                              {(() => {
                                const currentManager = teachers.find((t) => Number(t.ManageClassId ?? 0) === panel.ClassId);
                                const currentName = currentManager
                                  ? `${currentManager.FirstName ?? ''} ${currentManager.LastName ?? ''}`.trim()
                                  : '';
                                const hasHomeroom = !!currentManager;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => openClassWindow(panel.ClassId, panel.ClassFOREdit, panel.Seq, 2)}
                                    title="לחץ כדי לשנות את המחנך/ת — נפתח חלון העריכה"
                                    style={{
                                      width: '100%',
                                      display: 'grid',
                                      gridTemplateColumns: 'auto 1fr auto',
                                      alignItems: 'center',
                                      columnGap: 8,
                                      padding: '6px 10px',
                                      background: hasHomeroom
                                        ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)'
                                        : 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                                      border: `1.5px solid ${hasHomeroom ? '#10b981' : '#ef4444'}`,
                                      borderRadius: 8,
                                      marginTop: 6,
                                      cursor: 'pointer',
                                      textAlign: 'right',
                                      direction: 'rtl',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                    }}
                                  >
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      fontSize: 12, fontWeight: 800,
                                      color: hasHomeroom ? '#065f46' : '#991b1b',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      <i className={`fa ${hasHomeroom ? 'fa-graduation-cap' : 'fa-exclamation-triangle'}`} />
                                      מחנך/ת
                                    </span>
                                    <span style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: hasHomeroom ? '#065f46' : '#991b1b',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {hasHomeroom ? currentName : 'לא נקבע מחנך/ת'}
                                    </span>
                                    <i
                                      className="fa fa-pencil"
                                      style={{ fontSize: 11, color: hasHomeroom ? '#065f46' : '#991b1b', opacity: 0.7 }}
                                      aria-hidden="true"
                                    />
                                  </button>
                                );
                              })()}
                            </div>
                          );
                        })()}
                        <div
                          className={`panel-body droppable${dragHoverClassId === panel.ClassId ? ' is-drop-target' : ''}`}
                          style={{ height: 700 }}
                          onDragOver={(e) => {
                            allowDrop(e);
                            if (dragHoverClassId !== panel.ClassId) setDragHoverClassId(panel.ClassId);
                          }}
                          onDragLeave={(e) => {
                            // dragleave יורה גם בעת hover על ילד פנימי. אם היציאה
                            // לא לרכיב מחוץ ל-panel-body, התעלם.
                            const rt = e.relatedTarget as Node | null;
                            if (rt && (e.currentTarget as Node).contains(rt)) return;
                            if (dragHoverClassId === panel.ClassId) setDragHoverClassId(null);
                          }}
                          onDrop={(e) => onDropOnClass(e, panel.ClassId)}
                        >
                          {dragHoverClassId === panel.ClassId && (
                            <div className="tc-drop-placeholder" aria-hidden="true">
                              <i className="fa fa-plus-circle" />
                              <span>שחרר כאן להוספת המורה לכיתה</span>
                            </div>
                          )}
                          {(classBandsByClass.get(panel.ClassId) ?? []).map((band) => {
                            const col = groupColor(band.kind, band.number);
                            const label = band.name || (band.kind === 'H' ? `הקבצה ${band.number}` : `איחוד ${band.number}`);
                            return (
                              <div
                                key={`band_${band.kind}_${band.number}`}
                                style={{
                                  marginBottom: 4,
                                  borderRadius: 6,
                                  background: col.bg,
                                  border: `1px solid ${col.fg}30`,
                                  padding: '4px 6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  position: 'relative',
                                }}
                                title={label}
                              >
                                <span
                                  style={{
                                    fontWeight: 800,
                                    color: col.fg,
                                    fontSize: 10,
                                    background: 'rgba(255,255,255,0.55)',
                                    padding: '1px 5px',
                                    borderRadius: 8,
                                    flex: '0 0 auto',
                                  }}
                                >
                                  {band.kind === 'H' ? 'ה' : 'א'}{band.number}
                                </span>
                                <span style={{ color: col.fg, fontWeight: 700, flex: 1, minWidth: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {band.teacherNames.length === 0
                                    ? <em style={{ opacity: 0.6 }}>{label} · ללא מורים</em>
                                    : (
                                      <>
                                        {band.name && <span style={{ marginInlineEnd: 4, fontSize: 10, opacity: 0.85 }}>{band.name} · </span>}
                                        {band.teacherNames.join(' | ')}
                                      </>
                                    )}
                                </span>
                                <span
                                  style={{
                                    background: 'rgba(255,255,255,0.7)',
                                    color: col.fg,
                                    padding: '1px 6px',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    fontSize: 10,
                                    flex: '0 0 auto',
                                  }}
                                >
                                  {band.hour}ש
                                </span>
                              </div>
                            );
                          })}
                          {panel.teachers.map((t) => {
                            const hakNum = Number(t.Hakbatza ?? 0);
                            const hakColor = hakNum > 0 ? groupColor('H', hakNum) : null;
                            return (
                            <div
                              key={`${panel.ClassId}_${t.TeacherId}_${t.ClassTeacherId ?? ''}`}
                              className="draggable droppable"
                              style={{ marginBottom: 3, position: 'relative' }}
                              draggable
                              onDragStart={(e) =>
                                onDragStartTeacherInClass(e, {
                                  TeacherId: t.TeacherId,
                                  ClassId: panel.ClassId,
                                  Hakbatza: t.Hakbatza,
                                  ClassTeacherId: t.ClassTeacherId,
                                })
                              }
                              onDragOver={allowDrop}
                              onDrop={(e) => onDropOnClass(e, panel.ClassId)}
                            >
                              <div
                                className={`btn btn-${tafkidTheme(t.TafkidId)} btn-round`}
                                style={{
                                  width: '55%',
                                  marginLeft: 2,
                                }}
                                dangerouslySetInnerHTML={{ __html: t.displayRaw }}
                              />
                              {/* Group badges: Hakbatza/Ihud numbers shown as colored pills.
                                  Click on a badge opens the edit modal. */}
                              <span
                                style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle' }}
                              >
                                {hakNum > 0 && hakColor && (
                                  <span
                                    title={`הקבצה ${hakNum} — לחץ לעריכה`}
                                    onClick={() =>
                                      openGroupModal(
                                        panel.ClassId,
                                        panel.ClassName,
                                        t.memberClassTeacherIds,
                                        t.TeacherName.replace(/<br>/g, ' + '),
                                        hakNum,
                                      )
                                    }
                                    style={{
                                      cursor: 'pointer',
                                      background: hakColor.bg,
                                      color: hakColor.fg,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      lineHeight: 1.2,
                                      userSelect: 'none',
                                    }}
                                  >
                                    ה{hakNum}
                                  </span>
                                )}
                                {/* הכפתור "+" להוספה להקבצה הוסר —
                                    הקבצות נוצרות דרך אשף "הקבצה חדשה"
                                    בראש המסך, ומורים מצורפים בגרירה. */}
                              </span>
                              <input
                                key={`hr_${t.ClassTeacherId ?? 0}_${t.Hour ?? 0}`}
                                type="text"
                                style={{ width: '25%', float: 'left' }}
                                className="form-control tc-hour-input"
                                placeholder={t.Hour != null ? String(t.Hour) : '0'}
                                title="לחץ כדי לערוך — הערך הנוכחי מוצג כרקע"
                                onFocus={(e) => e.currentTarget.select()}
                                onBlur={(e) => {
                                  const raw = e.currentTarget.value.trim();
                                  if (raw === '') return; // empty → keep current value
                                  setHourToTeacherInClass(
                                    panel.ClassId,
                                    t.TeacherId,
                                    raw,
                                    t.Ihud,
                                    t.ClassTeacherId,
                                    t.Hakbatza
                                  );
                                }}
                              />
                            </div>
                          );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                      );
                    })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-3 tc-page__teachers">
        <div className="row dvWeek">
          <div className="panel panel-info tc-teachers-panel">
            <div className="panel-heading">
              <div className="tc-teachers-panel__heading">
                <span className="tc-teachers-panel__title-text">מורים</span>
                <button
                  type="button"
                  className="tc-teachers-panel__add"
                  onClick={() => openTeacherModal(2)}
                  title="הוסף מורה חדש"
                  aria-label="הוסף מורה"
                >
                  <i className="fa fa-plus" />
                  <span>הוספה</span>
                </button>
              </div>
            </div>
            <div
              className="panel-body droppable"
              style={{ overflow: 'auto' }}
              onDragOver={allowDrop}
              onDrop={onDropOnTeacherPanel}
            >
              <label
                className={`tc-teachers-search${teacherSearch ? ' is-filled' : ''}`}
                aria-label="חיפוש מורה"
              >
                <i className="fa fa-search tc-teachers-search__icon" aria-hidden="true" />
                <input
                  type="search"
                  className="tc-teachers-search__input"
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="חיפוש מורה..."
                />
                {teacherSearch && (
                  <button
                    type="button"
                    className="tc-teachers-search__clear"
                    aria-label="נקה חיפוש"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setTeacherSearch('')}
                  >
                    <i className="fa fa-times" />
                  </button>
                )}
              </label>
              {teacherGroups.map((grp, gi) => {
                const tafkidName =
                  tafkidOpts.find((t) => String(t.TafkidId) === String(grp.tafkidId))?.Name
                  ?? `תפקיד ${grp.tafkidId}`;
                const dotColor =
                  String(grp.tafkidId) === '2' ? '#0d9488'
                  : String(grp.tafkidId) === '3' ? '#be123c'
                  : '#4f46e5';
                return (
                  <div key={`grp_${gi}_${grp.tafkidId}`} className="tc-teachers-group">
                    <div className="tc-teachers-group__header">
                      <span className="tc-teachers-group__title">
                        <span
                          className="tc-teachers-group__dot"
                          style={{ background: dotColor }}
                        />
                        {tafkidName}
                      </span>
                      <span className="tc-teachers-group__count">
                        {grp.teachers.length}
                      </span>
                    </div>
                    <div className="tc-teachers-grid">
                      {grp.teachers.map((t) => {
                        const total = Number(t.TotalRequired ?? 0);
                        return (
                          <div
                            key={`dvTeacher_${t.TeacherId}`}
                            className={`btn btn-${tafkidTheme(t.TafkidId)} draggable`}
                            draggable
                            title={`${t.FullText} — סך שעות שבועיות: ${total}`}
                            onDragStart={(e) => onDragStartTeacher(e, t.TeacherId)}
                            onClick={() => openTeacherModal(1, t.TeacherId)}
                            onContextMenu={(e) => onTeacherContextMenu(e, t.TeacherId)}
                          >
                            {t.FullText}
                            {total > 0 && (
                              <span style={{ marginInlineStart: 4, opacity: 0.85, fontSize: '0.92em' }}>
                                ({total})
                              </span>
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

      {/* Context menu */}
      {contextMenu.visible && (
        <ul
          className="dropdown-menu dropdown-menu-right"
          role="menu"
          style={{
            display: 'block',
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 10000,
          }}
        >
          <li>
            <a
              tabIndex={-1}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                contextMenuAction('hours');
              }}
            >
              הצג מערכת מורה
            </a>
          </li>
          <li className="divider"></li>
          <li>
            <a
              tabIndex={-1}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setContextMenu((c) => ({ ...c, visible: false }));
              }}
            >
              סגור
            </a>
          </li>
        </ul>
      )}

      {/* Group edit modal (Hakbatza/Ihud) */}
      {groupModal && (
        <div
          className="modal fade in"
          role="dialog"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !groupBusy) setGroupModal(null);
          }}
        >
          <div className="modal-dialog" style={{ direction: 'rtl', maxWidth: 520 }}>
            <div className="modal-content">
              <div className="modal-header" style={{ background: '#f0f9ff', borderBottom: '2px solid #0284c7' }}>
                <button
                  type="button"
                  className="close"
                  onClick={() => !groupBusy && setGroupModal(null)}
                  aria-label="Close"
                >
                  &times;
                </button>
                <h4 className="modal-title" style={{ color: '#075985' }}>
                  <i className="fa fa-object-group" /> הקבצה / איחוד
                </h4>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 14, fontSize: 13, color: '#374151' }}>
                  <div><strong>כיתה:</strong> {groupModal.className}</div>
                  <div><strong>מורה:</strong> <span dangerouslySetInnerHTML={{ __html: groupModal.teacherNames }} /></div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>סוג שיוך:</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ cursor: 'pointer', padding: '6px 10px', background: groupKind === 'none' ? '#e0e7ff' : '#f3f4f6', borderRadius: 6, fontSize: 13 }}>
                      <input
                        type="radio"
                        name="gkind"
                        checked={groupKind === 'none'}
                        onChange={() => { setGroupKind('none'); setGroupNumber(''); }}
                        style={{ marginInlineEnd: 6 }}
                      />
                      ללא (עצמאי)
                    </label>
                    <label style={{ cursor: 'pointer', padding: '6px 10px', background: groupKind === 'hakbatza' ? '#fef3c7' : '#f3f4f6', borderRadius: 6, fontSize: 13 }}>
                      <input
                        type="radio"
                        name="gkind"
                        checked={groupKind === 'hakbatza'}
                        onChange={() => setGroupKind('hakbatza')}
                        style={{ marginInlineEnd: 6 }}
                      />
                      הקבצה (חלוקה בכיתה לקבוצות רמה)
                    </label>
                  </div>
                </div>

                {groupKind === 'hakbatza' && (() => {
                  // Suggest existing numbers of the chosen kind for quick pick
                  const existing = new Set<number>();
                  for (const r of classes) {
                    const n = Number(r.Hakbatza ?? 0);
                    if (n > 0 && r.ClassId === groupModal.classId) existing.add(n);
                  }
                  const sorted = Array.from(existing).sort((a, b) => a - b);
                  const nextFree = (sorted[sorted.length - 1] ?? 0) + 1;
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>
                        מספר הקבצה:
                      </label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="number"
                          min={1}
                          className="form-control"
                          style={{ width: 90, display: 'inline-block' }}
                          value={groupNumber}
                          onChange={(e) => setGroupNumber(e.target.value)}
                          placeholder="מס'"
                        />
                        <button
                          type="button"
                          className="btn btn-xs btn-default"
                          onClick={() => setGroupNumber(String(nextFree))}
                        >
                          הצעה: {nextFree}
                        </button>
                        {sorted.length > 0 && (
                          <>
                            <span style={{ color: '#6b7280', fontSize: 12 }}>קיימים:</span>
                            {sorted.map((n) => {
                              const col = groupColor('H', n);
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setGroupNumber(String(n))}
                                  style={{
                                    background: col.bg,
                                    color: col.fg,
                                    border: `1px solid ${col.fg}40`,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ה{n}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
                        מורים באותה כיתה שישתמשו באותו מספר הקבצה — ילמדו באותה שעה, כל אחד לקבוצת רמה אחרת.
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveGroupModal}
                  disabled={groupBusy}
                >
                  {groupBusy ? <><span className="spinner" /> שומר...</> : <><i className="fa fa-save" /> שמור</>}
                </button>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => !groupBusy && setGroupModal(null)}
                  disabled={groupBusy}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create-group wizard (Hakbatza only — single step: pick classes). */}
      {wizardOpen && (() => {
        // Distinct classes in the currently-loaded layer.
        const seen = new Set<number>();
        const allClasses: { ClassId: number; ClassName: string }[] = [];
        for (const r of classes) {
          if (r.ClassTeacherId && Number(r.ClassTeacherId) > 0 && !seen.has(r.ClassId)) {
            seen.add(r.ClassId);
            allClasses.push({ ClassId: r.ClassId, ClassName: r.ClassName });
          }
        }
        allClasses.sort((a, b) => a.ClassName.localeCompare(b.ClassName, 'he'));
        const allSelected = allClasses.length > 0 && allClasses.every((c) => wizardSelectedClasses.has(c.ClassId));
        const selectedCount = wizardSelectedClasses.size;

        return (
          <div
            className="modal fade in"
            role="dialog"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={(e) => { if (e.target === e.currentTarget) closeWizard(); }}
          >
            <div className="modal-dialog" style={{ direction: 'rtl', maxWidth: 600 }}>
              <div className="modal-content">
                <div className="modal-header" style={{ background: '#fef3c7', borderBottom: '2px solid #d97706' }}>
                  <button type="button" className="close" onClick={closeWizard} aria-label="Close" disabled={wizardBusy}>
                    &times;
                  </button>
                  <h4 className="modal-title" style={{ color: '#d97706' }}>
                    <i className="fa fa-object-group" /> יצירת הקבצה חדשה
                  </h4>
                  <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4, lineHeight: 1.5 }}>
                    בחר את הכיתות בשכבה שמהן יתפצלו תלמידי ההקבצה. אחרי היצירה גרור מורים לתוך ההקבצה.
                  </div>
                </div>
                <div className="modal-body">
                  {allClasses.length === 0 ? (
                    <div style={{ padding: 10, color: '#6b7280', fontSize: 13, background: '#f9fafb', borderRadius: 6 }}>
                      אין כיתות עם מורים בשכבה זו. הוסף מורים לכיתות קודם.
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontWeight: 600, marginBottom: 4, display: 'block', color: '#7c3aed' }}>
                          <i className="fa fa-book" /> מקצוע ההקבצה <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <select
                          className="form-control"
                          value={wizardProfessional}
                          onChange={(e) => setWizardProfessional(e.target.value)}
                          disabled={wizardBusy}
                          style={{ borderColor: wizardProfessional ? '#c4b5fd' : '#fca5a5' }}
                          required
                        >
                          <option value="">— בחר מקצוע —</option>
                          {professionalOpts.map((p) => (
                            <option key={p.ProfessionalId} value={p.ProfessionalId}>{p.Name}</option>
                          ))}
                        </select>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                          שם ההקבצה יהיה שם המקצוע שתבחר.
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label style={{ fontWeight: 600 }}>
                          סמן את הכיתות ({selectedCount} נבחרו):
                        </label>
                        <button
                          type="button"
                          className="btn btn-default btn-xs"
                          disabled={wizardBusy}
                          onClick={() => {
                            if (allSelected) setWizardSelectedClasses(new Set());
                            else setWizardSelectedClasses(new Set(allClasses.map((c) => c.ClassId)));
                          }}
                        >
                          {allSelected ? 'נקה הכל' : 'בחר את כל השכבה'}
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
                        {allClasses.map((c) => {
                          const checked = wizardSelectedClasses.has(c.ClassId);
                          return (
                            <label
                              key={c.ClassId}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 10px',
                                background: checked ? '#fef3c7' : '#f9fafb',
                                border: `1px solid ${checked ? '#f59e0b' : '#e5e7eb'}`,
                                borderRadius: 6, cursor: 'pointer', fontSize: 13,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleWizardClass(c.ClassId)}
                                disabled={wizardBusy}
                              />
                              <span style={{ flex: 1, fontWeight: 600 }}>{c.ClassName}</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={saveWizard}
                    disabled={wizardBusy || selectedCount < 2}
                  >
                    {wizardBusy ? <><span className="spinner" /> שומר...</> : <><i className="fa fa-save" /> צור הקבצה</>}
                  </button>
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={closeWizard}
                    disabled={wizardBusy}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create-Ihud wizard. Picks classes + a single responsible teacher,
          then materialises the Ihud with all rows already populated. */}
      {ihudWizardOpen && (() => {
        const seen = new Set<number>();
        const allClasses: { ClassId: number; ClassName: string }[] = [];
        for (const r of classes) {
          if (!seen.has(r.ClassId)) {
            seen.add(r.ClassId);
            allClasses.push({ ClassId: r.ClassId, ClassName: r.ClassName });
          }
        }
        allClasses.sort((a, b) => a.ClassName.localeCompare(b.ClassName, 'he'));
        const selectedCount = ihudWizardClasses.size;
        const allSelected = allClasses.length > 0 && allClasses.every((c) => ihudWizardClasses.has(c.ClassId));

        return (
          <div
            className="modal fade in"
            role="dialog"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={(e) => { if (e.target === e.currentTarget) closeIhudWizard(); }}
          >
            <div className="modal-dialog" style={{ direction: 'rtl', maxWidth: 600 }}>
              <div className="modal-content">
                <div className="modal-header" style={{ background: '#ede9fe', borderBottom: '2px solid #7c3aed' }}>
                  <button type="button" className="close" onClick={closeIhudWizard} aria-label="Close" disabled={ihudWizardBusy}>
                    &times;
                  </button>
                  <h4 className="modal-title" style={{ color: '#5b21b6' }}>
                    <i className="fa fa-link" /> יצירת איחוד חדש
                  </h4>
                  <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4, lineHeight: 1.5 }}>
                    איחוד מאחד שתי כיתות או יותר באותה שעה עם מורה אחראי אחד שילמד את כולן ביחד.
                  </div>
                </div>
                <div className="modal-body">
                  {allClasses.length === 0 ? (
                    <div style={{ padding: 10, color: '#6b7280', fontSize: 13, background: '#f9fafb', borderRadius: 6 }}>
                      אין כיתות בשכבה זו.
                    </div>
                  ) : (
                    <>
                      <label style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>
                        שם האיחוד (אופציונלי):
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="למשל: שיעור משותף / לימודי דת"
                        value={ihudWizardName}
                        onChange={(e) => setIhudWizardName(e.target.value)}
                        disabled={ihudWizardBusy}
                        style={{ marginBottom: 14 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label style={{ fontWeight: 600 }}>
                          סמן את הכיתות לאיחוד ({selectedCount} נבחרו):
                        </label>
                        <button
                          type="button"
                          className="btn btn-default btn-xs"
                          disabled={ihudWizardBusy}
                          onClick={() => {
                            if (allSelected) setIhudWizardClasses(new Set());
                            else setIhudWizardClasses(new Set(allClasses.map((c) => c.ClassId)));
                          }}
                        >
                          {allSelected ? 'נקה הכל' : 'בחר את כל השכבה'}
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, marginBottom: 16 }}>
                        {allClasses.map((c) => {
                          const checked = ihudWizardClasses.has(c.ClassId);
                          return (
                            <label
                              key={c.ClassId}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 10px',
                                background: checked ? '#ede9fe' : '#f9fafb',
                                border: `1px solid ${checked ? '#7c3aed' : '#e5e7eb'}`,
                                borderRadius: 6, cursor: 'pointer', fontSize: 13,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleIhudWizardClass(c.ClassId)}
                                disabled={ihudWizardBusy}
                              />
                              <span style={{ flex: 1, fontWeight: 600 }}>{c.ClassName}</span>
                            </label>
                          );
                        })}
                      </div>

                      <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>
                        מורה אחראי:
                      </label>
                      <select
                        className="form-control"
                        value={ihudWizardTeacher ?? ''}
                        onChange={(e) => setIhudWizardTeacher(e.target.value ? Number(e.target.value) : null)}
                        disabled={ihudWizardBusy}
                      >
                        <option value="">-- בחר מורה --</option>
                        {teachers.map((t) => (
                          <option key={t.TeacherId} value={t.TeacherId}>
                            {t.FirstName} {t.LastName}
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                        ניתן להחליף את המורה האחראי אחר כך ע"י גרירה לכרטיס האיחוד.
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={saveIhudWizard}
                    disabled={ihudWizardBusy || selectedCount < 2 || !ihudWizardTeacher}
                  >
                    {ihudWizardBusy ? <><span className="spinner" /> שומר...</> : <><i className="fa fa-save" /> צור איחוד</>}
                  </button>
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={closeIhudWizard}
                    disabled={ihudWizardBusy}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Class modal — עיצוב tm-modal אחיד עם מודאל המורה. */}
      {showClassModal && (() => {
        const isNew = classModalMode === 1;
        return (
          <div
            className="tm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-modal-title"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !classModalBusy) setShowClassModal(false);
            }}
          >
            <div className="tm-modal__card" style={{ maxWidth: 560 }}>
              <header className="tm-modal__header">
                <div className="tm-modal__header-side">
                  <span className="tm-modal__avatar" aria-hidden="true">
                    <i className={`fa ${isNew ? 'fa-plus' : 'fa-pencil'}`} />
                  </span>
                  <div>
                    <h2 id="class-modal-title" className="tm-modal__title">
                      {isNew ? 'כיתה חדשה' : 'עריכת כיתה'}
                    </h2>
                    {!isNew && (
                      <div className="tm-modal__subtitle">{classModalTitle.replace(/^עריכת כיתה:\s*/, '')}</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="tm-modal__close"
                  onClick={() => setShowClassModal(false)}
                  aria-label="סגור"
                  disabled={classModalBusy}
                >
                  <i className="fa fa-times" />
                </button>
              </header>

              <div className="tm-modal__body">
                <section className="tm-section">
                  <h3 className="tm-section__title">
                    <i className="fa fa-id-card-o tm-section__icon" />
                    פרטי הכיתה
                  </h3>
                  <div className="tm-grid tm-grid--2">
                    <label className="tm-field">
                      <span className="tm-field__label">
                        שם כיתה <span className="tm-field__required">*</span>
                      </span>
                      <input
                        type="text"
                        className="tm-field__input"
                        value={classForm.ClassName}
                        onChange={(e) => setClassForm({ ...classForm, ClassName: e.target.value })}
                        autoFocus
                      />
                    </label>
                    <label className="tm-field">
                      <span className="tm-field__label">
                        מספר רץ <span className="tm-field__required">*</span>
                      </span>
                      <input
                        type="number"
                        className="tm-field__input"
                        value={classForm.Seq}
                        onChange={(e) => setClassForm({ ...classForm, Seq: e.target.value })}
                      />
                    </label>
                  </div>
                </section>

                {/* בכיתה חדשה אין עוד ClassId — סלקטור מחנך/ת לא רלוונטי
                    עד שהכיתה תיווצר. נציג אותו רק במצב עריכה. */}
                {!isNew && (() => {
                  const selectedTeacher = teachers.find((t) => Number(t.TeacherId) === Number(classForm.TeacherId));
                  const selectedName = selectedTeacher
                    ? `${selectedTeacher.FirstName ?? ''} ${selectedTeacher.LastName ?? ''}`.trim()
                    : '';
                  return (
                    <section className="tm-section">
                      <h3 className="tm-section__title">
                        <i className="fa fa-graduation-cap tm-section__icon" />
                        מחנך/ת הכיתה
                      </h3>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto',
                          alignItems: 'center',
                          gap: 12,
                          padding: '14px 16px',
                          background: selectedTeacher
                            ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)'
                            : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                          border: `2px solid ${selectedTeacher ? '#818cf8' : '#fca5a5'}`,
                          borderRadius: 12,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <span
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: selectedTeacher ? '#4f46e5' : '#ef4444',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                          }}
                          aria-hidden="true"
                        >
                          <i className={`fa ${selectedTeacher ? 'fa-user' : 'fa-user-times'}`} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: selectedTeacher ? '#1e1b4b' : '#7f1d1d',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {selectedTeacher ? selectedName : 'לא נבחר/ה מחנך/ת'}
                          </div>
                          <div style={{ fontSize: 12, color: selectedTeacher ? '#4338ca' : '#991b1b', marginTop: 2 }}>
                            {selectedTeacher
                              ? `${selectedTeacher.Frontaly || 0} ש' פרונטליות מוקצבות`
                              : 'יש לבחור מחנך/ת לכיתה'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setHomeroomSearch(''); setHomeroomPickerOpen(true); }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            background: '#4f46e5',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(79,70,229,0.25)',
                            whiteSpace: 'nowrap',
                          }}
                          title="פתח חלון בחירת מחנך/ת"
                        >
                          <i className={`fa ${selectedTeacher ? 'fa-exchange' : 'fa-plus'}`} />
                          {selectedTeacher ? 'החלף/י' : 'בחר/י מחנך/ת'}
                        </button>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                        <i className="fa fa-info-circle" style={{ marginInlineEnd: 4 }} />
                        רק מורים בעלי תפקיד "מחנך/ת" זמינים. מורים שכבר מחנכים כיתה אחרת מופיעים כלא זמינים — כדי שלא לפגוע בכיתות אחרות.
                        <br />
                        <i className="fa fa-lightbulb-o" style={{ marginInlineEnd: 4 }} />
                        מורים אחרים שמלמדים בכיתה זו ייחשבו כ<b>מורים מקצועיים</b>, ולא כמחנכים.
                      </div>
                    </section>
                  );
                })()}
              </div>

              <div className="tm-modal__footer">
                <button
                  type="button"
                  className="tm-btn tm-btn--ghost"
                  onClick={() => setShowClassModal(false)}
                  disabled={classModalBusy}
                >
                  סגור
                </button>
                <button
                  type="button"
                  className="tm-btn tm-btn--primary"
                  onClick={() => saveClass(classModalMode)}
                  disabled={classModalBusy}
                >
                  <i className="fa fa-check" />
                  {classModalBusy ? 'שומר…' : 'שמור שינויים'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Homeroom picker — פופאפ משני, נפתח מתוך פופאפ עריכת כיתה. */}
      {homeroomPickerOpen && (() => {
        const currentClassId = typeof classForm.ClassId === 'number' ? classForm.ClassId : 0;
        // מורים זכאים: TafkidId=1 בלבד.
        const allHomerooms = teachers
          .filter((t) => Number(t.TafkidId ?? 0) === 1)
          .sort((a, b) => {
            const an = `${a.LastName ?? ''} ${a.FirstName ?? ''}`.trim();
            const bn = `${b.LastName ?? ''} ${b.FirstName ?? ''}`.trim();
            return an.localeCompare(bn, 'he');
          });
        const q = homeroomSearch.trim().toLowerCase();
        const filtered = q
          ? allHomerooms.filter((t) => {
              const full = `${t.FirstName ?? ''} ${t.LastName ?? ''}`.toLowerCase();
              return full.includes(q) || String(t.Tz ?? '').includes(q);
            })
          : allHomerooms;
        const currentClassObj = classes.find((c) => Number(c.ClassId) === currentClassId);
        const currentClassName = currentClassObj?.ClassName ?? classForm.ClassName ?? '';

        return (
          <div
            className="tm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="homeroom-picker-title"
            style={{ zIndex: 1100 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setHomeroomPickerOpen(false);
            }}
          >
            <div className="tm-modal__card" style={{ maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <header className="tm-modal__header">
                <div className="tm-modal__header-side">
                  <span className="tm-modal__avatar" aria-hidden="true" style={{ background: '#4f46e5' }}>
                    <i className="fa fa-graduation-cap" />
                  </span>
                  <div>
                    <h2 id="homeroom-picker-title" className="tm-modal__title">בחירת מחנך/ת</h2>
                    <div className="tm-modal__subtitle">לכיתה {currentClassName}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="tm-modal__close"
                  onClick={() => setHomeroomPickerOpen(false)}
                  aria-label="סגור"
                >
                  <i className="fa fa-times" />
                </button>
              </header>

              <div className="tm-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
                <div style={{ position: 'relative' }}>
                  <i
                    className="fa fa-search"
                    style={{
                      position: 'absolute',
                      insetInlineStart: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      fontSize: 14,
                      pointerEvents: 'none',
                    }}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    className="tm-field__input"
                    placeholder="חפש/י לפי שם או תעודת זהות…"
                    value={homeroomSearch}
                    onChange={(e) => setHomeroomSearch(e.target.value)}
                    autoFocus
                    style={{ paddingInlineStart: 36 }}
                  />
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {filtered.length === allHomerooms.length
                    ? `${allHomerooms.length} מורים זמינים`
                    : `${filtered.length} מתוך ${allHomerooms.length} מורים`}
                </div>
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    paddingInlineEnd: 4,
                  }}
                >
                  {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                      <i className="fa fa-inbox" style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
                      לא נמצאו מורים תואמים לחיפוש
                    </div>
                  ) : filtered.map((t) => {
                    const manageId = Number(t.ManageClassId ?? 0);
                    const isCurrentForThis = manageId === currentClassId;
                    const isElsewhere = manageId > 0 && manageId !== currentClassId;
                    // מחפשים את שם הכיתה גם בשכבה הנוכחית וגם ב-Map הגלובלי
                    // — כי המורה יכול להיות מחנך בכיתה משכבה אחרת.
                    const otherName = isElsewhere
                      ? (classes.find((c) => Number(c.ClassId) === manageId)?.ClassName
                         ?? allClassesById.get(manageId)
                         ?? '')
                      : '';
                    const isSelected = Number(t.TeacherId) === Number(classForm.TeacherId);
                    const fullName = `${t.FirstName ?? ''} ${t.LastName ?? ''}`.trim() || `מורה #${t.TeacherId}`;
                    return (
                      <button
                        key={t.TeacherId}
                        type="button"
                        disabled={isElsewhere}
                        onClick={() => {
                          if (isElsewhere) return;
                          setClassForm({ ...classForm, TeacherId: Number(t.TeacherId) });
                          setHomeroomPickerOpen(false);
                        }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          background: isSelected
                            ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)'
                            : isElsewhere
                              ? '#f8fafc'
                              : '#ffffff',
                          border: `1.5px solid ${isSelected ? '#6366f1' : isElsewhere ? '#e2e8f0' : '#e5e7eb'}`,
                          borderRadius: 10,
                          textAlign: 'right',
                          direction: 'rtl',
                          cursor: isElsewhere ? 'not-allowed' : 'pointer',
                          opacity: isElsewhere ? 0.6 : 1,
                          transition: 'all 0.12s ease',
                        }}
                        onMouseOver={(e) => {
                          if (!isElsewhere && !isSelected) {
                            (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc';
                            (e.currentTarget as HTMLButtonElement).style.borderColor = '#cbd5e1';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isElsewhere && !isSelected) {
                            (e.currentTarget as HTMLButtonElement).style.background = '#ffffff';
                            (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                          }
                        }}
                      >
                        <span
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: isSelected ? '#4f46e5' : isElsewhere ? '#94a3b8' : '#6366f1',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                          aria-hidden="true"
                        >
                          {(t.FirstName?.[0] ?? '?')}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: isSelected ? '#1e1b4b' : '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {fullName}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {`${t.Frontaly || 0} ש' פרונטלי · ${t.FreeDay ? 'יום חופשי: ' + ['','א','ב','ג','ד','ה','ו'][Number(t.FreeDay)] || '' : 'ללא יום חופשי'}`}
                          </div>
                        </div>
                        {isCurrentForThis ? (
                          <span style={{
                            background: '#10b981',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 999,
                            whiteSpace: 'nowrap',
                          }}>
                            <i className="fa fa-check" /> נוכחי/ת
                          </span>
                        ) : isElsewhere ? (
                          <span style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 999,
                            whiteSpace: 'nowrap',
                          }} title={`כבר מחנך/ת של ${otherName}`}>
                            <i className="fa fa-lock" /> {otherName || 'תפוס/ה'}
                          </span>
                        ) : isSelected ? (
                          <span style={{
                            background: '#6366f1',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 999,
                            whiteSpace: 'nowrap',
                          }}>
                            <i className="fa fa-check-circle" /> נבחר/ה
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="tm-modal__footer">
                <button
                  type="button"
                  className="tm-btn tm-btn--ghost"
                  onClick={() => setHomeroomPickerOpen(false)}
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Teacher modal */}
      {showTeacherModal && (
        <div
          className="tm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tm-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowTeacherModal(false);
          }}
        >
          <div className="tm-modal__card">
            <header className="tm-modal__header">
              <div className="tm-modal__header-side">
                <span className="tm-modal__avatar" aria-hidden="true">
                  <i className={`fa ${teacherModalType === 2 ? 'fa-user-plus' : 'fa-user'}`} />
                </span>
                <div>
                  <h2 id="tm-modal-title" className="tm-modal__title">
                    {teacherModalType === 2 ? 'הוספת מורה חדש/ה' : 'עריכת פרטי מורה'}
                  </h2>
                  {teacherModalType === 1 && (teacherForm.FirstName || teacherForm.LastName) && (
                    <div className="tm-modal__subtitle">
                      {teacherForm.FirstName} {teacherForm.LastName}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="tm-modal__close"
                onClick={() => setShowTeacherModal(false)}
                aria-label="סגור"
              >
                <i className="fa fa-times" />
              </button>
            </header>

            <div className="tm-modal__body">
              <section className="tm-section">
                <h3 className="tm-section__title">
                  <i className="fa fa-id-card-o tm-section__icon" />
                  פרטים אישיים
                </h3>
                <div className="tm-grid tm-grid--2">
                  <label className="tm-field">
                    <span className="tm-field__label">
                      שם פרטי <span className="tm-field__required">*</span>
                    </span>
                    <input
                      type="text"
                      className="tm-field__input"
                      value={teacherForm.FirstName}
                      onChange={(e) => setTeacherForm({ ...teacherForm, FirstName: e.target.value })}
                      autoFocus
                      placeholder="לדוגמה: דנה"
                    />
                  </label>
                  <label className="tm-field">
                    <span className="tm-field__label">
                      שם משפחה <span className="tm-field__required">*</span>
                    </span>
                    <input
                      type="text"
                      className="tm-field__input"
                      value={teacherForm.LastName}
                      onChange={(e) => setTeacherForm({ ...teacherForm, LastName: e.target.value })}
                      placeholder="לדוגמה: כהן"
                    />
                  </label>
                  <label className="tm-field">
                    <span className="tm-field__label">ת"ז</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="tm-field__input"
                      value={teacherForm.Tz}
                      onChange={(e) => setTeacherForm({ ...teacherForm, Tz: e.target.value })}
                      placeholder="9 ספרות"
                    />
                  </label>
                  <label className="tm-field">
                    <span className="tm-field__label">אימייל</span>
                    <input
                      type="email"
                      className="tm-field__input"
                      value={teacherForm.Email}
                      onChange={(e) => setTeacherForm({ ...teacherForm, Email: e.target.value })}
                      placeholder="name@example.com"
                      dir="ltr"
                    />
                  </label>
                </div>
              </section>

              <section className="tm-section">
                <h3 className="tm-section__title">
                  <i className="fa fa-briefcase tm-section__icon" />
                  תפקיד ומקצוע
                </h3>
                <div className="tm-grid tm-grid--2">
                  <label className="tm-field">
                    <span className="tm-field__label">
                      תפקיד <span className="tm-field__required">*</span>
                    </span>
                    <select
                      className="tm-field__input"
                      value={teacherForm.Tafkid}
                      onChange={(e) => {
                        const newTafkid = e.target.value;
                        // Choosing "מחנכ/ת כיתה" auto-fills the profession
                        // with "מחנך" — homeroom teachers always teach
                        // that as their default subject.
                        const isHomeroom = tafkidOpts.find((t) => String(t.TafkidId) === newTafkid)?.Name?.includes('מחנכ');
                        let nextProf = teacherForm.ProfessionalId;
                        if (isHomeroom) {
                          const homeroomProf = professionalOpts.find((p) => p.Name === 'מחנך');
                          if (homeroomProf) nextProf = String(homeroomProf.ProfessionalId);
                        }
                        setTeacherForm({ ...teacherForm, Tafkid: newTafkid, ProfessionalId: nextProf });
                      }}
                    >
                      <option value="0">-- בחר תפקיד --</option>
                      {tafkidOpts.map((t) => (
                        <option key={t.TafkidId} value={t.TafkidId}>
                          {t.Name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="tm-field">
                    <span className="tm-field__label">מקצוע ברירת מחדל</span>
                    <select
                      className="tm-field__input"
                      value={teacherForm.ProfessionalId}
                      onChange={(e) => setTeacherForm({ ...teacherForm, ProfessionalId: e.target.value })}
                    >
                      <option value="0">-- בחר מקצוע --</option>
                      {professionalOpts.map((p) => (
                        <option key={p.ProfessionalId} value={p.ProfessionalId}>
                          {p.Name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="tm-section">
                <h3 className="tm-section__title">
                  <i className="fa fa-clock-o tm-section__icon" />
                  שעות הוראה
                </h3>
                <div className="tm-grid tm-grid--3">
                  <label className="tm-field">
                    <span className="tm-field__label">
                      פרונטלי <span className="tm-field__required">*</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="tm-field__input tm-field__input--num"
                      value={teacherForm.Frontaly}
                      onChange={(e) => setTeacherForm({ ...teacherForm, Frontaly: e.target.value })}
                      placeholder="0"
                    />
                  </label>
                  <label className="tm-field">
                    <span className="tm-field__label">שהייה</span>
                    <input
                      type="number"
                      min={0}
                      className="tm-field__input tm-field__input--num"
                      value={teacherForm.Shehya}
                      onChange={(e) => setTeacherForm({ ...teacherForm, Shehya: e.target.value })}
                      placeholder="0"
                    />
                  </label>
                  <label className="tm-field">
                    <span className="tm-field__label">פרטני</span>
                    <input
                      type="number"
                      min={0}
                      className="tm-field__input tm-field__input--num"
                      value={teacherForm.Partani}
                      onChange={(e) => setTeacherForm({ ...teacherForm, Partani: e.target.value })}
                      placeholder="0"
                    />
                  </label>
                </div>
              </section>

              <section className="tm-section">
                <h3 className="tm-section__title">
                  <i className="fa fa-calendar-o tm-section__icon" />
                  העדפות
                </h3>
                <div className="tm-grid tm-grid--2">
                  <label className="tm-field">
                    <span className="tm-field__label">יום חופשי</span>
                    <select
                      className="tm-field__input"
                      value={teacherForm.FreeDay}
                      onChange={(e) => setTeacherForm({ ...teacherForm, FreeDay: e.target.value })}
                    >
                      <option value="0">-- ללא --</option>
                      <option value="1">יום ראשון</option>
                      <option value="2">יום שני</option>
                      <option value="3">יום שלישי</option>
                      <option value="4">יום רביעי</option>
                      <option value="5">יום חמישי</option>
                      <option value="6">יום שישי</option>
                    </select>
                  </label>
                </div>
              </section>
            </div>

            <footer className="tm-modal__footer">
              {/* Primary cluster first in DOM so it lands on the inline-start
                  (visual right in RTL) — matches Hebrew dialog conventions
                  where the affirmative action sits on the right. */}
              <div className="tm-modal__footer-primary">
                <button
                  type="button"
                  className="tm-btn tm-btn--primary"
                  onClick={() => saveTeacher(teacherModalType)}
                >
                  <i className={`fa ${teacherModalType === 2 ? 'fa-user-plus' : 'fa-check'}`} />
                  {teacherModalType === 2 ? 'צור מורה' : 'שמור שינויים'}
                </button>
                <button
                  type="button"
                  className="tm-btn tm-btn--ghost"
                  onClick={() => setShowTeacherModal(false)}
                >
                  ביטול
                </button>
              </div>
              <div className="tm-modal__footer-secondary">
                {teacherModalType === 1 && (
                  <button
                    type="button"
                    className="tm-btn tm-btn--ghost-danger"
                    onClick={deleteTeacher}
                  >
                    <i className="fa fa-trash" />
                    מחיקת מורה
                  </button>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Teacher hours modal */}
      {showHoursModal && hoursByDay && (
        <div
          className="modal fade in"
          role="dialog"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHoursModal(false);
          }}
        >
          <div className="modal-dialog" style={{ width: '90%' }}>
            <div className="modal-content">
              <div className="modal-header label-info">
                <button type="button" className="close" aria-hidden="true" onClick={() => setShowHoursModal(false)}>
                  &times;
                </button>
                <h4 className="modal-title">{hoursTitle}</h4>
              </div>
              <div className="modal-body">
                <table cellPadding={3} cellSpacing={1} width="100%" border={0} style={{ tableLayout: 'fixed' }}>
                  <tbody>
                    <tr>
                      {DAY_LABELS.map((label) => (
                        <td
                          key={label}
                          style={{
                            textAlign: 'center',
                            color: 'white',
                            fontSize: 18,
                            fontWeight: 'bold',
                            height: 20,
                            backgroundColor: '#428bca',
                            border: 'solid 1px black',
                          }}
                        >
                          {label}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      {[1, 2, 3, 4, 5, 6].map((day) => (
                        <td key={day} style={{ verticalAlign: 'top', paddingBottom: 10, fontSize: 12 }}>
                          {hoursByDay[day].map((cell, ci) => (
                            <div
                              key={ci}
                              className={`teacherRub ${cell.isWork ? 'emptyHour' : ''}`}
                              style={{
                                height: 40,
                                fontSize: 14,
                                padding: 1,
                                border: 'solid 1px silver',
                                fontWeight: 'bold',
                                backgroundColor: cell.isWork ? 'gainsboro' : undefined,
                              }}
                            >
                              {cell.className}
                              <div
                                className="teacherPro"
                                style={{
                                  textAlign: 'left',
                                  fontSize: 12,
                                  fontStyle: 'italic',
                                  fontWeight: 'lighter',
                                }}
                              >
                                {cell.professional}
                              </div>
                            </div>
                          ))}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-info btn-xs" onClick={() => setShowHoursModal(false)}>
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteGroup && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDeleteGroup(null);
          }}
        >
          <div className="confirm-modal__card">
            <div className="confirm-modal__icon">
              <i className="fa fa-exclamation-triangle" />
            </div>
            <h3 className="confirm-modal__title">
              מחיקת {confirmDeleteGroup.kind === 'H' ? 'הקבצה' : 'איחוד'}
            </h3>
            <p className="confirm-modal__text">
              האם אתה בטוח שברצונך למחוק את <strong>{confirmDeleteGroup.label}</strong>?
              <br />
              {confirmDeleteGroup.kind === 'H'
                ? 'המורים בהקבצה ישתחררו ויחזרו להיות זמינים.'
                : 'המורה האחראי ישתחרר משיוך זה.'}
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setConfirmDeleteGroup(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  const g = confirmDeleteGroup;
                  setConfirmDeleteGroup(null);
                  if (g.kind === 'H') deleteHakbatza(g.layerId, g.number);
                  else deleteIhud(g.layerId, g.number);
                }}
                autoFocus
              >
                <i className="fa fa-trash" /> מחק לצמיתות
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTeacherOverflow && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmTeacherOverflow(null);
              loadClasses(layerId);
            }
          }}
        >
          <div className="confirm-modal__card">
            <div className="confirm-modal__icon" style={{ background: '#fef3c7', color: '#d97706' }}>
              <i className="fa fa-user-clock" />
            </div>
            <h3 className="confirm-modal__title">חריגה מקצובת המורה</h3>
            <p className="confirm-modal__text">
              עדכון זה יביא את המורה <strong>{confirmTeacherOverflow.teacherName}</strong> ל-
              <strong>{confirmTeacherOverflow.projected}</strong> שעות פרונטליות,
              מעל הקצובה שהוגדרה ב"ניהול מורים" (<strong>{confirmTeacherOverflow.quota}</strong>).
              <br />
              להמשיך בכל זאת? (כדאי לעדכן את שעות הפרונטלי במסך "ניהול מורים")
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => {
                  setConfirmTeacherOverflow(null);
                  loadClasses(layerId);
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => {
                  const cb = confirmTeacherOverflow.onConfirm;
                  setConfirmTeacherOverflow(null);
                  cb();
                }}
                autoFocus
              >
                <i className="fa fa-check" /> כן, המשך
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmHourOverflow && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmHourOverflow(null);
              loadClasses(layerId);
            }
          }}
        >
          <div className="confirm-modal__card">
            <div className="confirm-modal__icon" style={{ background: '#fef3c7', color: '#d97706' }}>
              <i className="fa fa-clock-o" />
            </div>
            <h3 className="confirm-modal__title">חריגה משעות הכיתה</h3>
            <p className="confirm-modal__text">
              השעות הפרונטליות המעודכנות יביאו את הכיתה ל-<strong>{confirmHourOverflow.projected}</strong> שעות,
              מעל המגבלה של <strong>{confirmHourOverflow.maxHours}</strong> (לא כולל שעות שהייה/פרטני).
              <br />
              להמשיך בכל זאת?
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => {
                  setConfirmHourOverflow(null);
                  loadClasses(layerId);
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => {
                  const cb = confirmHourOverflow.onConfirm;
                  setConfirmHourOverflow(null);
                  cb();
                }}
                autoFocus
              >
                <i className="fa fa-check" /> כן, המשך
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteTeacher && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDeleteTeacher(false);
          }}
        >
          <div className="confirm-modal__card">
            <div className="confirm-modal__icon">
              <i className="fa fa-exclamation-triangle" />
            </div>
            <h3 className="confirm-modal__title">מחיקת מורה</h3>
            <p className="confirm-modal__text">
              האם אתה בטוח שברצונך למחוק את המורה <strong>{teacherForm.FirstName} {teacherForm.LastName}</strong>?
              <br />
              כל השיבוצים של המורה ימחקו.
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setConfirmDeleteTeacher(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={executeDeleteTeacher}
                autoFocus
              >
                <i className="fa fa-trash" /> מחק לצמיתות
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmDeleteTitle"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(null);
          }}
        >
          <div className="confirm-modal__card">
            <div className="confirm-modal__icon">
              <i className="fa fa-exclamation-triangle" />
            </div>
            <h3 className="confirm-modal__title" id="confirmDeleteTitle">
              מחיקת כיתה
            </h3>
            <p className="confirm-modal__text">
              האם אתה בטוח שברצונך למחוק את הכיתה{' '}
              <strong>{confirmDelete.className}</strong>?
              <br />
              כל המורים המשובצים לכיתה זו יתפנו.
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setConfirmDelete(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDeleteClass}
                autoFocus
              >
                <i className="fa fa-trash" /> מחק לצמיתות
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <ExcelImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="ייבוא הקצאות כיתות-מורים מ-Excel"
          description="הקובץ נקרא בפורמט 'פריסת שעות' — גיליון נפרד לכל שכבה (כיתה א׳–ו׳) עם בלוקי מקצוע / מס שעות / מורה תחת כותרת שם הכיתה."
          templates={buildClassTeacherTemplates(importClassesRef, teachersRef, {
            tafkidId: tafkidOpts[0]?.TafkidId,
            layerId,
            loadTeachers,
            loadClasses: reloadImportClasses,
          })}
          existingCount={0}
          performImport={async (rows, onProgress) => importClassTeachers(rows, onProgress)}
          onCompleted={() => { loadTeachers(); loadClasses(layerId); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Excel import — ClassTeacher
// ============================================================

const CLASSTEACHER_IMPORT_SCHEMA: ExcelColumnSpec[] = [
  { key: 'className', header: 'כיתה', required: true, description: 'שם הכיתה כפי שמופיע במערכת', example: 'רויטל',
    hint: 'יש להזין רק את השם הקצר (לדוגמה "רויטל"), לא את התיאור המלא ("ג\' 2 רויטל").' },
  { key: 'teacherName', header: 'מורה', required: true, description: 'שם פרטי + שם משפחה (מופרדים ברווח)', example: 'שרה כהן',
    hint: 'יש להזין בדיוק כפי שמופיע ברשימת המורים. רגישות לאותיות סופיות.' },
  { key: 'hour', header: 'שעות', required: true, description: 'מספר שעות שבועי שהמורה מלמד/ת בכיתה', example: '5' },
  { key: 'isHomeroom', header: 'מחנכ/ת', required: false, description: 'האם המורה מחנכ/ת הכיתה הזו?', example: 'לא',
    hint: 'כן/לא (השאר ריק = לא). רק מורה אחד יכול להיות מחנכ/ת לכיתה.' },
];

const CLASSTEACHER_IMPORT_SAMPLE: Array<Record<string, string | number>> = [
  { className: 'רויטל', teacherName: 'רויטל אוטמזגין', hour: 23, isHomeroom: 'כן' },
  { className: 'רויטל', teacherName: 'מאור חקלאות', hour: 1, isHomeroom: 'לא' },
  { className: 'אושרית', teacherName: 'אושרית קבלה', hour: 22, isHomeroom: 'כן' },
];

interface ClassTeacherImportPayload {
  classId: number;
  teacherId: number;
  hour: number;
  isHomeroom: boolean;
  classNameRaw: string;
  teacherNameRaw: string;
}

function normalizeName(s: string): string {
  return String(s ?? '').trim().replace(/\s+/g, ' ').replace(/[֑-ֽֿׁ-ׂׄ-ׇ]/g, '');
}

function parseClassTeacherRow(
  raw: Record<string, unknown>,
  _rowIdx: number,
  classes: Array<{ ClassId: number | string; ClassName: string; Name?: string | null }>,
  teachers: Array<{ TeacherId: number | string; FirstName?: string | null; LastName?: string | null; FullText?: string | null }>,
  _layerId: number,
): ParseRowResult<ClassTeacherImportPayload> {
  const errors: string[] = [];
  const get = (k: string): string => {
    const v = raw[k];
    return v == null ? '' : String(v).trim();
  };
  const className = get('כיתה');
  const teacherName = get('מורה');
  const hourStr = get('שעות');
  const isHomeroomStr = get('מחנכ/ת');

  if (!className && !teacherName && !hourStr) return { ok: false }; // שורה ריקה

  if (!className) errors.push('חסר שם כיתה');
  if (!teacherName) errors.push('חסר שם מורה');
  if (!hourStr || isNaN(Number(hourStr)) || Number(hourStr) <= 0) errors.push('שעות חייב להיות מספר חיובי');

  // מצא כיתה — חיפוש מקל: לפי "Name" (השם הקצר) או ClassName מלא, מנוקה
  const targetClass = className.toLowerCase();
  const cls = classes.find((c) => {
    const short = normalizeName(String(c.Name ?? c.ClassName ?? '')).toLowerCase();
    const full = normalizeName(String(c.ClassName ?? '')).toLowerCase();
    return short === targetClass || full === targetClass || full.endsWith(' ' + targetClass);
  });
  if (!cls && className) errors.push(`כיתה "${className}" לא נמצאה במערכת`);

  // מצא מורה — לפי FirstName+LastName או FullText
  const targetTeacher = normalizeName(teacherName).toLowerCase();
  const t = teachers.find((tt) => {
    const ft = normalizeName(`${tt.FirstName ?? ''} ${tt.LastName ?? ''}`).toLowerCase();
    const ftRev = normalizeName(`${tt.LastName ?? ''} ${tt.FirstName ?? ''}`).toLowerCase();
    const full = normalizeName(String(tt.FullText ?? '')).toLowerCase();
    return ft === targetTeacher || ftRev === targetTeacher || full === targetTeacher;
  });
  if (!t && teacherName) errors.push(`מורה "${teacherName}" לא נמצא/ה במערכת`);

  const isHomeroom = /^(כן|y|yes|true|1)$/i.test(isHomeroomStr);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      classId: Number(cls!.ClassId),
      teacherId: Number(t!.TeacherId),
      hour: Number(hourStr),
      isHomeroom,
      classNameRaw: className,
      teacherNameRaw: teacherName,
    },
  };
}

async function importClassTeachers(
  rows: ClassTeacherImportPayload[],
  onProgress: (cur: number, total: number) => void,
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0; let failed = 0; const errors: string[] = [];
  const total = Math.max(1, rows.length);
  // הייבוא צריך להיות אידמפוטנטי — אם הזוג (כיתה×מורה) כבר קיים ב-DB, רק
  // נעדכן את השעות במקום לייצר רישום כפול.
  //   שלב 0: סריקת DB → מיפוי קיים (כיתה|מורה)→ClassTeacherId.
  //   שלב 1: Type 1 (INSERT) רק עבור זוגות חדשים.
  //   שלב 2: רענון המיפוי כדי לתפוס את ה-IDs שנוצרו ב-Type 1.
  //   שלב 3: Type 4 (UPDATE Hour) לכל זוג — כך גם זוגות קיימים יקבלו את
  //          השעות מהאקסל.

  // --- שלב 0: מיפוי שיבוצים קיימים ב-DB ---
  const idMap = new Map<string, number>();
  try {
    const fresh = await fetchAllClassRows();
    for (const row of fresh) {
      if (Number(row.Hakbatza ?? 0) !== 0) continue; // רק שיבוצים רגילים (לא הקבצה)
      if (row.ClassTeacherId == null || row.TeacherId == null) continue;
      const key = `${row.ClassId}|${row.TeacherId}`;
      if (!idMap.has(key)) idMap.set(key, Number(row.ClassTeacherId));
    }
  } catch (e) {
    errors.push(`טעינת מזהי שיבוץ קיימים נכשלה: ${(e as Error).message}`);
  }

  // --- שלב 1: הוספה רק לזוגות שלא קיימים ---
  const needInsert: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (!idMap.has(`${rows[i].classId}|${rows[i].teacherId}`)) needInsert.push(i);
  }
  for (let j = 0; j < needInsert.length; j++) {
    const i = needInsert[j];
    const r = rows[i];
    try {
      await ajax('Class_SetTeacherToClass', {
        ClassId: String(r.classId),
        TeacherId: String(r.teacherId),
        Hour: '',
        TargetHakbatza: '', SourceHakbatza: '',
        TargetIhud: '', SourceIhud: '',
        TargetClassTeacherId: '', SourceClassTeacherId: '',
        Type: 1,
      });
    } catch (e) {
      failed++;
      errors.push(`${r.classNameRaw} / ${r.teacherNameRaw}: ${(e as Error).message}`);
    }
    onProgress(Math.round((j + 1) / Math.max(1, needInsert.length) * 0.4 * total), total);
  }

  // --- שלב 2: רענון מיפוי כדי לקבל את ה-IDs החדשים ---
  if (needInsert.length > 0) {
    try {
      const fresh = await fetchAllClassRows();
      for (const row of fresh) {
        if (Number(row.Hakbatza ?? 0) !== 0) continue;
        if (row.ClassTeacherId == null || row.TeacherId == null) continue;
        const key = `${row.ClassId}|${row.TeacherId}`;
        if (!idMap.has(key)) idMap.set(key, Number(row.ClassTeacherId));
      }
    } catch (e) {
      errors.push(`רענון מזהי שיבוץ נכשל: ${(e as Error).message}`);
    }
  }

  // --- שלב 3: קביעת השעות לכל הזוגות ---
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    onProgress(Math.round(total * 0.4 + (i + 1) * 0.6), total);
    const ctId = idMap.get(`${r.classId}|${r.teacherId}`);
    if (ctId == null) {
      failed++;
      errors.push(`${r.classNameRaw} / ${r.teacherNameRaw}: לא נמצא מזהה שיבוץ אחרי ההוספה`);
      continue;
    }
    try {
      await ajax('Class_SetTeacherToClass', {
        ClassId: String(r.classId),
        TeacherId: String(r.teacherId),
        Hour: String(r.hour),
        TargetHakbatza: '', SourceHakbatza: '',
        TargetIhud: '', SourceIhud: '',
        TargetClassTeacherId: '', SourceClassTeacherId: String(ctId),
        Type: 4,
      });
      success++;
    } catch (e) {
      failed++;
      errors.push(`${r.classNameRaw} / ${r.teacherNameRaw}: ${(e as Error).message}`);
    }
  }
  return { success, failed, errors };
}

// ============================================================
// Templates registry — מוחזר ל-ExcelImportModal
// ============================================================

type ClassRowLite = { ClassId: number | string; ClassName: string; Name?: string | null };
type TeacherRowLite = { TeacherId: number | string; FirstName?: string | null; LastName?: string | null; FullText?: string | null };

interface BuildTemplatesCtx {
  tafkidId?: number;
  layerId: number;
  loadTeachers: () => void | Promise<void>;
  loadClasses: () => void | Promise<void>;
}

async function addTeachersByName(names: string[], tafkidId: number | undefined): Promise<{ added: number; failed: number; errors: string[] }> {
  const tafkid = tafkidId != null ? String(tafkidId) : '0';
  let added = 0; let failed = 0; const errors: string[] = [];
  for (const fullName of names) {
    // פצל ל-FirstName / LastName לפי הרווח הראשון
    const trimmed = fullName.trim().replace(/\s+/g, ' ');
    const parts = trimmed.split(' ');
    const firstName = parts[0] ?? trimmed;
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    try {
      const ins = await ajax<Array<{ TeacherId?: number }>>('Teacher_DML', {
        TeacherId: '0',
        Type: 2, // 2 = הוספה (SP מצפה ל-tinyint, לא למחרוזת "insert")
        Tafkid: tafkid,
        FirstName: firstName,
        LastName: lastName,
        Email: '',
        Frontaly: '0',
        FreeDay: '0',
        Tz: '',
        Shehya: '0',
        Partani: '0',
        ProfessionalId: '',
      });
      // ה-SP `Teacher_DML` Type=2 יוצר רישומי TeacherHours לכל שעות בית
      // הספר כשעות **חסומות** למורה (isWork>0) — תופעת לוואי שמגרמת לכך
      // שמורה חדש מופיע ב-PreCheck כעם "0 זמינות". מנקים זאת מיד אחרי
      // ההוספה ע"י קריאת Teacher_SetTeacherHours Type=2 לכל HourId.
      const newId = Number(ins?.[0]?.TeacherId ?? 0);
      if (newId > 0) {
        try {
          const hours = await ajax<Array<{ HourId: number }>>('Teacher_GetAllTeacherHours', { TeacherId: newId });
          for (const h of (Array.isArray(hours) ? hours : [])) {
            try {
              await ajax('Teacher_SetTeacherHours', { TeacherId: newId, HourId: h.HourId, Type: 2 });
            } catch { /* ignore single-hour clear failure */ }
          }
        } catch (e) {
          // אם הקריאה הראשית נכשלה — לא נעצור את הזרימה; המורה עדיין נוסף.
          console.error('Failed to clear TeacherHours for new teacher', newId, e);
        }
      }
      added++;
    } catch (e) {
      failed++;
      errors.push(`${fullName}: ${(e as Error).message}`);
    }
  }
  return { added, failed, errors };
}

// ממפה שם גיליון ("כיתה א" / "כתה ג'") ל-LayerId (א'=1 .. ו'=6)
function sheetNameToLayerId(sheetName: string): number | null {
  const m = String(sheetName ?? '').match(/^\s*כ(?:י)?תה?\s*([א-ו])/);
  if (!m) return null;
  const idx = 'אבגדהו'.indexOf(m[1]);
  return idx >= 0 ? idx + 1 : null;
}

async function addClassesByName(
  names: string[],
  defaultLayerId: number,
  existingClasses: ClassRowLite[],
  classLayers?: Record<string, number>,
): Promise<{ added: number; failed: number; errors: string[] }> {
  // Seq מקסימלי לכל שכבה — כדי להוסיף כל כיתה בסוף השכבה הנכונה שלה
  const maxSeqByLayer = new Map<number, number>();
  for (const c of existingClasses) {
    const lid = Number((c as { LayerId?: number }).LayerId ?? 0);
    const cs = Number((c as { Seq?: number }).Seq ?? 0);
    if (cs > (maxSeqByLayer.get(lid) ?? 0)) maxSeqByLayer.set(lid, cs);
  }
  let added = 0; let failed = 0; const errors: string[] = [];
  for (const name of names) {
    // שכבה לפי הגיליון שממנו הכיתה הגיעה; ברירת מחדל — השכבה הנבחרת בדף
    const layerId = (classLayers && classLayers[name] != null) ? classLayers[name] : defaultLayerId;
    const nextSeq = (maxSeqByLayer.get(layerId) ?? 0) + 1;
    maxSeqByLayer.set(layerId, nextSeq);
    try {
      await ajax('Class_SetClassData', {
        ClassId: '',
        LayerId: layerId,
        ClassName: name.trim(),
        Seq: String(nextSeq),
        mode: 1,
      });
      added++;
    } catch (e) {
      failed++;
      errors.push(`${name}: ${(e as Error).message}`);
    }
  }
  return { added, failed, errors };
}

// טוען את כל הכיתות מכל השכבות (א'–ו'). אשף הייבוא חייב לראות כיתות בכל
// השכבות — Class_GetClassByLayerId מחזיר רק שכבה אחת בכל קריאה.
async function fetchAllClassRows(): Promise<ClassRow[]> {
  const all: ClassRow[] = [];
  for (let lid = 1; lid <= 6; lid++) {
    try {
      const data = await ajax<ClassRow[]>('Class_GetClassByLayerId', { LayerId: lid });
      if (Array.isArray(data)) all.push(...data);
    } catch { /* דלג על שכבה שנכשלה */ }
  }
  return all;
}

function buildClassTeacherTemplates(
  classesRef: React.RefObject<ClassRowLite[]>,
  teachersRef: React.RefObject<TeacherRowLite[]>,
  ctx: BuildTemplatesCtx,
): ExcelImportTemplate<ClassTeacherImportPayload>[] {
  // getters שמחזירים תמיד את המצב העדכני
  const getClasses = () => classesRef.current ?? [];
  const getTeachers = () => teachersRef.current ?? [];
  // תבנית משנית (תאימות לאחור) — טבלה שטוחה בגיליון יחיד.
  const flatTemplate: ExcelImportTemplate<ClassTeacherImportPayload> = {
      id: 'flat',
      name: 'טבלה שטוחה (גיליון יחיד)',
      description: 'כל שורה = הקצאה אחת (כיתה / מורה / שעות / מחנכ‫ת). הפורמט הסטנדרטי המומלץ.',
      schema: CLASSTEACHER_IMPORT_SCHEMA,
      sampleRows: CLASSTEACHER_IMPORT_SAMPLE,
      previewSheet: FLAT_PREVIEW_SHEET,
      detect: (wb) => {
        // ציון גבוה אם הגיליון הראשון מכיל את הכותרות "כיתה" + "מורה" + "שעות"
        const first = wb.Sheets[wb.SheetNames[0]];
        if (!first) return 0;
        const grid = XLSX.utils.sheet_to_json<unknown[]>(first, { defval: '', header: 1 });
        if (grid.length === 0) return 0;
        const headerRow = (grid[0] || []) as unknown[];
        const headers = new Set(headerRow.map((v) => String(v ?? '').trim()));
        let hits = 0;
        if (headers.has('כיתה')) hits++;
        if (headers.has('מורה')) hits++;
        if (headers.has('שעות')) hits++;
        return hits / 3;
      },
      parseFile: (wb) => parseFlatClassTeacherWorkbook(wb, getClasses(), getTeachers()),
      addMissingTeachers: (names) => addTeachersByName(names, ctx.tafkidId),
      addMissingClasses: (names, classLayers) => addClassesByName(names, ctx.layerId, getClasses(), classLayers),
      onAfterAutoAdd: async () => { await ctx.loadTeachers(); await ctx.loadClasses(); await new Promise((r) => setTimeout(r, 60)); },
  };
  // התבנית הראשית — פורמט "פריסת שעות" כפי שהקובץ מגיע מבית הספר.
  const multiSheetTemplate: ExcelImportTemplate<ClassTeacherImportPayload> = {
      id: 'multi-sheet-blocks',
      name: 'פריסת שעות — גיליון לכל שכבה',
      description: 'גיליון נפרד לכל שכבה ("כיתה א" עד "כיתה ו"). בכל גיליון בלוקים: שורת כותרת עם שם הכיתה (לדוגמה "סימי-23 ה"), שורת "מקצוע / מס שעות / מורה", ואז שורת מקצוע אחת לכל שיעור. נתמך גם גיליון מטריצה ("פריסת שעות") שבו השורות=כיתות והעמודות=מורים.',
      schema: MULTISHEET_PREVIEW_SCHEMA,
      sampleRows: [],
      previewSheet: MULTISHEET_BLOCKS_PREVIEW,
      buildTemplateWorkbook: () => buildMultiSheetBlocksTemplate(),
      detect: (wb) => {
        const classSheets = wb.SheetNames.filter(isClassSheetName).length;
        // קובץ עם בלוקי כיתות — התאמה מלאה
        if (classSheets >= 2) return 1;
        if (classSheets === 1) return 0.6;
        // קובץ עם רק גיליון מטריצה — גם מתאים
        for (const name of wb.SheetNames) {
          const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { defval: '', header: 1 });
          for (let r = 0; r < Math.min(grid.length, 4); r++) {
            const row = (grid[r] || []) as unknown[];
            const firstCell = normalizeText(row[0]);
            if (firstCell === 'כתה' || firstCell === 'כיתה') {
              const headersCount = row.filter((v) => String(v ?? '').trim()).length;
              if (headersCount >= 4) return 0.85;
            }
          }
        }
        return 0;
      },
      parseFile: (wb) => parseMultiSheetCombined(wb, getClasses(), getTeachers()),
      addMissingTeachers: (names) => addTeachersByName(names, ctx.tafkidId),
      addMissingClasses: (names, classLayers) => addClassesByName(names, ctx.layerId, getClasses(), classLayers),
      onAfterAutoAdd: async () => { await ctx.loadTeachers(); await ctx.loadClasses(); await new Promise((r) => setTimeout(r, 60)); },
  };
  // התבנית הראשית מוצגת ראשונה — היא זו שהמודאל מציג כברירת מחדל.
  return [multiSheetTemplate, flatTemplate];
}

// מבנה הנתונים שהמערכת מחלצת מקובץ "פריסת שעות" (עמודה לכל שדה אחרי הפרסור)
const MULTISHEET_PREVIEW_SCHEMA: ExcelColumnSpec[] = [
  { key: 'classNameRaw', header: 'כיתה', required: true,
    description: 'שם הכיתה — מחולץ אוטומטית מכותרת הבלוק (התא שמעל "מקצוע").', example: 'סימי',
    hint: 'בקובץ "פריסת שעות" כל כיתה נקראת על שם המחנכת. אין עמודת "כיתה" נפרדת — השם נקרא מהכותרת "סימי-23 ה".' },
  { key: 'teacherNameRaw', header: 'מורה', required: true,
    description: 'שם המורה — נקרא מעמודת "מורה" בכל שורת מקצוע בבלוק.', example: 'סימי',
    hint: 'בתא שמכיל כמה מורים ("אושרית/ליאורי", "מלי+ליאורי") נלקח המורה הראשון.' },
  { key: 'hour', header: 'שעות (מסוכם)', required: true,
    description: 'סך השעות שהמורה מלמד/ת בכיתה — סיכום עמודת "מס שעות" של כל המקצועות שלו/ה באותו בלוק.', example: '23' },
];

// ============================================================
// Parser רב-גיליוני: בלוקי כיתות
// ============================================================

function normalizeText(s: unknown): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[֑-ֽֿׁ-ׂׄ-ׇ]/g, '')
    .replace(/[״"׳']/g, '');
}

function isClassSheetName(name: string): boolean {
  return /^\s*כתה\s*[א-ת]/i.test(name) || /^\s*כיתה\s*[א-ת]/i.test(name);
}

function findAllBlockStarts(grid: unknown[][]): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (normalizeText(row[c]) === 'מקצוע') out.push({ row: r, col: c });
    }
  }
  return out;
}

function extractClassNameFromTitleCell(raw: unknown): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  const dashIdx = s.indexOf('-');
  if (dashIdx > 0) s = s.slice(0, dashIdx);
  s = s.replace(/\s*\d.*$/, '');
  return s.trim();
}

function toHourNumber(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function extractTeacherFromCell(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  // תא עם כמה מורים — "אושרית/ליאורי", "מלי+ליאורי", "שרית, מדריכה" — נלקח הראשון
  const m = s.match(/^([^/,+]+)/);
  return (m ? m[1] : s).trim();
}

function parseClassBlocksWorkbook(
  wb: XLSX.WorkBook,
  classes: ClassRowLite[],
  teachers: TeacherRowLite[],
): ParsedRowsResult<ClassTeacherImportPayload> {
  // שלב 1: חילוץ כל זוגות (className, teacherName, hour, subject) מהגיליונות
  type Raw = { sheet: string; className: string; teacherName: string; hour: number; subject: string };
  const raws: Raw[] = [];
  const errors: Array<{ rowIdx: number; messages: string[]; sheet?: string }> = [];
  let totalRaw = 0;

  for (const name of wb.SheetNames) {
    if (!isClassSheetName(name)) continue;
    const sheet = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: '', header: 1 });
    const starts = findAllBlockStarts(grid);
    if (starts.length === 0) {
      errors.push({ sheet: name, rowIdx: 0, messages: ['לא נמצאו בלוקי כיתות (תא "מקצוע")'] });
      continue;
    }
    const byCol = new Map<number, number[]>();
    for (const b of starts) {
      const arr = byCol.get(b.col) ?? [];
      arr.push(b.row);
      byCol.set(b.col, arr);
    }
    for (const { row: headerRow, col: startCol } of starts) {
      const rowsInCol = byCol.get(startCol)!;
      const nextHeader = rowsInCol.find((r) => r > headerRow);
      const stopBefore = nextHeader != null ? Math.max(headerRow + 1, nextHeader - 1) : grid.length;

      const titleRow = headerRow > 0 ? (grid[headerRow - 1] || []) : [];
      const titleCell = titleRow[startCol + 2] ?? titleRow[startCol + 1] ?? titleRow[startCol] ?? '';
      const className = extractClassNameFromTitleCell(titleCell);

      // אסוף שורות תוכן של הבלוק לפני שמדווחים שגיאה — בלוק עם כותרת ריקה
      // ובלי שום שורת נתונים הוא בלוק "פנוי" (למשל כיתה שעדיין לא שובצה) ולא
      // צריך להעמיס שגיאה על המשתמש בגללו.
      type BlockRow = { r: number; subject: string; hoursRaw: unknown; teacher: string; hoursStr: string };
      const dataRows: BlockRow[] = [];
      let blank = 0;
      for (let r = headerRow + 1; r < stopBefore; r++) {
        const row = grid[r] || [];
        const subject = String(row[startCol] ?? '').trim();
        const hoursRaw = row[startCol + 1];
        const teacherRawCell = String(row[startCol + 2] ?? '').trim();
        if (!subject && !hoursRaw && !teacherRawCell) {
          if (++blank >= 5) break;
          continue;
        }
        blank = 0;
        const sn = normalizeText(subject);
        if (sn === 'מקצוע' || sn === 'מורה' || sn === 'מס שעות') continue;
        const teacher = extractTeacherFromCell(teacherRawCell);
        const hoursStr = String(hoursRaw ?? '').trim();
        // שורת סיכום של הבלוק היא בד"כ עם hours בלבד (ללא מקצוע וללא מורה),
        // למשל "" / 37 / "" — לא שורת נתונים אמיתית.
        if (!subject && !teacher) continue;
        dataRows.push({ r, subject, hoursRaw, teacher, hoursStr });
      }

      // בלוק "פנוי" — אין שום שורה עם מורה תקין. גם אם יש שורות עם שם
      // מקצוע ("תורה", 4, "") בלי מורה — הן רק תזכורות שלא הושלמו ולא מספיק
      // כדי לדרוש מהמשתמש להזין שם כיתה לבלוק שאיש לא ילמד בו בפועל.
      const hasRealAssignment = dataRows.some((d) => d.teacher && d.hoursStr);
      if (!hasRealAssignment) continue;

      if (!className) {
        errors.push({ sheet: name, rowIdx: headerRow + 1, messages: [`בלוק בעמודה ${startCol + 1}: לא נמצא שם כיתה בכותרת ("${String(titleCell)}")`] });
        continue;
      }

      for (const d of dataRows) {
        totalRaw++;
        if (!d.teacher) continue; // מקצוע ללא מורה משויך — מדלגים בשקט
        if (!d.hoursStr) continue;
        const hours = toHourNumber(d.hoursRaw);
        if (hours <= 0) {
          errors.push({ sheet: name, rowIdx: d.r + 1, messages: [`"${d.subject || '?'} / ${d.teacher}": שעות לא חוקיות (${String(d.hoursRaw)})`] });
          continue;
        }
        raws.push({ sheet: name, className, teacherName: d.teacher, subject: d.subject, hour: hours });
      }
    }
  }

  // שלב 2: איגוד לפי (כיתה, מורה) וסיכום שעות
  const agg = new Map<string, { className: string; teacherName: string; hour: number; subjects: string[]; sheet: string }>();
  for (const r of raws) {
    const k = `${r.className}|||${r.teacherName}`;
    const prev = agg.get(k);
    if (prev) {
      prev.hour += r.hour;
      prev.subjects.push(r.subject);
    } else {
      agg.set(k, { className: r.className, teacherName: r.teacherName, hour: r.hour, subjects: [r.subject], sheet: r.sheet });
    }
  }

  // שלב 3: התאמה לישויות במערכת (תוך שימוש בלוגיקת ההתאמה הקיימת)
  const out: ClassTeacherImportPayload[] = [];
  const missingClasses = new Set<string>();
  const missingTeachers = new Set<string>();
  const missingClassLayers: Record<string, number> = {}; // שם כיתה → LayerId (לפי הגיליון)
  for (const a of agg.values()) {
    const pseudo: Record<string, unknown> = {
      'כיתה': a.className,
      'מורה': a.teacherName,
      'שעות': a.hour,
      'מחנכ/ת': a.className === a.teacherName ? 'כן' : '',
    };
    const res = parseClassTeacherRow(pseudo, 0, classes, teachers, 0);
    if (res.ok && res.payload) {
      out.push(res.payload);
    } else if (res.errors && res.errors.length) {
      for (const m of res.errors) {
        const mc = m.match(/^כיתה "([^"]+)" לא נמצאה במערכת$/);
        if (mc) {
          missingClasses.add(mc[1]);
          // הכיתה שייכת לשכבה של הגיליון שממנו הבלוק נקרא
          const lid = sheetNameToLayerId(a.sheet);
          if (lid != null) missingClassLayers[mc[1]] = lid;
        }
        const mt = m.match(/^מורה "([^"]+)" לא נמצא\/ה במערכת$/);
        if (mt) missingTeachers.add(mt[1]);
      }
      errors.push({
        sheet: a.sheet,
        rowIdx: 0,
        messages: [`"${a.className} / ${a.teacherName}" (${a.hour}ש'): ${res.errors.join(', ')}`],
      });
    }
  }

  return {
    rows: out,
    errors,
    totalRaw,
    actionable: {
      missingClasses: Array.from(missingClasses).sort((a, b) => a.localeCompare(b, 'he')),
      missingTeachers: Array.from(missingTeachers).sort((a, b) => a.localeCompare(b, 'he')),
      missingClassLayers,
    },
  };
}

// ============================================================
// Parser שטוח (גיליון יחיד) — עם איסוף חסרים
// ============================================================
function parseFlatClassTeacherWorkbook(
  wb: XLSX.WorkBook,
  classes: ClassRowLite[],
  teachers: TeacherRowLite[],
): ParsedRowsResult<ClassTeacherImportPayload> {
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const rows: ClassTeacherImportPayload[] = [];
  const errors: Array<{ rowIdx: number; messages: string[]; sheet?: string }> = [];
  const missingClasses = new Set<string>();
  const missingTeachers = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const r = parseClassTeacherRow(raw[i], i + 2, classes, teachers, 0);
    if (r.ok && r.payload) {
      rows.push(r.payload);
    } else if (r.errors && r.errors.length) {
      for (const m of r.errors) {
        const mc = m.match(/^כיתה "([^"]+)" לא נמצאה במערכת$/);
        if (mc) missingClasses.add(mc[1]);
        const mt = m.match(/^מורה "([^"]+)" לא נמצא\/ה במערכת$/);
        if (mt) missingTeachers.add(mt[1]);
      }
      errors.push({ rowIdx: i + 2, messages: r.errors, sheet: sheetName });
    }
  }
  return {
    rows,
    errors,
    totalRaw: raw.length,
    actionable: {
      missingClasses: Array.from(missingClasses).sort((a, b) => a.localeCompare(b, 'he')),
      missingTeachers: Array.from(missingTeachers).sort((a, b) => a.localeCompare(b, 'he')),
    },
  };
}

// ============================================================
// בונה חוברת הורדה לתבנית הרב-גיליונית — דמו של 2 שכבות
// ============================================================
function buildMultiSheetBlocksTemplate(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const makeClassSheet = (header1: [string, string, string], header2: [string, string, string], rows1: Array<[string, number | '', string]>, rows2: Array<[string, number | '', string]>) => {
    // עמודות 0-2 בלוק 1, עמודה 3 מפריד, עמודות 4-6 בלוק 2
    const aoa: unknown[][] = [];
    aoa.push([header1[0], header1[1], header1[2], '', header2[0], header2[1], header2[2]]);
    aoa.push(['מקצוע', 'מס שעות', 'מורה', '', 'מקצוע', 'מס שעות', 'מורה']);
    const maxRows = Math.max(rows1.length, rows2.length);
    for (let i = 0; i < maxRows; i++) {
      const a = rows1[i] ?? ['', '', ''];
      const b = rows2[i] ?? ['', '', ''];
      aoa.push([a[0], a[1] === '' ? '' : a[1], a[2], '', b[0], b[1] === '' ? '' : b[1], b[2]]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 3 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
    return ws;
  };

  XLSX.utils.book_append_sheet(wb, makeClassSheet(
    ['כתה א', 'בנים', 'סימי-22'],
    ['כתה א', 'בנים', 'לירז-23'],
    [['תורה', 6, 'סימי'], ['חשבון', 6, 'סימי'], ['חנ״ג', 2, 'שרית'], ['אומנות', 2, 'גלית']],
    [['תורה', 6, 'לירז'], ['חשבון', 6, 'לירז'], ['חנ״ג', 2, 'שרית'], ['אומנות', 2, 'גלית']],
  ), 'כיתה א');

  XLSX.utils.book_append_sheet(wb, makeClassSheet(
    ['כתה ב', 'בנות', 'אורית-22'],
    ['כתה ב', 'בנות', 'תחיה-22'],
    [['תורה', 6, 'אורית'], ['עברית', 6, 'אורית'], ['חשבון', 6, 'אורית'], ['חנ״ג', 2, 'ערן']],
    [['תורה', 6, 'תחיה'], ['עברית', 6, 'תחיה'], ['חשבון', 6, 'תחיה'], ['חנ״ג', 2, 'ערן']],
  ), 'כיתה ב');

  // גיליון מטריצה — סיכום נוסף, לא חובה אבל מומלץ
  const matrix: unknown[][] = [
    ['כתה', 'לירז', 'סימי', 'אורית', 'אריאל', 'תחיה', 'שרית', 'גלית', 'ערן', 'סה״כ'],
    ['א לירז', 22, '', '', '', '', 2, 2, '', 26],
    ['א סימי', '', 22, '', '', '', 2, 2, '', 26],
    ['ב אורית', '', '', 21, '', '', 2, '', 2, 25],
    ['ב תחיה', '', '', '', '', 22, 2, '', 2, 26],
  ];
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrix);
  wsMatrix['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 7 }];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'פריסת שעות');

  // גיליון הסבר
  const help: string[][] = [
    ['הוראות מילוי תבנית — בלוקי כיתות + מטריצת שעות'],
    [''],
    ['חלק 1 — בלוקי כיתות (גיליונות "כיתה א" עד "כיתה ו"):'],
    ['1. צור גיליון לכל שכבה: "כיתה א", "כיתה ב", "כיתה ג", "כיתה ד", "כיתה ה", "כיתה ו".'],
    ['2. בכל גיליון, צור בלוק לכל כיתה: 3 עמודות (מקצוע | מס שעות | מורה) ועמודה ריקה כמפריד בין בלוקים.'],
    ['3. בשורת הכותרת של הבלוק (השורה שמעל "מקצוע"), כתוב את שם המורה-המחנך בעמודה השלישית (לדוגמה: "אורית-22" או "סימי-23 ה").'],
    ['4. בכל שורה תחת הכותרת הזן מקצוע, מספר שעות, ושם המורה המלמד אותו.'],
    ['5. שעות לכל זוג (כיתה × מורה) מסוכמות יחד גם אם הן בכמה שורות.'],
    [''],
    ['חלק 2 — גיליון מטריצה ("פריסת שעות"):'],
    ['6. שורה 1 = כותרות: עמודה A "כתה", עמודות הבאות = שמות המורים.'],
    ['7. עמודה A = רשימת הכיתות. הפורמט: "<אות שכבה> <שם מחנך/ת>" — למשל "א לירז", "ב אורית".'],
    ['8. כל תא = מספר שעות שהמורה (בעמודה) מלמד/ת בכיתה (בשורה). תאים ריקים = אין הקצאה.'],
    ['9. עמודות "סה״כ" / "חוסרים" וכו\' — יידלגו אוטומטית.'],
    [''],
    ['10. שמות הכיתות והמורים חייבים להיות זהים לרשימות שמופיעות במערכת.'],
    ['11. אם יש זוג (כיתה × מורה) שמופיע גם בבלוקים וגם במטריצה — הבלוקים גוברים.'],
    ['12. אפשר להשתמש רק במטריצה (בלי בלוקים) או רק בבלוקים (בלי מטריצה).'],
  ];
  const wsHelp = XLSX.utils.aoa_to_sheet(help);
  wsHelp['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsHelp, 'הסברים');

  return wb;
}

// ============================================================
// תצוגות previewSheet — דוגמה ויזואלית של איך הקובץ נראה
// ============================================================

const FLAT_PREVIEW_SHEET: ExcelPreviewSheet = {
  sheetName: 'נתונים',
  cells: [
    ['כיתה', 'מורה', 'שעות', 'מחנכ/ת'],
    ['רויטל', 'רויטל אוטמזגין', 23, 'כן'],
    ['רויטל', 'מאור חקלאות', 1, 'לא'],
    ['אושרית', 'אושרית קבלה', 22, 'כן'],
    ['אושרית', 'שרה לוי', 2, 'לא'],
  ],
  headerRows: [0],
};

const MULTISHEET_BLOCKS_PREVIEW: ExcelPreviewSheet[] = [
  {
    sheetName: 'כיתה א',
    cells: [
      ['כתה א', 'בנים', 'סימי-22', '', 'כתה א', 'בנים', 'לירז-23'],
      ['מקצוע', 'מס שעות', 'מורה', '', 'מקצוע', 'מס שעות', 'מורה'],
      ['תורה', 6, 'סימי', '', 'תורה', 6, 'לירז'],
      ['חשבון', 6, 'סימי', '', 'חשבון', 6, 'לירז'],
      ['חנ״ג', 2, 'שרית', '', 'חנ״ג', 2, 'שרית'],
      ['אומנות', 2, 'גלית', '', 'אומנות', 2, 'גלית'],
    ],
    titleRows: [0],
    headerRows: [1],
    narrowCols: [3],
  },
  {
    sheetName: 'כיתה ב',
    cells: [
      ['כתה ב', 'בנות', 'אורית-22', '', 'כתה ב', 'בנות', 'תחיה-22'],
      ['מקצוע', 'מס שעות', 'מורה', '', 'מקצוע', 'מס שעות', 'מורה'],
      ['תורה', 6, 'אורית', '', 'תורה', 6, 'תחיה'],
      ['עברית', 6, 'אורית', '', 'עברית', 6, 'תחיה'],
      ['חשבון', 6, 'אורית', '', 'חשבון', 6, 'תחיה'],
      ['חנ״ג', 2, 'ערן', '', 'חנ״ג', 2, 'ערן'],
    ],
    titleRows: [0],
    headerRows: [1],
    narrowCols: [3],
  },
  {
    sheetName: 'פריסת שעות',
    cells: [
      ['כתה', 'לירז', 'סימי', 'אורית', 'אריאל', 'שרית', 'גלית', 'סה״כ'],
      ['א לירז', 22, '', '', '', 2, 2, 26],
      ['א סימי', '', 22, '', '', 2, 2, 26],
      ['ב אורית', '', '', 21, '', 2, 2, 25],
      ['ב אריאל', '', '', '', 22, 2, 2, 26],
    ],
    headerRows: [0],
  },
];

// ============================================================
// Parser מאוחד לתבנית רב-גיליונית — בלוקים + מטריצה
//   - אם יש בלוקי כיתות → קרא מהם (הם המקור המהימן).
//   - אם אין → קרא מהמטריצה.
//   - לא קוראים משניהם כדי למנוע כפילות (אותו מידע, אופנים שונים).
// ============================================================
function parseMultiSheetCombined(
  wb: XLSX.WorkBook,
  classes: ClassRowLite[],
  teachers: TeacherRowLite[],
): ParsedRowsResult<ClassTeacherImportPayload> {
  const hasBlocks = wb.SheetNames.some(isClassSheetName);
  if (hasBlocks) {
    // הבלוקים הם המקור היחיד והמהימן: שורת הסיכום שלהם ("סה"כ 37") היא הסך
    // הרשמי של הכיתה לפי הקובץ. גיליונות מטריצה לעיתים מציגים את אותו סך
    // עם פירוט-מורים שונה (למשל לירז במטריצה=22 אבל בבלוק=24, ויש מורים
    // נוספים במטריצה שמכסים את ההפרש) — שילוב של שניהם גורם לעודף שעות
    // ולסטייה מהסיכום שהקובץ עצמו מצהיר עליו. לכן: אם הקובץ כולל בלוקים,
    // המטריצה תיקרא רק לאיתור כיתות חדשות שיש להוסיף, ולא לזוגות שיבוץ.
    return parseClassBlocksWorkbook(wb, classes, teachers);
  }
  // אין בלוקי כיתות — קרא רק מהמטריצה
  return parseMatrixWorkbook(wb, classes, teachers);
}

// ============================================================
// Parser למטריצת שעות (שורה=כיתה, עמודה=מורה, תא=שעות)
// ============================================================
function parseMatrixWorkbook(
  wb: XLSX.WorkBook,
  classes: ClassRowLite[],
  teachers: TeacherRowLite[],
): ParsedRowsResult<ClassTeacherImportPayload> {
  const errors: Array<{ rowIdx: number; messages: string[]; sheet?: string }> = [];
  let totalRaw = 0;
  type Raw = { sheet: string; className: string; teacherName: string; hour: number; grade: string };
  const raws: Raw[] = [];

  // עמודות/שורות שיש לדלג עליהן (סיכומים והערות)
  const skipHeaders = new Set(['סה״כ', 'סהכ', 'סה"כ', 'סהכל', 'חוסרים', 'הערות', 'מילוי', 'סטטוס']);
  const skipClassNames = new Set(['סה״כ', 'סהכ', 'סה"כ', 'סהכל', 'סך הכל', 'סיכום', 'חוסרים']);

  // אם יש מספר גיליונות מטריצה, נטעין רק את הראשון — כדי למנוע כפילויות.
  let alreadyParsedMatrix = false;

  for (const sheetName of wb.SheetNames) {
    if (alreadyParsedMatrix) break;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { defval: '', header: 1 });
    // אתר את שורת הכותרת — זו שמתחילה ב"כתה"/"כיתה" בעמודה הראשונה
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(grid.length, 5); r++) {
      const first = normalizeText((grid[r] || [])[0]);
      if (first === 'כתה' || first === 'כיתה') {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx < 0) continue;
    alreadyParsedMatrix = true;

    const header = (grid[headerRowIdx] || []) as unknown[];
    // בנה מיפוי עמודה → שם מורה (דלג על עמודה 0 ועל "סה"כ" וכו')
    const colTeacher: Array<{ col: number; teacher: string }> = [];
    for (let c = 1; c < header.length; c++) {
      const raw = normalizeText(header[c]);
      if (!raw) continue;
      if (skipHeaders.has(raw)) continue;
      colTeacher.push({ col: c, teacher: extractTeacherFromCell(header[c]) });
    }
    if (colTeacher.length === 0) continue;

    for (let r = headerRowIdx + 1; r < grid.length; r++) {
      const row = grid[r] || [];
      const classRaw = String(row[0] ?? '').trim();
      if (!classRaw) continue;
      // דלג על שורות סיכום ("סה"כ" וכדומה)
      if (skipClassNames.has(normalizeText(classRaw))) continue;
      // שם הכיתה מ"א לירז" → "לירז" (החלק אחרי הרווח), או כל המחרוזת אם אין רווח
      const parts = classRaw.split(/\s+/);
      const className = parts.length >= 2 ? parts.slice(1).join(' ') : classRaw;
      const grade = parts.length >= 2 ? parts[0] : ''; // אות השכבה ("א".."ו")

      for (const { col, teacher } of colTeacher) {
        const v = row[col];
        const s = String(v ?? '').trim();
        if (!s) continue;
        const hours = toHourNumber(v);
        totalRaw++;
        if (hours <= 0) {
          errors.push({ sheet: sheetName, rowIdx: r + 1, messages: [`"${className} / ${teacher}": שעות לא חוקיות (${s})`] });
          continue;
        }
        raws.push({ sheet: sheetName, className, teacherName: teacher, hour: hours, grade });
      }
    }
  }

  // איגוד לפי (class, teacher) - אם אותו זוג מופיע בכמה גיליונות, נסכם
  const agg = new Map<string, { className: string; teacherName: string; hour: number; sheet: string; grade: string }>();
  for (const r of raws) {
    const k = `${r.className}|||${r.teacherName}`;
    const prev = agg.get(k);
    if (prev) prev.hour += r.hour;
    else agg.set(k, { className: r.className, teacherName: r.teacherName, hour: r.hour, sheet: r.sheet, grade: r.grade });
  }

  const out: ClassTeacherImportPayload[] = [];
  const missingClasses = new Set<string>();
  const missingTeachers = new Set<string>();
  const missingClassLayers: Record<string, number> = {}; // שם כיתה → LayerId (לפי אות השכבה)
  for (const a of agg.values()) {
    const pseudo: Record<string, unknown> = {
      'כיתה': a.className,
      'מורה': a.teacherName,
      'שעות': a.hour,
      'מחנכ/ת': a.className === a.teacherName ? 'כן' : '',
    };
    const res = parseClassTeacherRow(pseudo, 0, classes, teachers, 0);
    if (res.ok && res.payload) {
      out.push(res.payload);
    } else if (res.errors && res.errors.length) {
      for (const m of res.errors) {
        const mc = m.match(/^כיתה "([^"]+)" לא נמצאה במערכת$/);
        if (mc) {
          missingClasses.add(mc[1]);
          const gi = 'אבגדהו'.indexOf(a.grade);
          if (gi >= 0) missingClassLayers[mc[1]] = gi + 1;
        }
        const mt = m.match(/^מורה "([^"]+)" לא נמצא\/ה במערכת$/);
        if (mt) missingTeachers.add(mt[1]);
      }
      errors.push({
        sheet: a.sheet,
        rowIdx: 0,
        messages: [`"${a.className} / ${a.teacherName}" (${a.hour}ש'): ${res.errors.join(', ')}`],
      });
    }
  }

  return {
    rows: out,
    errors,
    totalRaw,
    actionable: {
      missingClasses: Array.from(missingClasses).sort((a, b) => a.localeCompare(b, 'he')),
      missingTeachers: Array.from(missingTeachers).sort((a, b) => a.localeCompare(b, 'he')),
      missingClassLayers,
    },
  };
}

