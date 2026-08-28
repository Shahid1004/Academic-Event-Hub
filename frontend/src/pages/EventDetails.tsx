import { useState, useEffect } from 'react';
import type { Page, StudentAttendanceRecord, AttendanceStatus } from '../types';
import { sampleEvents } from '../data/sampleData';
import { eventTypeColors } from './Dashboard';
import { getEventAttendanceApi, saveEventAttendanceApi, qrCheckInApi } from '../services/api';

interface EventDetailsProps {
  eventId: string;
  navigate: (page: Page, eventId?: string) => void;
}   

type Tab = 'overview' | 'attendance' | 'feedback' | 'documents' | 'ai-analysis' | 'final-report' | 'merged-report';

const defaultStudents: StudentAttendanceRecord[] = [
  { regNo: '22IT001', studentName: 'Arun Kumar M', className: 'III IT A', status: 'P', department: 'IT' },
  { regNo: '22IT002', studentName: 'Bhavya S', className: 'III IT A', status: 'P', department: 'IT' },
  { regNo: '22IT003', studentName: 'Chethan R', className: 'III IT B', status: 'A', department: 'IT' },
  { regNo: '22IT004', studentName: 'Divya P', className: 'III IT A', status: 'OD', department: 'IT' },
  { regNo: '22IT005', studentName: 'Elan K', className: 'III IT B', status: 'P', department: 'IT' },
  { regNo: '22IT006', studentName: 'Fathima N', className: 'III IT A', status: 'P', department: 'IT' },
  { regNo: '22IT007', studentName: 'Ganesh S', className: 'III IT B', status: 'A', department: 'IT' },
  { regNo: '22IT008', studentName: 'Harini M', className: 'III IT A', status: 'P', department: 'IT' },
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
  
  // Attendance records state
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendanceRecord[]>(defaultStudents);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Attendance mode
  const [attendanceMode, setAttendanceMode] = useState<'online' | 'qr' | 'hardcopy' | 'od_generator' | 'excel'>('online');
  
  // QR scanner simulator state
  const [qrRegInput, setQrRegInput] = useState('');
  const [qrLogs, setQrLogs] = useState<{ regNo: string; name: string; time: string; status: string }[]>([]);
  const [qrMessage, setQrMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Hardcopy upload state
  const [hardCopyUploaded, setHardCopyUploaded] = useState(false);

  // Excel state
  const [uploadedExcelName, setUploadedExcelName] = useState<string | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocName, setUploadDocName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [showOtherDocModal, setShowOtherDocModal] = useState(false);
  const [googleFormLink, setGoogleFormLink] = useState('');
  const [docOrder, setDocOrder] = useState<number[]>(documents.map((_, i) => i));
  const [mergedReportGenerated, setMergedReportGenerated] = useState(false);
  const [showArrangeStep, setShowArrangeStep] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const event = sampleEvents.find(e => e.id === eventId) || sampleEvents[0];

  // Fetch attendance from backend API if available
  useEffect(() => {
    let isMounted = true;
    getEventAttendanceApi(eventId).then((data) => {
      if (isMounted && data && data.records && data.records.length > 0) {
        setAttendanceRecords(data.records);
      }
    });
    return () => { isMounted = false; };
  }, [eventId]);

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

  const filteredStudents = attendanceRecords.filter(s => {
    const matchFilter = attendanceFilter === 'All' || s.status === attendanceFilter;
    const matchSearch = !attendanceSearch || s.regNo.toLowerCase().includes(attendanceSearch.toLowerCase()) || s.studentName.toLowerCase().includes(attendanceSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  const present = attendanceRecords.filter(v => v.status === 'P').length;
  const absent = attendanceRecords.filter(v => v.status === 'A').length;
  const od = attendanceRecords.filter(v => v.status === 'OD').length;
  const totalStudents = attendanceRecords.length;
  const attendanceRate = totalStudents > 0 ? Math.round(((present + od) / totalStudents) * 100) : 0;

  // Toggle single status
  const updateStudentStatus = (regNo: string, newStatus: AttendanceStatus) => {
    setAttendanceRecords(prev =>
      prev.map(s => s.regNo === regNo ? { ...s, status: newStatus, checkInMethod: 'online' } : s)
    );
  };

  // Mark all present
  const markAllPresent = () => {
    setAttendanceRecords(prev => prev.map(s => ({ ...s, status: 'P' })));
  };

  // Save to Backend API & Local State
  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    const result = await saveEventAttendanceApi(eventId, attendanceRecords);
    setSavingAttendance(false);
    setSaveToast('✅ Attendance records saved successfully!');
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Student QR check-in simulation
  const handleQrCheckIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanReg = qrRegInput.trim().toUpperCase();
    if (!cleanReg) return;

    const student = attendanceRecords.find(s => s.regNo.toUpperCase() === cleanReg);
    
    // Call backend API as well
    await qrCheckInApi(eventId, cleanReg, student?.studentName);

    if (student) {
      setAttendanceRecords(prev => prev.map(s => s.regNo.toUpperCase() === cleanReg ? { ...s, status: 'P', checkInMethod: 'qr', markedAt: new Date().toLocaleTimeString() } : s));
      setQrMessage({ text: `Success! ${student.studentName} (${cleanReg}) checked in.`, type: 'success' });
      setQrLogs(prev => [{ regNo: cleanReg, name: student.studentName, time: new Date().toLocaleTimeString(), status: 'P' }, ...prev]);
    } else {
      // Add new student
      const newRec: StudentAttendanceRecord = {
        regNo: cleanReg,
        studentName: `Student ${cleanReg}`,
        className: 'III IT A',
        status: 'P',
        checkInMethod: 'qr',
        markedAt: new Date().toLocaleTimeString()
      };
      setAttendanceRecords(prev => [...prev, newRec]);
      setQrMessage({ text: `Checked in new student ${cleanReg}!`, type: 'success' });
      setQrLogs(prev => [{ regNo: cleanReg, name: `Student ${cleanReg}`, time: new Date().toLocaleTimeString(), status: 'P' }, ...prev]);
    }
    setQrRegInput('');
    setTimeout(() => setQrMessage(null), 3000);
  };

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
                  ['Semester', `Semester ${event.semester}`],
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
        <div className="space-y-5">
          {/* Toast Notification */}
          {saveToast && (
            <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg flex items-center justify-between animate-fade-in">
              <span>{saveToast}</span>
              <button onClick={() => setSaveToast(null)} className="text-white hover:text-emerald-200 font-bold ml-4">✕</button>
            </div>
          )}

          {/* Mode Navigation Bar */}
          <div className="flex gap-2 bg-white rounded-2xl p-2 shadow-sm border border-slate-100 overflow-x-auto">
            {[
              { id: 'online', label: '🖥️ Online Roster' },
              { id: 'qr', label: '📱 QR Check-In & Scanner' },
              { id: 'hardcopy', label: '📋 Hard Copy Upload' },
              { id: 'excel', label: '📊 Excel Import/Export' },
              { id: 'od_generator', label: '📜 OD Pass Generator' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setAttendanceMode(m.id as any)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                  attendanceMode === m.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Stats Overview Card Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total Registered', value: totalStudents, color: 'text-slate-800', bg: 'bg-slate-50' },
              { label: 'Present (P)', value: present, color: 'text-green-600', bg: 'bg-green-50/50' },
              { label: 'Absent (A)', value: absent, color: 'text-red-600', bg: 'bg-red-50/50' },
              { label: 'On-Duty (OD)', value: od, color: 'text-blue-600', bg: 'bg-blue-50/50' },
              { label: 'Attendance Rate', value: `${attendanceRate}%`, color: 'text-indigo-600', bg: 'bg-indigo-50/50' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-3.5 shadow-sm border border-slate-100 text-center`}>
                <div className={`text-2xl sm:text-3xl font-extrabold font-heading ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Mode 1: Online Roster */}
          {attendanceMode === 'online' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap gap-2 min-w-64">
                  <input
                    type="text"
                    placeholder="🔍 Search Reg No or Student Name..."
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                    className="px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 flex-1 min-w-44"
                  />
                  <div className="flex gap-1">
                    {(['All', 'P', 'A', 'OD'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setAttendanceFilter(f)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                          attendanceFilter === f
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {f === 'All' ? 'All' : f === 'P' ? 'Present' : f === 'A' ? 'Absent' : 'OD'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={markAllPresent}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                  >
                    ✓ Mark All Present
                  </button>
                  <button
                    onClick={() => setAttendanceRecords((prev) => prev.map((s) => ({ ...s, status: 'A' })))}
                    className="px-3 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingAttendance ? 'Saving...' : '💾 Save Attendance'}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Reg No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Class / Section</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Remarks / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s) => (
                      <tr key={s.regNo} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-700 text-xs">{s.regNo}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{s.studentName}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{s.className}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            {(['P', 'A', 'OD'] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => updateStudentStatus(s.regNo, st)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                                  s.status === st
                                    ? st === 'P'
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                      : st === 'A'
                                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                      : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            placeholder="Optional remark..."
                            value={s.remarks || ''}
                            onChange={(e) =>
                              setAttendanceRecords((prev) =>
                                prev.map((item) => (item.regNo === s.regNo ? { ...item, remarks: e.target.value } : item))
                              )
                            }
                            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-slate-50/50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Showing {filteredStudents.length} of {totalStudents} students</span>
                <span className="font-semibold text-indigo-600">Total Attendance: {attendanceRate}%</span>
              </div>
            </div>
          )}

          {/* Mode 2: QR Check-In & Scanner */}
          {attendanceMode === 'qr' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Event Display QR Code */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center space-y-4">
                <div>
                  <h3 className="font-bold font-heading text-slate-800 text-lg">Event QR Code Check-In</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Project this QR Code on screen for student instant self check-in</p>
                </div>

                <div className="p-4 bg-indigo-50/60 rounded-2xl inline-block border-2 border-indigo-200 shadow-inner">
                  {/* Dynamic Visual QR Code */}
                  <svg className="w-48 h-48 mx-auto" viewBox="0 0 100 100" fill="currentColor">
                    <rect width="100" height="100" fill="white" rx="8" />
                    {/* Position patterns */}
                    <rect x="5" y="5" width="30" height="30" fill="#4F46E5" rx="4" />
                    <rect x="10" y="10" width="20" height="20" fill="white" rx="2" />
                    <rect x="14" y="14" width="12" height="12" fill="#4F46E5" rx="1" />

                    <rect x="65" y="5" width="30" height="30" fill="#4F46E5" rx="4" />
                    <rect x="70" y="10" width="20" height="20" fill="white" rx="2" />
                    <rect x="74" y="14" width="12" height="12" fill="#4F46E5" rx="1" />

                    <rect x="5" y="65" width="30" height="30" fill="#4F46E5" rx="4" />
                    <rect x="10" y="70" width="20" height="20" fill="white" rx="2" />
                    <rect x="14" y="74" width="12" height="12" fill="#4F46E5" rx="1" />

                    {/* Data pattern grid */}
                    <rect x="42" y="10" width="8" height="8" fill="#4F46E5" />
                    <rect x="52" y="18" width="8" height="8" fill="#4F46E5" />
                    <rect x="42" y="42" width="16" height="16" fill="#4F46E5" rx="2" />
                    <rect x="65" y="42" width="8" height="8" fill="#4F46E5" />
                    <rect x="10" y="42" width="8" height="8" fill="#4F46E5" />
                    <rect x="22" y="50" width="8" height="8" fill="#4F46E5" />
                    <rect x="42" y="68" width="8" height="8" fill="#4F46E5" />
                    <rect x="52" y="80" width="8" height="8" fill="#4F46E5" />
                    <rect x="70" y="68" width="16" height="8" fill="#4F46E5" />
                    <rect x="80" y="80" width="8" height="12" fill="#4F46E5" />
                  </svg>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex items-center justify-between gap-2">
                  <span className="font-mono text-slate-600 truncate">http://academic-hub.edu/checkin/{event.id}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(`http://academic-hub.edu/checkin/${event.id}`);
                      setSaveToast('Copied QR Check-In link to clipboard!');
                      setTimeout(() => setSaveToast(null), 2500);
                    }}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
                  >
                    Copy Link
                  </button>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Live Counter: {present} Students Checked In ({attendanceRate}%)
                </div>
              </div>

              {/* Student Check-In Simulator / Scanner Input */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                <div>
                  <h3 className="font-bold font-heading text-slate-800 text-lg">Student Scanner Simulator</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Scan or type Roll / Registration No to verify presence live</p>
                </div>

                {qrMessage && (
                  <div className={`p-3 rounded-xl text-xs font-semibold ${qrMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {qrMessage.text}
                  </div>
                )}

                <form onSubmit={handleQrCheckIn} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Reg No (e.g. 22IT001, 22IT003)..."
                    value={qrRegInput}
                    onChange={(e) => setQrRegInput(e.target.value)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 flex-1 font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm"
                  >
                    Check In
                  </button>
                </form>

                <div>
                  <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-2">Live Check-In Activity Log</h4>
                  <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                    {qrLogs.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">No student check-ins recorded yet in this session.</div>
                    ) : (
                      qrLogs.map((log, index) => (
                        <div key={`${log.regNo}-${index}`} className="flex items-center justify-between p-2.5 bg-white rounded-lg shadow-2xs border border-slate-100 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="font-mono font-bold text-slate-700">{log.regNo}</span>
                            <span className="text-slate-600 font-medium">{log.name}</span>
                          </div>
                          <span className="text-slate-400 font-mono text-xs">{log.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode 3: Hard Copy Upload */}
          {attendanceMode === 'hardcopy' && (
            <div className="space-y-4">
              {!hardCopyUploaded ? (
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                  <h3 className="font-bold font-heading text-slate-800 mb-2">Upload Signed Physical Attendance Sheet</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    Upload a scanned PDF or photo of the paper attendance sheet. Students with signatures will be marked as <span className="text-green-600 font-semibold">Present</span>, and others as <span className="text-red-600 font-semibold">Absent</span>.
                  </p>
                  <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-10 text-center bg-indigo-50/40">
                    <div className="text-5xl mb-4">📋</div>
                    <div className="text-slate-700 font-medium mb-1">Drop the signed attendance sheet here</div>
                    <div className="text-slate-400 text-sm mb-4">Supported formats: PDF, JPG, PNG</div>
                    <button
                      onClick={() => setHardCopyUploaded(true)}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md"
                    >
                      Browse & Scan Sheet
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <div className="font-semibold text-emerald-800 text-sm">Physical Sheet Processed via Optical Scanner</div>
                        <div className="text-emerald-600 text-xs">Identified 6 signatures. 2 unsigned students flagged.</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setHardCopyUploaded(false)}
                      className="text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-white bg-white font-medium"
                    >
                      Re-scan Sheet
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm">Verified Signature Roster</h4>
                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Reg No</th>
                            <th className="px-4 py-2.5 text-left">Student Name</th>
                            <th className="px-4 py-2.5 text-left">Class</th>
                            <th className="px-4 py-2.5 text-center">Detected Signature</th>
                            <th className="px-4 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {attendanceRecords.map((s) => {
                            const isPresent = s.status === 'P' || s.status === 'OD';
                            return (
                              <tr key={s.regNo} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.regNo}</td>
                                <td className="px-4 py-3 font-medium text-slate-800">{s.studentName}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">{s.className}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {isPresent ? '✓ Signed — Present' : '✗ Unsigned — Absent'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => updateStudentStatus(s.regNo, isPresent ? 'A' : 'P')}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium"
                                  >
                                    Override Status
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={handleSaveAttendance}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md"
                    >
                      💾 Confirm & Save Hard Copy Attendance
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode 4: Excel Import & Export */}
          {attendanceMode === 'excel' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
              <div>
                <h3 className="font-bold font-heading text-slate-800 text-lg">Excel / CSV Attendance Data Management</h3>
                <p className="text-xs text-slate-500 mt-0.5">Import bulk student attendance spreadsheets or export formatted records</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Download Template & Export */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="font-semibold text-sm text-slate-800">Export & Templates</h4>
                  <p className="text-xs text-slate-500">Download formatted blank spreadsheet templates or export the current event attendance report.</p>
                  
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8,RegNo,StudentName,Class,Status,Remarks\n22IT001,Arun Kumar M,III IT A,P,\n22IT002,Bhavya S,III IT A,P,\n";
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `Attendance_Template_${event.id}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs"
                    >
                      📥 Download Blank Template (.csv)
                    </button>

                    <button
                      onClick={() => {
                        const header = "RegNo,StudentName,Class,Status,Remarks\n";
                        const rows = attendanceRecords.map(r => `${r.regNo},"${r.studentName}","${r.className}",${r.status},"${r.remarks || ''}"`).join("\n");
                        const blob = new Blob([header + rows], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.setAttribute('href', url);
                        a.setAttribute('download', `Attendance_Report_${event.id}_${event.name.replace(/\s+/g, '_')}.csv`);
                        a.click();
                      }}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
                    >
                      📊 Export Attendance Sheet CSV
                    </button>
                  </div>
                </div>

                {/* Import Spreadsheet */}
                <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-4">
                  <h4 className="font-semibold text-sm text-indigo-900">Upload Attendance File</h4>
                  <p className="text-xs text-slate-500">Upload `.xlsx` or `.csv` spreadsheet to automatically update attendance statuses.</p>
                  
                  <div className="border-2 border-dashed border-indigo-200 rounded-xl p-5 text-center bg-white">
                    <div className="text-3xl mb-2">📤</div>
                    {uploadedExcelName ? (
                      <div className="text-xs font-bold text-emerald-700 mb-2">Uploaded: {uploadedExcelName}</div>
                    ) : (
                      <div className="text-xs text-slate-600 mb-2 font-medium">Select Excel / CSV file from your device</div>
                    )}
                    <label className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-indigo-700 inline-block shadow-2xs">
                      Browse File
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setUploadedExcelName(e.target.files[0].name);
                            setSaveToast(`Imported ${e.target.files[0].name} successfully!`);
                            setTimeout(() => setSaveToast(null), 3000);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode 5: On-Duty (OD) Recommendation Pass Generator */}
          {attendanceMode === 'od_generator' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold font-heading text-slate-800 text-lg">On-Duty (OD) Leave Recommendation Generator</h3>
                  <p className="text-xs text-slate-500">Generate printable OD recommendation letter for HOD & Principal sign-off</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  🖨️ Print / Save PDF
                </button>
              </div>

              {/* Formal Document Box */}
              <div className="p-8 border-2 border-slate-300 rounded-2xl bg-white space-y-6 max-w-3xl mx-auto shadow-inner text-slate-800">
                {/* Letterhead Header */}
                <div className="text-center border-b-2 border-indigo-600 pb-4 space-y-1">
                  <h2 className="text-lg font-bold font-heading uppercase text-indigo-900 tracking-wider">Academic Event Hub — Department of {event.department}</h2>
                  <p className="text-xs text-slate-500">Official Student On-Duty (OD) Recommendation Form</p>
                  <p className="text-xs text-slate-400 font-mono">Ref: OD/{event.academicYear}/{event.id}</p>
                </div>

                {/* Event Summary */}
                <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-1.5 border border-slate-200">
                  <div><strong>Event Name:</strong> {event.name}</div>
                  <div><strong>Event Date:</strong> {event.date} ({event.startTime} - {event.endTime})</div>
                  <div><strong>Venue:</strong> {event.venue}</div>
                  <div><strong>Faculty Coordinator:</strong> {typeof event.coordinator === 'string' ? event.coordinator : event.coordinator || 'Department Faculty'}</div>
                </div>

                {/* Recommended Students List */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase text-slate-700 tracking-wide">List of Recommended Students (Present / On-Duty)</h4>
                  <table className="w-full text-xs text-left border border-slate-300 border-collapse">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="border border-slate-300 px-3 py-2">S.No</th>
                        <th className="border border-slate-300 px-3 py-2">Reg No</th>
                        <th className="border border-slate-300 px-3 py-2">Student Name</th>
                        <th className="border border-slate-300 px-3 py-2">Class</th>
                        <th className="border border-slate-300 px-3 py-2 text-center">OD Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRecords.filter(s => s.status === 'OD' || s.status === 'P').map((s, idx) => (
                        <tr key={s.regNo}>
                          <td className="border border-slate-300 px-3 py-2 text-center">{idx + 1}</td>
                          <td className="border border-slate-300 px-3 py-2 font-mono font-semibold">{s.regNo}</td>
                          <td className="border border-slate-300 px-3 py-2">{s.studentName}</td>
                          <td className="border border-slate-300 px-3 py-2">{s.className}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">
                            {s.status === 'OD' ? 'On-Duty (Approved)' : 'Present (Attended)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-10 text-xs">
                  <div className="text-center border-t border-slate-300 pt-2 font-semibold text-slate-700">
                    Faculty Coordinator Signature
                  </div>
                  <div className="text-center border-t border-slate-300 pt-2 font-semibold text-slate-700 flex flex-col items-center">
                    <span className="text-emerald-600 font-bold text-xs mb-1">✓ Digitally Recommended</span>
                    HOD / Principal Approval
                  </div>
                </div>
              </div>
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
