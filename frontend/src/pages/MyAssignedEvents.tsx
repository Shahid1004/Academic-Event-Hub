import { useEffect, useState } from 'react';
import type { EventRecord, Page, UserProfile } from '../types';
import { deleteEvent, getEvents } from '../services/api';
import { eventTypeColors } from './Dashboard';

interface MyAssignedEventsProps {
  navigate: (page: Page, eventId?: string) => void;
  profile: UserProfile;
}

const docPercent = (docStatus: string, reportStatus?: string): number => {
  const docScore = docStatus === 'Completed' ? 2 : docStatus === 'Partial' ? 1 : 0;
  const repScore = reportStatus === 'Completed' ? 2 : reportStatus === 'Submitted' ? 1 : reportStatus === 'Partial' ? 1 : 0;
  const total = docScore + repScore;
  // Map 0–4 to 0–100% with meaningful steps
  if (total === 4) return 100;
  if (total === 3) return 75;
  if (total === 2) return 50;
  if (total === 1) return 25;
  return 0;
};

const docStatusLabel = (docStatus: string, reportStatus?: string): { label: string; color: string } => {
  if (docStatus === 'Completed' && (reportStatus === 'Completed' || !reportStatus))
    return { label: 'All documents submitted', color: 'text-emerald-600' };
  if (docStatus === 'Completed')
    return { label: `Docs complete · Report: ${reportStatus || 'Pending'}`, color: 'text-amber-600' };
  if (docStatus === 'Partial')
    return { label: `Docs partially submitted · Report: ${reportStatus || 'Pending'}`, color: 'text-amber-600' };
  if (docStatus === 'Missing' || !docStatus)
    return { label: 'Documentation not uploaded yet', color: 'text-rose-500' };
  return { label: docStatus, color: 'text-slate-500' };
};

const statusColors: Record<string, string> = {
  'Completed': 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
  'Upcoming': 'bg-blue-50 text-blue-700 border border-blue-200/80',
  'In Progress': 'bg-amber-50 text-amber-700 border border-amber-200/80',
  'Cancelled': 'bg-rose-50 text-rose-700 border border-rose-200/80',
};

export default function MyAssignedEvents({ navigate, profile }: MyAssignedEventsProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);

  useEffect(() => { getEvents().then(setEvents).catch(() => setEvents([])); }, []);

  const handleDelete = async (e: React.MouseEvent, eventId: string, eventName: string) => {
    e.stopPropagation();
    const confirmMsg = `Are you sure you want to delete "${eventName}"?\n\nWARNING: All event-related data will be permanently deleted including in the database (uploaded documents, attendance records, feedback forms, etc.).`;
    if (window.confirm(confirmMsg)) {
      try {
        await deleteEvent(eventId);
        alert(`Event "${eventName}" and all related data have been permanently deleted including in the database.`);
        setEvents(prev => prev.filter(ev => ev.id !== eventId));
      } catch (err: any) {
        alert(`Failed to delete event: ${err.response?.data?.message || err.message}`);
      }
    }
  };

  const assignedEvents = events.filter(event =>
    event.assignedFaculty?.some(assigned => typeof assigned === 'string' ? assigned === profile.id : assigned.id === profile.id) ||
    event.coordinator.toLowerCase().includes(profile.name.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">My Assigned Academic Events</h1>
        <p className="text-slate-500 text-sm mt-0.5 font-medium">
          Logged in as <span className="text-slate-900 font-bold">{profile.name}</span> &bull; {assignedEvents.length} assigned events requiring coordinator action
        </p>
      </div>

      <div className="space-y-4">
        {assignedEvents.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-bold font-heading text-slate-900 text-base">No Assigned Events</h3>
            <p className="text-slate-500 text-xs mt-1">You currently have no events assigned to your profile.</p>
          </div>
        ) : (
          assignedEvents.map(event => {
            const docPct = docPercent(event.docStatus, event.reportStatus);
            const { label: docLabel, color: docLabelColor } = docStatusLabel(event.docStatus, event.reportStatus);
            return (
              <div key={event.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:border-indigo-300 transition-all space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColors[event.status || 'Upcoming'] || 'bg-slate-100 text-slate-700'}`}>
                        {event.status || 'Upcoming'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${eventTypeColors[event.type] || 'bg-slate-100 text-slate-700'}`}>
                        {event.type}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        event.department === 'IT' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        event.department === 'AIDS' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {event.department}
                      </span>
                    </div>

                    <h3 className="font-bold font-heading text-slate-900 text-lg leading-snug">{event.name}</h3>

                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {event.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {event.venue}
                      </span>
                      <span className="flex items-center gap-1 text-slate-700 font-semibold">
                        👥 {event.actualParticipants ? `${event.actualParticipants} Attended` : 'Not Conducted Yet'}
                      </span>
                    </div>

                    {/* Doc Progress */}
                    <div className="pt-2 max-w-md">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-500">Audit Documentation Status</span>
                        <span className={`text-xs font-bold ${
                          docPct === 100 ? 'text-emerald-600' : docPct > 0 ? 'text-amber-600' : 'text-rose-500'
                        }`}>{docPct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            docPct === 100 ? 'bg-emerald-500' : docPct > 0 ? 'bg-amber-400' : 'bg-rose-400'
                          }`}
                          style={{ width: `${docPct}%` }}
                        />
                      </div>
                      <p className={`text-[10px] font-medium mt-1 ${docLabelColor}`}>{docLabel}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                    <button
                      onClick={() => navigate('event-details', event.id)}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-500/20 transition-all"
                    >
                      Manage Event &rarr;
                    </button>
                    <button
                      onClick={(e) => void handleDelete(e, event.id, event.name)}
                      className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-xl transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
