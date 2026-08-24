import { useEffect, useState } from 'react';
import type { Page, UserRole } from './types';

import Login from './pages/Login';
import Layout from './components/Layout';

import Dashboard from './pages/Dashboard';
import AllEvents from './pages/AllEvents';
import JointEvents from './pages/JointEvents';
import DepartmentDashboard from './pages/DepartmentDashboard';
import MyAssignedEvents from './pages/MyAssignedEvents';
import EventDetails from './pages/EventDetails';
import CalendarPage from './pages/CalendarPage';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import CreateEvent from './pages/CreateEvent';
import SemesterExcel from './pages/SemesterExcel';
import UserManagement from './pages/UserManagement';

interface StoredUser {
  role: UserRole;
  department?: string;
}

const getStoredUser = (): StoredUser | null => {
  const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
  if (!stored) return null;

  try {
    const user = JSON.parse(stored) as StoredUser;
    return ['admin', 'hod', 'coordinator', 'faculty'].includes(user.role) ? user : null;
  } catch {
    return null;
  }
};

const getRoleLandingPage = (user: StoredUser | null): Page => {
  if (!user || user.role === 'admin') return 'dashboard';
  if (user.role === 'hod') {
    return user.department?.toUpperCase().includes('AI') ? 'aids-dashboard' : 'it-dashboard';
  }
  return 'assigned-events';
};

export default function App() {
  const storedUser = getStoredUser();
  const [academicYear, setAcademicYear] = useState('');
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [page, setPage] = useState<Page>(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return token && storedUser ? getRoleLandingPage(storedUser) : 'login';
  });

  const [selectedEventId, setSelectedEventId] =
    useState<string>('EVT-001');

  const [userRole, setUserRole] = useState<UserRole>(() => {
    return storedUser?.role || 'faculty';
  });

  useEffect(() => {
    if (page === 'login') return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) setPage('login');
  }, [page]);

  const navigate = (
    targetPage: Page,
    eventId?: string
  ) => {
    if (eventId) {
      setSelectedEventId(eventId);
    }

    setPage(targetPage);

    window.scrollTo(0, 0);
  };

  if (page === 'login') {
    return (
      <Login
        onLogin={(user, token, remember) => {
          setUserRole(user.role);
          const otherStorage = remember ? sessionStorage : localStorage;
          otherStorage.removeItem('token');
          otherStorage.removeItem('user');
          navigate(getRoleLandingPage(user));
        }}
      />
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            navigate={navigate}
            academicYear={academicYear}
            onAcademicYearsChange={setAcademicYears}
          />
        );

      case 'it-dashboard':
        return (
          <DepartmentDashboard
            dept="IT"
            navigate={navigate}
          />
        );

      case 'aids-dashboard':
        return (
          <DepartmentDashboard
            dept="AIDS"
            navigate={navigate}
          />
        );

      case 'all-events':
        return (
          <AllEvents
            navigate={navigate}
          />
        );

      case 'joint-events':
        return (
          <JointEvents
            navigate={navigate}
          />
        );

      case 'calendar':
        return (
          <CalendarPage
            navigate={navigate}
          />
        );

      case 'assigned-events':
        return (
          <MyAssignedEvents
            navigate={navigate}
          />
        );

      case 'documentation':
        return (
          <AllEvents
            navigate={navigate}
            title="Documentation"
          />
        );

      case 'reports':
        return <Reports />;

      case 'analytics':
        return <Analytics />;

      case 'settings':
        return <Settings />;

      case 'event-details':
        return (
          <EventDetails
            eventId={selectedEventId}
            navigate={navigate}
          />
        );

      case 'create-event':
        return (
          <CreateEvent
            navigate={navigate}
          />
        );

      case 'semester-excel':
        return <SemesterExcel />;

      case 'user-management':
        return (
          <UserManagement
            currentUserRole={userRole}
          />
        );

      default:
        return (
          <Dashboard
            navigate={navigate}
            academicYear={academicYear}
            onAcademicYearsChange={setAcademicYears}
          />
        );
    }
  };

  return (
    <Layout
      currentPage={page}
      navigate={navigate}
      userRole={userRole}
      academicYear={academicYear}
      academicYears={academicYears}
      onAcademicYearChange={setAcademicYear}
    >
      {renderPage()}
    </Layout>
  );
}