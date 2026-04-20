import { useCallback, useEffect, useRef, useState } from 'react';
import { ajax } from '../../api/client';
import { useToast } from '../../lib/toast';

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
        let j = i;
        if (hakbatza) {
          while (
            rows[j + 1] &&
            hakbatza === rows[j + 1].Hakbatza &&
            r.ClassId === rows[j + 1].ClassId
          ) {
            teacherName = teacherName + '<br>' + (rows[j + 1].TeacherName ?? '');
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
            </div>
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
                          {panel.teachers.map((t) => (
                            <div
                              key={`${panel.ClassId}_${t.TeacherId}_${t.ClassTeacherId ?? ''}`}
                              className="draggable droppable"
                              style={{ marginBottom: 3 }}
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
                                style={{ width: '65%', marginLeft: 2 }}
                                // displayRaw may include <br> / <u> — matches aspx template
                                dangerouslySetInnerHTML={{ __html: t.displayRaw }}
                              />
                              <input
                                type="text"
                                style={{ width: '33%', float: 'left' }}
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
                          ))}
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
              style={{ height: 700, overflow: 'auto' }}
              onDragOver={allowDrop}
              onDrop={onDropOnTeacherPanel}
            >
              <div>
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
