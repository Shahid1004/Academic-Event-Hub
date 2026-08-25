import { useEffect, useState } from 'react';
import type { AppSettings, Page, UserProfile, UserRole } from './types';
import { getSettings } from './services/api';

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
import Settings from '@/pages/Settings';
import CreateEvent from './pages/CreateEvent';
import SemesterExcel from './pages/SemesterExcel';
import UserManagement from './pages/UserManagement';

interface StoredUser {
  id?: string;
  name?: string;
  email?: string;
  role: UserRole;
  department?: string;
  active?: boolean;
  employeeId?: string;
  phone?: string;
  designation?: string;
  avatarColor?: string;
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

const toProfile = (user: StoredUser | null): UserProfile => ({
  id: user?.id || '',
  name: user?.name || 'User',
  email: user?.email || '',
  department: user?.department || '',
  role: user?.role || 'faculty',
  active: user?.active ?? true,
  employeeId: user?.employeeId || '',
  phone: user?.phone || '',
  designation: user?.designation || '',
  avatarColor: user?.avatarColor || 'indigo'
});

const applyTheme = (settings: AppSettings | null) => {
  if (!settings) return;
  document.documentElement.dataset.theme = settings.theme.mode;
  document.documentElement.dataset.contrast = settings.theme.contrast;
  document.documentElement.dataset.accent = settings.theme.accent;
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
  const [profile, setProfile] = useState<UserProfile>(() => toProfile(storedUser));
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (page === 'login') return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) setPage('login');
  }, [page]);

  useEffect(() => {
    if (page === 'login') return;
    getSettings().then(({ settings: loadedSettings, profile: loadedProfile }) => {
      setSettings(loadedSettings);
      setProfile(loadedProfile);
      setAcademicYears(loadedSettings.academicYears.map(year => year.name));
      applyTheme(loadedSettings);
    }).catch(() => undefined);
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
          setProfile(user);
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
        return <Settings currentUserRole={userRole} profile={profile} settings={settings} onProfileChange={(nextProfile: UserProfile) => {
          setProfile(nextProfile);
          const storage = localStorage.getItem('user') ? localStorage : sessionStorage;
          storage.setItem('user', JSON.stringify(nextProfile));
        }} onSettingsChange={(nextSettings: AppSettings) => { setSettings(nextSettings); applyTheme(nextSettings); }} />;

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
      profile={profile}
      academicYear={academicYear}
      academicYears={academicYears}
      onAcademicYearChange={setAcademicYear}
    >
      {renderPage()}
    </Layout>
  );
}