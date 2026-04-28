import { useCallback, useEffect, useRef, useState } from 'react';
import { ajax } from '../../api/client';
import { useToast } from '../../lib/toast';
import ExportButtons from '../../lib/ExportButtons';
import { buildExportHandlers } from '../../lib/export';

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
  const [initialLoading, setInitialLoading] = useState(true);
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

  // class modal
  const [showClassModal, setShowClassModal] = useState(false);
  const [classModalMode, setClassModalMode] = useState<1 | 2>(1); // 1=new,2=edit
  const [classForm, setClassForm] = useState<{ ClassId: number | ''; ClassName: string; Seq: string }>({
    ClassId: '',
    ClassName: '',
    Seq: '',
  });
  const [classModalTitle, setClassModalTitle] = useState('');

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
    ihud?: string | null;
    classTeacherId?: number | null;
  } | null>(null);

  // ---------- group (hakbatza / ihud) edit modal ----------
  const [groupModal, setGroupModal] = useState<{
    classId: number;
    className: string;
    // All ClassTeacherIds that currently share this pill (hakbatza members)
    memberClassTeacherIds: number[];
    teacherNames: string; // for display
    currentHakbatza: number;
    currentIhud: number;
  } | null>(null);
  const [groupKind, setGroupKind] = useState<'none' | 'hakbatza' | 'ihud'>('none');
  const [groupNumber, setGroupNumber] = useState<string>('');
  const [groupBusy, setGroupBusy] = useState(false);

  // Create-group wizard state. Single-step: pick classes, click create.
  // The hakbatza is created empty and teachers are added afterwards by
  // dragging them onto the hakbatza card.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSelectedClasses, setWizardSelectedClasses] = useState<Set<number>>(new Set());
  const [wizardName, setWizardName] = useState<string>('');
  const [wizardBusy, setWizardBusy] = useState(false);

  // Ihud wizard: similar to Hakbatza wizard but also requires picking
  // a single responsible teacher. The Ihud is materialised with the
  // teacher already attached.
  const [ihudWizardOpen, setIhudWizardOpen] = useState(false);
  const [ihudWizardClasses, setIhudWizardClasses] = useState<Set<number>>(new Set());
  const [ihudWizardTeacher, setIhudWizardTeacher] = useState<number | null>(null);
  const [ihudWizardName, setIhudWizardName] = useState<string>('');
  const [ihudWizardBusy, setIhudWizardBusy] = useState(false);

  function openWizard() {
    setWizardOpen(true);
    setWizardSelectedClasses(new Set());
    setWizardName('');
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

  function openIhudWizard() {
    setIhudWizardOpen(true);
    setIhudWizardClasses(new Set());
    setIhudWizardTeacher(null);
    setIhudWizardName('');
  }
  function closeIhudWizard() {
    if (ihudWizardBusy) return;
    setIhudWizardOpen(false);
  }
  function toggleIhudWizardClass(classId: number) {
    setIhudWizardClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  async function setGroupName(kind: 'H' | 'I', layerIdArg: number, number: number, name: string) {
    try {
      await ajax('Group_SetName', {
        LayerId: String(layerIdArg),
        Number: String(number),
        Kind: kind,
        Name: name,
      });
      if (kind === 'H') loadHakbatzaList();
      else loadIhudList();
    } catch (err) {
      console.error('Group_SetName failed', err);
      toast.error('שמירת שם נכשלה');
    }
  }

  async function saveIhudWizard() {
    if (!ihudWizardOpen || ihudWizardBusy) return;
    const selected = Array.from(ihudWizardClasses);
    if (selected.length < 2) {
      toast.warning('צריך לבחור לפחות 2 כיתות לאיחוד');
      return;
    }
    if (!ihudWizardTeacher) {
      toast.warning('צריך לבחור מורה אחראי');
      return;
    }

    setIhudWizardBusy(true);
    try {
      const res = await ajax<{ Number?: number; Error?: string }>('Ihud_Create', {
        LayerId: String(layerId),
        ClassIds: selected.join(','),
        TeacherId: String(ihudWizardTeacher),
        Name: ihudWizardName.trim(),
      });
      if (res?.Error) {
        toast.error('יצירת האיחוד נכשלה: ' + res.Error);
        return;
      }
      const n = Number(res?.Number ?? 0);
      toast.success(`איחוד ${n} נוצר עם ${selected.length} כיתות.`);
      setIhudWizardOpen(false);
      loadIhudList();
      loadClasses(layerId);
    } catch (err) {
      console.error('Ihud_Create failed', err);
      toast.error('יצירת האיחוד נכשלה');
    } finally {
      setIhudWizardBusy(false);
    }
  }

  async function saveWizard() {
    if (!wizardOpen || wizardBusy) return;
    const selected = Array.from(wizardSelectedClasses);
    if (selected.length < 2) {
      toast.warning('צריך לבחור לפחות 2 כיתות בהקבצה');
      return;
    }

    setWizardBusy(true);
    try {
      const res = await ajax<{ Number?: number; Error?: string }>('Hakbatza_Create', {
        LayerId: String(layerId),
        ClassIds: selected.join(','),
        Name: wizardName.trim(),
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
  }
  interface IhudRow {
    ClassTeacherId: number;
    Ihud: number;
    ClassId: number;
    ClassName: string;
    LayerId: number;
    TeacherId: number;
    TeacherName: string;
    Hour: number;
    Name?: string;
  }
  const [hakbatzaRows, setHakbatzaRows] = useState<HakbatzaRow[]>([]);
  const [ihudRows, setIhudRows] = useState<IhudRow[]>([]);
  const [maxHours, setMaxHours] = useState<number>(0);
  const loadHakbatzaList = useCallback(async () => {
    try {
      const data = await ajax<HakbatzaRow[]>('Hakbatza_GetAll');
      setHakbatzaRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Hakbatza_GetAll failed', err);
    }
  }, []);
  const loadIhudList = useCallback(async () => {
    try {
      const data = await ajax<IhudRow[]>('Ihud_GetAll');
      setIhudRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Ihud_GetAll failed', err);
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
    loadIhudList();
    loadMaxHours();
  }, [loadHakbatzaList, loadIhudList, loadMaxHours]);

  // Tracks which (layer, number) pair is the active drop target so we can
  // highlight it during a drag.
  const [dragHoverHak, setDragHoverHak] = useState<string | null>(null);
  const [dragHoverIhud, setDragHoverIhud] = useState<string | null>(null);

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

  async function setIhudTeacher(layerIdArg: number, number: number, teacherId: number) {
    try {
      const res = await ajax<{ res?: number; Error?: string }>('Ihud_SetTeacher', {
        LayerId: String(layerIdArg),
        Number: String(number),
        TeacherId: String(teacherId),
      });
      if (res?.Error) {
        toast.error('עדכון מורה נכשל: ' + res.Error);
        return;
      }
      toast.success('המורה האחראי עודכן');
      loadIhudList();
      loadClasses(layerId);
    } catch (err) {
      console.error('Ihud_SetTeacher failed', err);
      toast.error('עדכון מורה אחראי נכשל');
    }
  }

  async function setIhudHour(layerIdArg: number, number: number, hour: number) {
    try {
      await ajax('Ihud_SetHour', {
        LayerId: String(layerIdArg),
        Number: String(number),
        Hour: String(hour),
      });
      loadIhudList();
      loadClasses(layerId);
    } catch (err) {
      console.error('Ihud_SetHour failed', err);
      toast.error('עדכון שעות איחוד נכשל');
    }
  }

  async function deleteIhud(layerIdArg: number, number: number) {
    try {
      await ajax('Ihud_Delete', {
        LayerId: String(layerIdArg),
        Number: String(number),
      });
      toast.success(`איחוד ${number} נמחק`);
      loadIhudList();
      loadClasses(layerId);
    } catch (err) {
      console.error('Ihud_Delete failed', err);
      toast.error('מחיקת האיחוד נכשלה');
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

  const loadTeachers = useCallback(async () => {
    try {
      const data = await ajax<TeacherRow[]>('Teacher_GetTeacherList', { TeacherId: -99 });
      setTeachers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Teacher_GetTeacherList failed', err);
      setTeachers([]);
    }
  }, []);

  const loadClasses = useCallback(async (layer: number) => {
    try {
      const data = await ajax<ClassRow[]>('Class_GetClassByLayerId', { LayerId: layer });
      setClasses(Array.isArray(data) ? data : []);
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
    setClassForm({ ClassId: classId, ClassName: className, Seq: String(seq ?? '') });
    setClassModalTitle(mode === 1 ? 'כיתה חדשה' : className);
    setShowClassModal(true);
  }

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
    try {
      await ajax('Class_SetClassData', {
        ClassId: classId,
        LayerId: layerId,
        ClassName: mode === 3 ? '' : classForm.ClassName,
        Seq: mode === 3 ? '' : classForm.Seq,
        mode,
      });
      setShowClassModal(false);
      loadClasses(layerId);
    } catch (err) {
      console.error('Class_SetClassData failed', err);
      toast.error('שגיאה בשמירת הכיתה');
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
    row: { TeacherId: number; ClassId: number; Hakbatza: string | null; Ihud: string | null; ClassTeacherId: number | null }
  ) {
    dragInfo.current = {
      sourceType: 'teacherInClass',
      teacherId: row.TeacherId,
      classId: row.ClassId,
      hakbatza: row.Hakbatza,
      ihud: row.Ihud,
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

  // Drop on a class panel (target = class)
  async function onDropOnClass(
    e: React.DragEvent,
    targetClassId: number,
    targetHakbatza: string = '',
    targetIhud: string = '',
    targetClassTeacherId: number | string = ''
  ) {
    e.preventDefault();
    e.stopPropagation();
    const info = dragInfo.current;
    if (!info) return;
    dragInfo.current = null;

    let type: 1 | 2 | 3 = 1; // 1 insert from empty, 3 to hakbatza, 2 ihud
    let sourceTeacherId = info.teacherId;
    let effectiveTargetHakbatza = targetHakbatza;
    const effectiveSourceHakbatza = info.hakbatza ?? '';
    const effectiveSourceIhud = info.ihud ?? '';
    const effectiveSourceClassTeacherId = info.classTeacherId ?? '';

    // hakbatza target (drop into an existing dv_CLASSID_TEACHERID slot)
    if (targetClassTeacherId && String(targetClassTeacherId) !== '') {
      if (String(sourceTeacherId) === String(targetClassTeacherId)) return;
      type = 3;
    }

    // ihud: moving a teacher-in-class to a different class
    if (info.sourceType === 'teacherInClass') {
      // Source already belongs to a class; dragging to another class is an ihud (type 2)
      if (info.classId === targetClassId && String(effectiveSourceHakbatza) === String(targetHakbatza)) {
        return;
      }
      effectiveTargetHakbatza = String(info.classId ?? '');
      type = 2;
    }

    try {
      const res = await ajax<DmlResult[]>('Class_SetTeacherToClass', {
        ClassId: targetClassId,
        TeacherId: sourceTeacherId,
        Hour: '',
        TargetHakbatza: effectiveTargetHakbatza,
        SourceHakbatza: effectiveSourceHakbatza,
        TargetIhud: targetIhud,
        SourceIhud: effectiveSourceIhud,
        TargetClassTeacherId: targetClassTeacherId,
        SourceClassTeacherId: effectiveSourceClassTeacherId,
        Type: type,
      });
      if (res && res[0] && res[0].res === 0) {
        loadClasses(layerId);
      }
    } catch (err) {
      console.error('Class_SetTeacherToClass failed', err);
    }
  }

  // Drop on teacher panel (delete when source is teacherInClass)
  async function onDropOnTeacherPanel(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
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
        SourceIhud: info.ihud ?? '',
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
    const hPalette = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#ddd6fe', '#a7f3d0', '#fecaca'];
    const iPalette = ['#c4b5fd', '#67e8f9', '#fcd34d', '#f9a8d4', '#86efac', '#fca5a5', '#93c5fd', '#fdba74'];
    const palette = kind === 'H' ? hPalette : iPalette;
    const color = palette[(n - 1) % palette.length];
    return { bg: color, fg: '#1f2937' };
  }

  function openGroupModal(
    classId: number,
    className: string,
    memberIds: number[],
    teacherNames: string,
    hakbatza: number,
    ihud: number,
  ) {
    setGroupModal({
      classId,
      className,
      memberClassTeacherIds: memberIds,
      teacherNames,
      currentHakbatza: hakbatza,
      currentIhud: ihud,
    });
    if (ihud > 0) {
      setGroupKind('ihud');
      setGroupNumber(String(ihud));
    } else if (hakbatza > 0) {
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
      let ihudVal = 0;
      if (groupKind === 'hakbatza') {
        hakVal = Number(groupNumber) || 0;
        if (hakVal <= 0) {
          toast.warning('יש להזין מספר הקבצה תקין (>0)');
          setGroupBusy(false);
          return;
        }
      } else if (groupKind === 'ihud') {
        ihudVal = Number(groupNumber) || 0;
        if (ihudVal <= 0) {
          toast.warning('יש להזין מספר איחוד תקין (>0)');
          setGroupBusy(false);
          return;
        }
      }
      for (const ctId of groupModal.memberClassTeacherIds) {
        await ajax<DmlResult[]>('Class_SetGroupNumber', {
          ClassTeacherId: ctId,
          Hakbatza: hakVal,
          Ihud: ihudVal,
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
  interface GroupSummary {
    kind: 'H' | 'I';
    number: number;
    members: Array<{ classId: number; className: string; teacherName: string }>;
  }
  function buildGroupsSummary(): GroupSummary[] {
    const map = new Map<string, GroupSummary>();
    for (const r of classes) {
      const hak = Number(r.Hakbatza ?? 0);
      const ihud = Number(r.Ihud ?? 0);
      if (!r.TeacherId) continue;
      if (ihud > 0) {
        const key = 'I_' + ihud;
        const entry = map.get(key) ?? { kind: 'I' as const, number: ihud, members: [] };
        entry.members.push({ classId: r.ClassId, className: r.ClassName, teacherName: r.TeacherName });
        map.set(key, entry);
      }
      if (hak > 0) {
        const key = 'H_' + r.ClassId + '_' + hak;
        const entry = map.get(key) ?? { kind: 'H' as const, number: hak, members: [] };
        entry.members.push({ classId: r.ClassId, className: r.ClassName, teacherName: r.TeacherName });
        map.set(key, entry);
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'I' ? -1 : 1;
      return a.number - b.number;
    });
  }

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

    // 1) Check class-level overflow (sum of hours for this class > maxHours)
    if (maxHours > 0) {
      let projected = 0;
      let foundOldRow = false;
      for (const r of classes) {
        if (r.ClassId !== classId) continue;
        if (r.ClassTeacherId != null && classTeacherId != null && Number(r.ClassTeacherId) === Number(classTeacherId)) {
          projected += newHour;
          foundOldRow = true;
        } else {
          projected += Number(r.Hour ?? 0);
        }
      }
      if (!foundOldRow) projected += newHour;
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
  function computeRealHours(classId: number): number {
    let total = 0;
    const seenHak = new Set<string>();
    const seenIhud = new Set<string>();
    for (const r of classes) {
      if (r.ClassId !== classId) continue;
      if (r.ClassTeacherId == null || Number(r.ClassTeacherId) <= 0) continue;
      const hak = Number(r.Hakbatza ?? 0);
      const ihud = Number(r.Ihud ?? 0);
      const hr = Number(r.Hour ?? 0);
      if (hak > 0) {
        const key = classId + '_H_' + hak;
        if (!seenHak.has(key)) {
          seenHak.add(key);
          total += hr;
        }
      } else if (ihud > 0) {
        const key = classId + '_I_' + ihud;
        if (!seenIhud.has(key)) {
          seenIhud.add(key);
          total += hr;
        }
      } else {
        total += hr;
      }
    }
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
    const hakBuckets = new Map<string, { classId: number; number: number; teachers: Map<number, string>; hour: number; name: string }>();
    for (const r of classes) {
      const hak = Number(r.Hakbatza ?? 0);
      if (!hak) continue;
      const key = r.ClassId + '_H_' + hak;
      let b = hakBuckets.get(key);
      if (!b) {
        b = { classId: r.ClassId, number: hak, teachers: new Map(), hour: Number(r.Hour ?? 0), name: '' };
        hakBuckets.set(key, b);
      }
      if (r.TeacherId != null && Number(r.TeacherId) > 0) {
        b.teachers.set(Number(r.TeacherId), r.TeacherName ?? '');
      }
      if (Number(r.Hour ?? 0) > b.hour) b.hour = Number(r.Hour);
    }
    // Pull friendly names from hakbatzaRows
    for (const r of hakbatzaRows) {
      if (Number(r.LayerId) !== Number(layerId)) continue;
      const key = r.ClassId + '_H_' + r.Hakbatza;
      const b = hakBuckets.get(key);
      if (b && r.Name) b.name = r.Name;
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
    let cur: { tafkidId: number | string; teachers: TeacherRow[] } | null = null;
    for (const t of teachers) {
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
        <div className="row dvWeek">
          <div className="panel panel-info">
            <div className="panel-heading tc-layer-bar">
              <div className="tc-layer-tabs" role="tablist" aria-label="בחירת שכבה">
                {LAYERS.map((layer) => (
                  <label
                    className={`tc-layer-tab${layerId === layer.id ? ' is-active' : ''}`}
                    key={layer.id}
                  >
                    <input
                      type="radio"
                      name="layer"
                      value={layer.id}
                      checked={layerId === layer.id}
                      onChange={() => setLayerId(layer.id)}
                    />
                    <span>{layer.label}</span>
                  </label>
                ))}
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
                className="btn btn-success btn-sm tc-add-class"
                style={{ marginInlineStart: 6 }}
                onClick={openWizard}
                title="צור הקבצה חדשה — בחר כיתות בשכבה ומורים שילמדו באותה שעה כקבוצות רמה"
              >
                <i className="fa fa-object-group" /> הקבצה חדשה
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm tc-add-class"
                style={{ marginInlineStart: 6 }}
                onClick={openIhudWizard}
                title="צור איחוד — בחר כיתות בשכבה ומורה אחראי שילמד את כולן באותה שעה"
              >
                <i className="fa fa-link" /> איחוד חדש
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
                };
                const hakBuckets = new Map<string, HakBucket>();
                for (const r of hakbatzaRows) {
                  if (Number(r.LayerId) !== Number(layerId)) continue;
                  const key = r.LayerId + '_' + r.Hakbatza;
                  let b = hakBuckets.get(key);
                  if (!b) {
                    b = { layerId: r.LayerId, number: r.Hakbatza, name: r.Name ?? '', classes: new Map(), teachers: new Map(), hour: 0 };
                    hakBuckets.set(key, b);
                  } else if (!b.name && r.Name) {
                    b.name = r.Name;
                  }
                  b.classes.set(r.ClassId, r.ClassName);
                  if (r.TeacherId > 0) b.teachers.set(r.TeacherId, r.TeacherName);
                }
                // Hakbatza row hours come from the underlying ClassTeacher.Hour
                // — we read it back from `classes` (the source of truth that
                // also drives ClassCountHour).
                for (const r of classes) {
                  const hak = Number(r.Hakbatza ?? 0);
                  if (!hak) continue;
                  const key = layerId + '_' + hak;
                  const b = hakBuckets.get(key);
                  if (b && Number(r.Hour ?? 0) > 0) b.hour = Number(r.Hour);
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
                        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700, marginBottom: 6, paddingInlineStart: 4 }}>
                          <i className="fa fa-object-group" style={{ marginInlineEnd: 4 }} /> הקבצות ואיחודים
                        </div>
                        <div className="tc-grid-4">
                          {/* Hakbatza cards — same panel shape as class cards */}
                          {hakList.map((b) => {
                            const col = groupColor('H', b.number);
                            const isHover = dragHoverHak === (b.layerId + '_' + b.number);
                            const classList = Array.from(b.classes.values());
                            return (
                              <div className="tc-grid-4__cell" key={'hak_' + b.layerId + '_' + b.number}>
                          <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 4, marginBottom: 2 }}>
                            <span>
                              <i className="fa fa-object-group" style={{ color: '#d97706', marginInlineEnd: 4 }} />
                              שעות שבועיות
                            </span>
                            <input
                              type="number"
                              min={0}
                              defaultValue={b.hour}
                              onBlur={(e) => {
                                const v = Math.max(0, Math.floor(Number(e.currentTarget.value) || 0));
                                if (v !== b.hour) setHakbatzaHour(b.layerId, b.number, v);
                              }}
                              style={{ width: 48, padding: '1px 4px', fontWeight: 700, textAlign: 'center', border: '1px solid #d97706', borderRadius: 3, background: '#fff' }}
                            />
                          </div>
                          <div className="row dvWeek" style={{ width: '100%' }}>
                            <div className="panel" style={{ borderColor: col.bg, borderTopWidth: 4 }}>
                              <div className="panel-heading" style={{ background: col.bg, color: col.fg, borderColor: col.bg, padding: '0.45rem 0.6rem' }}>
                                <button
                                  type="button"
                                  className="tc-class-close"
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
                                <h3 className="panel-title" style={{ color: col.fg, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span className="tc-class-name" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>{b.name || `הקבצה ${b.number}`}</span>
                                  <input
                                    type="text"
                                    placeholder={`הקבצה ${b.number} — תן שם`}
                                    defaultValue={b.name || ''}
                                    onBlur={(e) => {
                                      const v = e.currentTarget.value.trim();
                                      if (v !== (b.name || '')) setGroupName('H', b.layerId, b.number, v);
                                    }}
                                    title="לחץ לשינוי שם ההקבצה"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      background: 'rgba(255,255,255,0.55)',
                                      border: '1px solid rgba(0,0,0,0.08)',
                                      borderRadius: 4,
                                      padding: '1px 6px',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: '#1f2937',
                                    }}
                                  />
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                  {classList.length === 0 ? (
                                    <span style={{ fontSize: 11, opacity: 0.7 }}>—</span>
                                  ) : (
                                    classList.map((cn) => (
                                      <span
                                        key={cn}
                                        style={{
                                          background: 'rgba(255,255,255,0.65)',
                                          color: '#1f2937',
                                          padding: '1px 7px',
                                          borderRadius: 10,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          lineHeight: 1.5,
                                          border: '1px solid rgba(0,0,0,0.05)',
                                        }}
                                      >
                                        {cn}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div
                                className="panel-body droppable"
                                style={{
                                  minHeight: 110,
                                  padding: '0.5rem',
                                  background: isHover ? '#fff7ed' : undefined,
                                  border: isHover ? '2px dashed #d97706' : undefined,
                                  transition: 'background 120ms',
                                }}
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
                                {b.teachers.size === 0 ? (
                                  <div style={{ padding: 8, color: '#9ca3af', fontStyle: 'italic', fontSize: 11, textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: 6 }}>
                                    גרור מורים לכאן
                                  </div>
                                ) : (
                                  Array.from(b.teachers.entries()).map(([tid, tname]) => (
                                    <div
                                      key={tid}
                                      className="draggable"
                                      style={{ marginBottom: 3, position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                      <div
                                        className="btn btn-primary btn-round"
                                        style={{ flex: 1, textAlign: 'center', background: col.bg, color: col.fg, borderColor: col.fg + '40', padding: '4px 8px', fontSize: 12 }}
                                      >
                                        {tname}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeTeacherFromHakbatza(b.layerId, b.number, tid)}
                                        title="הסר מההקבצה"
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: '#dc2626', padding: '0 4px' }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Ihud cards — single responsible teacher */}
                    {ihudList.map((b) => {
                      const col = groupColor('I', b.number);
                      const isHover = dragHoverIhud === (b.layerId + '_' + b.number);
                      const classList = Array.from(b.classes.values());
                      return (
                        <div className="tc-grid-4__cell" key={'ihud_' + b.layerId + '_' + b.number}>
                          <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 4, marginBottom: 2 }}>
                            <span>
                              <i className="fa fa-link" style={{ color: '#7c3aed', marginInlineEnd: 4 }} />
                              שעות שבועיות
                            </span>
                            <input
                              type="number"
                              min={0}
                              defaultValue={b.hour}
                              onBlur={(e) => {
                                const v = Math.max(0, Math.floor(Number(e.currentTarget.value) || 0));
                                if (v !== b.hour) setIhudHour(b.layerId, b.number, v);
                              }}
                              style={{ width: 48, padding: '1px 4px', fontWeight: 700, textAlign: 'center', border: '1px solid #7c3aed', borderRadius: 3, background: '#fff' }}
                            />
                          </div>
                          <div className="row dvWeek" style={{ width: '100%' }}>
                            <div className="panel" style={{ borderColor: col.bg, borderTopWidth: 4 }}>
                              <div className="panel-heading" style={{ background: col.bg, color: col.fg, borderColor: col.bg, padding: '0.45rem 0.6rem' }}>
                                <button
                                  type="button"
                                  className="tc-class-close"
                                  onClick={() => setConfirmDeleteGroup({
                                    kind: 'I',
                                    layerId: b.layerId,
                                    number: b.number,
                                    label: b.name || `איחוד ${b.number}`,
                                  })}
                                  title="מחק איחוד"
                                  aria-label="מחק איחוד"
                                >
                                  <i className="fa fa-times" />
                                </button>
                                <h3 className="panel-title" style={{ color: col.fg, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span className="tc-class-name" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>{b.name || `איחוד ${b.number}`}</span>
                                  <input
                                    type="text"
                                    placeholder={`איחוד ${b.number} — תן שם`}
                                    defaultValue={b.name || ''}
                                    onBlur={(e) => {
                                      const v = e.currentTarget.value.trim();
                                      if (v !== (b.name || '')) setGroupName('I', b.layerId, b.number, v);
                                    }}
                                    title="לחץ לשינוי שם האיחוד"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      background: 'rgba(255,255,255,0.55)',
                                      border: '1px solid rgba(0,0,0,0.08)',
                                      borderRadius: 4,
                                      padding: '1px 6px',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: '#1f2937',
                                    }}
                                  />
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                  {classList.length === 0 ? (
                                    <span style={{ fontSize: 11, opacity: 0.7 }}>—</span>
                                  ) : (
                                    classList.map((cn) => (
                                      <span
                                        key={cn}
                                        style={{
                                          background: 'rgba(255,255,255,0.65)',
                                          color: '#1f2937',
                                          padding: '1px 7px',
                                          borderRadius: 10,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          lineHeight: 1.5,
                                          border: '1px solid rgba(0,0,0,0.05)',
                                        }}
                                      >
                                        {cn}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div
                                className="panel-body droppable"
                                style={{
                                  minHeight: 90,
                                  padding: '0.5rem',
                                  background: isHover ? '#f5f3ff' : undefined,
                                  border: isHover ? '2px dashed #7c3aed' : undefined,
                                  transition: 'background 120ms',
                                }}
                                onDragOver={(e) => {
                                  allowDrop(e);
                                  const key = b.layerId + '_' + b.number;
                                  if (dragHoverIhud !== key) setDragHoverIhud(key);
                                }}
                                onDragLeave={() => setDragHoverIhud(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDragHoverIhud(null);
                                  const info = dragInfo.current;
                                  if (!info) return;
                                  dragInfo.current = null;
                                  setIhudTeacher(b.layerId, b.number, info.teacherId);
                                }}
                              >
                                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>
                                  מורה אחראי:
                                </div>
                                {b.teacherId > 0 ? (
                                  <div className="draggable" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div
                                      className="btn btn-primary btn-round"
                                      style={{ flex: 1, textAlign: 'center', background: col.bg, color: col.fg, borderColor: col.fg + '40' }}
                                    >
                                      {b.teacherName}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ padding: 6, color: '#9ca3af', fontStyle: 'italic', fontSize: 11, textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: 6 }}>
                                    גרור מורה לכאן
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                      const indicatorColor = overflow ? '#dc2626' : exact ? '#16a34a' : '#374151';
                      const indicatorBg = overflow ? '#fee2e2' : exact ? '#dcfce7' : '#f3f4f6';
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {overflow && <i className="fa fa-exclamation-triangle" style={{ fontSize: 11 }} />}
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
                        <div className="panel-heading">
                          <button
                            type="button"
                            className="tc-class-close"
                            onClick={() => requestDeleteClass(panel.ClassId, panel.ClassName)}
                            title="מחק כיתה"
                            aria-label="מחק כיתה"
                          >
                            <i className="fa fa-times" />
                          </button>
                          <h3 className="panel-title">
                            <span className="tc-class-name">{panel.ClassName}</span>
                            <button
                              type="button"
                              className="btn btn-xs tc-class-edit"
                              onClick={() =>
                                openClassWindow(panel.ClassId, panel.ClassFOREdit, panel.Seq, 2)
                              }
                            >
                              <i className="fa fa-pencil" /> ערוך
                            </button>
                          </h3>
                        </div>
                        <div
                          className="panel-body droppable"
                          style={{ height: 700 }}
                          onDragOver={allowDrop}
                          onDrop={(e) => onDropOnClass(e, panel.ClassId)}
                        >
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
                            const ihudNum = Number(t.Ihud ?? 0);
                            const hakColor = hakNum > 0 ? groupColor('H', hakNum) : null;
                            const ihudColor = ihudNum > 0 ? groupColor('I', ihudNum) : null;
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
                                  Ihud: t.Ihud,
                                  ClassTeacherId: t.ClassTeacherId,
                                })
                              }
                              onDragOver={allowDrop}
                              onDrop={(e) =>
                                onDropOnClass(
                                  e,
                                  panel.ClassId,
                                  t.Hakbatza ?? '',
                                  t.Ihud ?? '',
                                  t.ClassTeacherId ?? ''
                                )
                              }
                            >
                              <div
                                className={`btn btn-${tafkidTheme(t.TafkidId)} btn-round`}
                                style={{
                                  width: '55%',
                                  marginLeft: 2,
                                  border: ihudColor ? `2px solid ${ihudColor.bg}` : undefined,
                                  boxShadow: ihudColor ? `0 0 0 1px ${ihudColor.bg} inset` : undefined,
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
                                        ihudNum,
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
                                {ihudNum > 0 && ihudColor && (
                                  <span
                                    title={`איחוד ${ihudNum} — לחץ לעריכה`}
                                    onClick={() =>
                                      openGroupModal(
                                        panel.ClassId,
                                        panel.ClassName,
                                        t.memberClassTeacherIds,
                                        t.TeacherName.replace(/<br>/g, ' + '),
                                        hakNum,
                                        ihudNum,
                                      )
                                    }
                                    style={{
                                      cursor: 'pointer',
                                      background: ihudColor.bg,
                                      color: ihudColor.fg,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      lineHeight: 1.2,
                                      userSelect: 'none',
                                    }}
                                  >
                                    א{ihudNum}
                                  </span>
                                )}
                                {hakNum === 0 && ihudNum === 0 && (
                                  <span
                                    title="הוסף להקבצה / איחוד"
                                    onClick={() =>
                                      openGroupModal(
                                        panel.ClassId,
                                        panel.ClassName,
                                        t.memberClassTeacherIds,
                                        t.TeacherName.replace(/<br>/g, ' + '),
                                        0,
                                        0,
                                      )
                                    }
                                    style={{
                                      cursor: 'pointer',
                                      background: '#e5e7eb',
                                      color: '#6b7280',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      lineHeight: 1.2,
                                      userSelect: 'none',
                                    }}
                                  >
                                    +
                                  </span>
                                )}
                              </span>
                              <input
                                type="text"
                                style={{ width: '25%', float: 'left' }}
                                className="form-control"
                                defaultValue={t.Hour != null ? String(t.Hour) : ''}
                                onBlur={(e) =>
                                  setHourToTeacherInClass(
                                    panel.ClassId,
                                    t.TeacherId,
                                    e.currentTarget.value,
                                    t.Ihud,
                                    t.ClassTeacherId,
                                    t.Hakbatza
                                  )
                                }
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
                <span><i className="fa fa-users" /> מורים</span>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={() => openTeacherModal(2)}
                >
                  <i className="fa fa-plus" /> הוסף מורה
                </button>
              </div>
            </div>
            <div
              className="panel-body droppable"
              style={{ overflow: 'auto' }}
              onDragOver={allowDrop}
              onDrop={onDropOnTeacherPanel}
            >
              <div className="tc-role-legend">
                <span className="tc-role-legend-item">
                  <span className="tc-role-legend-dot" style={{ background: '#2563eb' }} />
                  מחנך/ת
                </span>
                <span className="tc-role-legend-item">
                  <span className="tc-role-legend-dot" style={{ background: '#10b981' }} />
                  מקצועי/ת
                </span>
                <span className="tc-role-legend-item">
                  <span className="tc-role-legend-dot" style={{ background: '#ef4444' }} />
                  מנהלה
                </span>
              </div>
              <div style={{ marginTop: 16 }}>
                {teacherGroups.map((grp, gi) => (
                  <div key={`grp_${gi}_${grp.tafkidId}`}>
                    {gi > 0 && <div style={{ clear: 'both' }}></div>}
                    {grp.teachers.map((t) => (
                      <div
                        key={`dvTeacher_${t.TeacherId}`}
                        className={`btn btn-${tafkidTheme(t.TafkidId)} btn-round draggable selected`}
                        style={{ float: 'right', margin: 2 }}
                        draggable
                        onDragStart={(e) => onDragStartTeacher(e, t.TeacherId)}
                        onClick={() => openTeacherModal(1, t.TeacherId)}
                        onContextMenu={(e) => onTeacherContextMenu(e, t.TeacherId)}
                      >
                        {t.FullText}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
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
                    <label style={{ cursor: 'pointer', padding: '6px 10px', background: groupKind === 'ihud' ? '#ddd6fe' : '#f3f4f6', borderRadius: 6, fontSize: 13 }}>
                      <input
                        type="radio"
                        name="gkind"
                        checked={groupKind === 'ihud'}
                        onChange={() => setGroupKind('ihud')}
                        style={{ marginInlineEnd: 6 }}
                      />
                      איחוד (בין כיתות)
                    </label>
                  </div>
                </div>

                {(groupKind === 'hakbatza' || groupKind === 'ihud') && (() => {
                  // Suggest existing numbers of the chosen kind for quick pick
                  const existing = new Set<number>();
                  for (const r of classes) {
                    if (groupKind === 'hakbatza') {
                      const n = Number(r.Hakbatza ?? 0);
                      if (n > 0 && r.ClassId === groupModal.classId) existing.add(n);
                    } else {
                      const n = Number(r.Ihud ?? 0);
                      if (n > 0) existing.add(n);
                    }
                  }
                  const sorted = Array.from(existing).sort((a, b) => a - b);
                  const nextFree = (sorted[sorted.length - 1] ?? 0) + 1;
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>
                        מספר {groupKind === 'hakbatza' ? 'הקבצה' : 'איחוד'}:
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
                              const col = groupColor(groupKind === 'hakbatza' ? 'H' : 'I', n);
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
                                  {groupKind === 'hakbatza' ? 'ה' : 'א'}{n}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
                        {groupKind === 'hakbatza'
                          ? 'מורים באותה כיתה שישתמשו באותו מספר הקבצה — ילמדו באותה שעה, כל אחד לקבוצת רמה אחרת.'
                          : 'מורים בכיתות שונות שישתמשו באותו מספר איחוד — ילמדו באותה שעה, כל אחד בכיתתו.'}
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
                      <label style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>
                        שם ההקבצה (אופציונלי):
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="למשל: מתמטיקה / אנגלית / קבוצת רמה א'"
                        value={wizardName}
                        onChange={(e) => setWizardName(e.target.value)}
                        disabled={wizardBusy}
                        style={{ marginBottom: 14 }}
                      />
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

      {/* Class modal */}
      {showClassModal && (
        <div
          className="modal fade in"
          role="dialog"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowClassModal(false);
          }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header label-info">
                <button type="button" className="close" aria-hidden="true" onClick={() => setShowClassModal(false)}>
                  &times;
                </button>
                <h4 className="modal-title">{classModalTitle}</h4>
              </div>
              <div className="modal-body">
                <div className="col-md-4">
                  <div className="form-group">
                    <label>שם כיתה</label>
                    <input
                      type="text"
                      className="form-control"
                      value={classForm.ClassName}
                      onChange={(e) => setClassForm({ ...classForm, ClassName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>מספר כיתה</label>
                    <input
                      type="text"
                      className="form-control"
                      value={classForm.Seq}
                      onChange={(e) => setClassForm({ ...classForm, Seq: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-md-12" style={{ textAlign: 'left' }}>
                  <br />
                  <button
                    type="button"
                    className="btn btn-info btn-round"
                    onClick={() => saveClass(classModalMode)}
                  >
                    <i className="glyphicon glyphicon-edit"></i>&nbsp; <span>עדכן פרטי כיתה</span>
                  </button>
                </div>
                <div className="clear">&nbsp;</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-info btn-xs" onClick={() => setShowClassModal(false)}>
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher modal */}
      {showTeacherModal && (
        <div
          className="modal fade in"
          role="dialog"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTeacherModal(false);
          }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header label-info">
                <button type="button" className="close" aria-hidden="true" onClick={() => setShowTeacherModal(false)}>
                  &times;
                </button>
                <h4 className="modal-title">{teacherModalTitle}</h4>
              </div>
              <div className="modal-body">
                <div className="col-md-4">
                  <div className="form-group">
                    <label>ת"ז</label>
                    <input
                      type="text"
                      className="form-control"
                      value={teacherForm.Tz}
                      onChange={(e) => setTeacherForm({ ...teacherForm, Tz: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>שם פרטי</label>
                    <input
                      type="text"
                      className="form-control"
                      value={teacherForm.FirstName}
                      onChange={(e) => setTeacherForm({ ...teacherForm, FirstName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>שם משפחה</label>
                    <input
                      type="text"
                      className="form-control"
                      value={teacherForm.LastName}
                      onChange={(e) => setTeacherForm({ ...teacherForm, LastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>תפקיד</label>
                    <select
                      className="form-control"
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
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>אימייל</label>
                    <input
                      type="text"
                      className="form-control"
                      value={teacherForm.Email}
                      onChange={(e) => setTeacherForm({ ...teacherForm, Email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>יום חופשי</label>
                    <select
                      className="form-control"
                      value={teacherForm.FreeDay}
                      onChange={(e) => setTeacherForm({ ...teacherForm, FreeDay: e.target.value })}
                    >
                      <option value="0">--בחר יום חופשי --</option>
                      <option value="1">יום ראשון</option>
                      <option value="2">יום שני</option>
                      <option value="3">יום שלישי</option>
                      <option value="4">יום רביעי</option>
                      <option value="5">יום חמישי</option>
                      <option value="6">יום שישי</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-4">
                  <label>שעות פרונטלי</label>
                  <input
                    type="text"
                    className="form-control"
                    value={teacherForm.Frontaly}
                    onChange={(e) => setTeacherForm({ ...teacherForm, Frontaly: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label>שעות שהייה </label>
                  <input
                    type="text"
                    className="form-control"
                    value={teacherForm.Shehya}
                    onChange={(e) => setTeacherForm({ ...teacherForm, Shehya: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label>שעות פרטני</label>
                  <input
                    type="text"
                    className="form-control"
                    value={teacherForm.Partani}
                    onChange={(e) => setTeacherForm({ ...teacherForm, Partani: e.target.value })}
                  />
                </div>
                <div>&nbsp;</div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>מקצוע (ברירת מחדל)</label>
                    <select
                      className="form-control"
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
                  </div>
                </div>
                <div className="col-md-12" style={{ textAlign: 'left' }}>
                  <br />
                  <button
                    type="button"
                    className="btn btn-info btn-round"
                    onClick={() => saveTeacher(teacherModalType)}
                  >
                    <i className="glyphicon glyphicon-edit"></i>&nbsp; <span>עדכן פרטי מורה</span>
                  </button>
                  <button type="button" className="btn btn-danger btn-round" onClick={deleteTeacher}>
                    <i className="glyphicon glyphicon-edit"></i>&nbsp; <span>מחק מורה</span>
                  </button>
                </div>
                <div className="clear">&nbsp;</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-info btn-xs" onClick={() => setShowTeacherModal(false)}>
                  סגור
                </button>
              </div>
            </div>
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
    </div>
  );
}
