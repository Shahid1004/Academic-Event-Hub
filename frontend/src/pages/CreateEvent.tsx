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
    getUsers().then(users => setFacultyUsers(users.filter(user => user.role === 'faculty' && user.active))).catch(() => undefined);
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
      await createEvent({
        ...form,
        department: form.department as 'IT' | 'AIDS' | 'BOTH',
        resourcePerson: { name: form.rpName, designation: form.rpDesignation, organization: form.rpOrganization, contact: form.rpContact, email: form.rpEmail },
        coordinator: facultyUsers.filter(user => assignedFaculty.includes(user.id)).map(user => user.name).join(', '),
        assignedFaculty,
        targetYears,
        status: action === 'draft' ? 'Draft' : 'Upcoming',
      });
      navigate('all-events');
    } catch {
      setError('Unable to save the event. Check the backend connection and your permissions.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50";
  const labelCls = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('all-events')} className="text-sm text-slate-500 hover:text-slate-800">← Back</button>
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Create / Assign Event</h1>
          <p className="text-slate-500 text-sm">Fill in event details to create a new academic event</p>
        </div>
      </div>

      <div className="space-y-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {/* Basic Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Event Name *</label>
              <input value={form.name} onChange={update('name')} placeholder="e.g., Web Development Workshop" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Event Type *</label>
              <select value={form.type} onChange={update('type')} className={inputCls}>
                {eventTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Department *</label>
              <select value={form.department} onChange={update('department')} className={inputCls}>
                <option value="IT">Information Technology (IT)</option>
                <option value="AIDS">AI & Data Science (AIDS)</option>
                <option value="BOTH">BOTH – IT + AIDS</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Academic Year</label>
              <select value={form.academicYear} onChange={update('academicYear')} className={inputCls}>
                {['2023-24', '2024-25', '2025-26', '2026-27'].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Semester</label>
              <select value={form.semester} onChange={update('semester')} className={inputCls}>
                <option value="I">Semester I</option>
                <option value="II">Semester II</option>
              </select>
            </div>
          </div>
        </div>

        {/* Date & Venue */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Date, Time & Venue</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Event Date *</label>
              <input type="date" value={form.date} onChange={update('date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date To</label>
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
              <label className={labelCls}>Mode</label>
              <select value={form.mode} onChange={update('mode')} className={inputCls}>
                <option>Offline</option>
                <option>Online</option>
                <option>Hybrid</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Venue</label>
              <input value={form.venue} onChange={update('venue')} placeholder="e.g., Seminar Hall A, IT Block" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Target Year/Students</label>
              <input value={form.targetStudents} onChange={update('targetStudents')} placeholder="e.g., III Year IT, All AIDS Students" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Sponsored By</label>
              <input value={form.sponsoredBy} onChange={update('sponsoredBy')} placeholder="Organization or department" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Student Year(s) *</label>
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-3 bg-slate-50">
                {[1, 2, 3, 4].map(year => (
                  <label key={year} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${targetYears.includes(year) ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                    <input type="checkbox" checked={targetYears.includes(year)} onChange={event => setTargetYears(current => event.target.checked ? [...current, year] : current.filter(value => value !== year))} className="h-4 w-4 accent-indigo-600" />
                    Year {year}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">Select one or more years.</p>
            </div>
          </div>
        </div>

        {/* Coordinators */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Coordinators</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Expected Participants</label>
              <input type="number" value={form.expectedParticipants} onChange={update('expectedParticipants')} placeholder="e.g., 60" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Faculty Event Managers (select one or more)</label>
              {facultyUsers.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 bg-slate-50">
                  {facultyUsers.map(user => (
                    <label key={user.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={assignedFaculty.includes(user.id)}
                        onChange={event => setAssignedFaculty(current => event.target.checked ? [...current, user.id] : current.filter(id => id !== user.id))}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span>{user.name} <span className="text-xs text-slate-400">({user.department})</span></span>
                    </label>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">No active faculty users available for assignment.</p>}
            </div>
          </div>
        </div>

        {/* Resource Person */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Resource Person / Guest Speaker</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name</label>
              <input value={form.rpName} onChange={update('rpName')} placeholder="Mr./Dr. Full Name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Designation</label>
              <input value={form.rpDesignation} onChange={update('rpDesignation')} placeholder="e.g., Senior Engineer" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Organization</label>
              <input value={form.rpOrganization} onChange={update('rpOrganization')} placeholder="e.g., Infosys, IIT Madras" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contact</label>
              <input value={form.rpContact} onChange={update('rpContact')} placeholder="10-digit mobile number" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Email</label>
              <input type="email" value={form.rpEmail} onChange={update('rpEmail')} placeholder="email@organization.com" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Objective & Description */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold font-heading text-slate-800 mb-4">Event Details</h3>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Event Objective *</label>
              <textarea value={form.objective} onChange={update('objective')} rows={3} placeholder="Describe the main objective of this event..." className={inputCls + ' resize-none'} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={update('description')} rows={4} placeholder="Detailed description of event activities, agenda, etc." className={inputCls + ' resize-none'} />
            </div>
            <div>
              <label className={labelCls}>HOD Assignment / Approval Notes</label>
              <textarea value={form.hodAssignment} onChange={update('hodAssignment')} rows={2} placeholder="Notes from HOD for assignment..." className={inputCls + ' resize-none'} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button disabled={saving} onClick={() => handleSubmit('draft')} className="px-6 py-3 border border-indigo-200 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 text-sm disabled:opacity-50">
            💾 Save Draft
          </button>
          <button disabled={saving} onClick={() => handleSubmit('submit')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-sm disabled:opacity-50">
            ✅ Submit Event
          </button>
          <button onClick={() => navigate('all-events')} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
