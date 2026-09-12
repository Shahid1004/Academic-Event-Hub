import { useEffect, useState } from 'react';
import type { Department, EventRecord, Page } from '../types';
import { eventTypeColors } from './Dashboard';
import { getEvents } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

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

interface DeptDashboardProps {
  dept: Department;
  navigate: (page: Page, eventId?: string) => void;
  academicYear?: string;
}

const COLORS = ['#4F46E5', '#9333EA', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const getMonthShort = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en', { month: 'short' });
};

export default function DepartmentDashboard({ dept, navigate, academicYear = '' }: DeptDashboardProps) {
  const isDark = useIsDark();
  const [eventsData, setEventsData] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getEvents({ academicYear: academicYear || undefined })
      .then(data => {
        if (active) {
          setEventsData(Array.isArray(data) ? data : []);
          setError('');
        }
      })
      .catch(err => {
        if (active) {
          setError(err?.response?.data?.message || 'Unable to load department events.');
          setEventsData([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [academicYear]);

  const safeEvents = Array.isArray(eventsData) ? eventsData : [];

  const events = dept === 'BOTH'
    ? safeEvents.filter(e => e && e.department === 'BOTH')
    : safeEvents.filter(e => e && (e.department === dept || e.department === 'BOTH'));

  const completed = events.filter(e => e && e.status === 'Completed');
  const participants = events.reduce((a, e) => a + (Number(e?.actualParticipants) || 0), 0);
  const avgAttendance = completed.length ? Math.round(completed.reduce((a, e) => a + (Number(e?.attendance) || 0), 0) / completed.length) : 0;
  const completedWithFeedback = completed.filter(e => e && (Number(e.feedbackScore) || 0) > 0);
  const avgFeedback = completedWithFeedback.length
    ? (completedWithFeedback.reduce((a, e) => a + (Number(e.feedbackScore) || 0), 0) / completedWithFeedback.length).toFixed(1)
    : '—';

  const typeData = Array.from(new Set(events.map(e => e?.type).filter(Boolean))).map(type => ({
    type: type as string,
    count: events.filter(e => e?.type === type).length,
  }));

  const monthlyData = months.map(m => ({
    month: m,
    IT: safeEvents.filter(e => e?.department === 'IT' && getMonthShort(e?.date) === m).length,
    AIDS: safeEvents.filter(e => e?.department === 'AIDS' && getMonthShort(e?.date) === m).length,
    BOTH: safeEvents.filter(e => e?.department === 'BOTH' && getMonthShort(e?.date) === m).length,
  }));

  const deptLabel = dept === 'IT' ? 'Information Technology' : dept === 'AIDS' ? 'AI & Data Science' : 'Joint IT + AIDS';
  const deptColor = dept === 'IT' ? 'text-indigo-600' : dept === 'AIDS' ? 'text-purple-600' : 'text-amber-600';
  const deptBg = dept === 'IT' ? 'bg-indigo-600' : dept === 'AIDS' ? 'bg-purple-600' : 'bg-amber-500';

  const stats = [
    { label: 'Total Events', value: events.length, border: 'border-t-indigo-600' },
    { label: 'Total Participants', value: participants.toLocaleString(), border: 'border-t-purple-600' },
    { label: 'Avg. Attendance', value: `${avgAttendance}%`, border: 'border-t-emerald-600' },
    { label: 'Avg. Feedback', value: `${avgFeedback}/5`, border: 'border-t-amber-600' },
    { label: 'Doc Completed', value: events.filter(e => e?.docStatus === 'Completed').length, border: 'border-t-emerald-500' },
    { label: 'Doc Pending', value: events.filter(e => e?.docStatus === 'Pending' || e?.docStatus === 'Partial').length, border: 'border-t-rose-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className={`w-12 h-12 ${deptBg} rounded-2xl flex items-center justify-center text-white font-extrabold font-heading text-base shadow-md`}>
          {dept}
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Department of {deptLabel}</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">Academic Year {academicYear || 'All Sessions'} Performance Dashboard</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {stats.map(s => (
          <div key={s.label} className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 border-t-4 ${s.border}`}>
            <div className={`text-2xl font-extrabold font-heading ${deptColor}`}>{loading ? '—' : s.value}</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Event Type Distribution */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <h3 className="font-bold font-heading text-slate-900 text-sm mb-1">Event Classification Distribution</h3>
          <p className="text-slate-400 text-xs mb-4">Breakdown of event types in {dept}</p>
          {typeData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">No event classifications found.</div>
          ) : (
            <div className="flex items-center gap-6">
              <PieChart width={160} height={160}>
                <Pie data={typeData} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={70} innerRadius={42} paddingAngle={4}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px' }} />
              </PieChart>
              <div className="flex-1 space-y-2 max-h-40 overflow-y-auto pr-1">
                {typeData.map((d, i) => (
                  <div key={d.type} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className={`font-medium flex-1 truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{d.type}</span>
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monthly Event Count */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <h3 className="font-bold font-heading text-slate-900 text-sm mb-1">Monthly Event Schedule</h3>
          <p className="text-slate-400 text-xs mb-4">Distribution of events across the academic calendar</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: isDark ? '#64748B' : '#64748b' }} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11, fill: isDark ? '#64748B' : '#64748b' }} allowDecimals={false} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px' }} />
              <Bar dataKey="IT" fill="#4F46E5" radius={[4, 4, 0, 0]} name="IT" />
              <Bar dataKey="AIDS" fill="#9333EA" radius={[4, 4, 0, 0]} name="AIDS" />
              <Bar dataKey="BOTH" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Joint" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Semester Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(['I', 'II'] as const).map(sem => {
          const semEvents = events.filter(e => e && e.semester === sem);
          return (
            <div key={sem} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
              <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                <h3 className={`font-bold font-heading text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{sem === 'I' ? 'Odd Semester (I)' : 'Even Semester (II)'}</h3>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${isDark ? 'text-indigo-400 bg-indigo-950/60 border-indigo-700' : 'text-indigo-600 bg-indigo-50 border-indigo-200'}`}>
                  {semEvents.length} events
                </span>
              </div>
              <div className="space-y-2">
                {semEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No events recorded for this semester.</p>
                ) : (
                  semEvents.slice(0, 5).map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => navigate('event-details', ev.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors group border ${isDark ? 'border-white/10 hover:bg-indigo-950/40' : 'border-slate-100 hover:bg-indigo-50/40'}`}
                    >
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${eventTypeColors[ev.type] || (isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700')}`}>
                        {ev.type}
                      </span>
                      <span className={`flex-1 text-xs font-semibold group-hover:text-indigo-400 transition-colors truncate ${isDark ? 'text-slate-200' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                        {ev.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">{ev.date || '—'}</span>
                    </button>
                  ))
                )}
                {semEvents.length > 5 && (
                  <button onClick={() => navigate('all-events')} className="text-xs font-semibold text-indigo-600 hover:underline pl-1">
                    +{semEvents.length - 5} more events in semester
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
