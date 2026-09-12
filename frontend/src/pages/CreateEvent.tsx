import { useEffect, useState } from 'react';
import type { Page, UserProfile } from '../types';
import { eventTypes } from '../data/sampleData';
import { createEvent, getUsers } from '../services/api';

interface CreateEventProps {
  navigate: (page: Page, eventId?: string) => void;
}

export default function CreateEvent({ navigate }: CreateEventProps) {
  const [form, setForm] = useState({
    name: '', type: 'Workshop', department: 'IT', academicYear: '2025-26',
    semester: 'I', date: '', dateTo: '', startTime: '', endTime: '', venue: '', mode: 'Offline',
    targetStudents: '', coordinator: '', additionalCoordinators: '',
    expectedParticipants: '', rpName: '', rpDesignation: '', rpOrganization: '',
    rpContact: '', rpEmail: '', sponsoredBy: '', objective: '', description: '', hodAssignment: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [facultyUsers, setFacultyUsers] = useState<UserProfile[]>([]);
  const [assignedFaculty, setAssignedFaculty] = useState<string[]>([]);
  const [targetYears, setTargetYears] = useState<number[]>([]);

  useEffect(() => {
    getUsers().then(users => setFacultyUsers(users.filter(user => user.active))).catch(() => undefined);
  }, []);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (action: 'draft' | 'submit') => {
    if (!form.name.trim() || !form.date || !form.objective.trim()) {
      setError('Event name, date, and objective are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const selectedCoordinatorNames = facultyUsers
        .filter(user => assignedFaculty.includes(user.id))
        .map(user => user.name);
      const additionalCoordinatorNames = form.additionalCoordinators
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);
      await createEvent({
        ...form,
        department: form.department as 'IT' | 'AIDS' | 'BOTH',
        resourcePerson: { name: form.rpName, designation: form.rpDesignation, organization: form.rpOrganization, contact: form.rpContact, email: form.rpEmail },
        coordinator: [...selectedCoordinatorNames, ...additionalCoordinatorNames].join(', '),
        assignedFaculty,
        targetYears,
        status: action === 'draft' ? 'Draft' : 'Upcoming',
      });
      navigate('all-events');
    } catch (err: any) {
      const serverMsg = err.response?.data?.message || err.message || 'Unable to save the event. Check backend connection and permissions.';
      setError(serverMsg);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400";
  const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5";

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header Bar */}
      <div className="flex items-center gap-4 pb-4 border-b border-slate-200/80">
        <button
          onClick={() => navigate('all-events')}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
          title="Back to All Events"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Create Academic Event</h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">Define event specifications, schedules, coordinators, and guest speaker information</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-start gap-2.5 shadow-sm">
          <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Basic Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <h3 className="font-bold font-heading text-slate-900 text-sm">General Event Metadata</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2 lg:col-span-4">
              <label className={labelCls}>Event Title <span className="text-rose-500">*</span></label>
              <input value={form.name} onChange={update('name')} placeholder="e.g., International Symposium on Generative AI" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Event Category <span className="text-rose-500">*</span></label>
              <select value={form.type} onChange={update('type')} className={inputCls}>
                {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Organizing Department <span className="text-rose-500">*</span></label>
              <select value={form.department} onChange={update('department')} className={inputCls}>
                <option value="IT">Information Technology (IT)</option>
                <option value="AIDS">AI & Data Science (AIDS)</option>
                <option value="BOTH">Joint (IT + AIDS)</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Academic Year</label>
              <select value={form.academicYear} onChange={update('academicYear')} className={inputCls}>
                {['2023-24', '2024-25', '2025-26', '2026-27'].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Semester</label>
              <select value={form.semester} onChange={update('semester')} className={inputCls}>
                <option value="I">Odd Semester (I)</option>
                <option value="II">Even Semester (II)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Date, Time & Venue */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              02
            </div>
            <h3 className="font-bold font-heading text-slate-900 text-sm">Schedule & Logistics</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Start Date <span className="text-rose-500">*</span></label>
              <input type="date" value={form.date} onChange={update('date')} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" min={form.date} value={form.dateTo} onChange={update('dateTo')} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Start Time</label>
              <input type="time" value={form.startTime} onChange={update('startTime')} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>End Time</label>
              <input type="time" value={form.endTime} onChange={update('endTime')} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Delivery Mode</label>
              <select value={form.mode} onChange={update('mode')} className={inputCls}>
                <option>Offline</option>
                <option>Online</option>
                <option>Hybrid</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Venue / Location</label>
              <input value={form.venue} onChange={update('venue')} placeholder="e.g., APJ Abdul Kalam Auditorium, IT Block" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Sponsored / Funding Body</label>
              <input value={form.sponsoredBy} onChange={update('sponsoredBy')} placeholder="e.g., AICTE / Management" className={inputCls} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Target Audience Description</label>
              <input value={form.targetStudents} onChange={update('targetStudents')} placeholder="e.g., III & IV Year B.Tech Students" className={inputCls} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Target Student Year(s)</label>
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200/80 p-3 bg-slate-50/50">
                {[1, 2, 3, 4].map(year => (
                  <label key={year} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                    targetYears.includes(year) ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={targetYears.includes(year)}
                      onChange={event => setTargetYears(current => event.target.checked ? [...current, year] : current.filter(v => v !== year))}
                      className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    Year {year}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Faculty Coordinators */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              03
            </div>
            <h3 className="font-bold font-heading text-slate-900 text-sm">Faculty Coordinators & Attendance Expectation</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Expected Participant Count</label>
              <input type="number" value={form.expectedParticipants} onChange={update('expectedParticipants')} placeholder="e.g., 120" className={inputCls} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Assign Registered Faculty Coordinators</label>
              {facultyUsers.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 rounded-xl border border-slate-200/80 p-3 bg-slate-50/50">
                  {facultyUsers.map(user => (
                    <label key={user.id} className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      assignedFaculty.includes(user.id) ? 'border-indigo-400 bg-indigo-50/80 text-indigo-900 font-semibold' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={assignedFaculty.includes(user.id)}
                        onChange={event => setAssignedFaculty(current => event.target.checked ? [...current, user.id] : current.filter(id => id !== user.id))}
                        className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="truncate">{user.name} <span className="text-[10px] text-slate-400">({user.department})</span></span>
                    </label>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400 font-medium">No registered faculty available for assignment.</p>}
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>External / Additional Coordinator Names</label>
              <input value={form.additionalCoordinators} onChange={update('additionalCoordinators')} placeholder="Comma-separated list (e.g., Dr. R. Kumar, Prof. S. Priya)" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Section 4: Resource Person Details */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              04
            </div>
            <h3 className="font-bold font-heading text-slate-900 text-sm">Resource Person / Keynote Speaker</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Speaker Full Name</label>
              <input value={form.rpName} onChange={update('rpName')} placeholder="Dr. Johnathan Smith" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Designation</label>
              <input value={form.rpDesignation} onChange={update('rpDesignation')} placeholder="Principal Architect / Professor" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Affiliated Organization</label>
              <input value={form.rpOrganization} onChange={update('rpOrganization')} placeholder="Microsoft Research / IIT B" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Contact Phone</label>
              <input value={form.rpContact} onChange={update('rpContact')} placeholder="+91 9876543210" className={inputCls} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Speaker Email Address</label>
              <input type="email" value={form.rpEmail} onChange={update('rpEmail')} placeholder="speaker@institution.org" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Section 5: Description & Notes */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              05
            </div>
            <h3 className="font-bold font-heading text-slate-900 text-sm">Objectives & Additional Documentation</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>Primary Event Objective <span className="text-rose-500">*</span></label>
              <textarea value={form.objective} onChange={update('objective')} rows={3} placeholder="Summarize the learning outcomes, key deliverables, or workshop objectives..." className={inputCls + ' resize-none'} />
            </div>

            <div>
              <label className={labelCls}>Comprehensive Description / Agenda</label>
              <textarea value={form.description} onChange={update('description')} rows={4} placeholder="Outline session-by-session breakdown, topics covered, or special instructions..." className={inputCls + ' resize-none'} />
            </div>

            <div>
              <label className={labelCls}>Department Head / HOD Directives</label>
              <textarea value={form.hodAssignment} onChange={update('hodAssignment')} rows={2} placeholder="HOD approval notes, internal guidelines, or specific budget codes..." className={inputCls + ' resize-none'} />
            </div>
          </div>
        </div>

        {/* Form Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            onClick={() => navigate('all-events')}
            className="px-5 py-2.5 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>

          <button
            disabled={saving}
            onClick={() => handleSubmit('draft')}
            className="px-5 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-xs font-semibold rounded-xl disabled:opacity-50 transition-all"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            disabled={saving}
            onClick={() => handleSubmit('submit')}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
          >
            {saving ? 'Submitting...' : 'Create & Publish Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
