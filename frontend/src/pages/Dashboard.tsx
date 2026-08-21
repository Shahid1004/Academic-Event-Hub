import { useState } from 'react';
import type { Department, Page } from '../types';
import { sampleEvents, eventTypes } from '../data/sampleData';

interface DashboardProps {
  navigate: (page: Page, eventId?: string) => void;
}

const statCards = (events: typeof sampleEvents) => [
  { label: 'Total Events', value: events.length, color: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600', icon: '📅' },
  { label: 'Completed Events', value: events.filter(e => e.status === 'Completed').length, color: 'bg-green-500', light: 'bg-green-50', text: 'text-green-600', icon: '✅' },
  { label: 'Pending Documentation', value: events.filter(e => e.docStatus === 'Pending' || e.docStatus === 'Partial').length, color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600', icon: '📋' },
  { label: 'Upcoming Events', value: events.filter(e => e.status === 'Upcoming').length, color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', icon: '🗓️' },
  { label: 'Total Participants', value: events.reduce((a, e) => a + e.actualParticipants, 0), color: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-600', icon: '👥' },
  { label: 'Avg. Attendance', value: Math.round(events.filter(e => e.attendance > 0).reduce((a, e) => a + e.attendance, 0) / (events.filter(e => e.attendance > 0).length || 1)) + '%', color: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-600', icon: '📊' },
  { label: 'Avg. Feedback', value: (events.filter(e => e.feedbackScore > 0).reduce((a, e) => a + e.feedbackScore, 0) / (events.filter(e => e.feedbackScore > 0).length || 1)).toFixed(1) + '/5', color: 'bg-pink-500', light: 'bg-pink-50', text: 'text-pink-600', icon: '⭐' },
];

const eventTypeColors: Record<string, string> = {
  'Hackathon': 'bg-orange-100 text-orange-700',
  'Vervathon': 'bg-pink-100 text-pink-700',
  'Guest Lecture': 'bg-blue-100 text-blue-700',
  'Workshop': 'bg-indigo-100 text-indigo-700',
  'Webinar': 'bg-cyan-100 text-cyan-700',
  'Seminar': 'bg-violet-100 text-violet-700',
  'Symposium': 'bg-purple-100 text-purple-700',
  'FDP': 'bg-green-100 text-green-700',
  'Training Event': 'bg-teal-100 text-teal-700',
  'Conference': 'bg-red-100 text-red-700',
  'Joint Event': 'bg-amber-100 text-amber-700',
  'Other': 'bg-gray-100 text-gray-700',
};

export { eventTypeColors };

export default function Dashboard({ navigate }: DashboardProps) {
  const [dept, setDept] = useState<Department | 'ALL'>('ALL');

  const filtered = dept === 'ALL' ? sampleEvents : dept === 'BOTH'
    ? sampleEvents.filter(e => e.department === 'BOTH')
    : sampleEvents.filter(e => e.department === dept || e.department === 'BOTH');

  const stats = statCards(filtered);

  const typeCounts = eventTypes.map(type => ({
    type,
    count: filtered.filter(e => e.type === type).length,
  })).filter(t => t.count > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Main Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Academic Year 2025-26 — Overview</p>
        </div>
        <div className="flex gap-2">
          {(['ALL', 'IT', 'AIDS', 'BOTH'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                dept === d
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className={`text-2xl mb-1`}>{stat.icon}</div>
            <div className={`text-2xl font-bold font-heading ${stat.text}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5 leading-tight">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Event Types Grid */}
      <div>
        <h2 className="text-lg font-bold font-heading text-slate-800 mb-3">Events by Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {eventTypes.map(type => {
            const count = filtered.filter(e => e.type === type).length;
            return (
              <button
                key={type}
                onClick={() => navigate('all-events')}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md text-left group"
              >
                <div className={`text-2xl font-bold font-heading group-hover:text-indigo-600 ${count === 0 ? 'text-slate-300' : 'text-slate-800'}`}>{count}</div>
                <div className={`text-xs mt-1 font-medium leading-tight ${count === 0 ? 'text-slate-300' : 'text-slate-600'}`}>{type}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Events */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold font-heading text-slate-800">Recent Events</h2>
          <button onClick={() => navigate('all-events')} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View All →</button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Event Name', 'Type', 'Dept', 'Date', 'Coordinator', 'Participants', 'Attendance', 'Status', 'Action'].map(col => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 6).map((event, i) => (
                  <tr key={event.id} className={`border-b border-slate-50 hover:bg-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 whitespace-nowrap">{event.name}</div>
                      <div className="text-xs text-slate-400">{event.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${eventTypeColors[event.type] || 'bg-gray-100 text-gray-700'}`}>
                        {event.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        event.department === 'IT' ? 'bg-blue-100 text-blue-700' :
                        event.department === 'AIDS' ? 'bg-violet-100 text-violet-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{event.department}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{event.date}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{event.coordinator.split(' ').slice(0, 2).join(' ')}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{event.actualParticipants || '—'}</td>
                    <td className="px-4 py-3">
                      {event.attendance > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${event.attendance}%` }} />
                          </div>
                          <span className="text-xs text-slate-600">{event.attendance}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        event.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        event.status === 'Upcoming' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{event.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate('event-details', event.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50 whitespace-nowrap"
                      >
                        View Event
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
