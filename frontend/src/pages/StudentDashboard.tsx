import { useEffect, useState } from 'react';
import type { EventRecord, Page } from '../types';
import { getEvents } from '../services/api';

interface Props { navigate: (page: Page, eventId?: string) => void; }

export default function StudentDashboard({ navigate }: Props) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, string>>({});
  const registerNumber = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}').registerNumber || '';

  useEffect(() => { getEvents().then(data => { setEvents(data); setFeedbackStatus(Object.fromEntries(data.map(event => [event.id, 'Not Available']))); }).catch(error => setError(error.response?.data?.message || 'Unable to load your events.')).finally(() => setLoading(false)); }, []);
  const logout = () => {
    if (!window.confirm('Are you sure you want to log out?')) return;
    localStorage.clear();
    sessionStorage.clear();
    navigate('login');
  };

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10">
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between"><div><p className="text-sm text-indigo-600 font-semibold">Academic Event Hub</p><h1 className="text-3xl font-bold text-slate-900">Student Dashboard</h1><p className="text-slate-500 mt-1">Register Number: {registerNumber}</p></div><button onClick={logout} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 bg-white">Logout</button></header>
      {loading ? <div className="bg-white rounded-2xl p-10 text-center text-slate-500">Loading your events...</div> : error ? <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">{error}</div> : events.length === 0 ? <div className="bg-white rounded-2xl p-10 text-center"><p className="text-slate-700 font-semibold">You are not part of any events.</p><button onClick={logout} className="mt-4 text-indigo-600 text-sm">Return to login</button></div> : <section><h2 className="text-xl font-bold text-slate-800 mb-4">My Events</h2><div className="grid md:grid-cols-2 gap-5">{events.map(event => <article key={event.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"><div className="flex justify-between gap-3"><div><span className="text-xs text-indigo-600 font-semibold">{event.type}</span><h3 className="text-lg font-bold text-slate-900 mt-1">{event.name}</h3><p className="text-xs text-slate-400 mt-1">{event.id}</p></div><span className="text-xs px-2 py-1 h-fit rounded-full bg-slate-100 text-slate-600">{event.department}</span></div><div className="grid grid-cols-2 gap-3 mt-5 text-sm"><div><p className="text-xs text-slate-400">Date</p><p>{String(event.date || '').slice(0, 10)}</p></div><div><p className="text-xs text-slate-400">Time</p><p>{event.startTime || '—'}–{event.endTime || '—'}</p></div><div className="col-span-2"><p className="text-xs text-slate-400">Venue</p><p>{event.venue || '—'}</p></div></div><p className="mt-4 text-sm text-slate-600">Feedback: <span className="font-semibold">{feedbackStatus[event.id] || 'Loading...'}</span></p><button onClick={() => navigate('student-event', event.id)} className="w-full mt-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">View Event</button></article>)}</div></section>}
    </div>
  </main>;
}