import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';
import type { EventRecord } from '../types';
import { getEvents } from '../services/api';

const COLORS = ['#4F46E5', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

interface AnalyticsProps { academicYear?: string; }

export default function Analytics({ academicYear = '' }: AnalyticsProps) {
  const [dept, setDept] = useState<'ALL' | 'IT' | 'AIDS' | 'BOTH'>('ALL');
  const [year, setYear] = useState(academicYear || 'ALL');
  const [eventsData, setEventsData] = useState<EventRecord[]>([]);

  useEffect(() => {
    getEvents({ academicYear: year === 'ALL' ? undefined : year }).then(setEventsData).catch(() => setEventsData([]));
  }, [year]);

  const events = dept === 'ALL' ? eventsData : eventsData.filter(e => e.department === dept || (dept !== 'BOTH' && e.department === 'BOTH'));

  const itEventsWithAtt = eventsData.filter(e => e.department === 'IT' && e.attendance > 0);
  const aidsEventsWithAtt = eventsData.filter(e => e.department === 'AIDS' && e.attendance > 0);
  const itAvgAtt = itEventsWithAtt.length ? Math.round(itEventsWithAtt.reduce((a, e) => a + e.attendance, 0) / itEventsWithAtt.length) : 0;
  const aidsAvgAtt = aidsEventsWithAtt.length ? Math.round(aidsEventsWithAtt.reduce((a, e) => a + e.attendance, 0) / aidsEventsWithAtt.length) : 0;

  const monthlyData = months.map(m => ({
    month: m,
    IT: eventsData.filter(e => e.department === 'IT' && new Date(e.date).toLocaleString('en', { month: 'short' }) === m).length,
    AIDS: eventsData.filter(e => e.department === 'AIDS' && new Date(e.date).toLocaleString('en', { month: 'short' }) === m).length,
    BOTH: eventsData.filter(e => e.department === 'BOTH' && new Date(e.date).toLocaleString('en', { month: 'short' }) === m).length,
  }));

  const typeData = ['Workshop', 'Seminar', 'Hackathon', 'FDP', 'Webinar', 'Guest Lecture', 'Training Event', 'Conference', 'Symposium', 'Vervathon'].map(type => ({
    type, count: events.filter(e => e.type === type).length,
  })).filter(d => d.count > 0);

  const deptData = [
    { name: 'IT', value: eventsData.filter(e => e.department === 'IT').length },
    { name: 'AIDS', value: eventsData.filter(e => e.department === 'AIDS').length },
    { name: 'BOTH', value: eventsData.filter(e => e.department === 'BOTH').length },
  ];

  const attendanceData = events.filter(e => e.attendance > 0).map(e => ({
    name: e.name.length > 18 ? e.name.slice(0, 18) + '…' : e.name,
    attendance: e.attendance,
    feedback: e.feedbackScore * 20,
  }));

  const docData = [
    { name: 'Completed', value: events.filter(e => e.docStatus === 'Completed').length },
    { name: 'Partial', value: events.filter(e => e.docStatus === 'Partial').length },
    { name: 'Pending', value: events.filter(e => e.docStatus === 'Pending').length },
  ];

  const semesterData = [
    { semester: 'Odd semester', IT: eventsData.filter(e => e.department === 'IT' && e.semester === 'I').length, AIDS: eventsData.filter(e => e.department === 'AIDS' && e.semester === 'I').length, BOTH: eventsData.filter(e => e.department === 'BOTH' && e.semester === 'I').length },
    { semester: 'Even semester', IT: eventsData.filter(e => e.department === 'IT' && e.semester === 'II').length, AIDS: eventsData.filter(e => e.department === 'AIDS' && e.semester === 'II').length, BOTH: eventsData.filter(e => e.department === 'BOTH' && e.semester === 'II').length },
  ];

  const stats = [
    { label: 'Total Events', value: events.length },
    { label: 'Total Participants', value: events.reduce((a, e) => a + e.actualParticipants, 0) },
    { label: 'Avg. Attendance', value: Math.round(events.filter(e => e.attendance > 0).reduce((a, e) => a + e.attendance, 0) / (events.filter(e => e.attendance > 0).length || 1)) + '%' },
    { label: 'Avg. Feedback', value: (events.filter(e => e.feedbackScore > 0).reduce((a, e) => a + e.feedbackScore, 0) / (events.filter(e => e.feedbackScore > 0).length || 1)).toFixed(1) + '/5' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Overall Analytics</h1>
          <p className="text-slate-500 text-sm">Academic Year {year} — Comprehensive Analysis</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['ALL', 'IT', 'AIDS', 'BOTH'] as const).map(d => (
            <button key={d} onClick={() => setDept(d)} className={`px-3 py-2 rounded-xl text-sm font-medium border ${dept === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>{d}</button>
          ))}
          <select value={year} onChange={e => setYear(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700">
            {['ALL', '2023-24', '2024-25', '2025-26', '2026-27'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="text-3xl font-bold font-heading text-indigo-600">{s.value}</div>
            <div className="text-sm text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Events by Month</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="IT" fill="#4F46E5" radius={[3,3,0,0]} />
              <Bar dataKey="AIDS" fill="#7C3AED" radius={[3,3,0,0]} />
              <Bar dataKey="BOTH" fill="#F59E0B" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Events by Department</h3>
          <PieChart width={200} height={180} className="mx-auto">
            <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3}>
              {deptData.map((_, i) => <Cell key={i} fill={['#4F46E5', '#7C3AED', '#F59E0B'][i]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
          <div className="flex justify-center gap-4 mt-2">
            {deptData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: ['#4F46E5', '#7C3AED', '#F59E0B'][i] }} />
                <span className="text-slate-600">{d.name}: <strong>{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Events by Event Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={typeData} layout="vertical" barSize={14}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#4F46E5" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Attendance & Feedback Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="attendance" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} name="Attendance %" />
              <Line type="monotone" dataKey="feedback" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="Feedback %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Documentation Completion</h3>
          <PieChart width={160} height={160} className="mx-auto">
            <Pie data={docData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
              {docData.map((_, i) => <Cell key={i} fill={['#10B981', '#F59E0B', '#EF4444'][i]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
          <div className="flex justify-center gap-3 mt-3">
            {docData.map((d, i) => (
              <div key={d.name} className="text-center">
                <div className="w-2 h-2 rounded-full mx-auto mb-0.5" style={{ background: ['#10B981', '#F59E0B', '#EF4444'][i] }} />
                <div className="text-xs text-slate-500">{d.name}</div>
                <div className="text-sm font-bold text-slate-700">{d.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Semester-wise Events</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={semesterData} barSize={20}>
              <XAxis dataKey="semester" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="IT" fill="#4F46E5" radius={[4,4,0,0]} />
              <Bar dataKey="AIDS" fill="#7C3AED" radius={[4,4,0,0]} />
              <Bar dataKey="BOTH" fill="#F59E0B" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">IT vs AIDS Comparison</h3>
          <div className="space-y-4">
            {[
              { label: 'Events', it: eventsData.filter(e => e.department === 'IT').length, aids: eventsData.filter(e => e.department === 'AIDS').length },
              { label: 'Participants', it: eventsData.filter(e => e.department === 'IT').reduce((a,e) => a+e.actualParticipants, 0), aids: eventsData.filter(e => e.department === 'AIDS').reduce((a,e) => a+e.actualParticipants, 0) },
              { label: 'Avg Attendance %', it: itAvgAtt, aids: aidsAvgAtt },
            ].map(row => (
              <div key={row.label}>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span className="text-blue-600 font-medium">IT: {row.it}</span>
                  <span className="font-medium text-slate-600">{row.label}</span>
                  <span className="text-violet-600 font-medium">AIDS: {row.aids}</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 rounded-l-full" style={{ width: `${(row.it / (row.it + row.aids)) * 100}%` }} />
                  <div className="bg-violet-500 rounded-r-full" style={{ width: `${(row.aids / (row.it + row.aids)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
