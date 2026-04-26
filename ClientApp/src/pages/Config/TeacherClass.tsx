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
  const [showGroupsPanel, setShowGroupsPanel] = useState(false);

  // Create-group wizard state. When `wizardKind` is non-null the modal opens.
  // The user picks a class (hakbatza only), selects members, and either joins
  // an existing group or gets auto-assigned a fresh number.
  const [wizardKind, setWizardKind] = useState<'hakbatza' | 'ihud' | null>(null);
  const [wizardClassId, setWizardClassId] = useState<number | ''>('');
  const [wizardSelectedCtIds, setWizardSelectedCtIds] = useState<Set<number>>(new Set());
  const [wizardJoinNumber, setWizardJoinNumber] = useState<number | 'new'>('new');
  const [wizardBusy, setWizardBusy] = useState(false);

  function openWizard(kind: 'hakbatza' | 'ihud') {
    setWizardKind(kind);
    setWizardClassId('');
    setWizardSelectedCtIds(new Set());
    setWizardJoinNumber('new');
  }
  function closeWizard() {
    if (wizardBusy) return;
    setWizardKind(null);
  }
  function toggleWizardMember(ctId: number) {
    setWizardSelectedCtIds((prev) => {
      const next = new Set(prev);
      if (next.has(ctId)) next.delete(ctId);
      else next.add(ctId);
      return next;
    });
  }

  async function saveWizard() {
    if (!wizardKind || wizardBusy) return;
    const members = Array.from(wizardSelectedCtIds);
    if (members.length < 2) {
      toast.warning('צריך לבחור לפחות 2 מורים לקבוצה');
      return;
    }
    // Determine target number: either join existing, or pick next free
    let target: number;
    if (wizardJoinNumber === 'new') {
      const existing = new Set<number>();
      for (const r of classes) {
        if (wizardKind === 'hakbatza') {
          // Hakbatza is per-class; only consider the selected class
          if (r.ClassId === wizardClassId) {
            const n = Number(r.Hakbatza ?? 0);
            if (n > 0) existing.add(n);
          }
        } else {
          const n = Number(r.Ihud ?? 0);
          if (n > 0) existing.add(n);
        }
      }
      target = (Math.max(0, ...Array.from(existing))) + 1;
    } else {
      target = wizardJoinNumber;
    }

    setWizardBusy(true);
    try {
      for (const ctId of members) {
        await ajax<DmlResult[]>('Class_SetGroupNumber', {
          ClassTeacherId: ctId,
          Hakbatza: wizardKind === 'hakbatza' ? target : 0,
          Ihud: wizardKind === 'ihud' ? target : 0,
        });
      }
      toast.success(
        wizardKind === 'hakbatza'
          ? `הקבצה ${target} נוצרה עם ${members.length} מורים`
          : `איחוד ${target} נוצר עם ${members.length} מורים`,
      );
      setWizardKind(null);
      loadClasses(layerId);
    } catch (err) {
      console.error('Wizard save failed', err);
      toast.error('שמירת הקבוצה נכשלה');
    } finally {
      setWizardBusy(false);
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
    if (showGroupsPanel) loadGroupValidations();
  }, [showGroupsPanel, loadGroupValidations, classes]);

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

  // Edit hours inline (Type=4)
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

  function buildClassPanels(): ClassPanel[] {
    const panels: ClassPanel[] = [];
    const byClassId = new Map<number, ClassPanel>();
    const rows = classes;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!byClassId.has(r.ClassId)) {
        const panel: ClassPanel = {
          ClassId: r.ClassId,
          ClassName: r.ClassName,
          ClassFOREdit: r.ClassFOREdit,
          Seq: r.Seq,
          ClassCountHour: r.ClassCountHour,
          teachers: [],
        };
        byClassId.set(r.ClassId, panel);
        panels.push(panel);
      }
      if (r.ClassTeacherId != null && Number(r.ClassTeacherId) > 0) {
        const hakbatza = r.Hakbatza;
        let teacherName = r.TeacherName ?? '';
        const memberIds: number[] = [];
        if (r.ClassTeacherId != null) memberIds.push(Number(r.ClassTeacherId));
        let j = i;
        if (hakbatza) {
          while (
            rows[j + 1] &&
            hakbatza === rows[j + 1].Hakbatza &&
            r.ClassId === rows[j + 1].ClassId
          ) {
            teacherName = teacherName + '<br>' + (rows[j + 1].TeacherName ?? '');
            if (rows[j + 1].ClassTeacherId != null) memberIds.push(Number(rows[j + 1].ClassTeacherId));
            j++;
          }
        }
        const lastRow = rows[j];
        const ihud = lastRow.Ihud;
        const displayRaw = ihud ? `<u>${teacherName}</u>` : teacherName;
        byClassId.get(r.ClassId)!.teachers.push({
          ClassTeacherId: lastRow.ClassTeacherId,
          TeacherId: lastRow.TeacherId!,
          TeacherName: teacherName,
          TafkidId: lastRow.TafkidId,
          Hakbatza: lastRow.Hakbatza,
          Ihud: lastRow.Ihud,
          Hour: lastRow.Hour,
          displayRaw,
          memberClassTeacherIds: memberIds,
        });
        i = j;
      }
    }
    return panels;
  }

  const classPanels = buildClassPanels();
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
                className="btn btn-warning btn-sm"
                style={{ marginInlineStart: 6, fontWeight: 700 }}
                onClick={() => openWizard('hakbatza')}
                title="צור הקבצה חדשה — מורים באותה כיתה שילמדו באותה שעה כקבוצות רמה"
              >
                <i className="fa fa-plus" /> הקבצה חדשה
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginInlineStart: 6, fontWeight: 700 }}
                onClick={() => openWizard('ihud')}
                title="צור איחוד חדש — מורים מכיתות שונות שילמדו באותה שעה"
              >
                <i className="fa fa-plus" /> איחוד חדש
              </button>
              <button
                type="button"
                className="btn btn-info btn-sm"
                style={{ marginInlineStart: 6 }}
                onClick={() => setShowGroupsPanel((v) => !v)}
                title="הצג/הסתר רשימת הקבצות ואיחודים בשכבה"
              >
                <i className="fa fa-object-group" /> {showGroupsPanel ? 'הסתר קבוצות' : 'הצג קבוצות'}
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
            {showGroupsPanel && (() => {
              const summary = buildGroupsSummary();
              if (summary.length === 0) {
                return (
                  <div style={{ padding: 12, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 13, color: '#6b7280' }}>
                    אין הקבצות או איחודים מוגדרים בשכבה זו.
                  </div>
                );
              }
              return (
                <div style={{ padding: 12, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', maxHeight: 180, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {summary.map((g) => {
                      const col = groupColor(g.kind, g.number);
                      const label = g.kind === 'H' ? `ה${g.number}` : `א${g.number}`;
                      const kindName = g.kind === 'H' ? 'הקבצה' : 'איחוד';
                      const validation = groupValidations.get(g.kind + '_' + g.number);
                      const borderColor = validation?.Severity === 'error'
                        ? '#dc2626'
                        : validation?.Severity === 'warning'
                        ? '#ea580c'
                        : col.bg;
                      const bgTint = validation?.Severity === 'error'
                        ? '#fef2f2'
                        : validation?.Severity === 'warning'
                        ? '#fff7ed'
                        : '#fff';
                      return (
                        <div
                          key={g.kind + '_' + g.number + '_' + (g.members[0]?.classId ?? 0)}
                          style={{
                            border: `2px solid ${borderColor}`,
                            background: bgTint,
                            borderRadius: 6,
                            padding: 8,
                            minWidth: 180,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ background: col.bg, color: col.fg, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                              {label}
                            </span>
                            <strong>{kindName}</strong>
                            <span style={{ color: '#6b7280' }}>· {g.members.length} חברים</span>
                            {validation?.Severity === 'error' && (
                              <i className="fa fa-times-circle" title={validation.Message} style={{ color: '#dc2626', marginInlineStart: 'auto' }} />
                            )}
                            {validation?.Severity === 'warning' && (
                              <i className="fa fa-exclamation-triangle" title={validation.Message} style={{ color: '#ea580c', marginInlineStart: 'auto' }} />
                            )}
                          </div>
                          {validation && validation.Severity !== 'ok' && (
                            <div style={{
                              fontSize: 11,
                              color: validation.Severity === 'error' ? '#991b1b' : '#9a3412',
                              background: validation.Severity === 'error' ? '#fee2e2' : '#ffedd5',
                              padding: '4px 6px',
                              borderRadius: 4,
                              marginBottom: 6,
                              lineHeight: 1.4,
                            }}>
                              {validation.Message}
                            </div>
                          )}
                          <div style={{ color: '#374151', lineHeight: 1.5 }}>
                            {g.members.map((m, i) => (
                              <div key={i}>
                                <span style={{ color: '#6b7280' }}>{m.className}:</span> {m.teacherName}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <div className="panel-body" style={{ overflow: 'auto' }}>
              <div
                className="droppable"
                onDragOver={allowDrop}
              >
                {classPanels.map((panel) => (
                  <div className="col-md-3" key={panel.ClassId}>
                    <div>
                      סה"כ שעות - <span className="spTotal">{panel.ClassCountHour}</span>
                    </div>
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
                ))}
              </div>
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

      {/* Create-group wizard (Hakbatza or Ihud) */}
      {wizardKind && (() => {
        const kind = wizardKind;
        const isHak = kind === 'hakbatza';
        const allClassTeacherRows = classes.filter((r) => r.ClassTeacherId && Number(r.ClassTeacherId) > 0);

        // Hakbatza: teacher list depends on selected class; Ihud: all teachers in layer
        const candidatePool = isHak
          ? allClassTeacherRows.filter((r) => r.ClassId === wizardClassId)
          : allClassTeacherRows;

        // Compute existing group numbers for the "join existing" radio
        const existingNumbers = new Set<number>();
        for (const r of classes) {
          if (isHak) {
            if (wizardClassId && r.ClassId === wizardClassId) {
              const n = Number(r.Hakbatza ?? 0);
              if (n > 0) existingNumbers.add(n);
            }
          } else {
            const n = Number(r.Ihud ?? 0);
            if (n > 0) existingNumbers.add(n);
          }
        }
        const sortedExisting = Array.from(existingNumbers).sort((a, b) => a - b);
        const nextFree = (sortedExisting[sortedExisting.length - 1] ?? 0) + 1;

        // Unique class list for class dropdown (hakbatza)
        const uniqueClasses: Array<{ ClassId: number; ClassName: string }> = [];
        const seenC = new Set<number>();
        for (const r of classes) {
          if (!seenC.has(r.ClassId)) {
            seenC.add(r.ClassId);
            uniqueClasses.push({ ClassId: r.ClassId, ClassName: r.ClassName });
          }
        }

        // Group candidates by class for Ihud (render by class for clarity)
        const ihudByClass = new Map<number, { className: string; items: ClassRow[] }>();
        if (!isHak) {
          for (const r of candidatePool) {
            const entry = ihudByClass.get(r.ClassId);
            if (entry) entry.items.push(r);
            else ihudByClass.set(r.ClassId, { className: r.ClassName, items: [r] });
          }
        }

        const titleColor = isHak ? '#d97706' : '#2563eb';
        const titleBg = isHak ? '#fef3c7' : '#dbeafe';
        const kindName = isHak ? 'הקבצה' : 'איחוד';

        return (
          <div
            className="modal fade in"
            role="dialog"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeWizard();
            }}
          >
            <div className="modal-dialog" style={{ direction: 'rtl', maxWidth: 640 }}>
              <div className="modal-content">
                <div className="modal-header" style={{ background: titleBg, borderBottom: `2px solid ${titleColor}` }}>
                  <button
                    type="button"
                    className="close"
                    onClick={closeWizard}
                    aria-label="Close"
                    disabled={wizardBusy}
                  >
                    &times;
                  </button>
                  <h4 className="modal-title" style={{ color: titleColor }}>
                    <i className="fa fa-object-group" /> יצירת {kindName} חדשה
                  </h4>
                  <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4, lineHeight: 1.5 }}>
                    {isHak
                      ? 'בחר כיתה, ואז סמן 2 מורים או יותר שילמדו באותה שעה כקבוצות רמה.'
                      : 'סמן 2 מורים או יותר מכיתות שונות שילמדו באותה שעה (למשל חינוך גופני לכיתות א1/א2/א3).'}
                  </div>
                </div>
                <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  {/* Step 1: class picker (hakbatza only) */}
                  {isHak && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>
                        1. בחר כיתה:
                      </label>
                      <select
                        className="form-control"
                        value={wizardClassId}
                        onChange={(e) => {
                          setWizardClassId(e.target.value ? Number(e.target.value) : '');
                          setWizardSelectedCtIds(new Set());
                          setWizardJoinNumber('new');
                        }}
                        disabled={wizardBusy}
                      >
                        <option value="">— בחר כיתה —</option>
                        {uniqueClasses.map((c) => (
                          <option key={c.ClassId} value={c.ClassId}>{c.ClassName}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Step 2: member picker */}
                  {(isHak ? wizardClassId : true) && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>
                        {isHak ? '2' : '1'}. סמן את המורים ({wizardSelectedCtIds.size} נבחרו):
                      </label>
                      {candidatePool.length === 0 ? (
                        <div style={{ padding: 10, color: '#6b7280', fontSize: 13, background: '#f9fafb', borderRadius: 6 }}>
                          {isHak
                            ? 'אין מורים משובצים בכיתה זו. הוסף מורים לכיתה קודם (גרירה מהצד).'
                            : 'אין מורים משובצים בשכבה זו.'}
                        </div>
                      ) : isHak ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 220, overflowY: 'auto', padding: 4 }}>
                          {candidatePool.map((r) => {
                            const ctId = Number(r.ClassTeacherId);
                            const existing = Number(r.Hakbatza ?? 0);
                            const checked = wizardSelectedCtIds.has(ctId);
                            return (
                              <label
                                key={ctId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '6px 10px',
                                  background: checked ? '#fef3c7' : '#f9fafb',
                                  border: `1px solid ${checked ? '#f59e0b' : '#e5e7eb'}`,
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 13,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleWizardMember(ctId)}
                                  disabled={wizardBusy}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ flex: 1 }}>{r.TeacherName}</span>
                                {existing > 0 && (
                                  <span style={{ fontSize: 10, background: '#fde68a', color: '#92400e', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                                    ה{existing}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ maxHeight: 260, overflowY: 'auto', padding: 4 }}>
                          {Array.from(ihudByClass.entries())
                            .sort((a, b) => a[1].className.localeCompare(b[1].className, 'he'))
                            .map(([cid, { className, items }]) => (
                              <div key={cid} style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>{className}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                  {items.map((r) => {
                                    const ctId = Number(r.ClassTeacherId);
                                    const existing = Number(r.Ihud ?? 0);
                                    const checked = wizardSelectedCtIds.has(ctId);
                                    return (
                                      <label
                                        key={ctId}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                          padding: '5px 8px',
                                          background: checked ? '#dbeafe' : '#f9fafb',
                                          border: `1px solid ${checked ? '#3b82f6' : '#e5e7eb'}`,
                                          borderRadius: 5,
                                          cursor: 'pointer',
                                          fontSize: 12,
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleWizardMember(ctId)}
                                          disabled={wizardBusy}
                                          style={{ cursor: 'pointer' }}
                                        />
                                        <span style={{ flex: 1 }}>{r.TeacherName}</span>
                                        {existing > 0 && (
                                          <span style={{ fontSize: 10, background: '#c4b5fd', color: '#4c1d95', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                                            א{existing}
                                          </span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: number picker */}
                  {wizardSelectedCtIds.size >= 2 && (
                    <div style={{ marginBottom: 10, padding: 10, background: '#f9fafb', borderRadius: 6 }}>
                      <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>
                        {isHak ? '3' : '2'}. מספר {kindName}:
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <label style={{
                          cursor: 'pointer',
                          padding: '4px 10px',
                          borderRadius: 5,
                          background: wizardJoinNumber === 'new' ? titleBg : '#fff',
                          border: `1px solid ${wizardJoinNumber === 'new' ? titleColor : '#d1d5db'}`,
                          fontSize: 13,
                          fontWeight: 600,
                        }}>
                          <input
                            type="radio"
                            checked={wizardJoinNumber === 'new'}
                            onChange={() => setWizardJoinNumber('new')}
                            disabled={wizardBusy}
                            style={{ marginInlineEnd: 6 }}
                          />
                          חדש (מספר {nextFree})
                        </label>
                        {sortedExisting.map((n) => {
                          const col = groupColor(isHak ? 'H' : 'I', n);
                          const sel = wizardJoinNumber === n;
                          return (
                            <label
                              key={n}
                              style={{
                                cursor: 'pointer',
                                padding: '4px 10px',
                                borderRadius: 5,
                                background: sel ? col.bg : '#fff',
                                border: `1px solid ${sel ? col.fg : '#d1d5db'}`,
                                fontSize: 13,
                                fontWeight: 600,
                              }}
                            >
                              <input
                                type="radio"
                                checked={sel}
                                onChange={() => setWizardJoinNumber(n)}
                                disabled={wizardBusy}
                                style={{ marginInlineEnd: 6 }}
                              />
                              צרף ל-{isHak ? 'ה' : 'א'}{n}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={saveWizard}
                    disabled={wizardBusy || wizardSelectedCtIds.size < 2}
                  >
                    {wizardBusy ? <><span className="spinner" /> שומר...</> : <><i className="fa fa-save" /> צור {kindName}</>}
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
                      onChange={(e) => setTeacherForm({ ...teacherForm, Tafkid: e.target.value })}
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
