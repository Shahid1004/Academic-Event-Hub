import { useEffect, useState } from 'react';
import type { DashboardSummary, Page } from '../types';
import { eventTypes } from '../data/sampleData';
import { deleteEvent, getDashboardSummary } from '../services/api';

function useIsDark() {
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

interface DashboardProps { navigate: (page: Page, eventId?: string) => void; academicYear: string; onAcademicYearsChange: (years: string[]) => void; }

const eventTypeColors: Record<string, string> = {
  Hackathon: 'bg-orange-100 text-orange-700',
  Vervathon: 'bg-pink-100 text-pink-700',
  'Guest Lecture': 'bg-blue-100 text-blue-700',
  Workshop: 'bg-indigo-100 text-indigo-700',
  Webinar: 'bg-cyan-100 text-cyan-700',
  Seminar: 'bg-violet-100 text-violet-700',
  Symposium: 'bg-purple-100 text-purple-700',
  FDP: 'bg-green-100 text-green-700',
  'Training Event': 'bg-teal-100 text-teal-700',
  Conference: 'bg-red-100 text-red-700',
  'Joint Event': 'bg-amber-100 text-amber-700',
  Other: 'bg-gray-100 text-gray-700',
};
export { eventTypeColors };

function StatIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    'check-circle': <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
    'alert-circle': <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
    'calendar-clock': <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><polyline points="15 14 12 14 12 17" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    'bar-chart': <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      {icons[type]}
    </svg>
  );
}

export default function Dashboard({ navigate, academicYear, onAcademicYearsChange }: DashboardProps) {
  const isDark = useIsDark();
  const [dept, setDept] = useState('ALL');
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDashboard = async () => {
    setLoading(true); setError(false); setDashboard(null);
    try {
      const data = await getDashboardSummary(academicYear || undefined, dept);
      setDashboard(data); onAcademicYearsChange(data.academicYears);
    } catch { setError(true); } finally { setLoading(false); }
  };

  useEffect(() => { void loadDashboard(); }, [academicYear, dept]);

  const handleDeleteEvent = async (e: React.MouseEvent, eventId: string, eventName: string) => {
    e.stopPropagation();
    const confirmMsg = `Are you sure you want to delete "${eventName}"?\n\nWARNING: All event-related data will be permanently deleted including in the database (uploaded documents, attendance records, feedback forms, etc.).`;
    if (window.confirm(confirmMsg)) {
      try {
        await deleteEvent(eventId);
        alert(`Event "${eventName}" and all related data have been permanently deleted including in the database.`);
        void loadDashboard();
      } catch (err: any) {
        alert(`Failed to delete event: ${err.response?.data?.message || err.message}`);
      }
    }
  };

  const statCards = dashboard ? [
    { label: 'Total Events', value: dashboard.totalEvents, icon: 'calendar', color: 'indigo', textColor: '#4F46E5' },
    { label: 'Completed Events', value: dashboard.completedEvents, icon: 'check-circle', color: 'green', textColor: '#059669' },
    { label: 'Pending Docs', value: dashboard.pendingDocumentation, icon: 'alert-circle', color: 'amber', textColor: '#D97706' },
    { label: 'Upcoming Events', value: dashboard.upcomingEvents, icon: 'calendar-clock', color: 'blue', textColor: '#2563EB' },
    { label: 'Total Participants', value: dashboard.totalParticipants, icon: 'users', color: 'violet', textColor: '#7C3AED' },
    { label: 'Avg. Attendance', value: `${dashboard.averageAttendance}%`, icon: 'bar-chart', color: 'teal', textColor: '#0D9488' },
    { label: 'Avg. Feedback', value: `${(Number(dashboard?.averageFeedback) || 0).toFixed(1)}/5`, icon: 'star', color: 'pink', textColor: '#DB2777' },
  ] : [];

  const docStatusColors: Record<string, string> = {
    Completed: 'badge badge-success',
    Partial: 'badge badge-warning',
    Missing: 'badge badge-danger',
  };

  const reportStatusColors: Record<string, string> = {
    Approved: 'badge badge-success',
    Generated: 'badge badge-info',
    Draft: 'badge badge-warning',
    'Not Generated': 'badge badge-gray',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>
            Main Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Academic Year <span className="font-medium text-slate-700">{academicYear || 'All Years'}</span> · Overview
          </p>
        </div>
        <div
          className="flex items-center gap-2 p-1 rounded-xl"
          style={{
            background: isDark ? '#131B2E' : '#F1F5F9',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
          }}
        >
          {(['ALL', 'IT', 'AIDS', 'BOTH'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setDept(filter)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                dept === filter
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              style={dept === filter ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="stat-card rounded-xl h-24 skeleton" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm text-red-700">Failed to load dashboard data.</span>
          </div>
          <button onClick={() => void loadDashboard()} className="text-sm font-semibold text-red-700 underline">Retry</button>
        </div>
      )}

      {/* Stat Cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {statCards.map(({ label, value, icon, color, textColor }) => (
            <div key={label} className={`stat-card ${color}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="p-1.5 rounded-lg" style={{ background: `${textColor}18`, color: textColor }}>
                  <StatIcon type={icon} />
                </div>
              </div>
              <div className="text-2xl font-bold leading-tight mt-1" style={{ color: textColor, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {value}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Events by Type */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Events by Type</h2>
          <button onClick={() => navigate('all-events')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">View all events →</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {eventTypes.map(type => {
            const count = dashboard?.eventsByType.find(item => item.type === type)?.count || 0;
            return (
              <button
                key={type}
                onClick={() => navigate('all-events')}
                className="card-enterprise card-enterprise-hover text-left p-4 cursor-pointer rounded-xl"
              >
                <div className={`text-2xl font-bold leading-tight mb-1 ${count ? 'text-slate-800' : 'text-slate-300'}`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {count || 0}
                </div>
                <div className={`text-xs font-medium leading-tight ${count ? 'text-slate-500' : 'text-slate-300'}`}>{type}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Events Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Recent Events</h2>
          <button onClick={() => navigate('all-events')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">View All →</button>
        </div>

        <div className="card-enterprise rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-enterprise">
              <thead>
                <tr>
                  {['Event Name', 'Type', 'Dept', 'Date', 'Coordinator', 'Participants', 'Attendance', 'Status', 'Action'].map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">Loading events...</td></tr>
                )}
                {dashboard?.recentEvents.map((event) => (
                  <tr
                    key={event.eventId}
                    onClick={() => navigate('event-details', event.eventId)}
                    className="cursor-pointer"
                  >
                    <td>
                      <div className="font-semibold text-slate-800 text-[13px] whitespace-nowrap hover:text-indigo-600 transition-colors">{event.eventName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{event.eventId}</div>
                    </td>
                    <td>
                      <span className={`badge ${eventTypeColors[event.type] ? '' : 'badge-gray'}`}
                        style={eventTypeColors[event.type] ? { background: '', color: '' } : {}}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${eventTypeColors[event.type] || 'bg-gray-100 text-gray-700'}`}>
                          {event.type}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        event.department === 'IT' ? 'bg-blue-50 text-blue-700' :
                        event.department === 'AIDS' ? 'bg-violet-50 text-violet-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {event.department}
                      </span>
                    </td>
                    <td className="text-slate-600 whitespace-nowrap text-[13px]">
                      {event.date ? new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="text-slate-600 whitespace-nowrap text-[13px]">{event.coordinator || '—'}</td>
                    <td className="text-slate-700 font-semibold text-center text-[13px]">{event.participants || '—'}</td>
                    <td>
                      {event.attendance > 0 ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-12 h-1.5 rounded-full overflow-hidden"
                            style={{ background: isDark ? '#334155' : '#E2E8F0' }}
                          >
                            <div className="h-full rounded-full" style={{ width: `${Math.min(event.attendance, 100)}%`, background: '#10B981' }} />
                          </div>
                          <span className="text-[12px] font-medium text-slate-600">{event.attendance}%</span>
                        </div>
                      ) : <span className="text-slate-300 text-[13px]">—</span>}
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        event.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                        event.status === 'Ongoing' ? 'bg-blue-50 text-blue-700' :
                        event.status === 'Upcoming' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-50 text-slate-600'
                      }`}>{event.status || '—'}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('event-details', event.eventId); }}
                          className="text-[12px] font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all whitespace-nowrap"
                        >
                          View
                        </button>
                        <button
                          onClick={(e) => void handleDeleteEvent(e, event.eventId, event.eventName)}
                          className="text-[12px] font-semibold text-red-500 hover:text-white hover:bg-red-500 border border-red-200 px-2.5 py-1 rounded-lg transition-all whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !error && dashboard?.recentEvents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <div className="text-sm font-medium text-slate-400">No events found</div>
                        <div className="text-xs text-slate-300">No recent events for the selected filters</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
