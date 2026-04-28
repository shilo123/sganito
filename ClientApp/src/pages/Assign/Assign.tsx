import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
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
import ExportButtons from '../../lib/ExportButtons';
import { buildScheduleHandlers } from '../../lib/export';
import { readUserData } from '../../auth/userData';

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

// שעות היום — זהות ל-SchoolHours
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

function getDayId(hourId: string | number | null | undefined): number {
  if (hourId === null || hourId === undefined) return 0;
  return Number(String(hourId).charAt(0)) || 0;
}

function getSeqId(hourId: string | number | null | undefined): number {
  if (hourId === null || hourId === undefined) return 0;
  const s = String(hourId);
  return Number(s.substring(1)) || 0;
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

// Small day-of-week label helper used by the tooltip.
function dayName(n: number | string | null | undefined): string {
  const v = Number(n);
  return ['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'][v] || '';
}

interface FreeTeacherTooltipInfo {
  Frontaly?: string | number;
  Tafkid?: string;
  Professional?: string;
  FreeDay?: string | number | null;
}

function DraggableFreeTeacher({
  teacher,
  info,
}: {
  teacher: FreeTeacher;
  info?: FreeTeacherTooltipInfo;
}) {
  const payload: DragTeacherPayload = {
    kind: 'freeTeacher',
    TeacherId: teacher.TeacherId,
    TeacherName: teacher.TeacherName,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `freeTeacher-${teacher.TeacherId}`,
    data: payload,
  });
  // Tooltip uses position:fixed so ancestors with overflow:hidden/auto
  // (the dockbar's .panel-body) can't clip it. We compute coords on
  // mouseenter and pass them down to the portal.
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);

  const handleEnter = () => {
    if (isDragging) return;
    const el = pillRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Anchor tip above the pill, horizontally centered
    setTipPos({ x: r.left + r.width / 2, y: r.top });
  };
  const handleLeave = () => setTipPos(null);

  return (
    <>
      <div
        ref={(el) => {
          setNodeRef(el);
          pillRef.current = el;
        }}
        {...listeners}
        {...attributes}
        className="btn btn-success btn-round selected free-teacher-pill"
        style={{
          float: 'right',
          margin: 2,
          opacity: isDragging ? 0.4 : 1,
          cursor: 'move',
          userSelect: 'none',
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <span>{teacher.TeacherName}</span>
        {teacher.FreeHour ? <span style={{ opacity: 0.85, marginInlineStart: 4, fontSize: '0.76rem' }}>({teacher.FreeHour})</span> : null}
      </div>
      {tipPos && (
        <div
          className="ft-tip ft-tip--portal"
          role="tooltip"
          style={{
            position: 'fixed',
            left: tipPos.x,
            top: tipPos.y,
            transform: 'translate(-50%, -100%) translateY(-10px)',
          }}
        >
          <div className="ft-tip__name">{teacher.TeacherName}</div>
          <div className="ft-tip__rows">
            {info?.Tafkid && (
              <div className="ft-tip__row">
                <i className="fa fa-id-badge ft-tip__ic" /> תפקיד: <strong>{info.Tafkid}</strong>
              </div>
            )}
            {info?.Professional && (
              <div className="ft-tip__row">
                <i className="fa fa-book ft-tip__ic" /> מקצוע: <strong>{info.Professional}</strong>
              </div>
            )}
            {info?.Frontaly != null && info.Frontaly !== '' && (
              <div className="ft-tip__row">
                <i className="fa fa-clock-o ft-tip__ic" /> שעות שבועיות: <strong>{info.Frontaly}</strong>
              </div>
            )}
            {info?.FreeDay != null && Number(info.FreeDay) > 0 && (
              <div className="ft-tip__row">
                <i className="fa fa-calendar ft-tip__ic" /> יום חופשי: <strong>{dayName(info.FreeDay)}</strong>
              </div>
            )}
            {(!info || (!info.Tafkid && !info.Professional && info.Frontaly == null)) && (
              <div className="ft-tip__row" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                אין מידע נוסף
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Maps profession names to an emoji + color palette. Keywords are matched
// against the name (substring) so partial matches still style correctly.
// If nothing matches we fall back to a hash-based color so every profession
// still gets a distinct look.
const PRO_THEMES: Array<{ match: RegExp; icon: string; grad: string; shadow: string; border: string }> = [
  { match: /מתמט|חשבון|מספר/,         icon: '🔢', grad: 'linear-gradient(135deg, #dbeafe, #93c5fd)', shadow: 'rgba(37,99,235,0.35)',  border: '#3b82f6' },
  { match: /אנגל|English/i,            icon: '🔤', grad: 'linear-gradient(135deg, #fee2e2, #fca5a5)', shadow: 'rgba(220,38,38,0.35)',   border: '#dc2626' },
  { match: /עברי|קריא|כתיב|לשון/,      icon: '📖', grad: 'linear-gradient(135deg, #fef3c7, #fcd34d)', shadow: 'rgba(217,119,6,0.35)',   border: '#d97706' },
  { match: /תנ.?ך|מקרא|תורה|דת|יהד/,   icon: '📜', grad: 'linear-gradient(135deg, #fde68a, #f59e0b)', shadow: 'rgba(180,83,9,0.35)',    border: '#b45309' },
  { match: /תפיל|תפלה|בית.?כנס/,       icon: '🕍', grad: 'linear-gradient(135deg, #e0e7ff, #818cf8)', shadow: 'rgba(79,70,229,0.35)',   border: '#4f46e5' },
  { match: /היסטור/,                    icon: '🏛️', grad: 'linear-gradient(135deg, #fef3c7, #d97706)', shadow: 'rgba(146,64,14,0.35)',    border: '#92400e' },
  { match: /גיאוגרפ|מולד|אזרח/,        icon: '🗺️', grad: 'linear-gradient(135deg, #d1fae5, #6ee7b7)', shadow: 'rgba(16,185,129,0.35)',  border: '#059669' },
  { match: /מדע|טבע|ביולוג|כימ|פיזיק/, icon: '🔬', grad: 'linear-gradient(135deg, #cffafe, #67e8f9)', shadow: 'rgba(8,145,178,0.35)',   border: '#0891b2' },
  { match: /מחשב|תכנות|טכנולוג|רובוט/, icon: '💻', grad: 'linear-gradient(135deg, #e0f2fe, #38bdf8)', shadow: 'rgba(2,132,199,0.35)',   border: '#0284c7' },
  { match: /ספור|גופני|התעמל|שחיה/,    icon: '⚽', grad: 'linear-gradient(135deg, #dcfce7, #4ade80)', shadow: 'rgba(22,163,74,0.35)',   border: '#16a34a' },
  { match: /מוזיק|נגינ|שיר|תזמור/,     icon: '🎵', grad: 'linear-gradient(135deg, #fce7f3, #f472b6)', shadow: 'rgba(219,39,119,0.35)',  border: '#db2777' },
  { match: /אומנ|אמנ|ציור|יצירה/,      icon: '🎨', grad: 'linear-gradient(135deg, #f3e8ff, #c084fc)', shadow: 'rgba(147,51,234,0.35)',  border: '#9333ea' },
  { match: /דרמה|תיאטרו|משחק/,         icon: '🎭', grad: 'linear-gradient(135deg, #fae8ff, #e879f9)', shadow: 'rgba(192,38,211,0.35)',  border: '#c026d3' },
  { match: /מלאכה|נגר|חרש|עבוד/,       icon: '🔨', grad: 'linear-gradient(135deg, #ffedd5, #fb923c)', shadow: 'rgba(234,88,12,0.35)',   border: '#ea580c' },
  { match: /חינוך.?חבר|כישור|חייהחבר/, icon: '🤝', grad: 'linear-gradient(135deg, #fef3c7, #facc15)', shadow: 'rgba(202,138,4,0.35)',   border: '#ca8a04' },
  { match: /חינוך/,                    icon: '🎓', grad: 'linear-gradient(135deg, #dbeafe, #60a5fa)', shadow: 'rgba(37,99,235,0.35)',   border: '#2563eb' },
  { match: /שעת.?חב|חברה/,             icon: '👥', grad: 'linear-gradient(135deg, #ede9fe, #a78bfa)', shadow: 'rgba(124,58,237,0.35)',  border: '#7c3aed' },
  { match: /פרטני|תגבור|סיוע/,         icon: '🧑‍🏫', grad: 'linear-gradient(135deg, #fff1f2, #fda4af)', shadow: 'rgba(225,29,72,0.35)',   border: '#e11d48' },
  { match: /שה.?ה|שהייה/,              icon: '⏳', grad: 'linear-gradient(135deg, #f1f5f9, #cbd5e1)', shadow: 'rgba(71,85,105,0.30)',   border: '#64748b' },
  { match: /אשכול/,                    icon: '🧩', grad: 'linear-gradient(135deg, #ccfbf1, #5eead4)', shadow: 'rgba(13,148,136,0.35)',  border: '#0d9488' },
];

const FALLBACK_GRADIENTS: Array<{ grad: string; border: string; shadow: string }> = [
  { grad: 'linear-gradient(135deg, #fde68a, #f59e0b)', border: '#d97706', shadow: 'rgba(217,119,6,0.35)' },
  { grad: 'linear-gradient(135deg, #bfdbfe, #3b82f6)', border: '#1d4ed8', shadow: 'rgba(29,78,216,0.35)' },
  { grad: 'linear-gradient(135deg, #fbcfe8, #ec4899)', border: '#be185d', shadow: 'rgba(190,24,93,0.35)' },
  { grad: 'linear-gradient(135deg, #bbf7d0, #22c55e)', border: '#15803d', shadow: 'rgba(21,128,61,0.35)' },
  { grad: 'linear-gradient(135deg, #c7d2fe, #818cf8)', border: '#4338ca', shadow: 'rgba(67,56,202,0.35)' },
  { grad: 'linear-gradient(135deg, #fecaca, #ef4444)', border: '#b91c1c', shadow: 'rgba(185,28,28,0.35)' },
  { grad: 'linear-gradient(135deg, #a7f3d0, #10b981)', border: '#047857', shadow: 'rgba(4,120,87,0.35)' },
  { grad: 'linear-gradient(135deg, #fed7aa, #f97316)', border: '#c2410c', shadow: 'rgba(194,65,12,0.35)' },
];

function proTheme(name: string): { icon: string; grad: string; shadow: string; border: string } {
  for (const t of PRO_THEMES) {
    if (t.match.test(name)) return { icon: t.icon, grad: t.grad, shadow: t.shadow, border: t.border };
  }
  // Deterministic fallback by hashing the profession name
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const pick = FALLBACK_GRADIENTS[Math.abs(h) % FALLBACK_GRADIENTS.length];
  return { icon: '📚', grad: pick.grad, shadow: pick.shadow, border: pick.border };
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
  const theme = proTheme(pro.Name);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="pro-pill"
      style={{
        opacity: isDragging ? 0.4 : 1,
        background: theme.grad,
        borderColor: theme.border,
        '--pro-shadow': theme.shadow,
        '--pro-border': theme.border,
      } as React.CSSProperties}
      title={pro.Name}
    >
      <span className="pro-pill__icon" aria-hidden="true">{theme.icon}</span>
      <span className="pro-pill__name">{pro.Name}</span>
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
        // Height grows with content (the pills wrap), but capped so the
        // dock never swallows the page when many teachers are returned.
        minHeight: 56,
        maxHeight: 150,
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

function AssignBadgeImpl({
  slot,
  highlightTeacherId,
  highlightClassId,
  onBadgeClick,
  onTeacherRightClick,
  teacherInfo,
  dragBlockReason,
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
  teacherInfo?: FreeTeacherTooltipInfo;
  // Non-empty when a free-teacher card is being dragged AND this slot is
  // off-limits for that teacher (free day or outside their working hours).
  // The cell renders dimmed and intercepts the drop attempt visually.
  dragBlockReason?: string;
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
  // dnd-kit identifies a droppable by this id. It MUST be stable across
  // re-renders — using Math.random() here re-registered every empty cell
  // on each parent re-render, which broke drops onto unassigned slots.
  // For assigned cells we have a real AssignmentId; for empty ones the
  // (Class, Hour, Layer) tuple is unique inside the grid.
  const droppableId = assignId
    ? `cell-${assignId}`
    : `cell-empty-${primary.ClassId}-${primary.HourId}-${primary.LayerId ?? '0'}`;
  const droppable = useDroppable({
    id: droppableId,
    data: dropPayload,
  });

  const cellRef = useRef<HTMLElement | null>(null);
  const setNodeRef = (el: HTMLElement | null) => {
    draggable.setNodeRef(el);
    droppable.setNodeRef(el);
    cellRef.current = el;
  };

  // Tooltip state for the schedule cell: shown on hover when the slot has
  // a teacher assigned. Coordinates use position:fixed so overflow of the
  // grid container can't clip the tip.
  const [cellTipPos, setCellTipPos] = useState<{ x: number; y: number } | null>(null);
  const handleCellEnter = () => {
    if (!primary.TeacherName) return; // empty cells → no tooltip
    const el = cellRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCellTipPos({ x: r.left + r.width / 2, y: r.top });
  };
  const handleCellLeave = () => setCellTipPos(null);

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
    teacherSpans.push(
      <span
        key="blank"
        style={{
          color: '#9ca3af',
          fontStyle: 'italic',
          fontSize: 11,
          fontWeight: 500,
        }}
      >
        אין שיבוץ
      </span>,
    );
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

  const teacherDisplay = <>{teacherSpans}</>;

  const hakNum = Number(primary.Hakbatza ?? 0);
  // Same palette as TeacherClass/TeacherHours so colors stay consistent across the app
  const assignPalette = (n: number): string => {
    if (!n) return 'transparent';
    const hPalette = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#ddd6fe', '#a7f3d0', '#fecaca'];
    return hPalette[(n - 1) % hPalette.length];
  };

  const isBlocked = !!dragBlockReason;
  // Solid colors only — earlier we used `repeating-linear-gradient` here,
  // which the browser repaints on every dnd-kit move event across all 1500+
  // grid cells and made the drag feel laggy.
  const style: React.CSSProperties = {
    zIndex: 10,
    margin: 2,
    cursor: hasAssignment ? 'move' : isBlocked ? 'not-allowed' : 'default',
    background: isBlocked
      ? '#fecaca'
      : droppable.isOver
        ? '#cfe8ff'
        : undefined,
    opacity: draggable.isDragging ? 0.4 : isBlocked ? 0.6 : 1,
    position: 'relative',
    ...(isBlocked ? { boxShadow: 'inset 0 0 0 2px #dc2626' } : null),
    ...(isHighlighted && !isBlocked
      ? { backgroundColor: '#ffeb3b', boxShadow: '0 0 8px #ff9800' }
      : null),
  };

  return (
    <>
      <div
        ref={setNodeRef}
        {...(hasAssignment ? draggable.listeners : {})}
        {...(hasAssignment ? draggable.attributes : {})}
        className={`btn btn-${theme} btnWorker`}
        style={style}
        title={dragBlockReason || undefined}
        onClick={() => onBadgeClick(slot)}
        onMouseEnter={handleCellEnter}
        onMouseLeave={handleCellLeave}
      >
        {hakNum > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 1,
              insetInlineEnd: 2,
              pointerEvents: 'none',
            }}
          >
            <span
              title={`הקבצה ${hakNum}`}
              style={{
                background: assignPalette(hakNum),
                color: '#1f2937',
                padding: '1px 4px',
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ה{hakNum}
            </span>
          </span>
        )}
        <span style={{ fontWeight: 'bold' }}>
          {primary.Professional ? `${primary.Professional} -` : ''}
        </span>{' '}
        {teacherDisplay}
      </div>
      {cellTipPos && primary.TeacherName && (
        <div
          className="ft-tip ft-tip--portal"
          role="tooltip"
          style={{
            position: 'fixed',
            left: cellTipPos.x,
            top: cellTipPos.y,
            transform: 'translate(-50%, -100%) translateY(-10px)',
          }}
        >
          <div className="ft-tip__name">{primary.TeacherName}</div>
          <div className="ft-tip__rows">
            {teacherInfo?.Tafkid && (
              <div className="ft-tip__row">
                <i className="fa fa-id-badge ft-tip__ic" /> תפקיד: <strong>{teacherInfo.Tafkid}</strong>
              </div>
            )}
            {(primary.Professional || teacherInfo?.Professional) && (
              <div className="ft-tip__row">
                <i className="fa fa-book ft-tip__ic" /> מקצוע: <strong>{primary.Professional || teacherInfo?.Professional}</strong>
              </div>
            )}
            {teacherInfo?.Frontaly != null && teacherInfo.Frontaly !== '' && (
              <div className="ft-tip__row">
                <i className="fa fa-clock-o ft-tip__ic" /> שעות שבועיות: <strong>{teacherInfo.Frontaly}</strong>
              </div>
            )}
            {teacherInfo?.FreeDay != null && Number(teacherInfo.FreeDay) > 0 && (
              <div className="ft-tip__row">
                <i className="fa fa-calendar ft-tip__ic" /> יום חופשי: <strong>{dayName(teacherInfo.FreeDay)}</strong>
              </div>
            )}
            {hakNum > 0 && (
              <div className="ft-tip__row">
                <i className="fa fa-object-group ft-tip__ic" /> הקבצה: <strong>{hakNum}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// React.memo with a shallow custom compare. Without this, dnd-kit's pointer
// move events trigger the parent (Assign) to re-render once per frame, which
// re-mounts every one of the 1500+ schedule cells and made the drag feel
// stuck. The compare ignores `teacherInfo` identity (it's rebuilt inline
// each render but the actual values rarely change for the same TeacherId).
const AssignBadge = memo(AssignBadgeImpl, (prev, next) => {
  if (prev.slot !== next.slot) return false;
  if (prev.highlightTeacherId !== next.highlightTeacherId) return false;
  if (prev.highlightClassId !== next.highlightClassId) return false;
  if (prev.onBadgeClick !== next.onBadgeClick) return false;
  if (prev.onTeacherRightClick !== next.onTeacherRightClick) return false;
  if ((prev.dragBlockReason ?? '') !== (next.dragBlockReason ?? '')) return false;
  // teacherInfo: compare the only fields the cell renders
  const a = prev.teacherInfo;
  const b = next.teacherInfo;
  if (!a !== !b) return false;
  if (a && b) {
    if (a.Frontaly !== b.Frontaly) return false;
    if (a.Tafkid !== b.Tafkid) return false;
    if (a.Professional !== b.Professional) return false;
    if (a.FreeDay !== b.FreeDay) return false;
  }
  return true;
});

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
  // allAssignments holds the full dataset (LayerId=0); `assignments` below filters it.
  const [allAssignments, setAllAssignments] = useState<AssignmentRow[]>([]);
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
  // Load the full dataset (LayerId=0) once; layer switches filter client-side.
  const loadAssignments = useCallback(() => {
    return ajax<AssignmentRow[]>('Assign_GetAssignment', { LayerId: '0' })
      .then((data) => setAllAssignments(data ?? []))
      .catch((err) => console.error('Assign_GetAssignment', err));
  }, []);

  const loadFreeTeachers = useCallback((classId: string) => {
    setSelectedClassId(classId);
    // Empty classId → "הצג הכל": we use the dedicated endpoint that returns
    // only teachers whose working hours match at least one empty (class,
    // hour) slot. Teachers that can't actually help stay hidden.
    if (!classId) {
      return ajax<FreeTeacher[]>('Assign_GetFreeTeachersForEmpty')
        .then((data) => setFreeTeachers(Array.isArray(data) ? data : []))
        .catch((err) => console.error('Assign_GetFreeTeachersForEmpty', err));
    }
    return ajax<FreeTeacher[]>('Assign_GetFreeTeacher', { ClassId: classId })
      .then((data) => setFreeTeachers(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Assign_GetFreeTeacher', err));
  }, []);

  const loadProfessionals = useCallback(() => {
    return ajax<Professional[]>('Gen_GetTable', {
      TableName: 'Professional',
      Condition: `ConfigurationId=${configurationId}`,
    })
      .then((data) => setProfessionals(data ?? []))
      .catch((err) => console.error('Gen_GetTable Professional', err));
  }, [configurationId]);

  // Per-teacher set of HourIds the teacher is allowed to work — used to grey
  // out illegal cells while a free-teacher card is being dragged. We hit
  // Gen_GetTable directly (one round-trip) instead of N calls of
  // Teacher_GetAllTeacherHours per teacher.
  const [teacherHourMap, setTeacherHourMap] = useState<Map<string, Set<string>>>(new Map());
  const loadTeacherHourMap = useCallback(() => {
    return ajax<Array<{ TeacherId: string | number; HourId: string | number }>>('Gen_GetTable', {
      TableName: 'TeacherHours',
      Condition: `ConfigurationId=${configurationId}`,
    })
      .then((data) => {
        const m = new Map<string, Set<string>>();
        for (const row of data ?? []) {
          const tid = String(row.TeacherId);
          const hid = String(row.HourId);
          let set = m.get(tid);
          if (!set) {
            set = new Set();
            m.set(tid, set);
          }
          set.add(hid);
        }
        setTeacherHourMap(m);
      })
      .catch((err) => console.error('Gen_GetTable TeacherHours', err));
  }, [configurationId]);

  useEffect(() => {
    if (!configurationId) return;
    setInitialLoading(true);
    Promise.allSettled([
      loadProfessionals(),
      loadFreeTeachers(''),
      loadAssignments(),
      loadTeacherHourMap(),
    ]).finally(() => setInitialLoading(false));
  }, [configurationId, loadProfessionals, loadFreeTeachers, loadAssignments, loadTeacherHourMap]);

  // --- derived: filter the full dataset by selected layer (client-side) ---
  const assignments = useMemo(() => {
    if (layerId === '0') return allAssignments;
    return allAssignments.filter(
      (r) => String(r.LayerId ?? '') === layerId,
    );
  }, [allAssignments, layerId]);

  const grid = useMemo(() => buildGrid(assignments), [assignments]);

  // Coverage stats for the headline pill. A slot is counted per class per
  // (day, hour) cell that exists in the grid — so classes with fewer
  // school hours don't get penalized for being shorter.
  const coverage = useMemo(() => {
    const classCount = grid.classes.length;
    let totalCells = 0;
    let filledCells = 0;
    for (const [, slots] of grid.cells) {
      for (const s of slots) {
        totalCells++;
        if (s.primary.TeacherId) filledCells++;
      }
    }
    // Fallback when grid.cells doesn't include every possible cell: compute
    // from assignments vs. a 5-day × 9-hour baseline.
    if (totalCells === 0) {
      totalCells = classCount * 5 * 9;
      filledCells = assignments.filter((a) => a.TeacherId).length;
    }
    const pct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
    return { filledCells, totalCells, pct, classCount };
  }, [grid, assignments]);

  // A map of full teacher details for the tooltip on the dockbar hover.
  // We load once from `Teacher_GetTeacherList` and reuse.
  interface FullTeacher {
    TeacherId: number | string;
    FirstName?: string;
    LastName?: string;
    Frontaly?: string | number;
    FreeDay?: string | number | null;
    Tafkid?: string;
    TafkidId?: number | string;
    Professional?: string;
    ProfessionalId?: number | string | null;
  }
  const [teacherDetails, setTeacherDetails] = useState<Map<string, FullTeacher>>(new Map());
  useEffect(() => {
    if (!configurationId) return;
    (async () => {
      try {
        const all = await ajax<FullTeacher[]>('Teacher_GetTeacherList', { TeacherId: '' });
        const m = new Map<string, FullTeacher>();
        for (const t of all || []) m.set(String(t.TeacherId), t);
        setTeacherDetails(m);
      } catch (e) {
        console.error('Teacher_GetTeacherList (details) failed', e);
      }
    })();
  }, [configurationId]);

  // Returns the reason the teacher can't take a slot, or '' when allowed.
  // Used both for visual feedback during a drag and as a guard before the
  // server call, so the admin sees a clear message instead of a generic
  // "מורה לא מוגדר/ת לעבוד בשעה זו" toast.
  const teacherSlotBlockReason = useCallback(
    (teacherId: string | number, hourId: string | number): string => {
      const tid = String(teacherId);
      const hid = String(hourId);
      const det = teacherDetails.get(tid);
      const freeDay = det?.FreeDay != null ? Number(det.FreeDay) : 0;
      if (freeDay > 0 && getDayId(hid) === freeDay) {
        return `יום חופשי של המורה (${dayName(freeDay)})`;
      }
      const allowed = teacherHourMap.get(tid);
      // If we somehow never loaded TeacherHours for this teacher, fail open
      // — the server still validates and will reject with err=3.
      if (allowed && allowed.size > 0 && !allowed.has(hid)) {
        return 'השעה אינה מוגדרת בשעות העבודה של המורה';
      }
      return '';
    },
    [teacherDetails, teacherHourMap],
  );

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

      // Pre-flight check for free-teacher drops: refuse on the client when
      // the target slot is the teacher's free day or outside their declared
      // working hours. The server still validates the same thing, but
      // catching it here gives the admin a precise reason instead of the
      // generic err=3 toast — and avoids a wasted round-trip.
      if (
        (Type === 1 || Type === 5) &&
        src.kind === 'freeTeacher' &&
        tgt.kind === 'cell'
      ) {
        const reason = teacherSlotBlockReason(src.TeacherId, tgt.HourId);
        if (reason) {
          setErrorMsg(`לא ניתן לשבץ את ${src.TeacherName}: ${reason}`);
          return;
        }
      }

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
          loadAssignments();
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
    [loadAssignments, loadFreeTeachers, selectedClassId, teacherSlotBlockReason],
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
  const handleTeacherRightClick = useCallback(
    (e: React.MouseEvent, teacherId: string | number, classId: string | number) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, teacherId, classId });
    },
    [],
  );

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
      // Measure all 1500+ droppables once at drag start instead of on every
      // pointer move. Without this, dnd-kit's default `WhileDragging`
      // strategy re-measures the whole grid each frame and the drag stutters.
      measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="assign-page assign-page--with-side">
      {initialLoading && <PageLoader title="טוען מערכת בית הספר" subtitle="מאחזר כיתות, מורים ומקצועות..." />}

      <div className="assign-page__main" style={{ paddingBottom: 180 }}>
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
              <div
                className="assign-coverage-pill"
                title={`שובצו ${coverage.filledCells} מתוך ${coverage.totalCells} משבצות`}
              >
                <div className="assign-coverage-pill__track">
                  <div
                    className="assign-coverage-pill__fill"
                    style={{ width: `${Math.min(100, coverage.pct)}%` }}
                  />
                </div>
                <div className="assign-coverage-pill__label">
                  <i className="fa fa-check-circle" />
                  <strong>{coverage.pct}%</strong> שובץ
                  <span className="assign-coverage-pill__fraction">
                    ({coverage.filledCells}/{coverage.totalCells})
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-info btn-sm assign-print-btn"
                onClick={doPrint}
              >
                <i className="fa fa-print" /> הדפס מערכת
              </button>
              <div style={{ marginInlineStart: 'auto' }}>
                {(() => {
                  const ud = readUserData();
                  const schoolName = ud?.Name ?? 'בית הספר';
                  const logoUrl = ud?.SchoolId ? window.location.origin + `/assets/images/SchoolLogo/${ud.SchoolId}_.png` : undefined;
                  const classList = grid.classes.map((c) => ({ ClassId: c.ClassId, ClassName: c.ClassName }));
                  const handlers = buildScheduleHandlers({
                    schoolName,
                    title: 'מערכת שעות שבועית' + (layerId !== '0' ? ' — ' + (LAYERS.find((l) => l.id === layerId)?.label ?? '') : ''),
                    subtitle: `מערכת מלאה לפי שכבות`,
                    filename: 'school-schedule-' + layerId,
                    classes: classList,
                    assignments: assignments.map((a) => ({
                      ClassId: a.ClassId,
                      ClassName: a.ClassName,
                      HourId: a.HourId,
                      TeacherName: a.TeacherName,
                      Professional: a.Professional,
                      Hakbatza: a.Hakbatza,
                    })),
                    logoUrl,
                  });
                  return <ExportButtons {...handlers} compact />;
                })()}
              </div>
            </div>
            <div className="panel-body assign-grid">
              {grid.classes.length === 0 && (
                <div className="assign-grid__empty">
                  <i className="fa fa-info-circle" />
                  <div>בחר שכבה כדי להציג את מערכת הכיתות</div>
                </div>
              )}
              {grid.classes.map((cls) => {
                // Build a seq lookup per class: Map<"dayId_seq", AssignSlot>
                const cellMap = new Map<string, AssignSlot>();
                for (let dayId = 1; dayId <= 6; dayId++) {
                  const dayKey = `${cls.ClassId}_${dayId}`;
                  const slots = grid.cells.get(dayKey) ?? [];
                  for (const slot of slots) {
                    const seq = getSeqId(slot.primary.HourId);
                    if (seq > 0) cellMap.set(`${dayId}_${seq}`, slot);
                  }
                }
                return (
                  <div key={cls.ClassId} className="assign-schedule">
                    <div className="assign-schedule__header">
                      <button
                        type="button"
                        className="assign-schedule__class-btn"
                        onClick={() => loadFreeTeachers(cls.ClassId)}
                        title="הצג מורים פנויים לכיתה"
                      >
                        <i className="fa fa-users" /> {cls.ClassName}
                      </button>
                    </div>
                    <table className="assign-schedule__table">
                      <thead>
                        <tr>
                          <th className="assign-schedule__hour-hdr">שעה</th>
                          {[1, 2, 3, 4, 5, 6].map((dayId) => (
                            <th
                              key={dayId}
                              className={`assign-schedule__day-hdr day-${dayId}`}
                            >
                              {DAY_NAMES[dayId]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {HOUR_SLOTS.map(({ seq, time }) => (
                          <tr key={seq}>
                            <th className="assign-schedule__hour-cell">
                              <span className="assign-schedule__clock">{time}</span>
                            </th>
                            {[1, 2, 3, 4, 5, 6].map((dayId) => {
                              if (dayId === 6 && seq > 6) {
                                return (
                                  <td key={dayId} className="assign-schedule__cell is-off">
                                    &nbsp;
                                  </td>
                                );
                              }
                              const slot = cellMap.get(`${dayId}_${seq}`);
                              return (
                                <td
                                  key={dayId}
                                  className={`assign-schedule__cell day-${dayId}${slot ? '' : ' is-vacant'}`}
                                  title={`${cls.ClassName} · ${DAY_NAMES[dayId]} שעה ${seq} · ${time}`}
                                >
                                  {slot ? (() => {
                                    const tdet = teacherDetails.get(String(slot.primary.TeacherId ?? ''));
                                    const tInfo: FreeTeacherTooltipInfo | undefined = tdet
                                      ? {
                                          Frontaly: tdet.Frontaly,
                                          Tafkid: tdet.Tafkid,
                                          Professional: tdet.Professional,
                                          FreeDay: tdet.FreeDay,
                                        }
                                      : undefined;
                                    // While a free-teacher is being dragged, mark slots
                                    // the teacher can't legally take (free day or
                                    // outside their working hours). Empty slots and
                                    // hakbatza-merge targets both qualify.
                                    const dragBlockReason =
                                      activeDrag?.kind === 'freeTeacher'
                                        ? teacherSlotBlockReason(activeDrag.TeacherId, slot.primary.HourId)
                                        : '';
                                    return (
                                      <AssignBadge
                                        slot={slot}
                                        highlightTeacherId={highlightTeacherId}
                                        highlightClassId={highlightClassId}
                                        onBadgeClick={handleBadgeClick}
                                        onTeacherRightClick={handleTeacherRightClick}
                                        teacherInfo={tInfo}
                                        dragBlockReason={dragBlockReason}
                                      />
                                    );
                                  })() : (
                                    <span className="assign-schedule__empty" aria-hidden="true">
                                      +
                                    </span>
                                  )}
                                </td>
                              );
                            })}
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

      {/* Vertical professionals column — placed AFTER main so the CSS grid
          puts it in column 2 (= visual left in RTL), keeping main at 1fr */}
      <aside className="assign-pros-side">
        <div className="panel panel-primary">
          <div className="panel-heading">
            <h3 className="panel-title">
              <i className="fa fa-book" /> מקצועות
            </h3>
          </div>
          <ProDropZone>
            {professionals.length === 0 && (
              <div className="assign-dockbar__empty">אין מקצועות טעונים עדיין</div>
            )}
            {professionals.map((p) => (
              <DraggableProfessional key={p.ProfessionalId} pro={p} />
            ))}
          </ProDropZone>
        </div>
      </aside>

      {/* ---- bottom fixed: free teachers only. Hidden entirely when
          no matching teachers exist so the dock doesn't clutter the UI. */}
      {freeTeachers.length > 0 && (
        <div className="assign-dockbar assign-dockbar--solo">
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
                {freeTeachers.map((t) => {
                  const det = teacherDetails.get(String(t.TeacherId));
                  const info: FreeTeacherTooltipInfo | undefined = det
                    ? {
                        Frontaly: det.Frontaly,
                        Tafkid: det.Tafkid,
                        Professional: det.Professional,
                        FreeDay: det.FreeDay,
                      }
                    : undefined;
                  return <DraggableFreeTeacher key={t.TeacherId} teacher={t} info={info} />;
                })}
              </FreeTeacherDropZone>
            </div>
          </div>
        </div>
      )}
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
                              {combo}
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
