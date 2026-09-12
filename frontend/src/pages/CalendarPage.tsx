import { useEffect, useState } from 'react';
import type { EventRecord, Page } from '../types';
import { getCalendarEvents } from '../services/api';

interface CalendarPageProps {
  navigate: (page: Page, eventId?: string) => void;
  academicYear?: string;
}

type CalView = 'month' | 'week' | 'list';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const deptColors: Record<string, string> = {
  IT: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  AIDS: 'bg-purple-600 hover:bg-purple-700 text-white',
  BOTH: 'bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold',
};

export default function CalendarPage({ navigate, academicYear = '' }: CalendarPageProps) {
  const today = new Date();
  const [view, setView] = useState<CalView>('month');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    getCalendarEvents({ academicYear: academicYear || undefined })
      .then((calendarEvents) => {
        if (active) setEvents(calendarEvents);
      })
      .catch(() => {
        if (active) setError('Unable to load calendar events.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [academicYear]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsInMonth = events.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const getEventsOnDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Institutional Event Calendar</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">
            {loading ? 'Loading schedule...' : `${eventsInMonth.length} scheduled events for ${MONTHS[month]} ${year}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200/80">
            {(['month', 'week', 'list'] as CalView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  view === v
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {v} View
              </button>
            ))}
          </div>

          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all"
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Department Color Legend Bar */}
      <div className="flex items-center gap-4 bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 text-xs font-medium text-slate-600">
        <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Department Indicator:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
          <span>Information Technology (IT)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
          <span>AI & Data Science (AIDS)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Joint (IT + AIDS)</span>
        </div>
      </div>

      {/* Main Calendar View Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/40">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold font-heading text-slate-900 tracking-tight">
              {MONTHS[month]} {year}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={prev}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
              title="Previous Month"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
              title="Next Month"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Month View Grid */}
        {view === 'month' && (
          <div>
            {/* Header row */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
              {DAYS.map(d => (
                <div key={d} className="text-center py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[110px] bg-slate-50/30 p-2" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayEvents = getEventsOnDay(day);
                const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
                return (
                  <div
                    key={day}
                    className={`min-h-[110px] p-2 transition-colors ${
                      isToday ? 'bg-indigo-50/40' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700'
                      }`}>
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-bold text-slate-400">
                          {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map(e => (
                        <button
                          key={e.id}
                          onClick={() => navigate('event-details', e.id)}
                          className={`w-full text-left text-[11px] font-semibold px-2 py-1 rounded-lg truncate shadow-xs transition-transform hover:scale-[1.02] ${deptColors[e.department] || 'bg-slate-700 text-white'}`}
                          title={e.name}
                        >
                          {e.name}
                        </button>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] font-bold text-indigo-600 pt-0.5">
                          +{dayEvents.length - 2} more events
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="divide-y divide-slate-100">
            {events.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No events scheduled.
              </div>
            ) : (
              [...events].sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                <button
                  key={e.id}
                  onClick={() => navigate('event-details', e.id)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-indigo-50/30 text-left transition-colors group"
                >
                  <div className={`w-1.5 h-12 rounded-full shrink-0 ${
                    e.department === 'IT' ? 'bg-indigo-600' :
                    e.department === 'AIDS' ? 'bg-purple-600' : 'bg-amber-500'
                  }`} />

                  <div className="w-14 text-center shrink-0">
                    <div className="text-xl font-extrabold font-heading text-slate-900">{new Date(e.date).getDate()}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{MONTHS[new Date(e.date).getMonth()].slice(0, 3)}</div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors truncate">{e.name}</div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-700">{e.type}</span>
                      <span>&bull;</span>
                      <span>{e.department === 'BOTH' ? 'IT + AIDS' : e.department}</span>
                      <span>&bull;</span>
                      <span>{[e.startTime, e.endTime].filter(Boolean).join(' - ') || 'Full Day'}</span>
                      <span>&bull;</span>
                      <span>{e.venue}</span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    e.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    e.status === 'Upcoming' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {e.status}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Week View */}
        {view === 'week' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-bold font-heading text-slate-900 text-sm">Upcoming Week Events</h3>
            <div className="max-w-xl mx-auto space-y-2.5 text-left">
              {events.slice(0, 5).map(e => (
                <button
                  key={e.id}
                  onClick={() => navigate('event-details', e.id)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200/60 transition-all text-xs font-semibold text-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      e.department === 'IT' ? 'bg-indigo-600' :
                      e.department === 'AIDS' ? 'bg-purple-600' : 'bg-amber-500'
                    }`} />
                    <span>{e.name}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{e.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
