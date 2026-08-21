import { useState } from 'react';
import type { Page } from './types';
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

export default function App() {
  const [page, setPage] = useState<Page>('login');
  const [selectedEventId, setSelectedEventId] = useState<string>('EVT-001');
  const [userRole, setUserRole] = useState<'admin' | 'coordinator' | 'faculty'>('admin');

  const navigate = (targetPage: Page, eventId?: string) => {
    if (eventId) setSelectedEventId(eventId);
    setPage(targetPage);
    window.scrollTo(0, 0);
  };

  if (page === 'login') {
    return <Login onLogin={(role) => { setUserRole(role || 'admin'); navigate('dashboard'); }} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard navigate={navigate} />;
      case 'it-dashboard':
        return <DepartmentDashboard dept="IT" navigate={navigate} />;
      case 'aids-dashboard':
        return <DepartmentDashboard dept="AIDS" navigate={navigate} />;
      case 'all-events':
        return <AllEvents navigate={navigate} />;
      case 'joint-events':
        return <JointEvents navigate={navigate} />;
      case 'calendar':
        return <CalendarPage navigate={navigate} />;
      case 'assigned-events':
        return <MyAssignedEvents navigate={navigate} />;
      case 'documentation':
        return <AllEvents navigate={navigate} title="Documentation" />;
      case 'reports':
        return <Reports />;
      case 'analytics':
        return <Analytics />;
      case 'settings':
        return <Settings />;
      case 'event-details':
        return <EventDetails eventId={selectedEventId} navigate={navigate} />;
      case 'create-event':
        return <CreateEvent navigate={navigate} />;
      case 'semester-excel':
        return <SemesterExcel />;
      default:
        return <Dashboard navigate={navigate} />;
    }
  };

  return (
    <Layout currentPage={page} navigate={navigate} userRole={userRole}>
      {renderPage()}
    </Layout>
  );
}
