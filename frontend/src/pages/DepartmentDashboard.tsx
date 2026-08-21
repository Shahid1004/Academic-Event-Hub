import type { Department, Page } from '../types';
import { sampleEvents } from '../data/sampleData';
import { eventTypeColors } from './Dashboard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DeptDashboardProps {
  dept: Department;
  navigate: (page: Page, eventId?: string) => void;
}

const COLORS = ['#4F46E5', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

export default function DepartmentDashboard({ dept, navigate }: DeptDashboardProps) {
  const events = dept === 'BOTH'
    ? sampleEvents.filter(e => e.department === 'BOTH')
    : sampleEvents.filter(e => e.department === dept || e.department === 'BOTH');

  const completed = events.filter(e => e.status === 'Completed');
  const upcoming = events.filter(e => e.status === 'Upcoming');
  const participants = events.reduce((a, e) => a + e.actualParticipants, 0);
  const avgAttendance = completed.length ? Math.round(completed.reduce((a, e) => a + e.attendance, 0) / completed.length) : 0;
  const avgFeedback = completed.filter(e => e.feedbackScore > 0).length
    ? (completed.filter(e => e.feedbackScore > 0).reduce((a, e) => a + e.feedbackScore, 0) / completed.filter(e => e.feedbackScore > 0).length).toFixed(1)
    : '—';

  const typeData = Array.from(new Set(events.map(e => e.type))).map(type => ({
    type, count: events.filter(e => e.type === type).length,
  }));

  const monthlyData = months.map(m => ({
    month: m,
    IT: sampleEvents.filter(e => e.department === 'IT' && new Date(e.date).toLocaleString('en', { month: 'short' }) === m).length,
    AIDS: sampleEvents.filter(e => e.department === 'AIDS' && new Date(e.date).toLocaleString('en', { month: 'short' }) === m).length,
    BOTH: sampleEvents.filter(e => e.department === 'BOTH' && new Date(e.date).toLocaleString('en', { month: 'short' }) === m).length,
  }));

  const deptLabel = dept === 'IT' ? 'Information Technology' : dept === 'AIDS' ? 'AI & Data Science' : 'Combined IT + AIDS';
  const deptColor = dept === 'IT' ? 'text-blue-600' : dept === 'AIDS' ? 'text-violet-600' : 'text-amber-600';
  const deptBg = dept === 'IT' ? 'bg-blue-600' : dept === 'AIDS' ? 'bg-violet-600' : 'bg-amber-500';

  const stats = [
    { label: 'Total Events', value: events.length, icon: '📅' },
    { label: 'Participants', value: participants, icon: '👥' },
    { label: 'Avg. Attendance', value: `${avgAttendance}%`, icon: '📊' },
    { label: 'Avg. Feedback', value: `${avgFeedback}/5`, icon: '⭐' },
    { label: 'Doc Completed', value: events.filter(e => e.docStatus === 'Completed').length, icon: '✅' },
    { label: 'Doc Pending', value: events.filter(e => e.docStatus === 'Pending' || e.docStatus === 'Partial').length, icon: '⏳' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${deptBg} rounded-xl flex items-center justify-center text-white font-bold text-sm`}>{dept}</div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Department of {deptLabel}</h1>
          <p className="text-slate-500 text-sm">Academic Year 2025-26 Dashboard</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold font-heading ${deptColor}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Event Type Distribution */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Event Type Distribution</h3>
          <div className="flex items-center gap-6">
            <PieChart width={160} height={160}>
              <Pie data={typeData} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
            <div className="flex-1 space-y-1.5 max-h-40 overflow-y-auto">
              {typeData.map((d, i) => (
                <div key={d.type} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-600 flex-1 truncate">{d.type}</span>
                  <span className="font-semibold text-slate-800">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Event Count */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Monthly Event Count</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} barSize={10}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="IT" fill="#4F46E5" radius={[4,4,0,0]} />
              <Bar dataKey="AIDS" fill="#7C3AED" radius={[4,4,0,0]} />
              <Bar dataKey="BOTH" fill="#F59E0B" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            {[{l:'IT',c:'#4F46E5'},{l:'AIDS',c:'#7C3AED'},{l:'BOTH',c:'#F59E0B'}].map(x => (
              <div key={x.l} className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full" style={{ background: x.c }} /> {x.l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Semester Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(['I', 'II'] as const).map(sem => {
          const semEvents = events.filter(e => e.semester === sem);
          return (
            <div key={sem} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold font-heading text-slate-800">Semester {sem}</h3>
                <span className="text-sm font-bold text-indigo-600">{semEvents.length} events</span>
              </div>
              <div className="space-y-2">
                {semEvents.slice(0, 5).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => navigate('event-details', ev.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 text-left"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${eventTypeColors[ev.type] || 'bg-gray-100 text-gray-700'}`}>{ev.type.slice(0, 3)}</span>
                    <span className="flex-1 text-sm text-slate-700 truncate">{ev.name}</span>
                    <span className="text-xs text-slate-400">{ev.date}</span>
                  </button>
                ))}
                {semEvents.length > 5 && (
                  <button onClick={() => navigate('all-events')} className="text-xs text-indigo-600 hover:underline pl-2">+{semEvents.length - 5} more</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
