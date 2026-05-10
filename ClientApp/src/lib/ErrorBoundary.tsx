import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reportSent: boolean;
  errorId: string;
}

// תופס שגיאות JS שלא נתפסות בעץ ה-React ומציג פופאפ ידידותי במקום
// ה-error overlay של React (במצב dev) או מסך ריק (במצב prod).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, reportSent: false, errorId: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    // יוצר errorId קצר לסימוכין שהמשתמש יוכל לציין בפניה לתמיכה.
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    return { hasError: true, error, errorId: id };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // שלח דיווח לקונסול (במידה שיש logging service בעתיד — להוסיף כאן fetch).
    console.error('[ErrorBoundary] Caught:', error, info.componentStack);
    // נסה לשלוח לשרת לוגינג. שגיאה כאן מתעלמת — לא רוצים crash על דיווח כשל.
    try {
      fetch('/WebService.asmx/Log_FrontendError', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({
          errorId: this.state.errorId,
          message: String(error.message || error).slice(0, 500),
          stack: String(error.stack || '').slice(0, 2000),
          componentStack: String(info.componentStack || '').slice(0, 2000),
          url: typeof window !== 'undefined' ? window.location.href : '',
          ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
        }),
        credentials: 'include',
      }).then(() => this.setState({ reportSent: true })).catch(() => { /* ignore */ });
    } catch { /* ignore */ }
  }

  reload = () => {
    window.location.reload();
  };

  goHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="errboundary" role="alertdialog" aria-modal="true" aria-labelledby="errboundary-title">
        <div className="errboundary__card">
          <div className="errboundary__icon-wrap">
            <div className="errboundary__icon"><i className="fa fa-bug" /></div>
          </div>
          <h2 id="errboundary-title" className="errboundary__title">היי, נתקלנו בתקלה</h2>
          <p className="errboundary__msg">
            משהו לא צפוי קרה ולא הצלחנו לטעון את החלק הזה במערכת.
            הצוות שלנו קיבל את הדיווח באופן אוטומטי ואנחנו כבר בודקים את זה.
          </p>
          <div className="errboundary__hint">
            רוב הזמן רענון של הדף פותר את הבעיה. אם זה חוזר על עצמו — נשמח שתספרו לנו מה ניסיתם לעשות.
          </div>
          <div className="errboundary__id">
            <span className="errboundary__id-label">מס׳ סימוכין:</span>
            <code>{this.state.errorId}</code>
            <span className="errboundary__id-status">
              {this.state.reportSent ? <><i className="fa fa-check-circle" /> נשלח לצוות</> : <><i className="fa fa-paper-plane" /> בשליחה...</>}
            </span>
          </div>
          <div className="errboundary__actions">
            <button type="button" className="errboundary__btn errboundary__btn--primary" onClick={this.reload}>
              <i className="fa fa-refresh" /> רענן את הדף
            </button>
            <button type="button" className="errboundary__btn errboundary__btn--ghost" onClick={this.goHome}>
              <i className="fa fa-home" /> חזרה לדף הבית
            </button>
          </div>
          {/* פירוט טכני — מוצג רק במצב dev, מקופל כברירת מחדל. */}
          {import.meta.env?.DEV && this.state.error && (
            <details className="errboundary__details">
              <summary>פירוט טכני (dev)</summary>
              <pre>{String(this.state.error.message)}{'\n\n'}{String(this.state.error.stack || '')}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
