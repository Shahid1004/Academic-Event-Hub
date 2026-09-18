import { useState } from 'react';
import type { AppSettings, Page, UserProfile } from '../types';

interface LayoutProps {
  currentPage: Page;
  navigate: (page: Page, eventId?: string) => void;
  children: React.ReactNode;
  userRole?: 'admin' | 'hod' | 'coordinator' | 'faculty';
  academicYear: string;
  academicYears: string[];
  onAcademicYearChange: (year: string) => void;
  profile: UserProfile;
  settings: AppSettings | null;
  onSettingsChange: (settings: AppSettings) => void | Promise<void>;
}

const sidebarSections = [
  {
    label: null,
    items: [{ id: 'dashboard', label: 'Main Dashboard', icon: 'grid' }],
  },
  {
    label: 'Departments',
    items: [
      { id: 'it-dashboard', label: 'Information Technology', icon: 'cpu' },
      { id: 'aids-dashboard', label: 'AI & Data Science', icon: 'brain' },
    ],
  },
  {
    label: 'Events',
    items: [
      { id: 'all-events', label: 'All Events', icon: 'list' },
      { id: 'joint-events', label: 'Joint Events', icon: 'link' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    ],
  },
  {
    label: 'Management',
    items: [
      { id: 'assigned-events', label: 'My Assigned Events', icon: 'clipboard' },
      { id: 'documentation', label: 'Documentation', icon: 'file-text' },
      { id: 'reports', label: 'Reports', icon: 'bar-chart-2' },
    ],
  },
  {
    label: 'Analytics',
    items: [{ id: 'analytics', label: 'Overall Analytics', icon: 'trending-up' }],
  },
  {
    label: 'System',
    items: [{ id: 'settings', label: 'Settings', icon: 'settings' }],
  },
];

function Icon({ name, className = 'w-[18px] h-[18px]' }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
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
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    chevronDown: <polyline points="6 9 12 15 18 9" />,
    menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    sun: <><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>,
    moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  );
}

export { Icon };

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  hod: 'Head of Department',
  coordinator: 'Coordinator',
  faculty: 'Faculty',
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-500/20 text-purple-300',
  hod: 'bg-blue-500/20 text-blue-300',
  coordinator: 'bg-emerald-500/20 text-emerald-300',
  faculty: 'bg-slate-500/20 text-slate-300',
};

export default function Layout({ currentPage, navigate, children, userRole = 'faculty', academicYear, academicYears, onAcademicYearChange, profile, settings, onSettingsChange }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  const confirmLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      localStorage.clear();
      sessionStorage.clear();
      navigate('login' as Page);
    }
  };

  const toggleTheme = () => {
    if (!settings) return;
    const mode = settings.theme.mode === 'dark' ? 'light' : 'dark';
    onSettingsChange({ ...settings, theme: { ...settings.theme, mode } });
  };

  const userInitials = profile.name.trim().split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const avatarGradient = profile.avatarColor === 'blue' ? 'from-blue-500 to-blue-700'
    : profile.avatarColor === 'teal' ? 'from-teal-500 to-teal-700'
    : profile.avatarColor === 'rose' ? 'from-rose-500 to-rose-700'
    : 'from-indigo-500 to-violet-600';

  const isDark = settings?.theme.mode === 'dark';

  const pageTitle: Record<string, string> = {
    'dashboard': 'Main Dashboard',
    'it-dashboard': 'IT Department',
    'aids-dashboard': 'AI & Data Science',
    'all-events': 'All Events',
    'joint-events': 'Joint Events',
    'calendar': 'Calendar',
    'assigned-events': 'My Assigned Events',
    'documentation': 'Documentation',
    'reports': 'Reports',
    'analytics': 'Analytics',
    'settings': 'Settings',
    'event-details': 'Event Details',
    'create-event': 'Create Event',
    'semester-excel': 'Semester Export',
    'user-management': 'User Management',
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: isDark ? '#0B0F19' : '#F0F2F7' }}>
      {/* ── SIDEBAR ── */}
      <aside
        className={`${sidebarOpen ? 'w-60' : 'w-0 lg:w-[60px]'} flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 z-20 sidebar-enterprise`}
        style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.15)' }}
      >
        {/* Logo */}
        <div
          className={`flex items-center gap-2.5 px-4 py-4 flex-shrink-0 ${!sidebarOpen && 'lg:justify-center'}`}
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', minHeight: '64px' }}
        >
          <div
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', boxShadow: '0 4px 12px rgba(79,70,229,0.4)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5 text-white" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          {sidebarOpen && (
            <div className="truncate">
              <div className="text-[13px] font-bold leading-tight text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Academic Event Hub
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'rgba(148,163,184,0.7)' }}>SmartEvents Platform</div>
            </div>
          )}
        </div>

        {/* Create Event Button */}
        {sidebarOpen && ['admin', 'coordinator'].includes(userRole) && (
          <div className="px-3 pt-3 flex-shrink-0">
            <button
              onClick={() => navigate('create-event')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', boxShadow: '0 4px 14px rgba(79,70,229,0.4)', letterSpacing: '0.01em' }}
            >
              <Icon name="plus" className="w-4 h-4" />
              Create Event
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {sidebarSections.map((section, si) => (
            <div key={si} className={si > 0 ? 'mt-3' : ''}>
              {section.label && sidebarOpen && (
                <div className="sidebar-section-label">{section.label}</div>
              )}
              {section.items.map(item => {
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id as Page)}
                    className={`sidebar-nav-item ${active ? 'active' : ''} ${!sidebarOpen && 'lg:justify-center'}`}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <Icon
                      name={item.icon}
                      className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${active ? 'text-indigo-400' : 'text-slate-500'}`}
                    />
                    {sidebarOpen && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        {sidebarOpen && (
          <div className="flex-shrink-0 px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Role badge */}
            <div className="mb-2 px-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleColors[userRole] || roleColors.faculty}`}>
                {roleLabels[userRole] || 'Faculty'}
              </span>
            </div>
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 bg-gradient-to-br ${avatarGradient}`}>
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white truncate leading-tight">{profile.name}</div>
                <div className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
                  {profile.designation || profile.role} · {profile.department}
                </div>
              </div>
              <button
                onClick={confirmLogout}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'rgba(148,163,184,0.6)' }}
                title="Sign out"
              >
                <Icon name="logout" className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── TOP BAR ── */}
        <header
          className="flex items-center gap-3 px-4 flex-shrink-0 header-enterprise"
          style={{ height: '64px', minHeight: '64px' }}
        >
          {/* Menu toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: isDark ? '#CBD5E1' : undefined }}
          >
            <Icon name="menu" className="w-5 h-5" />
          </button>

          {/* Page title breadcrumb */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Academic Event Hub</span>
              <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="text-sm font-semibold text-slate-700">{pageTitle[currentPage] || 'Page'}</span>
            </div>

            {/* Academic year selector */}
            <div className="ml-3">
              <select
                value={academicYear}
                onChange={e => onAcademicYearChange(e.target.value)}
                className="text-xs font-medium border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all cursor-pointer"
                style={isDark ? {
                  background: '#131B2E',
                  borderColor: 'rgba(255,255,255,0.14)',
                  color: '#F8FAFC',
                  fontSize: '12px'
                } : {
                  background: '#F8FAFC',
                  borderColor: '#E2E8F0',
                  color: '#374151',
                  fontSize: '12px'
                }}
              >
                <option value="">All years</option>
                {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              disabled={!settings}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg transition-all disabled:opacity-40"
              style={{ color: isDark ? '#CBD5E1' : undefined }}
            >
              <Icon name={isDark ? 'sun' : 'moon'} className="w-4.5 h-4.5" />
            </button>


            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => { setShowProfile(!showProfile); }}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl transition-colors"
                style={{ color: isDark ? '#CBD5E1' : undefined }}
                onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br ${avatarGradient}`}>
                  {userInitials}
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-[13px] font-semibold leading-tight" style={{ color: isDark ? '#F8FAFC' : '#334155' }}>{profile.name.split(' ')[0]}</span>
                  <span className="text-[10px] leading-tight capitalize" style={{ color: isDark ? '#94A3B8' : '#94A3B8' }}>{userRole}</span>
                </div>
                <Icon name="chevronDown" className="w-3.5 h-3.5 hidden sm:block" />
              </button>

              {showProfile && (
                <div
                  className="absolute right-0 top-12 w-56 rounded-xl z-50 overflow-hidden"
                  style={isDark ? {
                    background: '#1E293B',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.12)'
                  } : {
                    background: '#FFFFFF',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
                    border: '1px solid #E8ECF0'
                  }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #F1F5F9' }}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br ${avatarGradient}`}>
                        {userInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: isDark ? '#F8FAFC' : '#1E293B' }}>{profile.name}</div>
                        <div className="text-[11px] truncate" style={{ color: isDark ? '#94A3B8' : '#94A3B8' }}>{profile.email}</div>
                      </div>
                    </div>
                  </div>
                  <div className="py-1">
                    {[
                      { label: 'Profile Settings', page: 'settings' as Page },
                      { label: 'My Assigned Events', page: 'assigned-events' as Page },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={() => { navigate(item.page); setShowProfile(false); }}
                        className="w-full text-left px-4 py-2 text-[13px] transition-colors"
                        style={{ color: isDark ? '#CBD5E1' : '#475569' }}
                        onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #F1F5F9' }}>
                    <button
                      onClick={confirmLogout}
                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium flex items-center gap-2 transition-colors"
                      style={{ color: isDark ? '#F87171' : '#DC2626' }}
                      onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Icon name="logout" className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <main className="flex-1 overflow-y-auto page-content">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-10"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
