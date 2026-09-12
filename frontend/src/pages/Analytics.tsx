import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';
import type { EventRecord } from '../types';
import { getEvents } from '../services/api';

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

const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const getMonthShort = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en', { month: 'short' });
};

interface AnalyticsProps { academicYear?: string; }

export default function Analytics({ academicYear = '' }: AnalyticsProps) {
  const isDark = useIsDark();
  const [dept, setDept] = useState<'ALL' | 'IT' | 'AIDS' | 'BOTH'>('ALL');
  const [year, setYear] = useState(academicYear || 'ALL');
  const [eventsData, setEventsData] = useState<EventRecord[]>([]);

  useEffect(() => {
    getEvents({ academicYear: year === 'ALL' ? undefined : year })
      .then(data => setEventsData(Array.isArray(data) ? data : []))
      .catch(() => setEventsData([]));
  }, [year]);

  const safeEventsData = Array.isArray(eventsData) ? eventsData : [];

  const events = dept === 'ALL'
    ? safeEventsData
    : safeEventsData.filter(e => e && (e.department === dept || (dept !== 'BOTH' && e.department === 'BOTH')));

  const itEventsWithAtt = safeEventsData.filter(e => e && e.department === 'IT' && (e.attendance || 0) > 0);
  const aidsEventsWithAtt = safeEventsData.filter(e => e && e.department === 'AIDS' && (e.attendance || 0) > 0);
  const itAvgAtt = itEventsWithAtt.length ? Math.round(itEventsWithAtt.reduce((a, e) => a + (e.attendance || 0), 0) / itEventsWithAtt.length) : 0;
  const aidsAvgAtt = aidsEventsWithAtt.length ? Math.round(aidsEventsWithAtt.reduce((a, e) => a + (e.attendance || 0), 0) / aidsEventsWithAtt.length) : 0;

  const monthlyData = months.map(m => ({
    month: m,
    IT: safeEventsData.filter(e => e && e.department === 'IT' && getMonthShort(e.date) === m).length,
    AIDS: safeEventsData.filter(e => e && e.department === 'AIDS' && getMonthShort(e.date) === m).length,
    BOTH: safeEventsData.filter(e => e && e.department === 'BOTH' && getMonthShort(e.date) === m).length,
  }));

  const typeData = ['Workshop', 'Seminar', 'Hackathon', 'FDP', 'Webinar', 'Guest Lecture', 'Training Event', 'Conference', 'Symposium', 'Vervathon'].map(type => ({
    type, count: events.filter(e => e && e.type === type).length,
  })).filter(d => d.count > 0);

  const deptData = [
    { name: 'IT', value: safeEventsData.filter(e => e && e.department === 'IT').length },
    { name: 'AIDS', value: safeEventsData.filter(e => e && e.department === 'AIDS').length },
    { name: 'BOTH', value: safeEventsData.filter(e => e && e.department === 'BOTH').length },
  ];

  const attendanceData = events.filter(e => e && (e.attendance || 0) > 0).map(e => ({
    name: (e.name || '').length > 16 ? (e.name || '').slice(0, 16) + '…' : (e.name || ''),
    attendance: e.attendance || 0,
    feedback: (e.feedbackScore || 0) * 20,
  }));

  const docData = [
    { name: 'Completed', value: events.filter(e => e && e.docStatus === 'Completed').length },
    { name: 'Partial', value: events.filter(e => e && e.docStatus === 'Partial').length },
    { name: 'Pending', value: events.filter(e => e && (e.docStatus === 'Pending' || !e.docStatus)).length },
  ];

  const semesterData = [
    { semester: 'Odd Semester', IT: safeEventsData.filter(e => e && e.department === 'IT' && e.semester === 'I').length, AIDS: safeEventsData.filter(e => e && e.department === 'AIDS' && e.semester === 'I').length, BOTH: safeEventsData.filter(e => e && e.department === 'BOTH' && e.semester === 'I').length },
    { semester: 'Even Semester', IT: safeEventsData.filter(e => e && e.department === 'IT' && e.semester === 'II').length, AIDS: safeEventsData.filter(e => e && e.department === 'AIDS' && e.semester === 'II').length, BOTH: safeEventsData.filter(e => e && e.department === 'BOTH' && e.semester === 'II').length },
  ];

  const validAttEvents = events.filter(e => e && (e.attendance || 0) > 0);
  const validFbEvents = events.filter(e => e && (e.feedbackScore || 0) > 0);

  const stats = [
    { label: 'Total Events Tracked', value: events.length, border: 'border-t-indigo-600' },
    { label: 'Total Footfall / Participants', value: events.reduce((a, e) => a + (e?.actualParticipants || 0), 0).toLocaleString(), border: 'border-t-purple-600' },
    { label: 'Average Attendance', value: Math.round(validAttEvents.reduce((a, e) => a + (e.attendance || 0), 0) / (validAttEvents.length || 1)) + '%', border: 'border-t-emerald-600' },
    { label: 'Average Feedback Rating', value: (validFbEvents.reduce((a, e) => a + (e.feedbackScore || 0), 0) / (validFbEvents.length || 1)).toFixed(1) + ' / 5.0', border: 'border-t-amber-600' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Institutional Event Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">Real-time performance metrics, compliance data & department trends</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`p-1 rounded-xl flex gap-1 border transition-colors ${isDark ? 'bg-[#172033] border-white/10' : 'bg-slate-100 border-slate-200/80'}`}>
            {(['ALL', 'IT', 'AIDS', 'BOTH'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDept(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dept === d
                    ? isDark ? 'bg-[#1E293B] text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">All Academic Years</option>
            {['2023-24', '2024-25', '2025-26', '2026-27'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 border-t-4 ${s.border}`}>
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">{s.label}</div>
            <div className="text-3xl font-extrabold font-heading text-slate-900 tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Row 1 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold font-heading text-slate-900 text-sm">Monthly Event Distribution</h3>
              <p className="text-slate-400 text-xs mt-0.5">Events hosted per month categorized by department</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: isDark ? '#64748B' : '#64748b' }} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11, fill: isDark ? '#64748B' : '#64748b' }} allowDecimals={false} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: isDark ? '#94A3B8' : undefined }} />
              <Bar dataKey="IT" fill="#4F46E5" radius={[4, 4, 0, 0]} name="IT Department" />
              <Bar dataKey="AIDS" fill="#9333EA" radius={[4, 4, 0, 0]} name="AIDS Department" />
              <Bar dataKey="BOTH" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Joint Events" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <h3 className="font-bold font-heading text-slate-900 text-sm">Department Volume Breakdown</h3>
            <p className="text-slate-400 text-xs mt-0.5">Proportion of events by department</p>
          </div>
          <div className="py-2">
            <PieChart width={220} height={190} className="mx-auto">
              <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={45} paddingAngle={4}>
                {deptData.map((_, i) => <Cell key={i} fill={['#4F46E5', '#9333EA', '#F59E0B'][i]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px' }} />
            </PieChart>
          </div>
          <div className={`flex justify-center gap-4 pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
            {deptData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: ['#4F46E5', '#9333EA', '#F59E0B'][i] }} />
                <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{d.name}: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <h3 className="font-bold font-heading text-slate-900 text-sm mb-1">Event Type Categorization</h3>
          <p className="text-slate-400 text-xs mb-4">Total events organized under each academic classification</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={typeData} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: isDark ? '#64748B' : '#64748b' }} allowDecimals={false} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#475569' }} width={95} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#4F46E5" radius={[0, 4, 4, 0]} name="Events Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <h3 className="font-bold font-heading text-slate-900 text-sm mb-1">Attendance vs Feedback Rating</h3>
          <p className="text-slate-400 text-xs mb-4">Correlation between student attendance % and overall satisfaction score %</p>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#64748B' : '#64748b' }} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11, fill: isDark ? '#64748B' : '#64748b' }} domain={[0, 100]} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: isDark ? '#94A3B8' : undefined }} />
              <Line type="monotone" dataKey="attendance" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4 }} name="Attendance %" />
              <Line type="monotone" dataKey="feedback" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} name="Feedback Score %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3 Charts & Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <h3 className="font-bold font-heading text-slate-900 text-sm mb-1">Documentation Compliance</h3>
          <p className="text-slate-400 text-xs mb-3">Status of uploaded audit documents</p>
          <PieChart width={180} height={160} className="mx-auto">
            <Pie data={docData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={42} paddingAngle={4}>
              {docData.map((_, i) => <Cell key={i} fill={['#10B981', '#F59E0B', '#EF4444'][i]} />)}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px' }} />
          </PieChart>
          <div className={`flex justify-center gap-4 pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
            {docData.map((d, i) => (
              <div key={d.name} className="text-center">
                <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1" style={{ background: ['#10B981', '#F59E0B', '#EF4444'][i] }} />
                <div className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.name}</div>
                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{d.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <h3 className="font-bold font-heading text-slate-900 text-sm mb-1">Semester Breakdown</h3>
          <p className="text-slate-400 text-xs mb-3">Odd vs Even semester course events</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={semesterData} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'} vertical={false} />
              <XAxis dataKey="semester" tick={{ fontSize: 11, fill: isDark ? '#64748B' : '#64748b' }} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11, fill: isDark ? '#64748B' : '#64748b' }} allowDecimals={false} axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: isDark ? '#94A3B8' : undefined }} />
              <Bar dataKey="IT" fill="#4F46E5" radius={[4, 4, 0, 0]} name="IT" />
              <Bar dataKey="AIDS" fill="#9333EA" radius={[4, 4, 0, 0]} name="AIDS" />
              <Bar dataKey="BOTH" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Joint" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <h3 className="font-bold font-heading text-slate-900 text-sm mb-1">IT vs AIDS Head-to-Head</h3>
          <p className="text-slate-400 text-xs mb-4">Comparative breakdown of key indicators</p>
          <div className="space-y-4">
            {[
              { label: 'Events Count', it: safeEventsData.filter(e => e && e.department === 'IT').length, aids: safeEventsData.filter(e => e && e.department === 'AIDS').length },
              { label: 'Total Footfall', it: safeEventsData.filter(e => e && e.department === 'IT').reduce((a,e) => a+(e?.actualParticipants||0), 0), aids: safeEventsData.filter(e => e && e.department === 'AIDS').reduce((a,e) => a+(e?.actualParticipants||0), 0) },
              { label: 'Avg Attendance %', it: itAvgAtt, aids: aidsAvgAtt },
            ].map(row => {
              const total = (row.it + row.aids) || 1;
              const itPct = Math.round((row.it / total) * 100);
              return (
                <div key={row.label} className={`p-3 rounded-xl border ${isDark ? 'bg-[#172033] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                  <div className={`flex justify-between text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className={isDark ? 'text-indigo-400' : 'text-indigo-600'}>IT: {row.it.toLocaleString()}</span>
                    <span>{row.label}</span>
                    <span className={isDark ? 'text-purple-400' : 'text-purple-600'}>AIDS: {row.aids.toLocaleString()}</span>
                  </div>
                  <div className={`flex h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-[#2D3E55]' : 'bg-slate-200'}`}>
                    <div className="bg-indigo-600 transition-all duration-500" style={{ width: `${itPct}%` }} />
                    <div className="bg-purple-600 transition-all duration-500" style={{ width: `${100 - itPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
