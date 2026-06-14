import { createBrowserRouter, Navigate } from 'react-router-dom';
import MasterLayout from './layouts/MasterLayout';
import LandingPage from './pages/Landing/LandingPage';
import Login from './pages/Login';
import Welcome from './pages/Main/Welcome';
import SchoolHours from './pages/Config/SchoolHours';
import TeacherHours from './pages/Config/TeacherHours';
import TeacherClass from './pages/Config/TeacherClass';
import Professional from './pages/Config/Professional';
import Assignment from './pages/Config/Assignment';
import Assign from './pages/Assign/Assign';
import AssignAuto from './pages/Assign/AssignAuto';
import AssignConfig from './pages/Assign/AssignConfig';
import AssignMatrix from './pages/Assign/AssignMatrix';
import BetKneset from './pages/BetKneset/BetKneset';
import BetKnesetEdit from './pages/BetKneset/BetKnesetEdit';
import MyIssues from './pages/Issues/MyIssues';
import AdminLogin from './admin/AdminLogin';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import AdminSchools from './admin/AdminSchools';
import AdminIssues from './admin/AdminIssues';
import AdminContacts from './admin/AdminContacts';
import { AdminAuthProvider } from './admin/AdminAuthContext';

export const router = createBrowserRouter([
  { path: '/landing', element: <LandingPage /> },
  { path: '/Login', element: <Login /> },

  // Admin routes — wrapped in AdminAuthProvider
  {
    path: '/admin',
    element: <AdminAuthProvider><AdminLayout /></AdminAuthProvider>,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'schools', element: <AdminSchools /> },
      { path: 'issues',  element: <AdminIssues /> },
      { path: 'contacts', element: <AdminContacts /> },
    ],
  },
  { path: '/admin/login', element: <AdminAuthProvider><AdminLogin /></AdminAuthProvider> },

  // Regular school user routes
  {
    path: '/',
    element: <MasterLayout />,
    children: [
      { index: true, element: <Navigate to="/Config/SchoolHours" replace /> },
      { path: 'Main/Welcome', element: <Welcome /> },
      { path: 'Config/SchoolHours', element: <SchoolHours /> },
      { path: 'Config/TeacherHours', element: <TeacherHours /> },
      { path: 'Config/TeacherClass', element: <TeacherClass /> },
      { path: 'Config/Professional', element: <Professional /> },
      { path: 'Config/Assignment', element: <Assignment /> },
      { path: 'Assign/Assign', element: <Assign /> },
      { path: 'Assign/AssignAuto', element: <AssignAuto /> },
      { path: 'Assign/AssignConfig', element: <AssignConfig /> },
      { path: 'Assign/AssignMatrix', element: <AssignMatrix /> },
      { path: 'BetKneset/BetKneset', element: <BetKneset /> },
      { path: 'BetKneset/BetKnesetEdit', element: <BetKnesetEdit /> },
      { path: 'Issues/MyIssues', element: <MyIssues /> },
    ],
  },
  { path: '*', element: <Navigate to="/Login" replace /> },
]);
