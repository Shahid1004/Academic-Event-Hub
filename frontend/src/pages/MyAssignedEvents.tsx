import { useEffect, useState } from 'react';
import type { EventRecord, Page, UserProfile } from '../types';
import { getEvents } from '../services/api';
import { eventTypeColors } from './Dashboard';

interface MyAssignedEventsProps {
  navigate: (page: Page, eventId?: string) => void;
  profile: UserProfile;
}

const docPercent = (docStatus: string) =>
  docStatus === 'Completed' ? 100 : docStatus === 'Partial' ? 50 : 0;

const statusColors: Record<string, string> = {
  'Completed': 'bg-green-100 text-green-700',
  'Upcoming': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Cancelled': 'bg-red-100 text-red-700',
};

export default function MyAssignedEvents({ navigate, profile }: MyAssignedEventsProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  useEffect(() => { getEvents().then(setEvents).catch(() => setEvents([])); }, []);
  const assignedEvents = events.filter(event =>
    event.assignedFaculty?.some(assigned => typeof assigned === 'string' ? assigned === profile.id : assigned.id === profile.id) ||
    event.coordinator.toLowerCase().includes(profile.name.toLowerCase())
  );
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">My Assigned Events</h1>
        <p className="text-slate-500 text-sm mt-0.5">{profile.name} — {assignedEvents.length} events assigned</p>
      </div>

      <div className="grid gap-4">
        {assignedEvents.map(event => {
          const docPct = docPercent(event.docStatus);
          return (
            <div key={event.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 flex-wrap">
                    <h3 className="font-semibold text-slate-800 text-base">{event.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[event.status]}`}>{event.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eventTypeColors[event.type] || 'bg-gray-100 text-gray-700'}`}>{event.type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      event.department === 'IT' ? 'bg-blue-100 text-blue-700' :
                      event.department === 'AIDS' ? 'bg-violet-100 text-violet-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{event.department}</span>
                    <span className="text-xs text-slate-500">📅 {event.date}</span>
                    <span className="text-xs text-slate-500">📍 {event.venue}</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Documentation Progress</span>
                      <span className="text-xs font-semibold text-slate-700">{docPct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${docPct === 100 ? 'bg-green-500' : docPct > 0 ? 'bg-amber-400' : 'bg-red-300'}`}
                        style={{ width: `${docPct}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="text-sm text-slate-600">{event.actualParticipants > 0 ? `${event.actualParticipants} participants` : 'Not held yet'}</div>
                  {event.attendance > 0 && <div className="text-sm text-slate-600">{event.attendance}% attendance</div>}
                  <button
                    onClick={() => navigate('event-details', event.id)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
