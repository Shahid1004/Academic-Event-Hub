import { useEffect, useState } from 'react';
import type { DashboardSummary, Page } from '../types';
import { eventTypes } from '../data/sampleData';
import { deleteEvent, getDashboardSummary } from '../services/api';

interface DashboardProps { navigate: (page: Page, eventId?: string) => void; academicYear: string; onAcademicYearsChange: (years: string[]) => void; }

const eventTypeColors: Record<string, string> = {
  Hackathon: 'bg-orange-100 text-orange-700', Vervathon: 'bg-pink-100 text-pink-700', 'Guest Lecture': 'bg-blue-100 text-blue-700', Workshop: 'bg-indigo-100 text-indigo-700', Webinar: 'bg-cyan-100 text-cyan-700', Seminar: 'bg-violet-100 text-violet-700', Symposium: 'bg-purple-100 text-purple-700', FDP: 'bg-green-100 text-green-700', 'Training Event': 'bg-teal-100 text-teal-700', Conference: 'bg-red-100 text-red-700', 'Joint Event': 'bg-amber-100 text-amber-700', Other: 'bg-gray-100 text-gray-700',
};
export { eventTypeColors };

export default function Dashboard({ navigate, academicYear, onAcademicYearsChange }: DashboardProps) {
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

  const stats = dashboard ? [
    ['Total Events', dashboard.totalEvents, 'text-indigo-600', '📅'], ['Completed Events', dashboard.completedEvents, 'text-green-600', '✅'], ['Pending Documentation', dashboard.pendingDocumentation, 'text-amber-600', '📋'], ['Upcoming Events', dashboard.upcomingEvents, 'text-blue-600', '🗓️'], ['Total Participants', dashboard.totalParticipants, 'text-violet-600', '👥'], ['Avg. Attendance', `${dashboard.averageAttendance}%`, 'text-teal-600', '📊'], ['Avg. Feedback', `${dashboard.averageFeedback.toFixed(1)}/5`, 'text-pink-600', '⭐'],
  ] : [];

  return <div className="p-6 space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold font-heading text-slate-900">Main Dashboard</h1><p className="text-slate-500 text-sm mt-0.5">Academic Year {academicYear || 'All years'} - Overview</p></div><div className="flex gap-2">{(['ALL', 'IT', 'AIDS', 'BOTH'] as const).map(filter => <button key={filter} onClick={() => setDept(filter)} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${dept === filter ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>{filter}</button>)}</div></div>
    {loading && <div className="bg-white rounded-2xl p-6 border border-slate-100 text-sm text-slate-500">Loading dashboard...</div>}
    {error && !loading && <div className="bg-red-50 rounded-2xl p-6 border border-red-100 text-sm text-red-700 flex items-center justify-between"><span>Failed to load dashboard data. Please try again.</span><button onClick={() => void loadDashboard()} className="font-semibold underline">Retry</button></div>}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">{stats.map(([label, value, text, icon]) => <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"><div className="text-2xl mb-1">{icon}</div><div className={`text-2xl font-bold font-heading ${text}`}>{value}</div><div className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</div></div>)}</div>
    <div><h2 className="text-lg font-bold font-heading text-slate-800 mb-3">Events by Type</h2><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">{eventTypes.map(type => { const count = dashboard?.eventsByType.find(item => item.type === type)?.count || 0; return <button key={type} onClick={() => navigate('all-events')} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md text-left group"><div className={`text-2xl font-bold font-heading group-hover:text-indigo-600 ${count ? 'text-slate-800' : 'text-slate-300'}`}>{count}</div><div className={`text-xs mt-1 font-medium leading-tight ${count ? 'text-slate-600' : 'text-slate-300'}`}>{type}</div></button>; })}</div></div>
    <div><div className="flex items-center justify-between mb-3"><h2 className="text-lg font-bold font-heading text-slate-800">Recent Events</h2><button onClick={() => navigate('all-events')} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View All →</button></div><div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50">{['Event Name', 'Type', 'Dept', 'Date', 'Coordinator', 'Participants', 'Attendance', 'Status', 'Action'].map(col => <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{col}</th>)}</tr></thead><tbody>
      {dashboard?.recentEvents.map((event, index) => <tr key={event.eventId} className={`border-b border-slate-50 hover:bg-slate-50 ${index % 2 ? 'bg-slate-50/30' : ''}`}><td className="px-4 py-3"><div className="font-medium text-slate-800 whitespace-nowrap">{event.eventName}</div><div className="text-xs text-slate-400">{event.eventId}</div></td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${eventTypeColors[event.type] || 'bg-gray-100 text-gray-700'}`}>{event.type}</span></td><td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{event.department}</span></td><td className="px-4 py-3 text-slate-600 whitespace-nowrap">{event.date ? new Date(event.date).toLocaleDateString() : '—'}</td><td className="px-4 py-3 text-slate-600 whitespace-nowrap">{event.coordinator || '—'}</td><td className="px-4 py-3 text-slate-700 font-medium">{event.participants || '—'}</td><td className="px-4 py-3">{event.attendance > 0 ? `${event.attendance}%` : '—'}</td><td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium">{event.status || '—'}</span></td><td className="px-4 py-3 whitespace-nowrap space-x-1.5"><button onClick={() => navigate('event-details', event.eventId)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50 whitespace-nowrap">View Event</button><button onClick={(e) => void handleDeleteEvent(e, event.eventId, event.eventName)} className="text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 whitespace-nowrap">Delete</button></td></tr>)}
      {!loading && !error && dashboard?.recentEvents.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No recent events found.</td></tr>}
    </tbody></table></div></div></div>
  </div>;
}
