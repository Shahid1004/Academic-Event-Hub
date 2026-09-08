import { useEffect, useState } from 'react';
import type { AppSettings, Page, UserProfile, UserRole } from './types';
import { getSettings, updateSettings } from './services/api';
import { getSettings } from './services/api';
import { sampleEvents } from './data/sampleData';

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
import FormalAcademicReport from './pages/FormalAcademicReport';
import Settings from '@/pages/Settings';
import CreateEvent from './pages/CreateEvent';
import SemesterExcel from './pages/SemesterExcel';
import UserManagement from './pages/UserManagement';
import StudentDashboard from './pages/StudentDashboard';
import Documentation from './pages/Documentation';

interface StoredUser {
  id?: string;
  name?: string;
  email?: string;
  role: UserRole;
  registerNumber?: string;
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
    return ['admin', 'hod', 'coordinator', 'faculty', 'student'].includes(user.role) ? user : null;
  } catch {
    return null;
  }
};

const getRoleLandingPage = (user: StoredUser | null): Page => {
  if (!user || user.role === 'admin') return 'dashboard';
  if (user.role === 'student') return 'student-dashboard';
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

  const isStudent = userRole === 'student';

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

  if (isStudent) {
    if (page === 'student-event') return <EventDetails eventId={selectedEventId} navigate={navigate} />;
    return <StudentDashboard navigate={navigate} />;
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
            academicYear={academicYear}
          />
        );

      case 'aids-dashboard':
        return (
          <DepartmentDashboard
            dept="AIDS"
            navigate={navigate}
            academicYear={academicYear}
          />
        );

      case 'all-events':
        return (
          <AllEvents
            navigate={navigate}
            academicYear={academicYear}
          />
        );

      case 'joint-events':
        return (
          <JointEvents
            navigate={navigate}
            academicYear={academicYear}
          />
        );

      case 'calendar':
        return (
          <CalendarPage
            navigate={navigate}
            academicYear={academicYear}
          />
        );

      case 'assigned-events':
        return (
          <MyAssignedEvents
            navigate={navigate}
            profile={profile}
          />
        );

      case 'documentation':
        return <EventDetails eventId={selectedEventId} navigate={navigate} />;
        return <Documentation eventId={selectedEventId} navigate={navigate} />;

      case 'reports':
        return <Reports academicYear={academicYear} />;

      case 'formal-reports':
        return (
          <FormalAcademicReport
            events={sampleEvents as any}
            navigate={navigate}
          />
        );

      case 'analytics':
        return <Analytics academicYear={academicYear} />;

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
        return <SemesterExcel academicYear={academicYear} />;

      case 'user-management':
        if (userRole === 'coordinator') return <Dashboard navigate={navigate} academicYear={academicYear} onAcademicYearsChange={setAcademicYears} />;
        return (
          <UserManagement
            currentUserRole={userRole}
          />
        );

      case 'student-dashboard':
        return <StudentDashboard navigate={navigate} />;

      case 'student-event':
        return <EventDetails eventId={selectedEventId} navigate={navigate} />;

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
      themeMode={settings?.theme.mode || 'light'}
      onThemeToggle={() => {
        if (!settings) return;
        const nextMode: AppSettings['theme']['mode'] = settings.theme.mode === 'dark' ? 'light' : 'dark';
        const nextSettings = { ...settings, theme: { ...settings.theme, mode: nextMode } };
        setSettings(nextSettings);
        applyTheme(nextSettings);
        updateSettings({ theme: nextSettings.theme }).catch(() => undefined);
      }}
    >
      {renderPage()}
    </Layout>
  );
}