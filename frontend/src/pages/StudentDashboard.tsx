import { useEffect, useState } from 'react';
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
    if (s === 'completed' || s === 'done') return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
    if (s === 'ongoing') return 'bg-blue-50 text-blue-700 border border-blue-200/80';
    if (s === 'cancelled') return 'bg-rose-50 text-rose-700 border border-rose-200/80';
    return 'bg-amber-50 text-amber-700 border border-amber-200/80';
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Academic Event Hub</p>
              <p className="text-sm font-bold font-heading text-white">Student Portal</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-400">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome Card */}
        <div className="relative bg-gradient-to-r from-slate-800 via-slate-850 to-indigo-950 border border-slate-800 rounded-3xl p-8 text-white overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">Student Attendance & Feedback Record</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight">{studentName || registerNumber}</h1>
              {studentName && (
                <p className="text-slate-400 text-xs font-mono mt-1">Register No: {registerNumber}</p>
              )}
            </div>

            <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-2xl px-6 py-4 text-center shrink-0">
              <p className="text-3xl font-extrabold font-heading text-indigo-400">{loading ? '—' : events.length}</p>
              <p className="text-slate-400 text-xs mt-0.5 font-medium">Recorded Events</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-5">
            {[1, 2].map(i => (
              <div key={i} className="bg-slate-800/50 rounded-2xl border border-slate-800 p-6 animate-pulse space-y-4">
                <div className="h-4 bg-slate-700 rounded w-1/3" />
                <div className="h-6 bg-slate-700 rounded w-2/3" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-4 bg-slate-700 rounded" />
                  <div className="h-4 bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-8 text-center text-rose-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-rose-400 mx-auto mb-3">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="font-semibold text-sm mb-1">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-3 text-xs text-rose-400 underline hover:text-rose-300">Retry</button>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-slate-800/40 rounded-3xl border border-slate-800 p-12 text-center">
            <div className="w-14 h-14 bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="text-lg font-bold font-heading text-white mb-2">No Registered Events Found</p>
            <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
              Register number <strong className="text-white">{registerNumber}</strong> has not been enrolled in any event attendance sheets yet. Contact your department event coordinator.
            </p>
            <button onClick={logout} className="mt-6 text-xs text-indigo-400 font-semibold hover:text-indigo-300 underline">Return to Login</button>
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-heading text-white tracking-tight flex items-center gap-2">
                <span>My Registered Academic Events</span>
                <span className="text-xs font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2.5 py-0.5">
                  {events.length}
                </span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {events.map(event => {
                const fb = feedbackStatus[event.id];
                const canGiveFeedback = fb?.status === 'available';
                const hasSubmitted = fb?.status === 'submitted';
                return (
                  <article
                    key={event.id}
                    className="bg-slate-800/60 rounded-2xl border border-slate-700/80 shadow-md hover:border-slate-600 transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                    <div className="p-6 space-y-4">
                      {/* Event header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider mb-1">{event.type}</p>
                          <h3 className="text-base font-bold font-heading text-white leading-snug">{event.name}</h3>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${statusBadge(event.status)}`}>
                          {event.status || 'Upcoming'}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                        <div>
                          <p className="text-slate-500 font-medium text-[10px] uppercase">Date</p>
                          <p className="text-slate-200 font-semibold mt-0.5">{formatDate(event.date as string)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium text-[10px] uppercase">Department</p>
                          <p className="text-slate-200 font-semibold mt-0.5">{event.department}</p>
                        </div>
                        {event.venue && (
                          <div className="col-span-2">
                            <p className="text-slate-500 font-medium text-[10px] uppercase">Venue</p>
                            <p className="text-slate-200 font-semibold mt-0.5 truncate">{event.venue}</p>
                          </div>
                        )}
                      </div>

                      {/* Feedback action section */}
                      <div className="pt-2">
                        {!fb || fb.status === 'loading' ? (
                          <div className="h-9 bg-slate-700/50 rounded-xl animate-pulse" />
                        ) : canGiveFeedback ? (
                          <button
                            onClick={() => navigate('student-event', event.id)}
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Submit Event Feedback
                          </button>
                        ) : hasSubmitted ? (
                          <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs font-semibold">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-emerald-400">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Feedback Submitted
                          </div>
                        ) : fb?.status === 'closed' ? (
                          <div className="py-2.5 px-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-500 font-semibold text-center">
                            Feedback Period Closed
                          </div>
                        ) : (
                          <div className="py-2.5 px-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-500 font-semibold text-center">
                            Feedback Form Not Available Yet
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => navigate('student-event', event.id)}
                        className="w-full text-center text-xs text-indigo-400 hover:text-indigo-300 font-semibold pt-1 transition-colors"
                      >
                        View Full Event Record &rarr;
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