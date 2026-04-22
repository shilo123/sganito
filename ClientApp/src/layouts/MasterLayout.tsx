import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ajax } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface ClassStatusRow {
  ClassId: number | null;
  ClassName: string;
  ClassHour: number;
  HourSchool: number;
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

  useEffect(() => {
    if (!user) return;
    ajax<ClassStatusRow[]>('Class_GetClassStatus').then(setClasses).catch(() => setClasses([]));
  }, [user, location.pathname]);

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
            <ul style={{ float: 'right', marginTop: 5, marginRight: 7 }}>
              {classes.map((c, i) => (
                <li key={i}>
                  <button
                    style={{ paddingRight: 10, paddingLeft: 10 }}
                    className={`btn ${c.ClassHour === c.HourSchool ? 'btn-success' : 'ls-red-btn'} btn-round btn-xs btnArea`}
                  >
                    {c.ClassName}
                  </button>
                </li>
              ))}
            </ul>
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
