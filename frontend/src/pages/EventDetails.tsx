import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import type { AttendanceStatus, EventRecord, Page, StudentAttendanceRecord } from '../types';
import { eventTypeColors } from './Dashboard';
import { getEventAttendanceApi, getEvents, importEventAttendanceRosterApi, qrCheckInApi, saveEventAttendanceApi, scanHardCopyAttendanceApi } from '../services/api';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

const deriveDepartment = (deptVal?: string, classVal?: string): string => {
  const cleanDept = String(deptVal || '').trim();
  const c = String(classVal || '').trim();
  const combined = `${cleanDept} ${c}`.toLowerCase();

  if (!combined || combined.trim() === '-' || combined.trim() === '') return '-';

  if (
    combined.includes('artificial intelligence') ||
    /\b(ads|aids)\b/i.test(combined) ||
    combined.includes('ai & ds') ||
    combined.includes('ai and ds') ||
    combined.includes('ai & data science') ||
    combined.includes('ai and data science')
  ) {
    return 'Artificial Intelligence and Data Science';
  }

  if (
    combined.includes('information technology') ||
    /\b(it)\b/i.test(combined)
  ) {
    return 'Information Technology';
  }

  if (cleanDept && cleanDept !== '-') {
    return cleanDept;
  }

  return '-';
};

const sortAttendanceRecords = <T extends { department?: string; studentName?: string; regNo?: string }>(records: T[]): T[] => {
  return [...records].sort((a, b) => {
    const deptA = String(a.department || '-').trim();
    const deptB = String(b.department || '-').trim();
    const deptComp = deptA.localeCompare(deptB, undefined, { sensitivity: 'base', numeric: true });
    if (deptComp !== 0) return deptComp;

    const nameA = String(a.studentName || '').trim();
    const nameB = String(b.studentName || '').trim();
    const nameComp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
    if (nameComp !== 0) return nameComp;

    const regA = String(a.regNo || '').trim();
    const regB = String(b.regNo || '').trim();
    return regA.localeCompare(regB, undefined, { sensitivity: 'base', numeric: true });
  });
};

const initialDefaultStudents: StudentAttendanceRecord[] = sortAttendanceRecords(
  defaultStudents.map((s) => ({
    ...s,
    department: deriveDepartment(s.department, s.className),
  }))
);

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
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendanceRecord[]>(initialDefaultStudents);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Attendance mode
  const [attendanceMode, setAttendanceMode] = useState<'online' | 'qr' | 'hardcopy' | 'od_generator' | 'excel'>('online');
  
  // QR scanner simulator state
  const [qrRegInput, setQrRegInput] = useState('');
  const [qrLogs, setQrLogs] = useState<{ regNo: string; name: string; time: string; status: string }[]>([]);
  const [qrMessage, setQrMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  // Add Student Manual Modal state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [addStudentForm, setAddStudentForm] = useState({
    regNo: '',
    studentName: '',
    className: '',
    department: '',
    status: 'P' as AttendanceStatus,
  });
  const [addStudentError, setAddStudentError] = useState<string | null>(null);

  // Hardcopy AI upload & scan state
  const [hardCopySheetType, setHardCopySheetType] = useState<'signed' | 'participant_list'>('signed');
  const [hardCopyFileName, setHardCopyFileName] = useState<string | null>(null);
  const [hardCopyScanning, setHardCopyScanning] = useState(false);
  const [hardCopyScanError, setHardCopyScanError] = useState<string | null>(null);
  const [selectedHardCopyFiles, setSelectedHardCopyFiles] = useState<File[]>([]);
  const [hardCopyProcessingProgress, setHardCopyProcessingProgress] = useState<string | null>(null);
  const [hardCopyMultiSummary, setHardCopyMultiSummary] = useState<any | null>(null);
  const [hardCopyRows, setHardCopyRows] = useState<Array<{
    regNo: string;
    studentName: string;
    department: string;
    className: string;
    status: AttendanceStatus;
    signaturePresent?: boolean;
    isUncertain?: boolean;
    uncertainFields?: string[];
    sourceFiles?: string[];
  }>>([]);
  const [editingHardCopyIndex, setEditingHardCopyIndex] = useState<number | null>(null);
  const [editingHardCopyData, setEditingHardCopyData] = useState<{
    regNo: string;
    studentName: string;
    department: string;
    className: string;
    status: AttendanceStatus;
    signaturePresent?: boolean;
    isUncertain?: boolean;
    uncertainFields?: string[];
  } | null>(null);

  // Excel state
  const [uploadedExcelName, setUploadedExcelName] = useState<string | null>(null);
  const [excelImportRows, setExcelImportRows] = useState<Array<{
    regNo: string;
    studentName: string;
    department: string;
    className: string;
    status: 'Valid' | 'Duplicate' | 'Invalid';
    reason?: string;
  }>>([]);
  const [excelImportMeta, setExcelImportMeta] = useState<{ totalRows: number; validStudents: number; duplicateCount: number; invalidRows: number } | null>(null);
  const [excelImportLoading, setExcelImportLoading] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportDownloadLoading, setReportDownloadLoading] = useState(false);
  const [showOtherDocModal, setShowOtherDocModal] = useState(false);
  const [googleFormLink, setGoogleFormLink] = useState('');
  const [docOrder, setDocOrder] = useState<number[]>(documents.map((_, i) => i));
  const [mergedReportGenerated, setMergedReportGenerated] = useState(false);
  const [mergedReportLoading, setMergedReportLoading] = useState(false);
  const [showArrangeStep, setShowArrangeStep] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState(false);

  useEffect(() => {
    setEventLoading(true);
    setEventError(false);
    getEvents()
      .then(events => {
        setEvent(events.find(item => item.id === eventId) || null);
        setEventError(!events.some(item => item.id === eventId));
      })
      .catch(() => {
        setEvent(null);
        setEventError(true);
      })
      .finally(() => setEventLoading(false));
  }, [eventId]);

  useEffect(() => {
    let isMounted = true;
    getEventAttendanceApi(eventId).then((data) => {
      if (isMounted && data && data.records && data.records.length > 0) {
        setAttendanceRecords(sortAttendanceRecords(data.records));
      }
    });
    return () => { isMounted = false; };
  }, [eventId]);

  if (eventLoading) return <div className="p-6 text-slate-500">Loading event details...</div>;
  if (!event) return (
    <div className="p-6 space-y-3">
      <button onClick={() => navigate('all-events')} className="text-sm text-indigo-600 hover:text-indigo-800">← Back to Events</button>
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {eventError ? 'This event could not be loaded. Please return to Events and try again.' : 'Event not found.'}
      </div>
    </div>
  );

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

  // Add student manually with duplicate prevention & auto-sorting
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReg = addStudentForm.regNo.trim().toUpperCase();
    const cleanName = addStudentForm.studentName.trim();
    if (!cleanReg || !cleanName) {
      setAddStudentError('Register Number and Student Name are required.');
      return;
    }

    // Duplicate check
    const isDuplicate = attendanceRecords.some(
      (s) => s.regNo.trim().toUpperCase() === cleanReg
    );
    if (isDuplicate) {
      setAddStudentError('This student is already in the attendance roster.');
      return;
    }

    const finalDept = deriveDepartment(addStudentForm.department, addStudentForm.className);
    const newStudent: StudentAttendanceRecord = {
      eventId,
      regNo: cleanReg,
      studentName: cleanName,
      className: addStudentForm.className.trim() || '-',
      department: finalDept,
      status: addStudentForm.status,
      checkInMethod: 'manual',
      markedAt: new Date().toLocaleTimeString(),
      remarks: '',
    };

    const updatedRoster = sortAttendanceRecords([...attendanceRecords, newStudent]);
    setAttendanceRecords(updatedRoster);
    await saveEventAttendanceApi(eventId, updatedRoster);

    setShowAddStudentModal(false);
    setAddStudentForm({ regNo: '', studentName: '', className: '', department: '', status: 'P' });
    setAddStudentError(null);
    setSaveToast(`✅ Student ${cleanName} (${cleanReg}) added to Online Roster!`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  // ── Client-side guard: reject any AI row containing SVG/XML/garbage data ──
  const INVALID_FIELD_PATTERN = /<|>|\bpath\b|d="M|\.svg|xmlns|DOCTYPE/i;
  const validateAiStudentRow = (s: {
    regNo?: string;
    studentName?: string;
    className?: string;
    department?: string;
    status?: string;
  }): boolean => {
    const name = String(s.studentName || '');
    const reg  = String(s.regNo || '');
    const cls  = String(s.className || '');
    const dept = String(s.department || '');
    // Must have a non-empty student name
    if (!name.trim()) return false;
    // Field-level contamination check
    if (INVALID_FIELD_PATTERN.test(name)) return false;
    if (INVALID_FIELD_PATTERN.test(reg))  return false;
    if (INVALID_FIELD_PATTERN.test(cls))  return false;
    if (INVALID_FIELD_PATTERN.test(dept)) return false;
    // Reasonable length limits
    if (name.length > 120) return false;
    if (reg.length  > 30)  return false;
    if (cls.length  > 60)  return false;
    if (dept.length > 100) return false;
    return true;
  };

  // Hard Copy Physical Sheet Scanning via AI Vision API (Supports Single & Multi-File)
  const handleHardCopyScanFile = async (filesToProcess?: File | File[]) => {
    let files: File[] = [];

    if (filesToProcess) {
      files = Array.isArray(filesToProcess) ? filesToProcess : [filesToProcess];
    } else {
      files = selectedHardCopyFiles;
    }

    if (!files || files.length === 0) {
      setHardCopyScanError('Please select at least one attendance sheet file.');
      return;
    }

    setHardCopyRows([]);
    setHardCopyScanError(null);
    setHardCopyScanning(true);
    setHardCopyMultiSummary(null);

    const displayName = files.length === 1 ? files[0].name : `${files.length} Attendance Sheets`;
    setHardCopyFileName(displayName);
    setHardCopyProcessingProgress(`Processing 1 of ${files.length} sheets with AI Vision...`);

    try {
      const apiResult = await scanHardCopyAttendanceApi(files, hardCopySheetType, eventId);

      if (apiResult && apiResult.success && apiResult.data?.students?.length) {
        const cleanStudents = apiResult.data.students.filter(validateAiStudentRow);
        const rejectedCount = apiResult.data.students.length - cleanStudents.length;

        if (cleanStudents.length === 0) {
          setHardCopyScanError('⚠️ AI extraction returned invalid document data. Please re-scan with clearer document photos/PDFs.');
          setSaveToast(`⚠️ No valid student data extracted.`);
          return;
        }

        const parsedStudents = cleanStudents.map((s) => ({
          ...s,
          department: deriveDepartment(s.department, s.className),
          status: s.status as AttendanceStatus,
        }));

        setHardCopyRows(sortAttendanceRecords(parsedStudents));
        if (apiResult.summary) {
          setHardCopyMultiSummary(apiResult.summary);
        }

        setSaveToast(
          `✅ Extracted ${parsedStudents.length} unique student records across ${files.length} sheet(s)!` +
          (rejectedCount > 0 ? ` (${rejectedCount} corrupted rows discarded)` : '')
        );
      } else {
        const errMsg = apiResult?.message || 'AI Vision could not extract student rows from these documents.';
        if (apiResult?.summary) {
          setHardCopyMultiSummary(apiResult.summary);
        }
        setHardCopyScanError(`⚠️ ${errMsg}`);
        setSaveToast(`⚠️ Scanning failed. No student data extracted.`);
      }
    } catch (err: any) {
      console.error('Error scanning hard copy file(s):', err);
      setHardCopyScanError(`⚠️ Failed to scan documents: ${err.message || 'Server connection error'}`);
    } finally {
      setHardCopyScanning(false);
      setHardCopyProcessingProgress(null);
      setTimeout(() => setSaveToast(null), 4000);
    }
  };

  // Confirm Hard Copy Import & Replace Online Roster completely
  const handleConfirmHardCopyImport = async () => {
    if (!hardCopyRows.length) return;

    setHardCopyScanning(true);
    const validStudents = hardCopyRows.map((r) => ({
      regNo: r.regNo,
      studentName: r.studentName,
      department: r.department || '-',
      className: r.className || '-',
      status: r.status || 'P',
    }));

    const result = await importEventAttendanceRosterApi(eventId, validStudents);
    setHardCopyScanning(false);

    let importedRecords: StudentAttendanceRecord[] = [];
    if (result && result.success && 'data' in result && result.data?.records?.length) {
      importedRecords = sortAttendanceRecords(result.data.records);
    } else {
      importedRecords = sortAttendanceRecords(
        validStudents.map((st) => ({
          eventId,
          regNo: st.regNo,
          studentName: st.studentName,
          department: st.department || '-',
          className: st.className || '-',
          status: st.status as AttendanceStatus,
          remarks: '',
        }))
      );
    }

    setAttendanceRecords(importedRecords);
    setHardCopyRows([]);
    setHardCopyFileName(null);
    setAttendanceMode('online');
    setSaveToast(`✅ Imported ${importedRecords.length} students from hard copy sheet to Online Roster!`);
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

  const getReportHtml = () => `<!doctype html>
<html><head><meta charset="utf-8"><title>${event.name} - Event Report</title>
<style>body{font-family:Arial,sans-serif;max-width:850px;margin:40px auto;color:#1e293b;line-height:1.6}h1{text-align:center;color:#3730a3}h2{border-bottom:1px solid #cbd5e1;padding-bottom:6px}p{white-space:pre-line}.meta{text-align:center;color:#64748b;border-bottom:2px solid #3730a3;padding-bottom:20px}</style>
</head><body><h1>XYZ COLLEGE OF ENGINEERING AND TECHNOLOGY</h1>
<div class="meta">Department of ${event.department === 'IT' ? 'Information Technology' : event.department === 'AIDS' ? 'Artificial Intelligence and Data Science' : 'IT & AIDS'}<br>
<strong>EVENT REPORT - ${event.type.toUpperCase()}</strong><br>${event.name}<br>${event.date} | ${event.startTime}-${event.endTime} | ${event.venue}</div>
<h2>1. Event Overview</h2><p>A ${event.type} titled "${event.name}" was organized by the ${event.department} department on ${event.date} at ${event.venue}. The event was conducted in ${event.mode} mode.</p>
<h2>2. Objective</h2><p>${event.objective}</p>
<h2>3. Resource Person</h2><p>Name: ${event.resourcePerson.name}
Designation: ${event.resourcePerson.designation}
Organization: ${event.resourcePerson.organization}
Contact: ${event.resourcePerson.contact}
Email: ${event.resourcePerson.email}</p>
<h2>4. Participation and Attendance</h2><p>Target students: ${event.targetStudents}
Expected participants: ${event.expectedParticipants}
Actual participants: ${event.actualParticipants}
Attendance: ${event.attendance}%</p>
<h2>5. Feedback</h2><p>Average feedback score: ${event.feedbackScore}/5</p>
<h2>6. Description</h2><p>${event.description}</p>
<p><strong>Event Coordinator:</strong> ${event.coordinator}</p></body></html>`;

  const handlePreviewReport = () => {
    const preview = window.open('', '_blank');
    if (!preview) return;
    preview.document.write(getReportHtml());
    preview.document.close();
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(getReportHtml());
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const createEventReportPdf = async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = [
      'ACADEMIC EVENT HUB - EVENT REPORT', event.name,
      `Department: ${event.department}`, `Date: ${event.date} | Venue: ${event.venue}`,
      '', 'Objective', event.objective, '', 'Description', event.description,
      '', `Participants: ${event.actualParticipants}`, `Attendance: ${event.attendance}%`, `Feedback: ${event.feedbackScore}/5`,
      '', `Coordinator: ${event.coordinator}`
    ];
    lines.forEach((line, index) => page.drawText((line || '').slice(0, 105), {
      x: 50, y: 770 - index * 25, size: index === 0 ? 18 : 11, font,
      color: index === 0 ? rgb(0.22, 0.19, 0.51) : rgb(0.12, 0.16, 0.23)
    }));
    return pdf;
  };

  const downloadPdf = async (pdf: PDFDocument, filename: string) => {
    const bytes = await pdf.save();
    const objectUrl = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleDownloadReport = async () => {
    setReportDownloadLoading(true);
    try {
      const pdf = await createEventReportPdf();
      await downloadPdf(pdf, `${event.id}-event-report.pdf`);
    } catch (error) {
      console.error('Report download failed:', error);
      window.alert('The report could not be downloaded. Please try again.');
    } finally {
      setReportDownloadLoading(false);
    }
  };

  const handleDownloadMergedReport = async () => {
    setMergedReportLoading(true);
    try {
      const mergedPdf = await createEventReportPdf();
      for (const index of docOrder) {
        for (const file of uploadedFiles[documents[index].name] || []) {
          const bytes = await file.arrayBuffer();
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            const sourcePdf = await PDFDocument.load(bytes);
            const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
          } else if (file.type === 'image/jpeg' || file.type === 'image/png') {
            const image = file.type === 'image/png' ? await mergedPdf.embedPng(bytes) : await mergedPdf.embedJpg(bytes);
            const page = mergedPdf.addPage([595, 842]);
            const scale = Math.min(500 / image.width, 740 / image.height);
            page.drawImage(image, { x: (595 - image.width * scale) / 2, y: (842 - image.height * scale) / 2, width: image.width * scale, height: image.height * scale });
          } else {
            const page = mergedPdf.addPage();
            const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
            page.drawText(`${file.name} must be converted to PDF before it can be merged.`, { x: 50, y: 750, size: 11, font });
          }
        }
      }
      await downloadPdf(mergedPdf, `${event.id}-merged-report.pdf`);
    } finally {
      setMergedReportLoading(false);
    }
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
                  ['Expected Participants', String(event.expectedParticipants ?? 0)],
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
              {[...(event.assignedFaculty || []), ...(event.assignedFaculty?.length ? [] : [event.coordinator, ...(event.additionalCoordinators || [])])].filter(Boolean).map((coordinator, index) => {
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
                    onClick={() => {
                      setAddStudentForm({ regNo: '', studentName: '', className: '', department: '', status: 'P' });
                      setAddStudentError(null);
                      setShowAddStudentModal(true);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                  >
                    ➕ Add Student
                  </button>
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
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Remarks / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s) => (
                      <tr key={s.regNo} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-700 text-xs">{s.regNo}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{s.studentName}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{s.className || '-'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{s.department || '-'}</td>
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
              {hardCopyRows.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 space-y-4">
                  <div>
                    <h3 className="font-bold font-heading text-slate-800 text-lg mb-1 flex items-center gap-2">
                      <span>🤖</span> Multimodal AI Vision Hard-Copy Attendance Extractor
                    </h3>
                    <p className="text-xs text-slate-500">
                      Upload single or multiple scanned PDFs, photos, or mobile snapshots of your physical attendance sheets. Our AI Vision API scans all documents row-by-row, detects printed/handwritten text, derives departments, checks signatures, and merges results into a single deduplicated roster.
                    </p>
                  </div>

                  {hardCopyScanError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-rose-800 font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚠️</span>
                        <span>{hardCopyScanError}</span>
                      </div>
                      <button
                        onClick={() => setHardCopyScanError(null)}
                        className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-rose-700 hover:bg-rose-100 transition-colors font-bold"
                      >
                        Dismiss & Re-scan
                      </button>
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <label className="block font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Attendance Sheet Type
                    </label>
                    <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-700">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sheetType"
                          value="signed"
                          checked={hardCopySheetType === 'signed'}
                          onChange={() => setHardCopySheetType('signed')}
                          className="text-indigo-600 focus:ring-indigo-400"
                        />
                        <span>☑ Signed Attendance Sheet <span className="text-slate-400 font-normal">(Signature column checked: Signed = Present, Unsigned = Absent)</span></span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sheetType"
                          value="participant_list"
                          checked={hardCopySheetType === 'participant_list'}
                          onChange={() => setHardCopySheetType('participant_list')}
                          className="text-indigo-600 focus:ring-indigo-400"
                        />
                        <span>☑ Participant / Present Student List <span className="text-slate-400 font-normal">(Every extracted student marked Present)</span></span>
                      </label>
                    </div>
                  </div>

                  {/* Drag-and-Drop & Browse File Selection Area */}
                  <div
                    className="border-2 border-dashed border-indigo-200 rounded-2xl p-8 text-center bg-indigo-50/30 space-y-3 transition-colors hover:border-indigo-400"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const droppedFiles = Array.from(e.dataTransfer.files);
                        setSelectedHardCopyFiles((prev) => [...prev, ...droppedFiles]);
                      }
                    }}
                  >
                    <div className="text-5xl">📄</div>
                    <div className="text-slate-700 font-medium text-sm">
                      {hardCopyScanning
                        ? (hardCopyProcessingProgress || 'Analyzing documents with Multimodal AI Vision API...')
                        : 'Drop physical attendance sheets here or click Browse & Add Sheets'}
                    </div>
                    <div className="text-slate-400 text-xs">Supported: PDF, JPG, JPEG, PNG, Mobile Snapshots (Select multiple files simultaneously)</div>

                    <div className="flex items-center justify-center gap-3 pt-2">
                      <label className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md cursor-pointer transition-all">
                        ➕ {selectedHardCopyFiles.length > 0 ? 'Add More Sheets' : 'Browse & Add Sheets'}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const newFiles = Array.from(e.target.files);
                              setSelectedHardCopyFiles((prev) => [...prev, ...newFiles]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Staged File List & Extract Action */}
                  {selectedHardCopyFiles.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                          Staged Sheets for Extraction ({selectedHardCopyFiles.length})
                        </h4>
                        <button
                          onClick={() => setSelectedHardCopyFiles([])}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                        >
                          Clear All Staged Files
                        </button>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedHardCopyFiles.map((file, idx) => (
                          <div key={`${file.name}-${idx}`} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <span className="text-lg flex-shrink-0">
                                {file.type.includes('pdf') ? '📕' : '🖼️'}
                              </span>
                              <div className="truncate">
                                <div className="font-semibold text-slate-800 truncate">{file.name}</div>
                                <div className="text-[10px] text-slate-400">
                                  {file.type || 'Document'} • {(file.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedHardCopyFiles((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-600 font-bold px-2 py-1"
                              title="Remove file"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => handleHardCopyScanFile(selectedHardCopyFiles)}
                          disabled={hardCopyScanning}
                          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold shadow-md disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                        >
                          {hardCopyScanning ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>{hardCopyProcessingProgress || 'Extracting All Sheets...'}</span>
                            </>
                          ) : (
                            <span>🚀 Extract All Sheets ({selectedHardCopyFiles.length})</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🤖</span>
                      <div>
                        <div className="font-semibold text-emerald-900 text-sm">AI Vision Document Analysis Complete</div>
                        <div className="text-emerald-700 text-xs">
                          Extracted {hardCopyRows.length} unique student rows from {hardCopyFileName || 'scanned sheets'} ({hardCopySheetType === 'signed' ? 'Signed Sheet' : 'Participant List'}). Review & edit details below before adding to roster.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setHardCopyRows([]);
                        setHardCopyFileName(null);
                        setSelectedHardCopyFiles([]);
                        setHardCopyMultiSummary(null);
                      }}
                      className="text-xs text-slate-700 border border-slate-300 px-3.5 py-1.5 rounded-xl hover:bg-white bg-white font-semibold shadow-xs"
                    >
                      🔄 Re-scan Sheets
                    </button>
                  </div>

                  {/* Multi-Sheet Extraction Summary Card */}
                  {hardCopyMultiSummary && (
                    <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="font-bold text-sm flex items-center gap-2">
                          <span>📊</span> Multi-Sheet Extraction Summary
                        </div>
                        <div className="text-xs text-slate-400">
                          Processed {hardCopyMultiSummary.totalFilesUploaded} sheet(s)
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-800 p-3 rounded-xl">
                          <div className="text-slate-400 text-[10px]">Total Files</div>
                          <div className="text-base font-bold text-white">
                            {hardCopyMultiSummary.totalFilesUploaded} ({hardCopyMultiSummary.successfulFilesCount} Success)
                          </div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-xl">
                          <div className="text-slate-400 text-[10px]">Raw Extracted Rows</div>
                          <div className="text-base font-bold text-indigo-400">{hardCopyMultiSummary.totalRowsExtracted}</div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-xl">
                          <div className="text-slate-400 text-[10px]">Unique Students</div>
                          <div className="text-base font-bold text-emerald-400">{hardCopyMultiSummary.uniqueStudents}</div>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-xl">
                          <div className="text-slate-400 text-[10px]">Duplicates Merged</div>
                          <div className="text-base font-bold text-amber-400">{hardCopyMultiSummary.duplicatesRemoved}</div>
                        </div>
                      </div>

                      {hardCopyMultiSummary.fileResults && hardCopyMultiSummary.fileResults.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-semibold text-slate-400">File-by-File Status:</div>
                          <div className="space-y-1 text-xs max-h-32 overflow-y-auto pr-1">
                            {hardCopyMultiSummary.fileResults.map((fr: any, i: number) => (
                              <div key={i} className="flex items-center justify-between bg-slate-800/80 px-3 py-1.5 rounded-lg">
                                <span className="truncate max-w-[220px] text-slate-300">{fr.fileName}</span>
                                <div className="flex items-center gap-2">
                                  {fr.status === 'success' ? (
                                    <span className="text-emerald-400 font-bold text-[11px]">✓ {fr.extractedCount} rows</span>
                                  ) : (
                                    <span className="text-rose-400 font-bold text-[11px]">✗ Failed ({fr.error})</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">AI Extracted Roster Preview</h4>
                        <p className="text-xs text-slate-500">
                          These students will become the exclusive Online Roster for this attendance session upon confirmation.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full">
                          Total Extracted: {hardCopyRows.length}
                        </span>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                          Present: {hardCopyRows.filter(r => r.status === 'P').length}
                        </span>
                        <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full">
                          Absent: {hardCopyRows.filter(r => r.status === 'A').length}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                          <tr>
                            <th className="px-4 py-2.5">Reg No</th>
                            <th className="px-4 py-2.5">Student Name</th>
                            <th className="px-4 py-2.5">Class / Section</th>
                            <th className="px-4 py-2.5">Department</th>
                            <th className="px-4 py-2.5 text-center">Status</th>
                            <th className="px-4 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {hardCopyRows.map((s: any, idx) => (
                            <tr key={`${s.regNo}-${idx}`} className={`hover:bg-slate-50 transition-colors ${s.isUncertain ? 'bg-amber-50/40' : ''}`}>
                              <td className="px-4 py-3 font-mono font-medium text-slate-700">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{s.regNo}</span>
                                  {s.isMatchedToRoster && (
                                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold" title="Matched to existing event roster">
                                      ✓ Matched
                                    </span>
                                  )}
                                  {(s.isUncertain || (s.uncertainFields?.length > 0 && s.uncertainFields[0] === 'Needs Review')) && (
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold" title="Low AI confidence — please verify this row">
                                      ⚠️ Needs Review
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{s.studentName}</td>
                              <td className="px-4 py-3 text-slate-500">{s.className || '-'}</td>
                              <td className="px-4 py-3 text-slate-500">{s.department || '-'}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  s.status === 'P'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : s.status === 'A'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {s.status === 'P' ? (s.signaturePresent ? '✓ Signed — Present' : '✓ Listed — Present') : s.status === 'A' ? '✗ Unsigned — Absent' : '📜 On-Duty (OD)'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingHardCopyIndex(idx);
                                    setEditingHardCopyData({ ...s });
                                  }}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 underline font-semibold"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setHardCopyRows(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                                >
                                  🗑️ Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                      <button
                        onClick={() => {
                          setAddStudentForm({ regNo: '', studentName: '', className: '', department: '', status: 'P' });
                          setAddStudentError(null);
                          setShowAddStudentModal(true);
                        }}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                      >
                        ➕ Add Missing Student Row
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setHardCopyRows([]);
                            setHardCopyFileName(null);
                          }}
                          className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmHardCopyImport}
                          disabled={hardCopyScanning}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {hardCopyScanning ? 'Importing Roster...' : '💾 Confirm & Add to Online Roster'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode 4: Excel Import & Export */}
          {attendanceMode === 'excel' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
              <div>
                <h3 className="font-bold font-heading text-slate-800 text-lg">Excel / CSV Student Roster Import</h3>
                <p className="text-xs text-slate-500 mt-0.5">Upload a student list containing register number, name, department, class, and section. Attendance status is manually marked later.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="font-semibold text-sm text-slate-800">Export & Templates</h4>
                  <p className="text-xs text-slate-500">Download a starter template or export the current attendance data for the selected event.</p>

                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        const csvContent = "Register Number,Student Name,Department,Class,Section\n221T001,Arun Kumar M,IT,III,A\n221T002,Bhavya S,IT,III,A\n";
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `Student_Attendance_Template_${event.id}.csv`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs"
                    >
                      📥 Download Student Template (.csv)
                    </button>

                    <button
                      onClick={() => {
                        const header = 'Register Number,Student Name,Department,Class,Section,Attendance Status,Remarks\n';
                        const rows = attendanceRecords.map(r => `${r.regNo},"${r.studentName}","${r.department || ''}","${r.className || ''}","${r.className || ''}","${r.status || ''}","${r.remarks || ''}"`).join('\n');
                        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Attendance_Report_${event.id}_${event.name.replace(/\s+/g, '_')}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
                    >
                      📊 Export Current Attendance CSV
                    </button>
                  </div>
                </div>

                <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-4">
                  <h4 className="font-semibold text-sm text-indigo-900">Upload Student List</h4>
                  <p className="text-xs text-slate-500">Supported: .xlsx, .xls, .csv. Only student details are imported; attendance is marked later.</p>

                  <div className="border-2 border-dashed border-indigo-200 rounded-xl p-5 text-center bg-white">
                    <div className="text-3xl mb-2">📤</div>
                    {uploadedExcelName ? (
                      <div className="text-xs font-bold text-emerald-700 mb-2">Uploaded: {uploadedExcelName}</div>
                    ) : (
                      <div className="text-xs text-slate-600 mb-2 font-medium">Select student roster file</div>
                    )}
                    <label className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-indigo-700 inline-block shadow-2xs">
                      Browse File
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const allowed = ['csv', 'xlsx', 'xls'];
                          const ext = file.name.split('.').pop()?.toLowerCase();
                          if (!ext || !allowed.includes(ext)) {
                            setSaveToast('Unsupported file type. Please upload .xlsx, .xls, or .csv only.');
                            setTimeout(() => setSaveToast(null), 3000);
                            return;
                          }

                          setExcelImportLoading(true);
                          setUploadedExcelName(file.name);

                          try {
                            const buffer = await file.arrayBuffer();
                            const workbook = XLSX.read(buffer, { type: 'array' });
                            const sheetName = workbook.SheetNames[0];
                            const sheet = workbook.Sheets[sheetName];
                            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }) as Record<string, unknown>[];

                            const normalizedRows: Array<{ regNo: string; studentName: string; department: string; className: string; status: 'Valid' | 'Duplicate' | 'Invalid'; reason?: string }> = [];
                            const seenInExcel = new Set<string>();
                            let validStudents = 0;
                            let duplicateCount = 0;
                            let invalidRows = 0;

                            for (const row of rows) {
                              const rawKeys = Object.keys(row);
                              const getValue = (...searchKeys: string[]) => {
                                for (const sk of searchKeys) {
                                  for (const k of rawKeys) {
                                    if (
                                      k.trim().toLowerCase() === sk.trim().toLowerCase() ||
                                      k.trim().toLowerCase().replace(/[\s_\-\/]/g, '') === sk.trim().toLowerCase().replace(/[\s_\-\/]/g, '')
                                    ) {
                                      const val = row[k];
                                      if (val !== undefined && val !== null && String(val).trim() !== '') {
                                        return String(val).trim();
                                      }
                                    }
                                  }
                                }
                                return '';
                              };

                              const regNo = getValue('Register Number', 'Register No', 'Reg No', 'Reg Number', 'Registration Number', 'Registration No', 'RegisterNumber');
                              const studentName = getValue('Student Name', 'Name', 'StudentName', 'Student');
                              const departmentRaw = getValue('Department', 'Dept', 'Department Name', 'DepartmentName');
                              const classValue = getValue('Class', 'Year', 'Year of Study');
                              const section = getValue('Section', 'Sec');
                              const combinedClass = getValue('Class / Section', 'Class/Section', 'Class Section', 'ClassSection') || [classValue, section].filter(Boolean).join(' ');
                              const finalDepartment = deriveDepartment(departmentRaw, combinedClass);

                              if (!regNo || !studentName) {
                                let reason = 'Invalid – Missing required fields';
                                if (!regNo && !studentName) reason = 'Invalid – Registration Number & Student Name missing';
                                else if (!regNo) reason = 'Invalid – Registration Number missing';
                                else if (!studentName) reason = 'Invalid – Student Name missing';

                                normalizedRows.push({
                                  regNo: regNo || '-',
                                  studentName: studentName || '-',
                                  department: finalDepartment,
                                  className: combinedClass || '-',
                                  status: 'Invalid',
                                  reason,
                                });
                                invalidRows += 1;
                                continue;
                              }

                              const dupKey = regNo.toLowerCase().trim();
                              if (seenInExcel.has(dupKey)) {
                                normalizedRows.push({
                                  regNo,
                                  studentName,
                                  department: finalDepartment,
                                  className: combinedClass || '-',
                                  status: 'Duplicate',
                                  reason: 'Invalid – Duplicate Registration Number',
                                });
                                duplicateCount += 1;
                                continue;
                              }

                              seenInExcel.add(dupKey);
                              normalizedRows.push({
                                regNo,
                                studentName,
                                department: finalDepartment,
                                className: combinedClass || '-',
                                status: 'Valid',
                              });
                              validStudents += 1;
                            }

                            const sortedNormalizedRows = sortAttendanceRecords(normalizedRows);
                            setExcelImportRows(sortedNormalizedRows);
                            setExcelImportMeta({
                              totalRows: rows.length,
                              validStudents,
                              duplicateCount,
                              invalidRows,
                            });
                            setSaveToast(`Preview ready for ${file.name}. Review and confirm import.`);
                            setTimeout(() => setSaveToast(null), 3000);
                          } catch (error) {
                            setSaveToast('Failed to read the uploaded file. Please check the format and try again.');
                            setTimeout(() => setSaveToast(null), 3000);
                          } finally {
                            setExcelImportLoading(false);
                          }
                        }}
                      />
                    </label>
                    {excelImportLoading && <div className="text-xs text-indigo-600 font-medium mt-2">Processing file...</div>}
                  </div>

                  {excelImportRows.length > 0 && excelImportMeta && (
                    <div className="space-y-4 border border-slate-200 rounded-xl bg-white p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5">
                          <span className="block text-slate-400 font-medium text-[11px]">Total Rows Found in Excel</span>
                          <span className="font-bold text-slate-800 text-sm">{excelImportMeta.totalRows}</span>
                        </div>
                        <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-2.5">
                          <span className="block text-emerald-600 font-medium text-[11px]">Valid Students</span>
                          <span className="font-bold text-emerald-800 text-sm">{excelImportMeta.validStudents}</span>
                        </div>
                        <div className="bg-rose-50/70 border border-rose-100 rounded-lg p-2.5">
                          <span className="block text-rose-600 font-medium text-[11px]">Invalid Students</span>
                          <span className="font-bold text-rose-800 text-sm">{excelImportMeta.invalidRows}</span>
                        </div>
                        <div className="bg-amber-50/70 border border-amber-100 rounded-lg p-2.5">
                          <span className="block text-amber-600 font-medium text-[11px]">Duplicate Register Numbers</span>
                          <span className="font-bold text-amber-800 text-sm">{excelImportMeta.duplicateCount}</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-64 border border-slate-200 rounded-xl">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100 text-slate-600 uppercase">
                            <tr>
                              <th className="px-2 py-2 text-left">Reg No</th>
                              <th className="px-2 py-2 text-left">Student Name</th>
                              <th className="px-2 py-2 text-left">Class / Section</th>
                              <th className="px-2 py-2 text-left">Department</th>
                              <th className="px-2 py-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {excelImportRows.map((row, index) => (
                              <tr key={`${row.regNo}-${index}`} className="border-t border-slate-100">
                                <td className="px-2 py-2 font-mono font-medium text-slate-800">{row.regNo}</td>
                                <td className="px-2 py-2">{row.studentName}</td>
                                <td className="px-2 py-2">{row.className}</td>
                                <td className="px-2 py-2">{row.department}</td>
                                <td className="px-2 py-2">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${row.status === 'Valid' ? 'bg-emerald-100 text-emerald-700' : row.status === 'Duplicate' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {row.reason ? `${row.status} (${row.reason})` : row.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => {
                            setExcelImportRows([]);
                            setExcelImportMeta(null);
                            setUploadedExcelName(null);
                          }}
                          className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            const validStudents = excelImportRows.filter(row => row.status === 'Valid').map(row => ({
                              regNo: row.regNo,
                              studentName: row.studentName,
                              department: row.department || '-',
                              className: row.className || '-',
                            }));

                            if (!validStudents.length) {
                              setSaveToast('No valid students available to import.');
                              setTimeout(() => setSaveToast(null), 2500);
                              return;
                            }

                            setExcelImportLoading(true);
                            const result = await importEventAttendanceRosterApi(eventId, validStudents);
                            setExcelImportLoading(false);

                            let importedRecords: StudentAttendanceRecord[] = [];
                            if (result && result.success && 'data' in result && result.data?.records?.length) {
                              importedRecords = sortAttendanceRecords(result.data.records);
                              setSaveToast(`Imported ${result.data.importedCount} students to the event roster.`);
                            } else {
                              importedRecords = sortAttendanceRecords(validStudents.map(st => ({
                                eventId,
                                regNo: st.regNo,
                                studentName: st.studentName,
                                department: st.department || '-',
                                className: st.className || '-',
                                status: '',
                                remarks: '',
                              })));
                              setSaveToast(`Imported ${validStudents.length} students to roster.`);
                            }

                            setAttendanceRecords(importedRecords);
                            setExcelImportRows([]);
                            setExcelImportMeta(null);
                            setUploadedExcelName(null);
                            setTimeout(() => setSaveToast(null), 3000);
                          }}
                          disabled={excelImportLoading}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          {excelImportLoading ? 'Importing...' : 'Confirm Import'}
                        </button>
                      </div>
                    </div>
                  )}
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
                <button onClick={handlePreviewReport} className="px-4 py-2 border border-indigo-200 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50">👁️ Preview Report</button>
                <button
                  onClick={handleDownloadReport}
                  disabled={reportDownloadLoading}
                  className="px-4 py-2 border border-green-200 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50 disabled:opacity-60"
                >
                  {reportDownloadLoading ? 'Preparing PDF...' : '📥 Download Report'}
                </button>
                <button onClick={handlePrintReport} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">🖨️ Print</button>
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
                  onClick={async () => { setMergedReportGenerated(true); await handleDownloadMergedReport(); }}
                  disabled={mergedReportLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium"
                >
                  {mergedReportLoading ? 'Generating PDF...' : '📄 Generate Merged PDF'}
                </button>
                <button
                  onClick={() => setShowArrangeStep(true)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50"
                >
                  ← Re-arrange Order
                </button>
                {mergedReportGenerated && (
                  <>
                    <button onClick={handleDownloadMergedReport} className="px-4 py-2 border border-green-200 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50">📥 Download Merged Report</button>
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
                <input id="event-document-files" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.doc,.docx" multiple className="hidden" onChange={e => setUploadFiles(Array.from(e.target.files || []))} />
                <label htmlFor="event-document-files" className="inline-block mt-3 px-4 py-1.5 bg-indigo-600 text-white text-xs rounded-xl cursor-pointer">Browse Files</label>
                {uploadFiles.length > 0 && <div className="text-xs text-green-600 mt-2">{uploadFiles.length} file(s) selected</div>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowUploadModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
                <button
                  onClick={() => {
                    if (uploadFiles.length > 0) setUploadedFiles(previous => ({ ...previous, [uploadDocName]: uploadFiles }));
                    setUploadFiles([]);
                    setShowUploadModal(false);
                  }}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium"
                >Upload Documents</button>
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
      {/* Modal: Add Student Manually */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">➕ Add Student to Roster</h3>
              <button
                onClick={() => {
                  setShowAddStudentModal(false);
                  setAddStudentError(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {addStudentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>{addStudentError}</span>
              </div>
            )}

            <form onSubmit={handleAddStudentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Register Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 221T009"
                  value={addStudentForm.regNo}
                  onChange={(e) => {
                    setAddStudentForm((prev) => ({ ...prev, regNo: e.target.value }));
                    setAddStudentError(null);
                  }}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Student Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Harish K"
                  value={addStudentForm.studentName}
                  onChange={(e) => {
                    setAddStudentForm((prev) => ({ ...prev, studentName: e.target.value }));
                    setAddStudentError(null);
                  }}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class / Section</label>
                  <input
                    type="text"
                    placeholder="e.g. III IT A"
                    value={addStudentForm.className}
                    onChange={(e) => {
                      const val = e.target.value;
                      const derived = deriveDepartment(addStudentForm.department, val);
                      setAddStudentForm((prev) => ({
                        ...prev,
                        className: val,
                        department: prev.department && prev.department !== '-' ? prev.department : derived,
                      }));
                    }}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Information Technology"
                    value={addStudentForm.department}
                    onChange={(e) => setAddStudentForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Attendance Status</label>
                <div className="flex gap-2">
                  {(['P', 'A', 'OD'] as const).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setAddStudentForm((prev) => ({ ...prev, status: st }))}
                      className={`flex-1 py-2 rounded-xl font-bold border transition-all text-xs ${
                        addStudentForm.status === st
                          ? st === 'P'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : st === 'A'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {st === 'P' ? '✓ Present (P)' : st === 'A' ? '✗ Absent (A)' : '📜 On-Duty (OD)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStudentModal(false);
                    setAddStudentError(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md"
                >
                  ➕ Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Extracted Hard Copy Row */}
      {editingHardCopyIndex !== null && editingHardCopyData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">✏️ Edit Extracted Student Details</h3>
              <button
                onClick={() => {
                  setEditingHardCopyIndex(null);
                  setEditingHardCopyData(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Register Number</label>
                <input
                  type="text"
                  value={editingHardCopyData.regNo}
                  onChange={(e) => setEditingHardCopyData({ ...editingHardCopyData, regNo: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Student Name</label>
                <input
                  type="text"
                  value={editingHardCopyData.studentName}
                  onChange={(e) => setEditingHardCopyData({ ...editingHardCopyData, studentName: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class / Section</label>
                  <input
                    type="text"
                    value={editingHardCopyData.className}
                    onChange={(e) => {
                      const val = e.target.value;
                      const derived = deriveDepartment(editingHardCopyData.department, val);
                      setEditingHardCopyData({
                        ...editingHardCopyData,
                        className: val,
                        department: derived,
                      });
                    }}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={editingHardCopyData.department}
                    onChange={(e) => setEditingHardCopyData({ ...editingHardCopyData, department: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Attendance Status</label>
                <div className="flex gap-2">
                  {(['P', 'A', 'OD'] as const).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setEditingHardCopyData({ ...editingHardCopyData, status: st })}
                      className={`flex-1 py-2 rounded-xl font-bold border transition-all text-xs ${
                        editingHardCopyData.status === st
                          ? st === 'P'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : st === 'A'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {st === 'P' ? '✓ Present (P)' : st === 'A' ? '✗ Absent (A)' : '📜 On-Duty (OD)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingHardCopyIndex(null);
                    setEditingHardCopyData(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingHardCopyIndex !== null && editingHardCopyData) {
                      const updated = [...hardCopyRows];
                      updated[editingHardCopyIndex] = editingHardCopyData;
                      setHardCopyRows(sortAttendanceRecords(updated));
                      setEditingHardCopyIndex(null);
                      setEditingHardCopyData(null);
                    }
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
