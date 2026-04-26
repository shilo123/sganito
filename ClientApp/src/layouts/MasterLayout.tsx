import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ajax } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface ClassStatusRow {
  ClassId: number | null;
  ClassName: string;
  ClassHour: number;
  HourSchool: number;
  LayerId?: number | null;
}

const NAV_ITEMS = [
  { to: '/Config/SchoolHours', icon: 'fa fa-clock-o', label: 'הגדרות שעות בית ספר' },
  { to: '/Config/TeacherHours', icon: 'fa fa-users', label: 'ניהול מורים' },
  { to: '/Config/TeacherClass', icon: 'fa fa-sitemap', label: 'הגדרות כיתות ומורים' },
  { to: '/Config/Professional', icon: 'fa fa-book', label: 'הגדרות מקצועות בית ספר' },
  { to: '/Assign/Assign', icon: 'fa fa-calendar', label: 'מערכת בית הספר' },
  { to: '/Assign/AssignMatrix', icon: 'fa fa-th', label: 'מערכת בית הספר מטריצה' },
  { to: '/Assign/AssignConfig', icon: 'fa fa-bolt', label: 'שיבוץ אוטומטי' },
];

export default function MasterLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [classes, setClasses] = useState<ClassStatusRow[]>([]);
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebarExpanded') === '1'; } catch { return false; }
  });
  const [statusDetailsOpen, setStatusDetailsOpen] = useState(false);

  // Close the status dropdown on any outside click
  useEffect(() => {
    if (!statusDetailsOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.class-status-strip')) setStatusDetailsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [statusDetailsOpen]);

  useEffect(() => {
    if (!user) return;
    ajax<ClassStatusRow[]>('Class_GetClassStatus').then(setClasses).catch(() => setClasses([]));
  }, [user, location.pathname]);

  // Auto-collapse the side navigation ONLY on the transition INTO the
  // school schedule page (/Assign/Assign exactly — not AssignMatrix or
  // AssignConfig), and re-expand ONLY on the transition OUT of it.
  // Moving between any other tabs leaves the sidebar untouched so the
  // user's manual choice is respected.
  const isSchedulePath = (p: string) => p === '/Assign/Assign' || p === '/Assign/Assign/';
  const prevPathRef = useRef<string>('__init__');
  useEffect(() => {
    const prev = prevPathRef.current;
    const now = location.pathname;
    const isAssign = isSchedulePath(now);
    if (prev === '__init__') {
      if (isAssign) setSidebarExpanded(false);
    } else {
      const wasAssign = isSchedulePath(prev);
      if (!wasAssign && isAssign) setSidebarExpanded(false);
      else if (wasAssign && !isAssign) setSidebarExpanded(true);
    }
    prevPathRef.current = now;
  }, [location.pathname]);

  const toggleSidebar = () => {
    setSidebarExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebarExpanded', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  if (!user) return <Navigate to="/Login" replace state={{ from: location }} />;

  const logoSrc = `/assets/images/SchoolLogo/${user.SchoolId}_.png`;

  return (
    <div>
      <nav className="navigation">
        <div className="container-fluid">
          <div className="header-logo">
            <span style={{ fontWeight: 'bold' }}>סגנית </span>
            <div>שלום, <span>{user.UserName}</span></div>
          </div>
          <div className="top-navigation">
            <div className="menu-control hidden-xs">
              <a href="javascript:void(0)"><i className="fa fa-bars"></i></a>
            </div>
            {/* Class status summary — hidden on the main schedule page
                where the built-in coverage pill already shows this info.
                On other screens, show a compact per-layer summary rather
                than 23 identical pills. */}
            {!isSchedulePath(location.pathname) && (() => {
              if (classes.length === 0) return null;
              // Group classes by LayerId (with fallback to first letter of ClassName).
              const byLayer = new Map<string, ClassStatusRow[]>();
              const LAYER_LETTERS = ['', "א'", "ב'", "ג'", "ד'", "ה'", "ו'"];
              for (const c of classes) {
                const layerKey = c.LayerId && c.LayerId >= 1 && c.LayerId <= 6
                  ? LAYER_LETTERS[c.LayerId]
                  : ((c.ClassName || '?').trim().charAt(0) || '?');
                const list = byLayer.get(layerKey) ?? [];
                list.push(c);
                byLayer.set(layerKey, list);
              }
              // Overall percentage = sum(ClassHour) / sum(HourSchool). Counting
              // classes that are EXACTLY at 100% was too strict — most classes
              // hover around 85-95% so nothing ever showed as "done".
              const totalHours = classes.reduce((a, c) => a + (Number(c.HourSchool) || 0), 0);
              const filledHours = classes.reduce((a, c) => a + (Number(c.ClassHour) || 0), 0);
              const overallPct = totalHours > 0 ? Math.round((filledHours / totalHours) * 100) : 0;
              const totalClasses = classes.length;
              const totalDone = classes.filter((c) => c.ClassHour === c.HourSchool).length;
              const sortedLayers = Array.from(byLayer.entries()).sort((a, b) =>
                a[0].localeCompare(b[0], 'he'),
              );
              return (
                <div className="class-status-strip" aria-label="סטטוס שיבוץ כיתות">
                  <button
                    type="button"
                    className="class-status-strip__summary"
                    title={`שובצו ${filledHours} מתוך ${totalHours} שעות (${totalDone}/${totalClasses} כיתות הושלמו במלואן) — לחץ לפירוט`}
                    onClick={() => setStatusDetailsOpen((v) => !v)}
                    aria-expanded={statusDetailsOpen}
                  >
                    <i className="fa fa-check-circle" />
                    <strong>{overallPct}%</strong>
                    <span className="class-status-strip__frac">({filledHours}/{totalHours})</span>
                    <i className={`fa fa-chevron-${statusDetailsOpen ? 'up' : 'down'} class-status-strip__caret`} />
                  </button>
                  {statusDetailsOpen && (
                    <div className="class-status-strip__dropdown" role="dialog">
                      <div className="class-status-strip__dropdown-header">
                        סטטוס שיבוץ לפי שכבות
                      </div>
                      <div className="class-status-strip__dropdown-body">
                        {sortedLayers.map(([layer, list]) => {
                          const layerFilled = list.reduce((a, c) => a + (Number(c.ClassHour) || 0), 0);
                          const layerTotal = list.reduce((a, c) => a + (Number(c.HourSchool) || 0), 0);
                          const layerPct = layerTotal > 0 ? Math.round((layerFilled / layerTotal) * 100) : 0;
                          const full = layerPct >= 100;
                          return (
                            <div key={layer} className="class-status-strip__layer-row">
                              <div className="class-status-strip__layer-head">
                                <span className="class-status-strip__letter">{layer}</span>
                                <strong>שכבה {layer}</strong>
                                <span className={`class-status-strip__layer-count${full ? ' is-full' : ''}`}>
                                  {layerPct}% · {layerFilled}/{layerTotal}
                                  {full && <i className="fa fa-check" style={{ marginInlineStart: 4 }} />}
                                </span>
                              </div>
                              <div className="class-status-strip__class-list">
                                {list
                                  .slice()
                                  .sort((a, b) => a.ClassName.localeCompare(b.ClassName, 'he'))
                                  .map((c) => {
                                    const ok = c.ClassHour === c.HourSchool;
                                    return (
                                      <span
                                        key={c.ClassId ?? c.ClassName}
                                        className={`class-status-strip__cls${ok ? ' is-ok' : ''}`}
                                        title={`${c.ClassName}: ${c.ClassHour}/${c.HourSchool} שעות`}
                                      >
                                        {c.ClassName}
                                        <span className="class-status-strip__cls-h">
                                          {c.ClassHour}/{c.HourSchool}
                                        </span>
                                      </span>
                                    );
                                  })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </nav>

      <section id="main-container" className={sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}>
        <section id="left-navigation">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? 'כווץ תפריט' : 'הרחב תפריט'}
            title={sidebarExpanded ? 'כווץ תפריט' : 'הרחב תפריט'}
          >
            <i className={`fa ${sidebarExpanded ? 'fa-angle-double-right' : 'fa-angle-double-left'}`}></i>
          </button>
          <div className="user-image">
            <img
              id="imgLogo"
              src={logoSrc}
              width={80}
              height={80}
              alt=""
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/images/demo/avatar-80.png'; }}
            />
            <div className="user-online-status">
              <span className="user-status is-online"></span>
            </div>
          </div>
          <ul className="social-icon">
            <li><a href="javascript:void(0)"><i className="fa fa-facebook"></i></a></li>
            <li><a href="javascript:void(0)"><i className="fa fa-twitter"></i></a></li>
            <li><a href="javascript:void(0)"><i className="fa fa-github"></i></a></li>
            <li><a href="javascript:void(0)"><i className="fa fa-bitbucket"></i></a></li>
          </ul>
          <ul className="mainNav">
            {NAV_ITEMS.map((item) => (
              <li key={item.to} className="active">
                <NavLink to={item.to}>
                  <i className={item.icon}></i><span>{item.label}</span>
                </NavLink>
              </li>
            ))}
            <li className="active">
              <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>
                <i className="fa fa-power-off"></i><span>יציאה מהמערכת</span>
              </a>
            </li>
          </ul>
          <div style={{ fontSize: 20, color: 'white', textAlign: 'center', paddingTop: 20, fontStyle: 'italic' }}>{user.Name}</div>
          <div style={{ fontSize: 20, color: 'white', textAlign: 'center' }}>{user.HebDate}</div>
        </section>

        <section id="min-wrapper">
          <div id="main-content" style={{ padding: 0, margin: 0 }}>
            <div className="container-fluid" style={{ padding: 0, margin: 0 }}>
              <Outlet />
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
