import { useState } from 'react';
import type { Page } from '../types';
import { sampleEvents } from '../data/sampleData';
import { eventTypeColors } from './Dashboard';

interface EventDetailsProps {
  eventId: string;
  navigate: (page: Page, eventId?: string) => void;
}   

type Tab = 'overview' | 'attendance' | 'feedback' | 'documents' | 'ai-analysis' | 'final-report' | 'merged-report';

const students = [
  { reg: '22IT001', name: 'Arun Kumar M', class: 'III IT A', status: 'P' as const },
  { reg: '22IT002', name: 'Bhavya S', class: 'III IT A', status: 'P' as const },
  { reg: '22IT003', name: 'Chethan R', class: 'III IT B', status: 'A' as const },
  { reg: '22IT004', name: 'Divya P', class: 'III IT A', status: 'OD' as const },
  { reg: '22IT005', name: 'Elan K', class: 'III IT B', status: 'P' as const },
  { reg: '22IT006', name: 'Fathima N', class: 'III IT A', status: 'P' as const },
  { reg: '22IT007', name: 'Ganesh S', class: 'III IT B', status: 'A' as const },
  { reg: '22IT008', name: 'Harini M', class: 'III IT A', status: 'P' as const },
];

const documents = [
  { name: 'Circular', status: 'Approved', file: 'circular_evt001.pdf' },
  { name: 'Proposal / Permission Letter', status: 'Approved', file: 'proposal_evt001.pdf' },
  { name: 'Resource Person Details / Profile', status: 'Uploaded', file: 'resource_profile.pdf' },
  { name: 'Attendance', status: 'Approved', file: 'attendance_sheet.xlsx' },
  { name: 'Feedback', status: 'Approved', file: 'feedback_forms.pdf' },
  { name: 'Payment / Remuneration', status: 'Pending', file: '' },
  { name: 'Event Photographs', status: 'Uploaded', file: 'photos.zip' },
  { name: 'Event Summary Report', status: 'Under Review', file: 'summary_report.pdf' },
  { name: 'Other Documents', status: 'Pending', file: '' },
];

const docStatusColors: Record<string, string> = {
  'Approved': 'bg-green-100 text-green-700',
  'Uploaded': 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  'Pending': 'bg-red-100 text-red-600',
};

const feedbackData = [
  { label: '5 Stars', count: 28, pct: 52 },
  { label: '4 Stars', count: 18, pct: 33 },
  { label: '3 Stars', count: 6, pct: 11 },
  { label: '2 Stars', count: 2, pct: 4 },
  { label: '1 Star', count: 0, pct: 0 },
];

const comments = [
  'Excellent hands-on session! The instructor was very clear and patient.',
  'Really helpful for our project work. Would love more such sessions.',
  'Good content, but the time was a bit short. Need more practice sessions.',
  'Very informative. The resource person explained concepts with real-world examples.',
];

const feedbackSubmitters = [
  { reg: '22IT001', name: 'Arun Kumar M', submitted: true },
  { reg: '22IT002', name: 'Bhavya S', submitted: true },
  { reg: '22IT003', name: 'Chethan R', submitted: false },
  { reg: '22IT004', name: 'Divya P', submitted: true },
  { reg: '22IT005', name: 'Elan K', submitted: true },
  { reg: '22IT006', name: 'Fathima N', submitted: false },
  { reg: '22IT007', name: 'Ganesh S', submitted: true },
  { reg: '22IT008', name: 'Harini M', submitted: true },
];

export default function EventDetails({ eventId, navigate }: EventDetailsProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [attendanceFilter, setAttendanceFilter] = useState<'All' | 'P' | 'A' | 'OD'>('All');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [studentStatuses, setStudentStatuses] = useState<Record<string, 'P' | 'A' | 'OD'>>(
    Object.fromEntries(students.map(s => [s.reg, s.status]))
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocName, setUploadDocName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [showOtherDocModal, setShowOtherDocModal] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState<'online' | 'hardcopy'>('online');
  const [hardCopyUploaded, setHardCopyUploaded] = useState(false);
  const [hardCopyStatuses, setHardCopyStatuses] = useState<Record<string, 'P' | 'A'>>(
    Object.fromEntries(students.map(s => [s.reg, 'A' as const]))
  );
  const [googleFormLink, setGoogleFormLink] = useState('');
  const [docOrder, setDocOrder] = useState<number[]>(documents.map((_, i) => i));
  const [mergedReportGenerated, setMergedReportGenerated] = useState(false);
  const [showArrangeStep, setShowArrangeStep] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const event = sampleEvents.find(e => e.id === eventId) || sampleEvents[0];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'documents', label: 'Documents' },
    { id: 'ai-analysis', label: 'AI Analysis' },
    { id: 'final-report', label: 'Final Report' },
    { id: 'merged-report', label: 'Merged Report' },
  ];

  const docPct = event.docStatus === 'Completed' ? 100 : event.docStatus === 'Partial' ? 60 : 20;

  const filteredStudents = students.filter(s => {
    const matchFilter = attendanceFilter === 'All' || studentStatuses[s.reg] === attendanceFilter;
    const matchSearch = !attendanceSearch || s.reg.includes(attendanceSearch) || s.name.toLowerCase().includes(attendanceSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  const present = Object.values(studentStatuses).filter(v => v === 'P').length;
  const absent = Object.values(studentStatuses).filter(v => v === 'A').length;
  const od = Object.values(studentStatuses).filter(v => v === 'OD').length;

  const handleGenAI = () => {
    setAiLoading(true);
    setTimeout(() => { setAiLoading(false); setAiGenerated(true); }, 2500);
  };
  const handleGenReport = () => {
    setReportLoading(true);
    setTimeout(() => { setReportLoading(false); setReportGenerated(true); }, 3000);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('all-events')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3"
        >
          ← Back to Events
        </button>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eventTypeColors[event.type] || 'bg-gray-100 text-gray-700'}`}>{event.type}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  event.department === 'IT' ? 'bg-blue-100 text-blue-700' :
                  event.department === 'AIDS' ? 'bg-violet-100 text-violet-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{event.department === 'BOTH' ? 'BOTH – IT+AIDS' : event.department}</span>
                <span className="text-xs text-slate-400">{event.id}</span>
              </div>
              <h1 className="text-2xl font-bold font-heading text-slate-900">{event.name}</h1>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                <span>📅 {event.date}</span>
                <span>⏰ {event.startTime}–{event.endTime}</span>
                <span>📍 {event.venue}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 lg:items-end">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                event.docStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                event.docStatus === 'Partial' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-600'
              }`}>Doc: {event.docStatus}</span>
              <div className="flex items-center gap-2 min-w-44">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${docPct}%` }} />
                </div>
                <span className="text-xs font-semibold text-indigo-600">{docPct}%</span>
              </div>
              <div className="text-xs text-slate-400">Complete Documentation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-4">Event Information</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ['Event Name', event.name],
                  ['Event Type', event.type],
                  ['Department', event.department === 'BOTH' ? 'BOTH – IT+AIDS' : event.department],
                  ['Academic Year', event.academicYear],
                  ['Student Year(s)', event.targetYears?.length ? event.targetYears.map(year => `Year ${year}`).join(', ') : event.targetStudents],
                  ['Semester', event.semester === 'I' ? 'Odd semester' : 'Even semester'],
                  ['Date', event.date],
                  ['Date To', event.dateTo || event.date],
                  ['Time', `${event.startTime} – ${event.endTime}`],
                  ['Venue', event.venue],
                  ['Mode', event.mode],
                  ['Sponsored By', event.sponsoredBy || '—'],
                  ['Target Students', event.targetStudents],
                  ['Expected Participants', event.expectedParticipants.toString()],
                  ['Actual Participants', event.actualParticipants > 0 ? event.actualParticipants.toString() : 'N/A'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-slate-400 mb-0.5">{label}</div>
                    <div className="font-medium text-slate-800">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-3">Objective</h3>
              <p className="text-sm text-slate-600">{event.objective}</p>
              <h3 className="font-bold font-heading text-slate-800 mt-4 mb-2">Description</h3>
              <p className="text-sm text-slate-600">{event.description}</p>
            </div>
            {/* Lifecycle */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-4">Event Lifecycle</h3>
              <div className="flex items-center gap-2">
                {['Proposal', 'Approval', 'Execution', 'Documentation', 'Report', 'Approved'].map((stage, i) => {
                  const done = event.docStatus === 'Completed' ? i < 6 : event.docStatus === 'Partial' ? i < 4 : i < 3;
                  return (
                    <div key={stage} className="flex items-center gap-2">
                      <div className={`flex flex-col items-center`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {done ? '✓' : i + 1}
                        </div>
                        <span className="text-xs text-slate-500 mt-1 text-center leading-tight w-14">{stage}</span>
                      </div>
                      {i < 5 && <div className={`flex-1 h-0.5 mt-0 mb-5 ${done ? 'bg-indigo-600' : 'bg-slate-100'}`} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-3">Faculty Coordinators</h3>
              {[...(event.assignedFaculty || []), ...(event.assignedFaculty?.length ? [] : [event.coordinator, ...event.additionalCoordinators])].map((coordinator, index) => {
                const name = typeof coordinator === 'string' ? coordinator : `${coordinator.name}${coordinator.designation ? ` (${coordinator.designation})` : ''}`;
                return (
                <div key={`${name}-${index}`} className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs">
                    {name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium text-slate-700 text-xs">{name}</div>
                    <div className="text-xs text-slate-400">Faculty Coordinator</div>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-3">Resource Person</h3>
              <div className="space-y-2 text-sm">
                <div className="font-semibold text-slate-800">{event.resourcePerson.name}</div>
                <div className="text-slate-500 text-xs">{event.resourcePerson.designation}</div>
                <div className="text-slate-500 text-xs">{event.resourcePerson.organization}</div>
                <div className="text-slate-500 text-xs">📞 {event.resourcePerson.contact}</div>
                <div className="text-slate-500 text-xs">✉️ {event.resourcePerson.email}</div>
              </div>
            </div>

            {event.status === 'Completed' && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold font-heading text-slate-800 mb-3">Performance</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Attendance</span><span className="font-medium text-slate-700">{event.attendance}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${event.attendance}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Feedback Score</span><span className="font-medium text-slate-700">⭐ {event.feedbackScore}/5</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${event.feedbackScore * 20}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-3">Approval Status</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-slate-700">HOD Approved</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-slate-700">Principal Approved</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-3">
            <button
              onClick={() => setAttendanceMode('online')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                attendanceMode === 'online'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              🖥️ Take Online Attendance
            </button>
            <button
              onClick={() => setAttendanceMode('hardcopy')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                attendanceMode === 'hardcopy'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              📋 Upload Hard Copy
            </button>
          </div>

          {attendanceMode === 'online' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Students', value: students.length, color: 'text-slate-700' },
                  { label: 'Present', value: present, color: 'text-green-600' },
                  { label: 'Absent', value: absent, color: 'text-red-600' },
                  { label: 'OD', value: od, color: 'text-blue-600' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
                    <div className={`text-3xl font-bold font-heading ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex flex-wrap gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Search Reg No or Name..."
                    value={attendanceSearch}
                    onChange={e => setAttendanceSearch(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 flex-1 min-w-40"
                  />
                  <div className="flex gap-1">
                    {(['All', 'P', 'A', 'OD', 'Not Marked'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setAttendanceFilter(f === 'Not Marked' ? 'All' : f as any)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                          attendanceFilter === f || (f === 'All' && attendanceFilter === 'All')
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setStudentStatuses(Object.fromEntries(students.map(s => [s.reg, 'P' as const])))}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-medium"
                  >
                    Mark All Present
                  </button>
                  <button className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50">📤 Upload Excel</button>
                  <button className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50">📥 Template</button>
                  <button className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50">📊 Export</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-3 py-2 text-xs text-slate-500 font-semibold w-8">
                          <input type="checkbox" className="rounded" />
                        </th>
                        {['Reg No', 'Student Name', 'Class/Section', 'Attendance'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(s => {
                        const status = studentStatuses[s.reg];
                        return (
                          <tr key={s.reg} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-3 py-3"><input type="checkbox" className="rounded" /></td>
                            <td className="px-3 py-3 font-mono text-xs text-slate-600">{s.reg}</td>
                            <td className="px-3 py-3 font-medium text-slate-800">{s.name}</td>
                            <td className="px-3 py-3 text-slate-500 text-xs">{s.class}</td>
                            <td className="px-3 py-3">
                              <div className="flex gap-1">
                                {(['P', 'A', 'OD'] as const).map(st => (
                                  <button
                                    key={st}
                                    onClick={() => setStudentStatuses(prev => ({ ...prev, [s.reg]: st }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                                      status === st
                                        ? st === 'P' ? 'bg-green-600 text-white border-green-600'
                                          : st === 'A' ? 'bg-red-600 text-white border-red-600'
                                          : 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Attendance: {Math.round((present / students.length) * 100)}% ({present}/{students.length} present)
                </div>
              </div>
            </>
          )}

          {attendanceMode === 'hardcopy' && (
            <div className="space-y-4">
              {!hardCopyUploaded ? (
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                  <h3 className="font-bold font-heading text-slate-800 mb-2">Upload Signed Attendance Sheet</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    Upload a scanned copy of the physical attendance sheet. Students who signed will be automatically marked as <span className="text-green-600 font-semibold">Present</span>, and those who did not sign will be marked as <span className="text-red-600 font-semibold">Absent</span>.
                  </p>
                  <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-10 text-center bg-indigo-50/40">
                    <div className="text-5xl mb-4">📋</div>
                    <div className="text-slate-700 font-medium mb-1">Drop the signed attendance sheet here</div>
                    <div className="text-slate-400 text-sm mb-4">Supported: PDF, JPG, PNG, TIFF</div>
                    <button
                      onClick={() => {
                        setHardCopyUploaded(true);
                        setHardCopyStatuses({
                          '22IT001': 'P', '22IT002': 'P', '22IT003': 'A',
                          '22IT004': 'P', '22IT005': 'P', '22IT006': 'A',
                          '22IT007': 'P', '22IT008': 'P',
                        });
                      }}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
                    >
                      Browse & Upload
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <div className="font-semibold text-green-800 text-sm">Hard copy processed successfully</div>
                      <div className="text-green-600 text-xs mt-0.5">Signed names marked Present · Unsigned marked Absent</div>
                    </div>
                    <button
                      onClick={() => setHardCopyUploaded(false)}
                      className="ml-auto text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-white"
                    >
                      Re-upload
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total', value: students.length, color: 'text-slate-700' },
                      { label: 'Signed (Present)', value: Object.values(hardCopyStatuses).filter(v => v === 'P').length, color: 'text-green-600' },
                      { label: 'Not Signed (Absent)', value: Object.values(hardCopyStatuses).filter(v => v === 'A').length, color: 'text-red-600' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
                        <div className={`text-3xl font-bold font-heading ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          {['Reg No', 'Student Name', 'Class', 'Signature Status'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(s => {
                          const signed = hardCopyStatuses[s.reg] === 'P';
                          return (
                            <tr key={s.reg} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.reg}</td>
                              <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                              <td className="px-4 py-3 text-slate-500 text-xs">{s.class}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${signed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                    {signed ? '✓ Signed — Present' : '✗ Not Signed — Absent'}
                                  </span>
                                  <button
                                    onClick={() => setHardCopyStatuses(prev => ({ ...prev, [s.reg]: prev[s.reg] === 'P' ? 'A' : 'P' }))}
                                    className="text-xs text-slate-400 hover:text-indigo-600 underline"
                                  >
                                    Override
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">
                    💾 Save Hard Copy Attendance
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'feedback' && (
        <div className="space-y-4">
          {/* Google Form generator */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold font-heading text-slate-800">Google Form Feedback Link</h3>
                <p className="text-sm text-slate-500 mt-0.5">Generate a Google Form link to collect student feedback for this event</p>
              </div>
              <button
                onClick={() => setGoogleFormLink(`https://docs.google.com/forms/d/e/1FAIpQLSc${Math.random().toString(36).slice(2, 14)}/viewform?usp=sf_link`)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
              >
                📝 Generate Google Form Link
              </button>
            </div>
            {googleFormLink && (
              <div className="mt-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                <span className="text-green-600 text-lg">✅</span>
                <a href={googleFormLink} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 underline break-all flex-1">{googleFormLink}</a>
                <button
                  onClick={() => navigator.clipboard?.writeText(googleFormLink)}
                  className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-white text-slate-600"
                >
                  Copy
                </button>
              </div>
            )}
          </div>

          {/* Submission stats */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold font-heading text-slate-800">Feedback Submissions</h3>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-700">
                {feedbackSubmitters.filter(s => s.submitted).length} / {present} present students submitted
              </span>
            </div>
            <div className="mb-3">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${present > 0 ? (feedbackSubmitters.filter(s => s.submitted).length / present) * 100 : 0}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {present > 0 ? Math.round((feedbackSubmitters.filter(s => s.submitted).length / present) * 100) : 0}% response rate among present students
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-h-52 overflow-y-auto">
              {feedbackSubmitters.map(s => (
                <div key={s.reg} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.submitted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {s.submitted ? '✓' : '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{s.name}</div>
                    <div className="text-xs text-slate-400">{s.reg}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.submitted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {s.submitted ? 'Submitted' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Summary */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-4">Feedback Summary</h3>
              <div className="text-center mb-5">
                <div className="text-5xl font-bold font-heading text-indigo-600">{event.feedbackScore}</div>
                <div className="text-slate-400 text-sm mt-1">Average Rating / 5</div>
                <div className="flex justify-center gap-0.5 mt-2">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className={`text-xl ${i <= Math.round(event.feedbackScore) ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                  ))}
                </div>
                <div className="text-xs text-slate-400 mt-1">{feedbackData.reduce((a, d) => a + d.count, 0)} total responses</div>
              </div>
              <div className="space-y-2">
                {feedbackData.map(f => (
                  <div key={f.label} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-12">{f.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${f.pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-6">{f.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Q Analysis */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold font-heading text-slate-800 mb-4">Question-wise Analysis</h3>
                {[
                  { q: 'Overall satisfaction', avg: 4.3 },
                  { q: 'Content quality', avg: 4.5 },
                  { q: 'Presentation quality', avg: 4.2 },
                  { q: 'Expectations met', avg: 4.1 },
                  { q: 'Would recommend', avg: 4.6 },
                ].map(q => (
                  <div key={q.q} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{q.q}</span>
                      <span className="font-semibold text-slate-800">{q.avg}/5</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${q.avg * 20}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold font-heading text-slate-800 mb-3">Student Comments</h3>
                <div className="space-y-3">
                  {comments.map((c, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
                        S{i+1}
                      </div>
                      <p className="text-sm text-slate-600">{c}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold font-heading text-slate-800">Post-Event Documentation</h3>
            <button
              onClick={() => setShowOtherDocModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium"
            >
              + Add Other Document
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['#', 'Document Name', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, i) => (
                  <tr key={doc.name} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{doc.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${docStatusColors[doc.status]}`}>{doc.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {doc.file ? (
                          <>
                            <button className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">View</button>
                            <button className="text-xs text-green-600 hover:text-green-800 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50">Download</button>
                            <button
                              onClick={() => { setUploadDocName(doc.name); setShowUploadModal(true); }}
                              className="text-xs text-amber-600 hover:text-amber-800 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-50"
                            >
                              Replace
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setUploadDocName(doc.name); setShowUploadModal(true); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50"
                          >
                            Upload Now
                          </button>
                        )}
                        {doc.status !== 'Pending' && (
                          <button className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ai-analysis' && (
        <div className="space-y-4">
          {!aiGenerated ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-xl font-bold font-heading text-slate-800 mb-2">AI Analysis</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                Generate an AI-powered analysis of this event using attendance data, feedback responses, documents, and event details.
              </p>
              <button
                onClick={handleGenAI}
                disabled={aiLoading}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm disabled:opacity-60"
              >
                {aiLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating Analysis...
                  </span>
                ) : '✨ Generate AI Analysis'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🤖</span>
                  <span className="font-bold font-heading text-indigo-800">AI-Generated Event Summary</span>
                  <span className="ml-auto text-xs text-indigo-400">Generated just now</span>
                </div>
                <p className="text-sm text-slate-700 mt-2">
                  The <strong>{event.name}</strong> was a highly successful {event.type.toLowerCase()} conducted by the {event.department} department.
                  With {event.actualParticipants} participants and an attendance rate of {event.attendance}%, the event exceeded expectations.
                  The resource person, {event.resourcePerson.name} from {event.resourcePerson.organization}, delivered excellent content,
                  reflected in the feedback score of {event.feedbackScore}/5.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: '🎯 Key Highlights', items: ['Strong attendance rate of ' + event.attendance + '%', 'High feedback score: ' + event.feedbackScore + '/5', 'Industry expert as resource person', 'All primary documentation completed'] },
                  { title: '📊 Attendance Analysis', items: ['Total registered: ' + event.expectedParticipants, 'Actual present: ' + event.actualParticipants, 'Attendance %: ' + event.attendance + '%', 'Attendance above department average'] },
                  { title: '💬 Feedback Analysis', items: ['Overall rating: ' + event.feedbackScore + '/5', '85% students rated 4+ stars', 'Content quality highly appreciated', 'Students requested follow-up sessions'] },
                  { title: '✅ Strengths', items: ['Excellent resource person engagement', 'Well-organized logistics', 'Practical hands-on approach', 'High student participation'] },
                  { title: '⚠️ Areas for Improvement', items: ['Extend session duration', 'Add practice lab time', 'Provide pre-reading materials', 'Consider virtual attendance option'] },
                  { title: '💡 Recommendations', items: ['Conduct follow-up advanced session', 'Create resource material repository', 'Establish industry-academia connect', 'Document best practices'] },
                ].map(section => (
                  <div key={section.title} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <h4 className="font-semibold text-slate-800 mb-2">{section.title}</h4>
                    <ul className="space-y-1">
                      {section.items.map(item => (
                        <li key={item} className="text-sm text-slate-600 flex gap-2"><span className="text-indigo-400 flex-shrink-0">•</span>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setAiGenerated(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">
                  🔄 Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'final-report' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button onClick={handleGenReport} disabled={reportLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium disabled:opacity-60">
              {reportLoading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</span> : '📄 Generate Report'}
            </button>
            {reportGenerated && (
              <>
                <button className="px-4 py-2 border border-indigo-200 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50">👁️ Preview Report</button>
                <button className="px-4 py-2 border border-green-200 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50">📥 Download PDF</button>
                <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">🖨️ Print</button>
                <button onClick={handleGenAI} className="px-4 py-2 border border-violet-200 text-violet-600 rounded-xl text-sm font-medium hover:bg-violet-50">✨ Regenerate with AI</button>
              </>
            )}
          </div>

          {reportGenerated ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 space-y-6">
              {/* Report Header */}
              <div className="text-center border-b border-slate-200 pb-6">
                <div className="font-bold text-lg font-heading text-slate-900">XYZ COLLEGE OF ENGINEERING AND TECHNOLOGY</div>
                <div className="text-slate-600">Department of {event.department === 'IT' ? 'Information Technology' : event.department === 'AIDS' ? 'Artificial Intelligence and Data Science' : 'IT & AIDS'}</div>
                <div className="mt-3 font-bold text-base font-heading text-indigo-700">EVENT REPORT — {event.type.toUpperCase()}</div>
                <div className="text-slate-600 text-sm mt-1">{event.name}</div>
                <div className="text-slate-500 text-xs mt-1">Date: {event.date} | Time: {event.startTime}–{event.endTime} | Venue: {event.venue}</div>
              </div>

              {[
                { num: 1, title: 'Event Overview', content: `A ${event.type} titled "${event.name}" was organized by the Department of ${event.department === 'IT' ? 'Information Technology' : 'AI & Data Science'} on ${event.date} at ${event.venue}. The event was conducted in ${event.mode} mode from ${event.startTime} to ${event.endTime}.` },
                { num: 2, title: 'Objective', content: event.objective },
                { num: 3, title: 'Permission / Proposal Details', content: 'Prior approval was obtained from the HOD and the Principal. The proposal was submitted on ' + event.date.split('-').slice(0,2).join('-') + '-01 and approved on ' + event.date.split('-').slice(0,2).join('-') + '-05.' },
                { num: 4, title: 'Resource Person / Guest Details', content: `Name: ${event.resourcePerson.name}\nDesignation: ${event.resourcePerson.designation}\nOrganization: ${event.resourcePerson.organization}\nContact: ${event.resourcePerson.contact}\nEmail: ${event.resourcePerson.email}` },
                { num: 5, title: 'Event Execution Details', content: `The event was conducted as planned. The coordinator ${event.coordinator} managed the event efficiently. ${event.description}` },
                { num: 6, title: 'Topics / Concepts Covered', content: 'Introduction to the topic | Theoretical foundations | Hands-on demonstration | Q&A Session | Feedback collection' },
                { num: 7, title: 'Student Participation', content: `Target students: ${event.targetStudents}\nExpected participants: ${event.expectedParticipants}\nActual participants: ${event.actualParticipants}` },
                { num: 8, title: 'Attendance Summary', content: `Total students: ${event.actualParticipants}\nPresent: ${Math.round(event.actualParticipants * event.attendance / 100)}\nAbsent: ${event.actualParticipants - Math.round(event.actualParticipants * event.attendance / 100)}\nAttendance percentage: ${event.attendance}%` },
                { num: 9, title: 'Feedback Summary and Analysis', content: `Average feedback score: ${event.feedbackScore}/5\nTotal responses collected: ${Math.round(event.actualParticipants * 0.9)}\nOverall satisfaction: High\nMajority of students (85%) rated the event 4 or above.` },
                { num: 10, title: 'Payment / Remuneration Details', content: 'Resource person remuneration: ₹5,000\nPayment method: NEFT\nPayment date: ' + event.date + '\nTransaction reference: TXN2025001' },
                { num: 12, title: 'Key Outcomes', content: '• Students gained practical knowledge in the subject area\n• Enhanced industry connect\n• Improved skill development\n• Increased awareness of current trends' },
                { num: 14, title: 'Corrective Action / Recommendations', content: '• Extend duration for future sessions\n• Arrange for lab access during the workshop\n• Share resource materials in advance\n• Schedule follow-up sessions' },
              ].map(section => (
                <div key={section.num}>
                  <h4 className="font-bold font-heading text-slate-800 mb-2">{section.num}. {section.title}</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{section.content}</p>
                </div>
              ))}

              {/* Signatures */}
              <div className="border-t border-slate-200 pt-6">
                <div className="grid grid-cols-2 gap-8 text-center text-sm text-slate-600">
                  <div>
                    <div className="h-12 border-b border-slate-300 mb-2" />
                    <div className="font-medium">{event.coordinator}</div>
                    <div className="text-xs text-slate-400">Event Coordinator</div>
                  </div>
                  <div>
                    <div className="h-12 border-b border-slate-300 mb-2" />
                    <div className="font-medium">Dr. S. Ravichandran</div>
                    <div className="text-xs text-slate-400">Head of Department</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
              <div className="text-5xl mb-4">📄</div>
              <h3 className="text-lg font-bold font-heading text-slate-700">Report Not Generated Yet</h3>
              <p className="text-slate-500 text-sm mt-2">Click "Generate Report" to create a comprehensive academic event report.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'merged-report' && (
        <div className="space-y-4">
          {showArrangeStep ? (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold font-heading text-slate-800 mb-1">Arrange Document Order</h3>
                <p className="text-sm text-slate-500 mb-5">Drag or use the arrows to set the order in which documents will be merged into the final report. Only uploaded documents will be included.</p>
                <div className="space-y-2">
                  {docOrder.map((docIdx, position) => {
                    const doc = documents[docIdx];
                    const hasFile = !!doc.file;
                    return (
                      <div
                        key={docIdx}
                        draggable
                        onDragStart={() => setDragIndex(position)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex === null || dragIndex === position) return;
                          const newOrder = [...docOrder];
                          const [moved] = newOrder.splice(dragIndex, 1);
                          newOrder.splice(position, 0, moved);
                          setDocOrder(newOrder);
                          setDragIndex(null);
                        }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-grab active:cursor-grabbing transition-colors ${
                          hasFile ? 'bg-white border-slate-200 hover:border-indigo-300' : 'bg-slate-50 border-slate-100 opacity-50'
                        }`}
                      >
                        <span className="text-slate-400 text-sm select-none">⠿</span>
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {position + 1}
                        </span>
                        <span className={`flex-1 text-sm font-medium ${hasFile ? 'text-slate-800' : 'text-slate-400'}`}>{doc.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${docStatusColors[doc.status]}`}>{doc.status}</span>
                        {!hasFile && <span className="text-xs text-slate-400 italic">Not uploaded — will be skipped</span>}
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              if (position === 0) return;
                              const newOrder = [...docOrder];
                              [newOrder[position - 1], newOrder[position]] = [newOrder[position], newOrder[position - 1]];
                              setDocOrder(newOrder);
                            }}
                            disabled={position === 0}
                            className="px-1.5 py-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >▲</button>
                          <button
                            onClick={() => {
                              if (position === docOrder.length - 1) return;
                              const newOrder = [...docOrder];
                              [newOrder[position + 1], newOrder[position]] = [newOrder[position], newOrder[position + 1]];
                              setDocOrder(newOrder);
                            }}
                            disabled={position === docOrder.length - 1}
                            className="px-1.5 py-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >▼</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => { setShowArrangeStep(false); setMergedReportGenerated(false); }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
                  >
                    Confirm Order & Generate Merged Report →
                  </button>
                  <button
                    onClick={() => setDocOrder(documents.map((_, i) => i))}
                    className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50"
                  >
                    Reset Order
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => { setMergedReportGenerated(true); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium"
                >
                  📄 Generate Merged PDF
                </button>
                <button
                  onClick={() => setShowArrangeStep(true)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50"
                >
                  ← Re-arrange Order
                </button>
                {mergedReportGenerated && (
                  <>
                    <button className="px-4 py-2 border border-green-200 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50">📥 Download Merged PDF</button>
                    <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">🖨️ Print</button>
                  </>
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold font-heading text-slate-800 mb-4">Merge Order Confirmed</h3>
                <div className="space-y-2 mb-5">
                  {docOrder.filter(i => !!documents[i].file).map((docIdx, pos) => (
                    <div key={docIdx} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">{pos + 1}</span>
                      <span className="text-sm text-slate-800 font-medium">{documents[docIdx].name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{documents[docIdx].file}</span>
                    </div>
                  ))}
                </div>

                {mergedReportGenerated ? (
                  <div className="border border-indigo-200 rounded-2xl overflow-hidden">
                    <div className="bg-indigo-600 text-white px-5 py-3 text-center">
                      <div className="font-bold text-base font-heading">MERGED EVENT DOCUMENTATION REPORT</div>
                      <div className="text-indigo-200 text-sm">{event.name} — {event.date}</div>
                    </div>
                    <div className="p-6 space-y-4 text-sm text-slate-700 bg-white">
                      {docOrder.filter(i => !!documents[i].file).map((docIdx, pos) => (
                        <div key={docIdx} className="border-b border-slate-100 pb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{pos + 1}</span>
                            <span className="font-semibold text-slate-800">{documents[docIdx].name}</span>
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${docStatusColors[documents[docIdx].status]}`}>{documents[docIdx].status}</span>
                          </div>
                          <div className="pl-8 text-slate-500 text-xs italic">[ {documents[docIdx].file} — content merged here ]</div>
                        </div>
                      ))}
                      <div className="text-center text-xs text-slate-400 pt-2">— End of Merged Documentation —</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <div className="text-4xl mb-2">📎</div>
                    <div className="text-sm">Click "Generate Merged PDF" to combine all documents</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold font-heading text-slate-800">Upload Document</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Document Name</label>
                <input value={uploadDocName} onChange={e => setUploadDocName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Document Type</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                  {['Circular', 'Permission Letter', 'Attendance', 'Feedback', 'Report', 'Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Description</label>
                <textarea className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 h-20 resize-none" />
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                <div className="text-2xl mb-2">📁</div>
                <div className="text-sm text-slate-600">Drop files here or click to browse</div>
                <div className="text-xs text-slate-400 mt-1">PDF, DOC, XLSX, JPG supported</div>
                <input type="file" multiple className="hidden" />
                <button className="mt-3 px-4 py-1.5 bg-indigo-600 text-white text-xs rounded-xl">Browse Files</button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowUploadModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={() => setShowUploadModal(false)} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">Upload Documents</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other Document Modal */}
      {showOtherDocModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold font-heading text-slate-800">Add Other Document</h3>
              <button onClick={() => setShowOtherDocModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              {['Document Name', 'Document Type', 'Description'].map(label => (
                <div key={label}>
                  <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                  <input className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              ))}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                <div className="text-2xl mb-2">📁</div>
                <div className="text-sm text-slate-600">Upload multiple files</div>
                <div className="text-xs text-slate-400 mt-1">Any file type supported</div>
                <button className="mt-3 px-4 py-1.5 bg-indigo-600 text-white text-xs rounded-xl">Browse Files</button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowOtherDocModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={() => setShowOtherDocModal(false)} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">Save Document</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
