import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import PageLoader from '../../lib/PageLoader';

// ============================================================================
// Types
// ============================================================================

interface FreeTeacher {
  TeacherId: string | number;
  TeacherName: string;
  FreeHour: string | number;
}

interface Professional {
  ProfessionalId: string | number;
  Name: string;
  ConfigurationId?: string | number;
}

interface AssignmentRow {
  AssignmentId?: string | number | null;
  ClassId: string | number;
  ClassName: string;
  HourId: string | number;
  TeacherId?: string | number | null;
  TeacherName?: string | null;
  ProfessionalId?: string | number | null;
  Professional?: string | null;
  Hakbatza?: string | number | null;
  Ihud?: string | number | null;
  LayerId?: string | number | null;
  IsAuto?: number | null;
}

interface AssignResultRow {
  res: number;
}

interface TeacherHourRow {
  TeacherId: string | number;
  TeacherName: string;
  HourId: string | number;
  ClassId?: string | number | null;
  ClassNameAssign?: string | null;
  className?: string | null;
  Professional?: string | null;
  HourTypeId?: string | number | null;
  HourType?: string | null;
  SheyaGroupName?: string | null;
  isWork?: number | null;
}

interface TeacherHoursPerClassRow {
  TeacherId: string | number;
  TeacherName: string;
  ClassId: string | number;
  ClassName?: string;
  ExpectedHours?: number | null;
  AssignedHours?: number | null;
}

interface OptionalTeacherRow {
  Name: string;
  Hakbatza?: string | number | null;
}

// A single displayable "slot" on the grid: an existing AssignmentRow plus any
// sibling rows that share the same ClassId+HourId (parallel teachers).
interface AssignSlot {
  primary: AssignmentRow;
  extras: AssignmentRow[]; // additional teachers in the same hour (same ClassId+HourId)
}

// Drag payload definitions -------------------------------------------------
interface DragTeacherPayload {
  kind: 'freeTeacher';
  TeacherId: string | number;
  TeacherName: string;
}

interface DragProPayload {
  kind: 'professional';
  ProfessionalId: string | number;
  Name: string;
}

interface DragAssignPayload {
  kind: 'assign';
  assignmentId: string | number;
  TeacherId?: string | number | null;
  ProfessionalId?: string | number | null;
  Professional?: string | null;
  ClassId: string | number;
  HourId: string | number;
  Hakbatza?: string | number | null;
  Ihud?: string | number | null;
  LayerId?: string | number | null;
  TeacherName?: string | null;
}

type DragPayload = DragTeacherPayload | DragProPayload | DragAssignPayload;

interface DropCellPayload {
  kind: 'cell';
  assignmentId: string | number | null;
  TeacherId?: string | number | null;
  ProfessionalId?: string | number | null;
  Professional?: string | null;
  ClassId: string | number;
  HourId: string | number;
  Hakbatza?: string | number | null;
  Ihud?: string | number | null;
  LayerId?: string | number | null;
}

interface DropContainerPayload {
  kind: 'teacherContainer' | 'proContainer';
}

type DropPayload = DropCellPayload | DropContainerPayload;

// ============================================================================
// Helpers
// ============================================================================

const DAY_NAMES = ['', 'יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי'];
const LAYERS = [
  { id: '0', label: 'הכל' },
  { id: '1', label: "שכבה א'" },
  { id: '2', label: "שכבה ב'" },
  { id: '3', label: "שכבה ג'" },
  { id: '4', label: "שכבה ד'" },
  { id: '5', label: "שכבה ה'" },
  { id: '6', label: "שכבה ו'" },
];

function getDayId(hourId: string | number | null | undefined): number {
  if (hourId === null || hourId === undefined) return 0;
  return Number(String(hourId).charAt(0)) || 0;
}

function emptyIfNull<T>(v: T | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

// Group rows into (classId -> dayId -> slots[]) collapsing rows that share the
// same HourId (paired teachers). Mirrors the while-loop logic in the original JS.
function buildGrid(rows: AssignmentRow[]): {
  classes: { ClassId: string; ClassName: string }[];
  cells: Map<string, AssignSlot[]>; // key = `${ClassId}_${DayId}`
} {
  const classes: { ClassId: string; ClassName: string }[] = [];
  const seenClasses = new Set<string>();
  const cells = new Map<string, AssignSlot[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cid = String(row.ClassId);
    if (!seenClasses.has(cid)) {
      seenClasses.add(cid);
      classes.push({ ClassId: cid, ClassName: row.ClassName });
    }

    const extras: AssignmentRow[] = [];
    let j = i;
    while (
      rows[j + 1] &&
      String(rows[j].ClassId) === String(rows[j + 1].ClassId) &&
      String(rows[j].HourId) === String(rows[j + 1].HourId)
    ) {
      extras.push(rows[j + 1]);
      j++;
    }

    const dayId = getDayId(row.HourId);
    const key = `${cid}_${dayId}`;
    const arr = cells.get(key) ?? [];
    arr.push({ primary: row, extras });
    cells.set(key, arr);
    i = j;
  }

  return { classes, cells };
}

// Build parameter map for Assign_SetAssignManual in terms of Source / Target
// objects — matches the original SetDataTODB contract exactly.
interface SrcTgtObj {
  ObjId: string;
  TeacherId: string;
  ClassId: string;
  HourId: string;
  ProfessionalId: string;
  Hakbatza: string;
  Ihud: string;
  LayerId: string;
  TeacherName?: string;
  Professional?: string;
}

function emptySrcTgt(): SrcTgtObj {
  return {
    ObjId: '',
    TeacherId: '',
    ClassId: '',
    HourId: '',
    ProfessionalId: '',
    Hakbatza: '',
    Ihud: '',
    LayerId: '',
  };
}

// ============================================================================
// Draggable / Droppable components
// ============================================================================

function DraggableFreeTeacher({ teacher }: { teacher: FreeTeacher }) {
  const payload: DragTeacherPayload = {
    kind: 'freeTeacher',
    TeacherId: teacher.TeacherId,
    TeacherName: teacher.TeacherName,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `freeTeacher-${teacher.TeacherId}`,
    data: payload,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="btn btn-success btn-round selected"
      style={{
        float: 'right',
        margin: 2,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'move',
        userSelect: 'none',
      }}
    >
      <span>{teacher.TeacherName}</span> ({teacher.FreeHour})
    </div>
  );
}

function DraggableProfessional({ pro }: { pro: Professional }) {
  const payload: DragProPayload = {
    kind: 'professional',
    ProfessionalId: pro.ProfessionalId,
    Name: pro.Name,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pro-${pro.ProfessionalId}`,
    data: payload,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="btn btn-primary btn-round"
      style={{
        float: 'right',
        margin: 2,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'move',
        userSelect: 'none',
      }}
    >
      {pro.Name}
    </div>
  );
}

function FreeTeacherDropZone({ children }: { children: React.ReactNode }) {
  const payload: DropContainerPayload = { kind: 'teacherContainer' };
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-teacherContainer', data: payload });
  return (
    <div
      ref={setNodeRef}
      className="panel-body"
      style={{
        height: 150,
        overflow: 'auto',
        background: isOver ? '#fff0d4' : undefined,
      }}
    >
      {children}
    </div>
  );
}

function ProDropZone({ children }: { children: React.ReactNode }) {
  const payload: DropContainerPayload = { kind: 'proContainer' };
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-proContainer', data: payload });
  return (
    <div
      ref={setNodeRef}
      className="panel-body"
      style={{
        height: 150,
        overflow: 'auto',
        background: isOver ? '#fff0d4' : undefined,
      }}
    >
      {children}
    </div>
  );
}

function AssignBadge({
  slot,
  highlightTeacherId,
  highlightClassId,
  onBadgeClick,
  onTeacherRightClick,
}: {
  slot: AssignSlot;
  highlightTeacherId: string;
  highlightClassId: string;
  onBadgeClick: (slot: AssignSlot) => void;
  onTeacherRightClick: (
    e: React.MouseEvent,
    teacherId: string | number,
    classId: string | number,
  ) => void;
}) {
  const { primary, extras } = slot;
  const theme = primary.AssignmentId ? (primary.IsAuto === 1 ? 'info' : 'primary') : 'danger';

  const hasAssignment = !!primary.AssignmentId;
  const assignId = primary.AssignmentId ? String(primary.AssignmentId) : null;

  // Set up draggable (assigned entries are draggable back to unassign)
  const dragPayload: DragAssignPayload | null = hasAssignment
    ? {
        kind: 'assign',
        assignmentId: primary.AssignmentId as string | number,
        TeacherId: primary.TeacherId ?? '',
        ProfessionalId: primary.ProfessionalId ?? '',
        Professional: primary.Professional ?? '',
        ClassId: primary.ClassId,
        HourId: primary.HourId,
        Hakbatza: primary.Hakbatza ?? '',
        Ihud: primary.Ihud ?? '',
        LayerId: primary.LayerId ?? '',
        TeacherName: primary.TeacherName ?? '',
      }
    : null;

  const draggable = useDraggable({
    id: `assign-${assignId ?? `${primary.ClassId}-${primary.HourId}-empty`}`,
    data: dragPayload ?? undefined,
    disabled: !hasAssignment,
  });

  // And droppable (teachers/pros can be dropped on the slot)
  const dropPayload: DropCellPayload = {
    kind: 'cell',
    assignmentId: primary.AssignmentId ?? null,
    TeacherId: primary.TeacherId ?? '',
    ProfessionalId: primary.ProfessionalId ?? '',
    Professional: primary.Professional ?? '',
    ClassId: primary.ClassId,
    HourId: primary.HourId,
    Hakbatza: primary.Hakbatza ?? '',
    Ihud: primary.Ihud ?? '',
    LayerId: primary.LayerId ?? '',
  };
  const droppable = useDroppable({
    id: `cell-${assignId ?? `${primary.ClassId}-${primary.HourId}-empty-${Math.random()}`}`,
    data: dropPayload,
  });

  const setNodeRef = (el: HTMLElement | null) => {
    draggable.setNodeRef(el);
    droppable.setNodeRef(el);
  };

  // highlight check: does this slot contain the highlighted teacher + class?
  const allTeacherIds: string[] = [primary.TeacherId, ...extras.map((e) => e.TeacherId)]
    .filter((t) => t !== null && t !== undefined && t !== '')
    .map((t) => String(t));

  const isHighlighted =
    !!highlightTeacherId &&
    !!highlightClassId &&
    String(primary.ClassId) === highlightClassId &&
    allTeacherIds.includes(highlightTeacherId);

  // Build teacher-name display with spans (so right-click menu can identify teacher)
  const teacherSpans: React.ReactNode[] = [];
  if (primary.TeacherName) {
    teacherSpans.push(
      <span
        key={`p-${primary.TeacherId}`}
        className="selected"
        onContextMenu={(e) =>
          onTeacherRightClick(e, primary.TeacherId ?? '', primary.ClassId)
        }
      >
        {primary.TeacherName}
      </span>,
    );
  } else {
    teacherSpans.push(<span key="blank">&nbsp;</span>);
  }
  for (const ex of extras) {
    teacherSpans.push(
      <span key={`sep-${ex.TeacherId}`}>/</span>,
      <span
        key={`e-${ex.TeacherId}`}
        className="selected"
        onContextMenu={(e) => onTeacherRightClick(e, ex.TeacherId ?? '', ex.ClassId)}
      >
        {ex.TeacherName}
      </span>,
    );
  }

  const teacherDisplay = primary.Ihud ? <u>{teacherSpans}</u> : <>{teacherSpans}</>;

  const style: React.CSSProperties = {
    zIndex: 10,
    margin: 2,
    cursor: hasAssignment ? 'move' : 'default',
    background: droppable.isOver ? '#cfe8ff' : undefined,
    opacity: draggable.isDragging ? 0.4 : 1,
    ...(isHighlighted
      ? { backgroundColor: '#ffeb3b', boxShadow: '0 0 8px #ff9800' }
      : null),
  };

  return (
    <div
      ref={setNodeRef}
      {...(hasAssignment ? draggable.listeners : {})}
      {...(hasAssignment ? draggable.attributes : {})}
      className={`btn btn-${theme} btnWorker`}
      style={style}
      onClick={() => onBadgeClick(slot)}
    >
      <span style={{ fontWeight: 'bold' }}>
        {primary.Professional ? `${primary.Professional} -` : ''}
      </span>{' '}
      {teacherDisplay}
    </div>
  );
}

// ============================================================================
// Modal for teacher hours display
// ============================================================================

function TeacherHoursModal({
  teacherId,
  onClose,
}: {
  teacherId: string | number;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<TeacherHourRow[] | null>(null);
  const [teacherName, setTeacherName] = useState('');

  useEffect(() => {
    ajax<TeacherHourRow[]>('Teacher_GetAllTeacherHours', { TeacherId: String(teacherId) })
      .then((data) => {
        setRows(data);
        if (data?.[0]) setTeacherName(data[0].TeacherName);
      })
      .catch((err) => console.error(err));
  }, [teacherId]);

  // group by dayId
  const byDay = useMemo(() => {
    const m: Record<number, { className: string; pro: string; isWork: boolean; seq: number }[]> = {};
    if (!rows) return m;
    let prevDayId = -1;
    let seq = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const dayId = getDayId(r.HourId);
      let className = r.ClassNameAssign || '';
      let classHalf = r.className || '';
      let j = i;
      while (
        rows[j + 1] &&
        String(rows[j].ClassId) !== String(rows[j + 1].ClassId) &&
        String(rows[j].HourId) === String(rows[j + 1].HourId)
      ) {
        classHalf += '/' + (rows[j + 1].className || '');
        j++;
        className = classHalf;
      }
      let pro = r.Professional || '';
      const hourType = r.HourType || '';
      const hourTypeId = r.HourTypeId ? String(r.HourTypeId) : '';
      if (hourTypeId === '2' || hourTypeId === '3') className = hourType;
      if (hourTypeId === '3') pro = r.SheyaGroupName || '';

      if (prevDayId !== dayId) {
        seq = 1;
        prevDayId = dayId;
      } else {
        seq += 1;
      }

      m[dayId] = m[dayId] ?? [];
      m[dayId].push({ className, pro, isWork: !!r.isWork, seq });
      i = j;
    }
    return m;
  }, [rows]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        left: 60,
        width: 400,
        background: 'white',
        border: '1px solid #888',
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: 5000,
        direction: 'rtl',
      }}
    >
      <div
        style={{
          background: '#428bca',
          color: 'white',
          padding: '4px 8px',
          fontWeight: 'bold',
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>שעות למורה - {teacherName}</span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'black',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          X
        </button>
      </div>
      <div style={{ padding: 4 }}>
        {!rows ? (
          <div>טוען...</div>
        ) : (
          <table
            cellPadding={3}
            cellSpacing={1}
            width="350px"
            style={{ borderCollapse: 'collapse' }}
          >
            <thead>
              <tr>
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <td
                    key={d}
                    style={{
                      textAlign: 'center',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 'bold',
                      height: 10,
                      backgroundColor: '#428bca',
                      border: 'solid 1px black',
                    }}
                  >
                    {DAY_NAMES[d]}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <td key={d} style={{ verticalAlign: 'top', paddingBottom: 3, fontSize: 12 }}>
                    {(byDay[d] ?? []).map((cell, idx) => (
                      <div
                        key={idx}
                        className={cell.isWork ? 'emptyHour' : ''}
                        style={{
                          height: 30,
                          fontSize: 11,
                          padding: 1,
                          border: 'solid 1px silver',
                          backgroundColor: cell.isWork ? 'gainsboro' : undefined,
                        }}
                      >
                        <b>{cell.seq}&nbsp;</b>
                        {cell.className}
                        <div style={{ textAlign: 'left', fontSize: 7, fontStyle: 'italic' }}>
                          {cell.pro}
                        </div>
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Simple school-hours-per-class modal (Assign_GetTeacherHoursPerClass)
// ============================================================================

function TeacherHoursPerClassModal({
  teacherId,
  onClose,
}: {
  teacherId: string | number;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<TeacherHoursPerClassRow[] | null>(null);

  useEffect(() => {
    ajax<TeacherHoursPerClassRow[]>('Assign_GetTeacherHoursPerClass', {
      TeacherId: String(teacherId),
    })
      .then((data) => setRows(data))
      .catch(() => setRows([]));
  }, [teacherId]);

  const teacherName = rows?.[0]?.TeacherName ?? '';

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        left: 80,
        width: 450,
        background: 'white',
        border: '1px solid #888',
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: 5000,
        direction: 'rtl',
      }}
    >
      <div
        style={{
          background: '#428bca',
          color: 'white',
          padding: '4px 8px',
          fontWeight: 'bold',
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>שעות בבית הספר - {teacherName}</span>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'black', cursor: 'pointer' }}
        >
          X
        </button>
      </div>
      <div style={{ padding: 15 }}>
        {!rows ? (
          <div>טוען...</div>
        ) : rows.length === 0 ? (
          <div>לא נמצאו נתונים למורה זה</div>
        ) : (
          <table className="table table-bordered table-striped">
            <thead>
              <tr>
                <th>כיתה</th>
                <th>שעות מתוכננות</th>
                <th>שובץ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.ClassName ?? r.ClassId}</td>
                  <td>{r.ExpectedHours ?? '-'}</td>
                  <td>{r.AssignedHours ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main page
// ============================================================================

export default function Assign() {
  const { user } = useAuth();
  const [layerId, setLayerId] = useState<string>('0');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [freeTeachers, setFreeTeachers] = useState<FreeTeacher[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);

  // highlight
  const [highlightTeacherId, setHighlightTeacherId] = useState<string>('');
  const [highlightClassId, setHighlightClassId] = useState<string>('');

  // modals
  const [teacherHoursModalId, setTeacherHoursModalId] = useState<string | number | null>(null);
  const [perClassModalId, setPerClassModalId] = useState<string | number | null>(null);

  // optional-teachers alert
  const [optionalTeachersAlert, setOptionalTeachersAlert] = useState<string[] | null>(null);

  // right-click menu
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    teacherId: string | number;
    classId: string | number;
  } | null>(null);

  const configurationId = user?.ConfigurationId ?? '';

  // --- data loading ---
  const loadAssignments = useCallback((lid: string) => {
    ajax<AssignmentRow[]>('Assign_GetAssignment', { LayerId: lid })
      .then((data) => setAssignments(data ?? []))
      .catch((err) => console.error('Assign_GetAssignment', err));
  }, []);

  const loadFreeTeachers = useCallback((classId: string) => {
    setSelectedClassId(classId);
    ajax<FreeTeacher[]>('Assign_GetFreeTeacher', { ClassId: classId })
      .then((data) => setFreeTeachers(data ?? []))
      .catch((err) => console.error('Assign_GetFreeTeacher', err));
  }, []);

  const loadProfessionals = useCallback(() => {
    ajax<Professional[]>('Gen_GetTable', {
      TableName: 'Professional',
      Condition: `ConfigurationId=${configurationId}`,
    })
      .then((data) => setProfessionals(data ?? []))
      .catch((err) => console.error('Gen_GetTable Professional', err));
  }, [configurationId]);

  useEffect(() => {
    if (!configurationId) return;
    setInitialLoading(true);
    Promise.allSettled([
      loadProfessionals(),
      loadFreeTeachers(''),
      loadAssignments('0'),
    ]).finally(() => setInitialLoading(false));
  }, [configurationId, loadProfessionals, loadFreeTeachers, loadAssignments]);

  useEffect(() => {
    loadAssignments(layerId);
  }, [layerId, loadAssignments]);

  // --- derived ---
  const grid = useMemo(() => buildGrid(assignments), [assignments]);

  // --- dnd-kit ---
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragPayload | undefined;
    if (data) setActiveDrag(data);
  };

  // Figure out Type per the original drop logic, fill Source/Target objects, call DB.
  const resolveDrop = useCallback(
    async (src: DragPayload, tgt: DropPayload): Promise<void> => {
      const sourceObj = emptySrcTgt();
      const targetObj = emptySrcTgt();
      let Type = 0;

      // ----- Build Source fields -----
      if (src.kind === 'freeTeacher') {
        sourceObj.ObjId = String(src.TeacherId); // after stripping "dvTeacher_"
        sourceObj.TeacherId = String(src.TeacherId);
        sourceObj.TeacherName = src.TeacherName;
      } else if (src.kind === 'professional') {
        sourceObj.ObjId = String(src.ProfessionalId); // after stripping "dvProfessional_"
        sourceObj.ProfessionalId = String(src.ProfessionalId);
      } else if (src.kind === 'assign') {
        sourceObj.ObjId = String(src.assignmentId);
        sourceObj.TeacherId = emptyIfNull(src.TeacherId);
        sourceObj.ProfessionalId = emptyIfNull(src.ProfessionalId);
        sourceObj.ClassId = String(src.ClassId);
        sourceObj.HourId = String(src.HourId);
        sourceObj.Hakbatza = emptyIfNull(src.Hakbatza);
        sourceObj.Ihud = emptyIfNull(src.Ihud);
        sourceObj.LayerId = emptyIfNull(src.LayerId);
      }

      // ----- Build Target fields -----
      if (tgt.kind === 'cell') {
        targetObj.ObjId = tgt.assignmentId === null ? '' : String(tgt.assignmentId);
        targetObj.TeacherId = emptyIfNull(tgt.TeacherId);
        targetObj.ProfessionalId = emptyIfNull(tgt.ProfessionalId);
        targetObj.ClassId = String(tgt.ClassId);
        targetObj.HourId = String(tgt.HourId);
        targetObj.Hakbatza = emptyIfNull(tgt.Hakbatza);
        targetObj.Ihud = emptyIfNull(tgt.Ihud);
        targetObj.LayerId = emptyIfNull(tgt.LayerId);
      }

      // ----- Determine Type (follows Assign.aspx JS order exactly) -----

      // 1: teacher -> empty/only-pro cell
      if (src.kind === 'freeTeacher' && tgt.kind === 'cell' && !targetObj.TeacherId) {
        Type = 1;
      }
      // 2: professional drop
      if (src.kind === 'professional' && tgt.kind === 'cell') {
        Type = 2;
      }
      // 3: drag existing assignment back to teacher container
      if (tgt.kind === 'teacherContainer') {
        targetObj.ObjId = '';
        Type = 3;
      }
      // 4: drag existing assignment to pro container
      if (tgt.kind === 'proContainer') {
        targetObj.ObjId = '';
        Type = 4;
      }
      // 5: teacher -> taken cell (hakbatza)
      if (src.kind === 'freeTeacher' && tgt.kind === 'cell' && !!targetObj.TeacherId) {
        Type = 5;
      }
      // 6: existing assignment moved to empty slot same hour+layer (swap/move)
      if (
        src.kind === 'assign' &&
        tgt.kind === 'cell' &&
        sourceObj.HourId === targetObj.HourId &&
        sourceObj.LayerId === targetObj.LayerId &&
        !targetObj.TeacherId &&
        !targetObj.ProfessionalId &&
        !!sourceObj.TeacherId
      ) {
        Type = 6;
      }

      if (!Type) return;

      try {
        const res = await ajax<AssignResultRow[]>('Assign_SetAssignManual', {
          Type: String(Type),
          SourceId: sourceObj.ObjId,
          SourceTeacherId: sourceObj.TeacherId,
          SourceClassId: sourceObj.ClassId,
          SourceHourId: sourceObj.HourId,
          SourceProfessionalId: sourceObj.ProfessionalId,
          SourceHakbatza: sourceObj.Hakbatza,
          SourceIhud: sourceObj.Ihud,
          TargetId: targetObj.ObjId,
          TargetTeacherId: targetObj.TeacherId,
          TargetClassId: targetObj.ClassId,
          TargetHourId: targetObj.HourId,
          TargetProfessionalId: targetObj.ProfessionalId,
          TargetHakbatza: targetObj.Hakbatza,
          TargetIhud: targetObj.Ihud,
        });
        const err = Array.isArray(res) && res[0] ? Number(res[0].res) : 0;
        if (err === 0) {
          loadAssignments(layerId);
          if (Type === 1 || Type === 3 || Type === 5) {
            loadFreeTeachers(selectedClassId);
          }
        } else if (err === 2) {
          setErrorMsg('מורה כבר משובץ לשעה זו');
        } else if (err === 3) {
          setErrorMsg('מורה לא מוגדר\\ת לעבוד בשעה זו');
        } else if (err === 4) {
          setErrorMsg('המורה עברה את השעות שהוקצה לה לכיתה זו');
        }
      } catch (err) {
        console.error('Assign_SetAssignManual', err);
        setErrorMsg('שגיאה בשמירה');
      }
    },
    [layerId, loadAssignments, loadFreeTeachers, selectedClassId],
  );

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    if (!e.over) return;
    const src = e.active.data.current as DragPayload | undefined;
    const tgt = e.over.data.current as DropPayload | undefined;
    if (!src || !tgt) return;
    void resolveDrop(src, tgt);
  };

  // --- empty-slot optional teachers ---
  const handleBadgeClick = useCallback((slot: AssignSlot) => {
    if (slot.primary.AssignmentId) return;
    const { ClassId, HourId } = slot.primary;
    ajax<OptionalTeacherRow[]>('Assign_GetAllTeacherOptional', {
      ClassId: String(ClassId),
      HourId: String(HourId),
    })
      .then((data) => {
        setOptionalTeachersAlert((data ?? []).map((r) => r.Name));
      })
      .catch((err) => console.error('Assign_GetAllTeacherOptional', err));
  }, []);

  // --- right-click ---
  const handleTeacherRightClick = (
    e: React.MouseEvent,
    teacherId: string | number,
    classId: string | number,
  ) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, teacherId, classId });
  };

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [ctxMenu]);

  const printRef = useRef<HTMLDivElement>(null);

  const doPrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(
      `<html dir="rtl"><head><title>הדפסה</title></head><body>${printRef.current.innerHTML}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  // ---- render ----
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="assign-page">
      {initialLoading && <PageLoader title="טוען מערכת בית הספר" subtitle="מאחזר כיתות, מורים ומקצועות..." />}
      <div className="col-md-12 assign-page__main" style={{ paddingBottom: 180 }}>
        <div className="row dvWeek">
          <div className="panel panel-info">
            <div className="panel-heading assign-layer-bar">
              <div className="assign-layer-tabs" role="tablist">
                {LAYERS.map((l) => (
                  <label
                    key={l.id}
                    className={`assign-layer-tab${layerId === l.id ? ' is-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="layer"
                      value={l.id}
                      checked={layerId === l.id}
                      onChange={() => setLayerId(l.id)}
                    />
                    <span>{l.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-info btn-sm assign-print-btn"
                onClick={doPrint}
              >
                <i className="fa fa-print" /> הדפס מערכת
              </button>
            </div>
            <div className="panel-body assign-grid">
              {grid.classes.length === 0 && (
                <div className="assign-grid__empty">
                  <i className="fa fa-info-circle" />
                  <div>בחר שכבה כדי להציג את מערכת הכיתות</div>
                </div>
              )}
              {grid.classes.map((cls) => (
                <div key={cls.ClassId} className="assign-class-row">
                  <div className="assign-class-row__header">
                    <button
                      type="button"
                      className="btn btn-primary btn-round assign-class-row__chip"
                      onClick={() => loadFreeTeachers(cls.ClassId)}
                    >
                      <i className="fa fa-users" /> {cls.ClassName}
                    </button>
                  </div>
                  <div className="assign-class-row__days">
                    {[1, 2, 3, 4, 5, 6].map((dayId) => {
                      const key = `${cls.ClassId}_${dayId}`;
                      const slots = grid.cells.get(key) ?? [];
                      return (
                        <div key={dayId} className="assign-day col-md-2">
                          <div className="panel panel-info">
                            <div className="panel-heading dvClassDayTitle">
                              <h3 className="panel-title">{DAY_NAMES[dayId]}</h3>
                            </div>
                            <div className="panel-body dvClassDayBody">
                              {slots.map((slot, i) => (
                                <AssignBadge
                                  key={`${slot.primary.AssignmentId ?? 'e'}-${slot.primary.HourId}-${i}`}
                                  slot={slot}
                                  highlightTeacherId={highlightTeacherId}
                                  highlightClassId={highlightClassId}
                                  onBadgeClick={handleBadgeClick}
                                  onTeacherRightClick={handleTeacherRightClick}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- bottom fixed: free teachers + professionals ---- */}
      <div className="assign-dockbar">
        <div className="assign-dockbar__col assign-dockbar__col--teachers">
          <div className="panel panel-primary">
            <div className="panel-heading">
              <h3 className="panel-title">
                <i className="fa fa-user-plus" /> מורים פנויים{' '}
                <a
                  className="assign-dockbar__link"
                  style={{ cursor: 'pointer' }}
                  onClick={() => loadFreeTeachers('')}
                >
                  הצג הכל
                </a>
              </h3>
            </div>
            <FreeTeacherDropZone>
              {freeTeachers.length === 0 && (
                <div className="assign-dockbar__empty">גרור מורים לכיתה או לחץ על "הצג הכל"</div>
              )}
              {freeTeachers.map((t) => (
                <DraggableFreeTeacher key={t.TeacherId} teacher={t} />
              ))}
            </FreeTeacherDropZone>
          </div>
        </div>
        <div className="assign-dockbar__col assign-dockbar__col--pros">
          <div className="panel panel-primary">
            <div className="panel-heading">
              <h3 className="panel-title">
                <i className="fa fa-book" /> מקצועות
              </h3>
            </div>
            <ProDropZone>
              {professionals.map((p) => (
                <DraggableProfessional key={p.ProfessionalId} pro={p} />
              ))}
            </ProDropZone>
          </div>
        </div>
      </div>
      </div>

      {/* Drag overlay ghost */}
      <DragOverlay>
        {activeDrag?.kind === 'freeTeacher' && (
          <div className="btn btn-success btn-round">{activeDrag.TeacherName}</div>
        )}
        {activeDrag?.kind === 'professional' && (
          <div className="btn btn-primary btn-round">{activeDrag.Name}</div>
        )}
        {activeDrag?.kind === 'assign' && (
          <div className="btn btn-primary btnWorker">
            {activeDrag.Professional ? `${activeDrag.Professional} - ` : ''}
            {activeDrag.TeacherName}
          </div>
        )}
      </DragOverlay>

      {/* --- Error bootbox --- */}
      {errorMsg && (
        <div
          style={{
            position: 'fixed',
            top: 120,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            border: '1px solid #888',
            padding: 16,
            zIndex: 6000,
            direction: 'rtl',
            minWidth: 300,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ marginBottom: 10 }}>{errorMsg}</div>
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={() => setErrorMsg('')}>
              אישור
            </button>
          </div>
        </div>
      )}

      {/* --- Optional teachers alert (when clicking an empty slot) --- */}
      {optionalTeachersAlert && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            border: '1px solid #888',
            padding: 16,
            zIndex: 6000,
            direction: 'rtl',
            minWidth: 260,
            maxHeight: '70vh',
            overflow: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <h4>מורים אפשריים</h4>
          {optionalTeachersAlert.length === 0 ? (
            <div>אין מורים זמינים</div>
          ) : (
            optionalTeachersAlert.map((n, i) => (
              <div key={i} style={{ padding: '4px 0' }}>
                {n}
              </div>
            ))
          )}
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button className="btn btn-primary" onClick={() => setOptionalTeachersAlert(null)}>
              סגור
            </button>
          </div>
        </div>
      )}

      {/* --- Context menu --- */}
      {ctxMenu && (
        <ul
          className="dropdown-menu"
          style={{
            display: 'block',
            position: 'fixed',
            top: ctxMenu.y,
            left: ctxMenu.x,
            zIndex: 7000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setTeacherHoursModalId(ctxMenu.teacherId);
                setCtxMenu(null);
              }}
            >
              הצג מערכת מורה
            </a>
          </li>
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPerClassModalId(ctxMenu.teacherId);
                setCtxMenu(null);
              }}
            >
              שעות בבית הספר
            </a>
          </li>
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setHighlightTeacherId(String(ctxMenu.teacherId));
                setHighlightClassId(String(ctxMenu.classId));
                setCtxMenu(null);
              }}
            >
              סמן שעות בכיתה
            </a>
          </li>
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setHighlightTeacherId('');
                setHighlightClassId('');
                setCtxMenu(null);
              }}
            >
              בטל הדגשה
            </a>
          </li>
          <li className="divider" />
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setCtxMenu(null);
              }}
            >
              סגור
            </a>
          </li>
        </ul>
      )}

      {/* --- Modals --- */}
      {teacherHoursModalId !== null && (
        <TeacherHoursModal
          teacherId={teacherHoursModalId}
          onClose={() => setTeacherHoursModalId(null)}
        />
      )}
      {perClassModalId !== null && (
        <TeacherHoursPerClassModal
          teacherId={perClassModalId}
          onClose={() => setPerClassModalId(null)}
        />
      )}

      {/* --- Hidden print area: server-rendered but shown only via window.print --- */}
      <div ref={printRef} style={{ display: 'none' }}>
        {grid.classes.map((cls) => (
          <div key={cls.ClassId} style={{ pageBreakAfter: 'always' }}>
            <div
              style={{
                textAlign: 'center',
                fontStyle: 'italic',
                fontFamily: 'David',
                fontSize: 50,
              }}
            >
              מערכת שעות בית ספר
            </div>
            <div style={{ fontFamily: 'David', fontWeight: 'bold', padding: 10, fontSize: 30 }}>
              {cls.ClassName}
            </div>
            <table cellPadding={0} cellSpacing={0} width="100%" border={0}>
              <thead>
                <tr>
                  {[1, 2, 3, 4, 5, 6].map((d) => (
                    <td
                      key={d}
                      style={{
                        textAlign: 'center',
                        background: '#428bca',
                        color: 'white',
                        border: 'solid 1px black',
                        fontSize: 18,
                        fontWeight: 'bold',
                      }}
                    >
                      {DAY_NAMES[d]}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[1, 2, 3, 4, 5, 6].map((d) => {
                    const slots = grid.cells.get(`${cls.ClassId}_${d}`) ?? [];
                    return (
                      <td key={d} style={{ verticalAlign: 'top', fontSize: 12 }}>
                        {slots.map((slot, i) => {
                          const names: string[] = [];
                          if (slot.primary.TeacherName) names.push(slot.primary.TeacherName);
                          for (const ex of slot.extras) {
                            if (ex.TeacherName) names.push(ex.TeacherName);
                          }
                          const combo = names.join(' / ');
                          return (
                            <div
                              key={i}
                              style={{
                                height: 50,
                                fontSize: 20,
                                padding: 4,
                                border: 'solid 1px silver',
                                fontWeight: 'bold',
                              }}
                            >
                              {slot.primary.Ihud ? <u>{combo}</u> : combo}
                              <div
                                style={{
                                  textAlign: 'left',
                                  fontSize: 15,
                                  fontStyle: 'italic',
                                  fontWeight: 'lighter',
                                }}
                              >
                                {slot.primary.Professional ?? ''}
                              </div>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </DndContext>
  );
}
