interface PageLoaderProps {
  title?: string;
  subtitle?: string;
}

export default function PageLoader({
  title = 'טוען נתונים',
  subtitle = 'אנא המתן',
}: PageLoaderProps) {
  return (
    <div
      className="page-loading-overlay"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="page-loading-overlay__card">
        <div className="page-loading-overlay__orb">
          <span /><span /><span />
        </div>
        <div className="page-loading-overlay__title">{title}</div>
        <div className="page-loading-overlay__subtitle">{subtitle}</div>
        <div className="page-loading-overlay__bar"><div /></div>
      </div>
    </div>
  );
}
