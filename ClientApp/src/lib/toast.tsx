import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
  duration: number;
}

interface ToastAPI {
  show: (type: ToastType, message: string, opts?: { title?: string; duration?: number }) => void;
  success: (message: string, opts?: { title?: string; duration?: number }) => void;
  error: (message: string, opts?: { title?: string; duration?: number }) => void;
  warning: (message: string, opts?: { title?: string; duration?: number }) => void;
  info: (message: string, opts?: { title?: string; duration?: number }) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

// Module-level pointer to the active toast API. Lets non-React modules
// (e.g. lib/export.ts) call toast methods without going through context.
let activeToastApi: ToastAPI | null = null;
export function getActiveToast(): ToastAPI | null {
  return activeToastApi;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3200,
  info: 3800,
  warning: 5000,
  error: 6000,
};

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: 'הצלחה',
  error: 'שגיאה',
  warning: 'שימו לב',
  info: 'הודעה',
};

const ICONS: Record<ToastType, string> = {
  success: 'fa-check',
  error: 'fa-exclamation',
  warning: 'fa-exclamation-triangle',
  info: 'fa-info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const tm = timers.current[id];
    if (tm) {
      clearTimeout(tm);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback(
    (type: ToastType, message: string, opts?: { title?: string; duration?: number }) => {
      const id = nextId.current++;
      const duration = opts?.duration ?? DEFAULT_DURATION[type];
      setItems((list) => [
        ...list,
        {
          id,
          type,
          message,
          title: opts?.title ?? DEFAULT_TITLES[type],
          duration,
        },
      ]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastAPI>(
    () => ({
      show,
      success: (m, o) => show('success', m, o),
      error: (m, o) => show('error', m, o),
      warning: (m, o) => show('warning', m, o),
      info: (m, o) => show('info', m, o),
      dismiss,
    }),
    [show, dismiss],
  );

  useEffect(() => () => {
    for (const id of Object.keys(timers.current)) {
      clearTimeout(timers.current[Number(id)]);
    }
  }, []);

  // Expose the toast API to non-React modules so functions like
  // exportToPDF (lib/export.ts) can replace window.alert with a styled
  // toast without needing to thread a callback through every caller.
  useEffect(() => {
    activeToastApi = api;
    return () => {
      if (activeToastApi === api) activeToastApi = null;
    };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite" aria-atomic="true">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} role="alert">
            <div className="toast__icon">
              <i className={`fa ${ICONS[t.type]}`} aria-hidden="true" />
            </div>
            <div className="toast__body">
              {t.title && <div className="toast__title">{t.title}</div>}
              <div className="toast__message">{t.message}</div>
            </div>
            <button
              type="button"
              className="toast__close"
              aria-label="סגור"
              onClick={() => dismiss(t.id)}
            >
              <i className="fa fa-times" aria-hidden="true" />
            </button>
            <div
              className="toast__bar"
              style={{ animationDuration: `${t.duration}ms` }}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
