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
import type { Page } from '../types';
import { getStudentEvents, getStudentFeedback, type StudentEventRecord } from '../services/api';

interface Props { navigate: (page: Page, eventId?: string) => void; }

interface FeedbackStatusInfo {
  status: 'loading' | 'not-available' | 'available' | 'submitted' | 'closed' | 'error';
  label: string;
}

export default function StudentDashboard({ navigate }: Props) {
  const [events, setEvents] = useState<StudentEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, FeedbackStatusInfo>>({});
  const [studentName, setStudentName] = useState('');

  const stored = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const registerNumber = stored.registerNumber || stored.name || '';

  useEffect(() => {
    setLoading(true);
    getStudentEvents()
      .then(async ({ events: evts, studentName: name }) => {
        setEvents(evts);
        if (name) setStudentName(name);

        // Load feedback status for each event concurrently
        const statusEntries = await Promise.all(
          evts.map(async event => {
            try {
              const result = await getStudentFeedback(event.id);
              let info: FeedbackStatusInfo;
              if (result.submitted) {
                info = { status: 'submitted', label: 'Feedback Submitted ✓' };
              } else if (!result.form) {
                if (result.status === 'Closed') {
                  info = { status: 'closed', label: 'Feedback Closed' };
                } else {
                  info = { status: 'not-available', label: 'Not Available Yet' };
                }
              } else {
                info = { status: 'available', label: 'Give Feedback' };
              }
              return [event.id, info] as const;
            } catch {
              return [event.id, { status: 'error' as const, label: 'Unavailable' }] as const;
            }
          })
        );
        setFeedbackStatus(Object.fromEntries(statusEntries));
      })
      .catch(err => {
        const msg = err?.response?.data?.message || 'Unable to load your events. Please try again.';
        setError(msg);
        console.error('getStudentEvents error:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      localStorage.clear();
      sessionStorage.clear();
      navigate('login');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return String(dateStr).slice(0, 10); }
  };

  const statusBadge = (status?: string) => {
    const s = (status || 'Upcoming').toLowerCase();
    if (s === 'completed' || s === 'done') return 'bg-emerald-100 text-emerald-700';
    if (s === 'ongoing') return 'bg-blue-100 text-blue-700';
    if (s === 'cancelled') return 'bg-red-100 text-red-600';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-indigo-600 font-semibold tracking-wide uppercase">Academic Event Hub</p>
              <p className="text-sm font-bold text-slate-800">Student Portal</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome Card */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-3xl p-8 text-white overflow-hidden shadow-xl shadow-indigo-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-16 -translate-x-12" />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-indigo-200 text-sm font-medium mb-1">Welcome back</p>
                <h1 className="text-3xl font-bold mb-1">{studentName || registerNumber}</h1>
                {studentName && (
                  <p className="text-indigo-200 text-sm font-mono">{registerNumber}</p>
                )}
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-4 text-center">
                <p className="text-3xl font-bold">{loading ? '—' : events.length}</p>
                <p className="text-indigo-200 text-xs mt-1">Registered<br />Events</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-5">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-6 bg-slate-200 rounded w-2/3 mb-4" />
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="h-4 bg-slate-200 rounded" />
                  <div className="h-4 bg-slate-200 rounded" />
                </div>
                <div className="h-10 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-12 h-12 text-red-400 mx-auto mb-3">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-red-700 font-semibold mb-1">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-3 text-sm text-red-600 underline hover:text-red-700">Retry</button>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-slate-400">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="text-xl font-bold text-slate-800 mb-2">No Events Found</p>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Your register number <strong>{registerNumber}</strong> has not been added to any event attendance yet. Contact your event coordinator.
            </p>
            <button onClick={logout} className="mt-6 text-sm text-indigo-600 font-medium hover:text-indigo-700 underline">Return to Login</button>
          </div>
        ) : (
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
              <span>My Registered Events</span>
              <span className="text-sm font-normal text-slate-500 bg-slate-100 rounded-full px-3 py-1">
                {events.length} event{events.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              {events.map(event => {
                const fb = feedbackStatus[event.id];
                const canGiveFeedback = fb?.status === 'available';
                const hasSubmitted = fb?.status === 'submitted';
                return (
                  <article
                    key={event.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
                    <div className="p-6">
                      {/* Event header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-1">{event.type}</p>
                          <h3 className="text-lg font-bold text-slate-900 leading-tight">{event.name}</h3>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusBadge(event.status)}`}>
                          {event.status || 'Upcoming'}
                        </span>
                      </div>

                      {/* Event details */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-5">
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">Date</p>
                          <p className="text-slate-700 font-semibold">{formatDate(event.date as string)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">Department</p>
                          <p className="text-slate-700 font-semibold">{event.department}</p>
                        </div>
                        {event.venue && (
                          <div>
                            <p className="text-xs text-slate-400 font-medium mb-0.5">Venue</p>
                            <p className="text-slate-700 font-semibold truncate">{event.venue}</p>
                          </div>
                        )}
                        {event.startTime && (
                          <div>
                            <p className="text-xs text-slate-400 font-medium mb-0.5">Time</p>
                            <p className="text-slate-700 font-semibold">{event.startTime} – {event.endTime || '—'}</p>
                          </div>
                        )}
                      </div>

                      {/* Feedback section */}
                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-wide">Feedback</p>
                        {!fb || fb.status === 'loading' ? (
                          <div className="h-9 bg-slate-100 rounded-xl animate-pulse" />
                        ) : canGiveFeedback ? (
                          <button
                            onClick={() => navigate('student-event', event.id)}
                            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Give Feedback
                          </button>
                        ) : hasSubmitted ? (
                          <div className="flex items-center gap-2 py-2.5 px-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-emerald-600 shrink-0">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span className="text-sm font-semibold text-emerald-700">Feedback Submitted</span>
                          </div>
                        ) : fb?.status === 'closed' ? (
                          <div className="py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 font-medium text-center">
                            Feedback Closed
                          </div>
                        ) : (
                          <div className="py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 font-medium text-center">
                            Feedback Not Available Yet
                          </div>
                        )}
                      </div>

                      {/* View event button */}
                      <button
                        onClick={() => navigate('student-event', event.id)}
                        className="w-full mt-3 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:bg-indigo-50 rounded-xl transition-colors"
                      >
                        View Event Details →
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}