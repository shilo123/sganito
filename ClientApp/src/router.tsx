import { createBrowserRouter, Navigate } from 'react-router-dom';
import MasterLayout from './layouts/MasterLayout';
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

export const router = createBrowserRouter([
  { path: '/Login', element: <Login /> },
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
    ],
  },
  { path: '*', element: <Navigate to="/Login" replace /> },
]);
