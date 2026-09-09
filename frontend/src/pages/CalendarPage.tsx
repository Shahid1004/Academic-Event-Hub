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
  IT: 'bg-blue-500',
  AIDS: 'bg-violet-500',
  BOTH: 'bg-amber-500',
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
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Academic Event Calendar</h1>
          <p className="text-slate-500 text-sm">
            {loading ? 'Loading events...' : `${eventsInMonth.length} events this month`}
          </p>
        </div>
        <div className="flex gap-2">
          {(['month', 'week', 'list'] as CalView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border capitalize ${view === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Legend */}
      <div className="flex gap-4">
        {[['IT', 'bg-blue-500'], ['AIDS', 'bg-violet-500'], ['BOTH', 'bg-amber-500']].map(([d, c]) => (
          <div key={d} className="flex items-center gap-2 text-sm text-slate-600">
            <div className={`w-3 h-3 rounded-full ${c}`} />
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <button onClick={prev} className="p-2 hover:bg-slate-100 rounded-xl">←</button>
          <h2 className="text-lg font-bold font-heading text-slate-800">{MONTHS[month]} {year}</h2>
          <button onClick={next} className="p-2 hover:bg-slate-100 rounded-xl">→</button>
        </div>

        {view === 'month' && (
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAYS.map(d => (
                <div key={d} className="text-center py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{d}</div>
              ))}
            </div>
            {/* Days */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-24 border-b border-r border-slate-50 bg-slate-50/50" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayEvents = getEventsOnDay(day);
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                return (
                  <div key={day} className={`min-h-24 border-b border-r border-slate-100 p-1.5 ${isToday ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                    <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                      {day}
                    </div>
                    {dayEvents.slice(0, 2).map(e => (
                      <button
                        key={e.id}
                        onClick={() => navigate('event-details', e.id)}
                        className={`w-full text-left text-white text-xs px-1.5 py-0.5 rounded mb-0.5 truncate ${deptColors[e.department]}`}
                      >
                        {e.name}
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-slate-400">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="divide-y divide-slate-100">
            {[...events].sort((a, b) => a.date.localeCompare(b.date)).map(e => (
              <button
                key={e.id}
                onClick={() => navigate('event-details', e.id)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 text-left"
              >
                <div className={`w-1 h-12 rounded-full flex-shrink-0 ${deptColors[e.department]}`} />
                <div className="w-16 text-center">
                  <div className="text-lg font-bold font-heading text-slate-800">{new Date(e.date).getDate()}</div>
                  <div className="text-xs text-slate-400">{MONTHS[new Date(e.date).getMonth()].slice(0, 3)}</div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-800">{e.name}</div>
                  <div className="text-xs text-slate-500">{e.type} · {e.department === 'BOTH' ? 'IT+AIDS' : e.department} · {e.startTime}–{e.endTime} · {e.venue}</div>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                  e.status === 'Completed' ? 'bg-green-100 text-green-700' :
                  e.status === 'Upcoming' ? 'bg-blue-100 text-blue-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{e.status}</div>
              </button>
            ))}
          </div>
        )}

        {view === 'week' && (
          <div className="p-6 text-center text-slate-500">
            <div className="text-3xl mb-3">📆</div>
            <p>Week view shows events for the current week.</p>
            <div className="mt-4 space-y-3">
              {events.slice(0, 5).map(e => (
                <button
                  key={e.id}
                  onClick={() => navigate('event-details', e.id)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-left"
                >
                  <div className={`w-3 h-3 rounded-full ${deptColors[e.department]}`} />
                  <span className="font-medium text-slate-700">{e.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{e.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
