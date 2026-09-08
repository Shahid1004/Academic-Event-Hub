import { useState } from 'react';
import type { Page, UserProfile } from '../types';
import { notifications } from '../data/sampleData';

interface LayoutProps {
  currentPage: Page;
  navigate: (page: Page, eventId?: string) => void;
  children: React.ReactNode;
  userRole?: 'admin' | 'hod' | 'coordinator' | 'faculty';
  academicYear: string;
  academicYears: string[];
  onAcademicYearChange: (year: string) => void;
  profile: UserProfile;
  themeMode: 'light' | 'dark';
  onThemeToggle: () => void;
}

const sidebarSections = [
  {
    label: null,
    items: [{ id: 'dashboard', label: 'Main Dashboard', icon: 'grid' }],
  },
  {
    label: 'DEPARTMENTS',
    items: [
      { id: 'it-dashboard', label: 'Information Technology', icon: 'cpu' },
      { id: 'aids-dashboard', label: 'AI & Data Science', icon: 'brain' },
    ],
  },
  {
    label: 'EVENTS',
    items: [
      { id: 'all-events', label: 'All Events', icon: 'list' },
      { id: 'joint-events', label: 'Joint Events', icon: 'link' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { id: 'assigned-events', label: 'My Assigned Events', icon: 'clipboard' },
      { id: 'documentation', label: 'Documentation', icon: 'file-text' },
      { id: 'reports', label: 'Reports', icon: 'bar-chart-2' },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [{ id: 'analytics', label: 'Overall Analytics', icon: 'trending-up' }],
  },
  {
    label: 'SYSTEM',
    items: [{ id: 'settings', label: 'Settings', icon: 'settings' }],
  },
];

function Icon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    cpu: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></>,
    brain: <><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></>,
    'file-text': <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
    'bar-chart-2': <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    'trending-up': <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    chevronDown: <polyline points="6 9 12 15 18 9" />,
    menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  );
}

export { Icon };

export default function Layout({ currentPage, navigate, children, userRole = 'faculty', academicYear, academicYears, onAcademicYearChange, profile, themeMode, onThemeToggle }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const avatarClass = profile.avatarColor === 'blue' ? 'bg-blue-600' : profile.avatarColor === 'teal' ? 'bg-teal-600' : profile.avatarColor === 'rose' ? 'bg-rose-600' : 'bg-indigo-600';
  const userInitials = profile.name.trim().split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const logout = () => {
    if (!window.confirm('Are you sure you want to log out?')) return;
    localStorage.clear();
    sessionStorage.clear();
    navigate('login' as Page);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-0 lg:w-16'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-300 z-20`}
      >
        {/* Sidebar Logo */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-slate-100 ${!sidebarOpen && 'lg:justify-center'}`}>
          <div className="w-9 h-9 flex-shrink-0 bg-indigo-600 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
            </svg>
          </div>
          {sidebarOpen && (
            <div className="truncate">
              <div className="text-sm font-bold font-heading text-gray-900 leading-tight">Academic Event Hub</div>
              <div className="text-xs text-gray-400">SmartEvents</div>
            </div>
          )}
        </div>

        {/* Create Event Button */}
        {sidebarOpen && ['admin', 'coordinator'].includes(userRole) && (
          <div className="px-3 pt-3">
            <button
              onClick={() => navigate('create-event')}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium"
            >
              <Icon name="plus" className="w-4 h-4" />
              Create Event
            </button>
          </div>
        )}

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {sidebarSections.map((section, si) => (
            <div key={si} className="mb-2">
              {section.label && sidebarOpen && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{section.label}</div>
              )}
              {section.items.map(item => {
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id as Page)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    } ${!sidebarOpen && 'lg:justify-center'}`}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <Icon name={item.icon} className={`w-4.5 h-4.5 flex-shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                    {active && sidebarOpen && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className="px-3 py-3 border-t border-slate-100">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className={`w-8 h-8 rounded-full ${avatarClass} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>{userInitials}</div>
              <div className="flex-1 truncate">
                <div className="text-sm font-medium text-slate-800">{profile.name}</div>
                <div className="text-xs text-slate-400">{profile.designation || profile.role} — {profile.department}</div>
              </div>
              <button onClick={logout} className="text-slate-400 hover:text-slate-600" aria-label="Log out">
                <Icon name="logout" className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center gap-4 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
          >
            <Icon name="menu" className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-slate-800 font-heading hidden sm:block">Academic Event Hub</span>
            <div className="hidden sm:block text-slate-300">|</div>
            <select
              value={academicYear}
              onChange={e => onAcademicYearChange(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All years</option>
              {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onThemeToggle}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span className="text-base" aria-hidden="true">{themeMode === 'dark' ? '☀️' : '🌙'}</span>
            </button>
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              >
                <Icon name="bell" className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Notifications</span>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{notifications.length} new</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => { navigate('event-details', n.eventId); setShowNotifications(false); }}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-50"
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === 'success' ? 'bg-green-500' : n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                        <div>
                          <p className="text-sm text-slate-700">{n.text}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded-xl"
              >
                <div className={`w-8 h-8 rounded-full ${avatarClass} flex items-center justify-center text-white font-bold text-sm`}>{userInitials}</div>
                <span className="hidden sm:block text-sm font-medium text-slate-700">{profile.name}</span>
                <Icon name="chevronDown" className="w-4 h-4 text-slate-400" />
              </button>
              {showProfile && (
                <div className="absolute right-0 top-11 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-800">{profile.name}</div>
                    <div className="text-xs text-slate-400">{profile.designation || profile.role} — {profile.department}</div>
                  </div>
                  {[
                    { label: 'Profile Settings', page: 'settings' as Page },
                    { label: 'My Assigned Events', page: 'assigned-events' as Page },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={() => { navigate(item.page); setShowProfile(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="border-t border-slate-100">
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/20 z-10" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
