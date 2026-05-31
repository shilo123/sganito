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
import './confirm.css';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  icon?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface ConfirmState {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const settle = useCallback((value: boolean) => {
    setState((current) => {
      if (current) current.resolve(value);
      return null;
    });
  }, []);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState((current) => {
        // אם כבר פתוח דיאלוג קודם — נסגור אותו עם false כדי לא לאבד את ה-Promise.
        if (current) current.resolve(false);
        return { opts, resolve };
      });
    });
  }, []);

  // מיקוד אוטומטי לכפתור האישור כשהדיאלוג נפתח.
  useEffect(() => {
    if (state) {
      const t = setTimeout(() => confirmBtnRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [state]);

  // תמיכת Esc (ביטול) ו-Enter (אישור) ברמת המסמך.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        settle(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        settle(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state, settle]);

  const api = useMemo<ConfirmFn>(() => confirm, [confirm]);

  const opts = state?.opts;
  const danger = !!opts?.danger;
  const icon = opts?.icon ?? (danger ? 'fa-exclamation-triangle' : 'fa-question');

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {state && opts && (
        <div
          className="confirm-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) settle(false);
          }}
        >
          <div
            className={`confirm-card${danger ? ' confirm-card--danger' : ''}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
          >
            <div className="confirm-icon">
              <i className={`fa ${icon}`} aria-hidden="true" />
            </div>
            <div className="confirm-title" id="confirm-title">
              {opts.title ?? 'אישור פעולה'}
            </div>
            <div className="confirm-message" id="confirm-message">
              {opts.message}
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn confirm-btn--cancel"
                onClick={() => settle(false)}
              >
                {opts.cancelText ?? 'ביטול'}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                className={`confirm-btn confirm-btn--ok${danger ? ' confirm-btn--danger' : ''}`}
                onClick={() => settle(true)}
              >
                {opts.confirmText ?? 'אישור'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
