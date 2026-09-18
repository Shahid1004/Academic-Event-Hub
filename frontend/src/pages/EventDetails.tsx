import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import type { AttendanceStatus, EventRecord, Page, StudentAttendanceRecord } from '../types';
import { eventTypeColors } from './Dashboard';
import { addStudentToEventApi, deleteEvent, getEventAttendanceApi, getEvents, importEventAttendanceRosterApi, saveEventAttendanceApi, scanHardCopyAttendanceApi } from '../services/api';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { generateFinalEventReport } from '../utils/finalEventReportGenerator';
import { deleteEventDocument, generateMergedEventReport, getEventAttendance, getEventDocumentBytes, getEventDocuments, getEventFeedback, getFeedbackAnalytics, getFeedbackForm, replaceEventDocument, saveFeedbackForm, uploadEventDocument, generateAIFinalReport, type AIReportContent, type AIReportResponse, type EventAttendanceSummary, type EventDocumentRecord, type EventFeedbackRecord, type FeedbackAnalytics, type FeedbackQuestion, type StudentFeedbackForm } from '../services/api';

interface EventDetailsProps {
  eventId: string;
  navigate: (page: Page, eventId?: string) => void;
}   

type Tab = 'overview' | 'attendance' | 'feedback' | 'documents' | 'final-report' | 'merged-report';

const reportValue = (value: unknown) => value === undefined || value === null || value === '' ? 'Not Available' : String(value);
const storedReportValue = (event: EventRecord, ...keys: string[]) => {
  const record = event as EventRecord & Record<string, unknown>;
  return keys.map(key => record[key]).find(value => value !== undefined && value !== null && value !== '') ?? 'Not Available';
};

const feedbackNumber = (record: EventFeedbackRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return undefined;
};
const feedbackAverage = (records: EventFeedbackRecord[], ...keys: string[]) => {
  const values = records.map(record => feedbackNumber(record, ...keys)).filter((value): value is number => value !== undefined);
  return values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)}/5` : 'Not Available';
};
const feedbackText = (records: EventFeedbackRecord[], ...keys: string[]) => {
  const counts = new Map<string, number>();
  records.forEach(record => keys.some(key => {
    const value = record[key];
    if (typeof value === 'string' && value.trim() && !Number.isFinite(Number(value))) {
      const normalized = value.trim();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
      return true;
    }
    return false;
  }));
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || 'Not Available';
};

interface AiAnalysis {
  overallPerformance: string;
  attendance: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
  outcomes: string[];
  recommendations: string[];
  executiveSummary: string;
}

const buildAiAnalysis = (event: EventRecord, attendance: EventAttendanceSummary, feedback: EventFeedbackRecord[]): AiAnalysis => {
  const expected = attendance.expectedParticipants ?? event.expectedParticipants;
  const actual = attendance.actualParticipants ?? event.actualParticipants;
  const attendancePercentage = attendance.attendancePercentage ?? event.attendance;
  const overallValues = feedback.map(record => feedbackNumber(record, 'overallRating', 'overall', 'rating', 'overallScore')).filter((value): value is number => value !== undefined);
  const averageOverall = overallValues.length ? overallValues.reduce((sum, value) => sum + value, 0) / overallValues.length : undefined;
  const positivePercentage = overallValues.length ? (overallValues.filter(value => value >= 4).length / overallValues.length) * 100 : undefined;
  const comments = feedback.map(record => record.comment || record.comments || record.response).filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const attendanceText = attendancePercentage === undefined ? 'Attendance percentage was not recorded.' : `Attendance was ${Number(attendancePercentage).toFixed(1)}%`;
  const attendanceComparison = expected === undefined || actual === undefined ? 'Expected and actual participant counts were not both recorded.' : `Actual participation was ${actual} against an expected ${expected}, a difference of ${actual - expected}.`;
  const feedbackText = feedback.length === 0
    ? 'No feedback responses were recorded for this event.'
    : `${feedback.length} feedback response(s) were analyzed. ${averageOverall === undefined ? 'An overall rating was not recorded.' : `Average overall rating was ${averageOverall.toFixed(2)}/5.`} ${positivePercentage === undefined ? 'The percentage of positive ratings was not recorded.' : `${positivePercentage.toFixed(1)}% of recorded overall ratings were 4 or above.`} ${comments.length ? `${comments.length} student comment(s) were available for review.` : 'No student comments were recorded.'}`;
  const strengths = [
    event.objective ? 'The event had a documented objective.' : '',
    actual !== undefined && expected !== undefined && actual >= expected ? 'Actual participation met or exceeded the expected participation.' : '',
    attendancePercentage !== undefined && Number(attendancePercentage) >= 75 ? `Recorded attendance was ${Number(attendancePercentage).toFixed(1)}%.` : '',
    averageOverall !== undefined && averageOverall >= 4 ? `Feedback ratings averaged ${averageOverall.toFixed(2)}/5.` : '',
    event.description ? 'Event execution details were documented.' : '',
  ].filter(Boolean);
  const improvements = [
    actual !== undefined && expected !== undefined && actual < expected ? `Participation was ${expected - actual} below the expected count.` : '',
    attendancePercentage !== undefined && Number(attendancePercentage) < 75 ? `Recorded attendance was ${Number(attendancePercentage).toFixed(1)}%, indicating scope for improved attendance.` : '',
    overallValues.some(value => value < 3) ? 'Some overall ratings were below 3/5.' : '',
    feedback.length === 0 ? 'Collect feedback responses for this event to support evidence-based review.' : '',
    comments.length === 0 && feedback.length > 0 ? 'Capture written student comments in future feedback forms.' : '',
  ].filter(Boolean);
  const recommendations = [
    actual !== undefined && expected !== undefined && actual < expected ? 'Review communication and registration follow-up to improve participation.' : '',
    attendancePercentage !== undefined && Number(attendancePercentage) < 75 ? 'Review scheduling and attendance follow-up for future sessions.' : '',
    feedback.length === 0 ? 'Use an event-linked feedback form and retain the responses for reporting.' : '',
    comments.length === 0 && feedback.length > 0 ? 'Add a mandatory open-ended comment field to the feedback form.' : '',
    event.description ? 'Use the recorded event description to plan the next related activity.' : 'Document the event execution details for future review.',
  ].filter(Boolean);
  const outcomes = [
    event.objective ? `The event was designed to address: ${event.objective}` : 'The intended learning objective was not recorded.',
    event.description ? `Recorded event details: ${event.description}` : 'Specific student outcomes were not recorded.',
  ];
  return {
    overallPerformance: `The ${event.type || 'event'} titled "${event.name}" was conducted by ${event.department || 'the department'} on ${event.date || 'the recorded date'}. ${attendanceText}. ${feedback.length ? `Feedback was collected from ${feedback.length} response(s).` : 'No feedback responses were recorded for this event.'}`,
    attendance: `${attendanceComparison} ${attendanceText}. Present and absent counts are ${attendance.present === undefined || attendance.absent === undefined ? 'not available from the attendance records' : `${attendance.present} and ${attendance.absent}`}.`,
    feedback: feedbackText,
    strengths: strengths.length ? strengths : ['No specific strengths were identified from the available event data.'],
    improvements: improvements.length ? improvements : ['No specific improvement area was identified from the available event data.'],
    outcomes,
    recommendations: recommendations.length ? recommendations : ['No additional recommendation was identified from the available event data.'],
    executiveSummary: `The ${event.type || 'event'} "${event.name}" was conducted on ${event.date || 'the recorded date'} at ${event.venue || 'the recorded venue'} for ${event.department || 'the recorded department'}. ${attendanceComparison} ${attendanceText}. ${feedbackText} The documented objective and event details provide the basis for future academic review; no outcomes beyond the stored event information are inferred.`,
  };
};

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

const documentCategories = [
  { category: 'Event Proposal / Permission Letter', name: 'Proposal / Permission Letter' },
  { category: 'Event Circular / Invitation', name: 'Circular' },
  { category: 'Resource Person / Guest Documents', name: 'Resource Person Details / Profile' },
  { category: 'Attendance Documents', name: 'Attendance' },
  { category: 'Feedback Documents', name: 'Feedback' },
  { category: 'Event Photographs', name: 'Event Photographs' },
  { category: 'Supporting Documents', name: 'Supporting Documents' },
  { category: 'Other', name: 'Other Documents' },
];
const documentCategoryForDisplay = (name: string) => documentCategories.find(item => item.name === name)?.category || name;
const emptyEvent = (id: string): EventRecord => ({
  id, name: 'Event details unavailable', type: 'Other', department: 'BOTH', academicYear: '', date: '',
  startTime: '', endTime: '', venue: '', mode: '', coordinator: '',
  resourcePerson: { name: '', designation: '', organization: '', contact: '', email: '' },
  actualParticipants: 0, attendance: 0, feedbackScore: 0, docStatus: 'Pending', reportStatus: 'Not Generated'
});

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



export default function EventDetails({ eventId, navigate }: EventDetailsProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [attendanceFilter, setAttendanceFilter] = useState<'All' | 'P' | 'A' | 'OD'>('All');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  
  // Attendance records state
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendanceRecord[]>(initialDefaultStudents);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Attendance mode — removed 'qr'
  const [attendanceMode, setAttendanceMode] = useState<'online' | 'hardcopy' | 'od_generator' | 'excel'>('online');
  
  // Add Student Manual Modal state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [addStudentForm, setAddStudentForm] = useState({
    regNo: '',
    studentName: '',
    className: '',
    department: 'Information Technology',
    status: 'P' as AttendanceStatus,
  });
  const [addStudentError, setAddStudentError] = useState<string | null>(null);
  const [addingStudentLoading, setAddingStudentLoading] = useState(false);

  // Hardcopy AI upload & scan state
  const [hardCopySheetType, setHardCopySheetType] = useState<'signed' | 'participant_list'>('signed');
  const [hardCopyFileName, setHardCopyFileName] = useState<string | null>(null);
  const [hardCopyScanning, setHardCopyScanning] = useState(false);
  const [hardCopyScanError, setHardCopyScanError] = useState<string | null>(null);
  const [selectedHardCopyFiles, setSelectedHardCopyFiles] = useState<File[]>([]);
  const [hardCopyProcessingProgress, setHardCopyProcessingProgress] = useState<string | null>(null);
  const [hardCopyProgressPercentage, setHardCopyProgressPercentage] = useState<number>(0);
  const [hardCopyProgressStage, setHardCopyProgressStage] = useState<string>('');
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
  const [uploadCategory, setUploadCategory] = useState('Event Proposal / Permission Letter');
  const [replaceDocumentId, setReplaceDocumentId] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportDownloadLoading, setReportDownloadLoading] = useState(false);
  // AI Final Report state
  const [finalReportContent, setFinalReportContent] = useState<AIReportContent | null>(null);
  const [finalReportData, setFinalReportData] = useState<AIReportResponse | null>(null);
  const [finalReportLoading, setFinalReportLoading] = useState(false);
  const [finalReportGenerated, setFinalReportGenerated] = useState(false);
  const [finalReportError, setFinalReportError] = useState<string | null>(null);
  const [finalReportDownloadLoading, setFinalReportDownloadLoading] = useState(false);
  const [showOtherDocModal, setShowOtherDocModal] = useState(false);
  const [docOrder, setDocOrder] = useState<number[]>(documents.map((_, i) => i));
  const [mergedReportGenerated, setMergedReportGenerated] = useState(false);
  const [mergedReportLoading, setMergedReportLoading] = useState(false);
  const [showArrangeStep, setShowArrangeStep] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [feedbackRecords, setFeedbackRecords] = useState<EventFeedbackRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<EventAttendanceSummary | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackFormTitle, setFeedbackFormTitle] = useState('Event Feedback');
  const [feedbackFormStatus, setFeedbackFormStatus] = useState<'Draft' | 'Published' | 'Closed'>('Draft');
  const [feedbackFormQuestions, setFeedbackFormQuestions] = useState<FeedbackQuestion[]>([]);
  const [feedbackFormSaving, setFeedbackFormSaving] = useState(false);
  const [feedbackFormMessage, setFeedbackFormMessage] = useState('');
  const [feedbackForm, setFeedbackForm] = useState<StudentFeedbackForm | null>(null);
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [feedbackAnalyticsLoading, setFeedbackAnalyticsLoading] = useState(false);
  const [eventDocuments, setEventDocuments] = useState<EventDocumentRecord[]>([]);
  const [documentError, setDocumentError] = useState<string | null>(null);

  const [loadedEvent, setLoadedEvent] = useState<EventRecord | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState(false);
  const event = loadedEvent || emptyEvent(eventId);
  useEffect(() => {
    setLoadedEvent(null);
    setEventLoading(true);
    setEventError(false);
    let active = true;
    setFeedbackLoading(true);
    setFeedbackError(null);
    getEventFeedback(eventId)
      .then(records => { if (active) setFeedbackRecords(records); })
      .catch(error => { console.error('Feedback lookup failed:', error); if (active) setFeedbackError('Unable to load feedback records.'); })
      .finally(() => { if (active) setFeedbackLoading(false); });
    return () => { active = false; };
  }, [eventId]);
  // Track if feedback form was already loaded so typing is never overwritten
  const feedbackFormLoadedRef = useRef(false);
  useEffect(() => {
    // Reset the loaded flag when the event changes so new event always populates the form
    feedbackFormLoadedRef.current = false;
  }, [eventId]);
  useEffect(() => {
    let active = true;
    setFeedbackAnalyticsLoading(true);

    const loadFeedbackData = () => Promise.all([getFeedbackForm(eventId), getFeedbackAnalytics(eventId)])
      .then(([form, analytics]) => {
        if (!active) return;
        setFeedbackForm(form);
        setFeedbackAnalytics(analytics);
        // Only populate editable form fields once per event — never overwrite while user is typing
        if (!feedbackFormLoadedRef.current) {
          setFeedbackFormTitle(form?.title || 'Event Feedback');
          setFeedbackFormStatus((form?.status as 'Draft' | 'Published' | 'Closed') || 'Draft');
          setFeedbackFormQuestions(form?.questions || []);
          feedbackFormLoadedRef.current = true;
        }
      })
      .catch(error => { if (active) setFeedbackError(error?.response?.data?.message || 'Unable to load feedback form.'); })
      .finally(() => { if (active) setFeedbackAnalyticsLoading(false); });

    loadFeedbackData();

    // Background timer only refreshes submission analytics so unsaved draft questions being typed are never overwritten
    const refreshAnalyticsOnly = () => {
      getFeedbackAnalytics(eventId)
        .then(analytics => {
          if (active) setFeedbackAnalytics(analytics);
        })
        .catch(() => {});
    };

    const refreshTimer = window.setInterval(refreshAnalyticsOnly, 30000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, [eventId]);
  useEffect(() => {
    let active = true;
    setDocumentError(null);
    getEventDocuments(eventId)
      .then(records => { if (active) setEventDocuments(records); })
      .catch(() => { if (active) { setEventDocuments([]); setDocumentError('Unable to load documents for this event.'); } });
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    let active = true;
    getEventAttendance(eventId)
      .then(summary => { if (active) setAttendanceSummary(summary); })
      .catch(error => { console.error('Attendance lookup failed:', error); if (active) setAttendanceSummary(null); });
    return () => { active = false; };
  }, [eventId]);
  const reportEvent = event as EventRecord & Record<string, unknown>;
  const reportTopics = Array.isArray(reportEvent.topics) ? reportEvent.topics.map(String).join('\n') : reportValue(reportEvent.topics || reportEvent.topicsCovered || reportEvent.conceptsCovered);
  const reportOutcomes = Array.isArray(reportEvent.keyOutcomes) ? reportEvent.keyOutcomes.map(String).join('\n') : reportValue(reportEvent.keyOutcomes || reportEvent.outcomes);
  const reportRecommendations = Array.isArray(reportEvent.recommendations) ? reportEvent.recommendations.map(String).join('\n') : reportValue(reportEvent.recommendations || reportEvent.correctiveActions);
  const feedbackOverallValues = feedbackRecords.map(record => feedbackNumber(record, 'overallRating', 'overall', 'rating', 'overallScore')).filter((value): value is number => value !== undefined);
  const feedbackHighRating = feedbackOverallValues.length ? `${((feedbackOverallValues.filter(value => value >= 4).length / feedbackOverallValues.length) * 100).toFixed(1)}%` : 'Not Available';
  const feedbackDistribution = [5, 4, 3, 2, 1].map(rating => ({ rating, count: feedbackAnalytics?.ratingDistribution?.[String(rating)] || 0 }));
  const feedbackQuestions = [
    { q: 'Overall satisfaction', keys: ['overallSatisfaction', 'satisfactionRating', 'satisfaction'] },
    { q: 'Content quality', keys: ['sessionContentRating', 'contentRating', 'content', 'sessionContent'] },
    { q: 'Presentation quality', keys: ['speakerEffectivenessRating', 'speakerRating', 'speakerEffectiveness', 'speaker'] },
    { q: 'Expectations met', keys: ['expectationsMet', 'expectationRating', 'expectations'] },
    { q: 'Would recommend', keys: ['wouldRecommend', 'recommendationRating', 'recommend'] },
  ].map(question => ({ ...question, average: feedbackAverage(feedbackRecords, ...question.keys) }));
  const feedbackAnalysisText = feedbackRecords.length
    ? `Feedback analysis was generated from ${feedbackRecords.length} response(s). ${feedbackOverallValues.length ? `The average overall rating was ${feedbackAverage(feedbackRecords, 'overallRating', 'overall', 'rating', 'overallScore')}, with ${feedbackOverallValues.filter(value => value >= 4).length} response(s) rated 4 or above.` : 'An overall rating was not recorded.'}`
    : 'No feedback responses were recorded for this event.';
  const feedbackComments = [...feedbackRecords
    .map(record => record.comment || record.comments || record.response)
    .filter((comment): comment is string => typeof comment === 'string' && comment.trim().length > 0), ...(feedbackAnalytics?.comments || []).map(comment => `${comment.question}: ${comment.answer}`)];
  const addFeedbackQuestion = () => setFeedbackFormQuestions(previous => [
    ...previous,
    { id: `question-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, text: '', type: 'text', required: false }
  ]);
  const saveEventFeedbackForm = async () => {
    const questionsToSave = feedbackFormQuestions
      .map(question => ({
        ...question,
        text: question.text.trim(),
        options: question.type === 'multiple-choice'
          ? (question.options || []).map(opt => opt.trim()).filter(Boolean)
          : undefined
      }))
      .filter(question => question.text.length > 0);

    if (!questionsToSave.length) { setFeedbackFormMessage('Add at least one question with text before saving.'); return; }
    if (!feedbackFormTitle.trim()) { setFeedbackFormMessage('Please enter a form title.'); return; }
    setFeedbackFormSaving(true); setFeedbackFormMessage('');
    try {
      const saved = await saveFeedbackForm(event.id, { title: feedbackFormTitle.trim(), status: feedbackFormStatus, questions: questionsToSave });
      setFeedbackForm(saved);
      setFeedbackFormQuestions(saved.questions || []);
      setFeedbackFormStatus((saved.status as 'Draft' | 'Published' | 'Closed') || feedbackFormStatus);
      setFeedbackFormMessage(`✅ Feedback form saved successfully. Status: ${saved.status}`);
      try { const analytics = await getFeedbackAnalytics(event.id); setFeedbackAnalytics(analytics); } catch { /* analytics optional */ }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Unable to save the feedback form.';
      setFeedbackFormMessage(`❌ ${msg}`);
      console.error('saveFeedbackForm error:', err?.response?.data || err);
    }
    finally { setFeedbackFormSaving(false); }
  };

  const reportSections = [
    { num: 1, title: 'Event Overview', content: `Event Name: ${reportValue(event.name)}\nEvent Type: ${reportValue(event.type)}\nDepartment: ${reportValue(event.department)}\nDate: ${reportValue(event.date)}\nTime: ${event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : 'Not Available'}\nVenue: ${reportValue(event.venue)}\nMode: ${reportValue(event.mode)}\nCoordinator: ${reportValue(event.coordinator)}\nTarget Participants: ${reportValue(event.targetStudents)}` },
    { num: 2, title: 'Objective', content: reportValue(event.objective) },
    { num: 3, title: 'Permission / Proposal Details', content: `Approval status: ${storedReportValue(event, 'approvalStatus', 'permissionStatus')}\nProposal submission date: ${storedReportValue(event, 'proposalSubmissionDate', 'proposalDate', 'submissionDate')}\nApproval date: ${storedReportValue(event, 'approvalDate', 'permissionApprovalDate')}\nHOD/Principal approval details: ${storedReportValue(event, 'approvalDetails', 'hodApprovalDetails', 'principalApprovalDetails')}` },
    { num: 4, title: 'Resource Person / Guest Details', content: `Name: ${reportValue(event.resourcePerson?.name)}\nDesignation: ${reportValue(event.resourcePerson?.designation)}\nOrganization: ${reportValue(event.resourcePerson?.organization)}\nContact: ${reportValue(event.resourcePerson?.contact)}\nEmail: ${reportValue(event.resourcePerson?.email)}\nSession Topic: ${storedReportValue(event, 'sessionTopic', 'topic', 'topics')}` },
    { num: 5, title: 'Event Execution Details', content: storedReportValue(event, 'executionDetails', 'executionSummary') !== 'Not Available' ? String(storedReportValue(event, 'executionDetails', 'executionSummary')) : `The event was conducted in ${reportValue(event.mode)} mode at ${reportValue(event.venue)}. Coordinator: ${reportValue(event.coordinator)}. Description: ${reportValue(event.description)}` },
    { num: 6, title: 'Topics / Concepts Covered', content: reportTopics },
    { num: 7, title: 'Student Participation', content: `Target students: ${reportValue(event.targetStudents)}\nExpected participants: ${reportValue(event.expectedParticipants)}\nActual participants: ${reportValue(event.actualParticipants)}` },
    { num: 8, title: 'Attendance Summary', content: `Total students: ${storedReportValue(event, 'totalStudents') !== 'Not Available' ? storedReportValue(event, 'totalStudents') : reportValue(event.actualParticipants)}\nPresent: ${storedReportValue(event, 'present', 'studentsPresent', 'presentStudents')}\nAbsent: ${storedReportValue(event, 'absent', 'studentsAbsent', 'absentStudents')}\nAttendance percentage: ${event.attendance ? `${event.attendance}%` : 'Not Available'}` },
    { num: 9, title: 'Feedback Summary and Analysis', content: feedbackLoading ? 'Loading feedback records...' : feedbackError || `Total feedback received: ${feedbackRecords.length || 'No feedback responses were recorded for this event.'}\nAverage overall rating: ${feedbackAverage(feedbackRecords, 'overallRating', 'overall', 'rating', 'overallScore')}\nSession content rating: ${feedbackAverage(feedbackRecords, 'sessionContentRating', 'contentRating', 'content', 'sessionContent')}\nSpeaker effectiveness rating: ${feedbackAverage(feedbackRecords, 'speakerEffectivenessRating', 'speakerRating', 'speakerEffectiveness', 'speaker')}\nUsefulness to students: ${feedbackAverage(feedbackRecords, 'usefulnessToStudents', 'usefulnessRating', 'usefulness', 'relevanceRating')}\nOverall satisfaction/response: ${feedbackAverage(feedbackRecords, 'overallSatisfaction', 'satisfactionRating', 'satisfaction')}\nPercentage rating 4 or above: ${feedbackHighRating}\nAnalysis: ${feedbackAnalysisText}` },
    { num: 10, title: 'Payment / Remuneration Details', content: `Resource person remuneration: ${storedReportValue(event, 'remuneration', 'resourcePersonRemuneration', 'paymentAmount')}\nPayment method: ${storedReportValue(event, 'paymentMethod')}\nPayment date: ${storedReportValue(event, 'paymentDate')}\nTransaction reference: ${storedReportValue(event, 'transactionReference', 'transactionId')}` },
    { num: 11, title: 'Key Outcomes', content: reportOutcomes },
    { num: 12, title: 'Corrective Action / Recommendations', content: reportRecommendations },
    { num: 13, title: 'Conclusion', content: `The ${reportValue(event.type)} titled "${reportValue(event.name)}" was conducted on ${reportValue(event.date)} with ${reportValue(event.actualParticipants)} participant(s) recorded. The event addressed its recorded objective, with attendance recorded as ${event.attendance ? `${event.attendance}%` : 'Not Available'} and feedback recorded as ${event.feedbackScore ? `${event.feedbackScore}/5` : 'Not Available'}.` },
  ];
  useEffect(() => {
    setEventLoading(true);
    setEventError(false);
    getEvents()
      .then(events => {
        setLoadedEvent(events.find(item => item.id === eventId) || null);
        setEventError(!events.some(item => item.id === eventId));
      })
      .catch(() => {
        setLoadedEvent(null);
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
  if (!loadedEvent) return (
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
    { id: 'final-report', label: 'Final Report' },
    { id: 'merged-report', label: 'Merged Report' },
  ];

  const completedDocumentCategories = new Set(eventDocuments.map(document => document.category));
  const docPct = Math.round((documentCategories.filter(item => completedDocumentCategories.has(item.category)).length / documentCategories.length) * 1000) / 10;
  const refreshEventDocuments = async () => {
    const records = await getEventDocuments(eventId);
    setEventDocuments(records);
  };
  const openEventDocument = async (document: EventDocumentRecord) => {
    try {
      const bytes = await getEventDocumentBytes(document.url);
      const url = URL.createObjectURL(new Blob([bytes], { type: document.mimeType || document.type }));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setDocumentError('Unable to open this document.'); }
  };
  const downloadEventDocument = async (document: EventDocumentRecord) => {
    try {
      const bytes = await getEventDocumentBytes(document.url);
      const url = URL.createObjectURL(new Blob([bytes], { type: document.mimeType || document.type }));
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch { setDocumentError('Unable to download this document.'); }
  };
  const deleteEventDocumentRecord = async (document: EventDocumentRecord) => {
    if (!window.confirm(`Delete ${document.name}?`)) return;
    try { await deleteEventDocument(document.id); await refreshEventDocuments(); }
    catch { setDocumentError('Unable to delete this document.'); }
  };
  const beginDocumentUpload = (category: string, name: string, documentId?: string) => {
    setUploadCategory(category);
    setUploadDocName(name);
    setReplaceDocumentId(documentId || null);
    setShowUploadModal(true);
  };

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

  // Add student manually with persistent backend saving, duplicate validation & auto-sorting
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReg = addStudentForm.regNo.trim().toUpperCase();
    const cleanName = addStudentForm.studentName.trim();
    if (!cleanReg || !cleanName) {
      setAddStudentError('Register Number and Student Name are required.');
      return;
    }

    // Client-side duplicate check
    const isDuplicate = attendanceRecords.some(
      (s) => s.regNo.trim().toUpperCase() === cleanReg
    );
    if (isDuplicate) {
      setAddStudentError(`Student with Register Number "${cleanReg}" is already in the attendance roster.`);
      return;
    }

    setAddingStudentLoading(true);
    setAddStudentError(null);

    const finalDept = deriveDepartment(addStudentForm.department, addStudentForm.className);

    try {
      const response = await addStudentToEventApi(eventId, {
        regNo: cleanReg,
        studentName: cleanName,
        className: addStudentForm.className.trim() || '-',
        department: finalDept,
        status: addStudentForm.status,
      });

      if (!response || !response.success) {
        setAddStudentError(response?.message || 'Failed to save student to database.');
        setAddingStudentLoading(false);
        return;
      }

      // Successful persistence in database -> update frontend state with fresh backend roster
      if (response.data && response.data.records) {
        setAttendanceRecords(sortAttendanceRecords(response.data.records));
      }

      setShowAddStudentModal(false);
      setAddStudentForm({ regNo: '', studentName: '', className: '', department: 'Information Technology', status: 'P' });
      setAddStudentError(null);
      setSaveToast(`✅ Student ${cleanName} (${cleanReg}) saved to database & added to roster!`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      console.error('Error adding student:', err);
      setAddStudentError(err?.response?.data?.message || err?.message || 'Failed to save student to database.');
    } finally {
      setAddingStudentLoading(false);
    }
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
    setHardCopyProgressPercentage(5);
    setHardCopyProgressStage(`Uploading ${files.length} attendance sheet(s)...`);

    const displayName = files.length === 1 ? files[0].name : `${files.length} Attendance Sheets`;
    setHardCopyFileName(displayName);
    setHardCopyProcessingProgress(`Processing ${files.length} sheet(s) with AI Vision...`);

    let currentPercent = 10;
    const progressTimer = setInterval(() => {
      currentPercent += Math.floor(Math.random() * 3) + 2;
      if (currentPercent > 94) {
        currentPercent = 94;
      }
      setHardCopyProgressPercentage(currentPercent);
      if (currentPercent < 25) {
        setHardCopyProgressStage(`Uploading ${files.length} sheet(s) to server...`);
      } else if (currentPercent < 48) {
        setHardCopyProgressStage('Scanning sheet layout & OCR text recognition...');
      } else if (currentPercent < 70) {
        setHardCopyProgressStage('Extracting student roll numbers & names via AI...');
      } else if (currentPercent < 86) {
        setHardCopyProgressStage('Verifying signatures & attendance status...');
      } else {
        setHardCopyProgressStage('Consolidating & finalizing attendance roster...');
      }
    }, 350);

    try {
      const apiResult = await scanHardCopyAttendanceApi(
        files,
        hardCopySheetType,
        eventId,
        (uploadPercent) => {
          const scaled = Math.min(25, Math.max(5, Math.round(uploadPercent * 0.25)));
          if (scaled > currentPercent) {
            currentPercent = scaled;
            setHardCopyProgressPercentage(currentPercent);
          }
        }
      );

      clearInterval(progressTimer);
      setHardCopyProgressPercentage(100);
      setHardCopyProgressStage('Extraction completed successfully (100%)');
      await new Promise((resolve) => setTimeout(resolve, 400));

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
      clearInterval(progressTimer);
      setHardCopyScanning(false);
      setHardCopyProcessingProgress(null);
      setHardCopyProgressPercentage(0);
      setHardCopyProgressStage('');
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

  // Export Attendance Roster as Excel (.xlsx)
  const handleExportAttendanceExcel = () => {
    const exportRows = attendanceRecords.map((r, index) => ({
      'S.No': index + 1,
      'Register Number': r.regNo,
      'Student Name': r.studentName,
      'Department': r.department || event.department || '-',
      'Class / Section': r.className || '-',
      'Attendance Status': r.status === 'P' ? 'Present (P)' : r.status === 'A' ? 'Absent (A)' : r.status === 'OD' ? 'On-Duty (OD)' : r.status || 'Not Marked',
      'Remarks': r.remarks || ''
    }));

    const dataToExport = exportRows.length ? exportRows : [
      { 'S.No': 1, 'Register Number': '221IT001', 'Student Name': 'Sample Student', 'Department': 'IT', 'Class / Section': 'III IT A', 'Attendance Status': 'Present (P)', 'Remarks': '' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 28 },
      { wch: 15 },
      { wch: 18 },
      { wch: 22 },
      { wch: 25 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Roster');
    const safeName = (event.name || 'Event').replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `Attendance_Report_${event.id}_${safeName}.xlsx`);
  };

  // Download Student Roster Template as Excel (.xlsx)
  const handleDownloadStudentTemplateExcel = () => {
    const templateData = [
      { 'Register Number': '221T001', 'Student Name': 'Arun Kumar M', 'Department': 'IT', 'Class': 'III', 'Section': 'A' },
      { 'Register Number': '221T002', 'Student Name': 'Bhavya S', 'Department': 'IT', 'Class': 'III', 'Section': 'A' },
      { 'Register Number': '221T003', 'Student Name': 'Chandran K', 'Department': 'IT', 'Class': 'III', 'Section': 'A' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 15 },
      { wch: 12 },
      { wch: 10 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Roster Template');
    XLSX.writeFile(workbook, `Student_Attendance_Template_${event.id}.xlsx`);
  };

  // Export Attendance Roster as PDF (.pdf)
  const handleExportAttendancePdf = async () => {
    try {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

      const records = attendanceRecords.length ? attendanceRecords : [];
      const recordsPerPage = 22;
      const totalPages = Math.max(1, Math.ceil(records.length / recordsPerPage));

      let recordIdx = 0;

      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const page = pdf.addPage([595, 842]);
        const { width, height } = page.getSize();
        const margin = 35;
        let y = height - 40;

        // Header branding
        page.drawText('SONA COLLEGE OF TECHNOLOGY, SALEM', {
          x: margin, y, size: 13, font: boldFont, color: rgb(0.12, 0.16, 0.53)
        });
        y -= 15;
        page.drawText('DEPARTMENT OF INFORMATION TECHNOLOGY', {
          x: margin, y, size: 9.5, font: boldFont, color: rgb(0.3, 0.3, 0.3)
        });
        y -= 13;
        page.drawText(`Official Student Attendance Report — ${event.name || 'Event'}`, {
          x: margin, y, size: 10.5, font: boldFont, color: rgb(0.1, 0.1, 0.1)
        });
        y -= 10;

        // Divider
        page.drawLine({
          start: { x: margin, y }, end: { x: width - margin, y },
          thickness: 1.5, color: rgb(0.2, 0.25, 0.65)
        });
        y -= 16;

        // Summary Stats Box on Page 1
        if (pageNum === 0) {
          const presentCount = records.filter(r => r.status === 'P').length;
          const absentCount = records.filter(r => r.status === 'A').length;
          const odCount = records.filter(r => r.status === 'OD').length;
          const total = records.length;
          const rate = total ? Math.round((presentCount / total) * 100) : 0;

          page.drawRectangle({
            x: margin, y: y - 36, width: width - margin * 2, height: 42,
            color: rgb(0.96, 0.97, 0.99), borderColor: rgb(0.85, 0.88, 0.93), borderWidth: 1
          });

          page.drawText(`Date: ${event.date || '—'}   Time: ${event.startTime || '—'} - ${event.endTime || '—'}   Venue: ${event.venue || '—'}`, {
            x: margin + 10, y: y - 14, size: 8.5, font: boldFont, color: rgb(0.2, 0.2, 0.2)
          });
          page.drawText(`Total Registered: ${total}   |   Present (P): ${presentCount}   |   Absent (A): ${absentCount}   |   On-Duty (OD): ${odCount}   |   Rate: ${rate}%`, {
            x: margin + 10, y: y - 28, size: 8.5, font: boldFont, color: rgb(0.1, 0.45, 0.2)
          });
          y -= 50;
        }

        // Table Header
        const colX = {
          sno: margin + 6,
          regNo: margin + 35,
          name: margin + 125,
          classDept: margin + 295,
          status: margin + 415,
          remarks: margin + 475
        };

        page.drawRectangle({
          x: margin, y: y - 18, width: width - margin * 2, height: 22,
          color: rgb(0.18, 0.24, 0.45)
        });

        page.drawText('S.No', { x: colX.sno, y: y - 13, size: 8, font: boldFont, color: rgb(1, 1, 1) });
        page.drawText('Register No', { x: colX.regNo, y: y - 13, size: 8, font: boldFont, color: rgb(1, 1, 1) });
        page.drawText('Student Name', { x: colX.name, y: y - 13, size: 8, font: boldFont, color: rgb(1, 1, 1) });
        page.drawText('Class / Dept', { x: colX.classDept, y: y - 13, size: 8, font: boldFont, color: rgb(1, 1, 1) });
        page.drawText('Status', { x: colX.status, y: y - 13, size: 8, font: boldFont, color: rgb(1, 1, 1) });
        page.drawText('Remarks', { x: colX.remarks, y: y - 13, size: 8, font: boldFont, color: rgb(1, 1, 1) });
        y -= 22;

        const pageRecords = records.slice(recordIdx, recordIdx + recordsPerPage);
        pageRecords.forEach((record, idx) => {
          const globalIdx = recordIdx + idx + 1;
          const isEven = idx % 2 === 0;

          page.drawRectangle({
            x: margin, y: y - 18, width: width - margin * 2, height: 20,
            color: isEven ? rgb(1, 1, 1) : rgb(0.97, 0.98, 1)
          });

          page.drawText(String(globalIdx), { x: colX.sno, y: y - 13, size: 8, font });
          page.drawText((record.regNo || '-').slice(0, 16), { x: colX.regNo, y: y - 13, size: 8, font: boldFont });
          page.drawText((record.studentName || '-').slice(0, 26), { x: colX.name, y: y - 13, size: 8, font });
          page.drawText(`${record.className || ''} ${record.department || ''}`.trim().slice(0, 18) || '-', { x: colX.classDept, y: y - 13, size: 8, font });

          let statusColor = rgb(0.3, 0.3, 0.3);
          let statusText = record.status || 'N/M';
          if (record.status === 'P') { statusText = 'Present (P)'; statusColor = rgb(0.05, 0.5, 0.2); }
          else if (record.status === 'A') { statusText = 'Absent (A)'; statusColor = rgb(0.8, 0.1, 0.1); }
          else if (record.status === 'OD') { statusText = 'On-Duty (OD)'; statusColor = rgb(0.1, 0.3, 0.8); }

          page.drawText(statusText, { x: colX.status, y: y - 13, size: 8, font: boldFont, color: statusColor });
          page.drawText((record.remarks || '').slice(0, 12), { x: colX.remarks, y: y - 13, size: 7.5, font });

          page.drawLine({
            start: { x: margin, y: y - 18 }, end: { x: width - margin, y: y - 18 },
            thickness: 0.5, color: rgb(0.9, 0.9, 0.9)
          });
          y -= 20;
        });

        recordIdx += pageRecords.length;

        if (pageNum === totalPages - 1) {
          const sigY = Math.max(y - 45, 55);
          page.drawText('Faculty Coordinator Signature', { x: margin + 20, y: sigY, size: 8.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
          page.drawText('HOD / Principal Approval', { x: width - margin - 150, y: sigY, size: 8.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
        }

        page.drawText(`Page ${pageNum + 1} of ${totalPages}  |  Generated on ${new Date().toLocaleDateString('en-IN')}`, {
          x: margin, y: 18, size: 7.5, font, color: rgb(0.5, 0.5, 0.5)
        });
      }

      const safeName = (event.name || 'Event').replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
      await downloadPdf(pdf, `Attendance_Report_${event.id}_${safeName}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      setSaveToast('❌ Failed to generate PDF report. Please try again.');
      setTimeout(() => setSaveToast(null), 3000);
    }
  };




  // Generate AI Final Report — displays inline, does NOT auto-download
  const handleGenerateAIFinalReport = async () => {
    setFinalReportLoading(true);
    setFinalReportError(null);
    setFinalReportGenerated(false);
    setFinalReportContent(null);
    setFinalReportData(null);
    try {
      // Refresh latest data first
      const [latestFeedback, latestAttendance] = await Promise.all([
        getEventFeedback(event.id),
        getEventAttendance(event.id),
      ]);
      setFeedbackRecords(latestFeedback);
      setAttendanceSummary(latestAttendance);

      // Call backend AI report generation
      const reportResponse = await generateAIFinalReport(event.id, event);
      setFinalReportData(reportResponse);
      setFinalReportContent(reportResponse.reportContent);
      setFinalReportGenerated(true);
    } catch (error: any) {
      console.error('AI Final Report generation failed:', error);
      setFinalReportError(
        error?.response?.data?.message || error?.message || 'Failed to generate AI report. Please try again.'
      );
    } finally {
      setFinalReportLoading(false);
    }
  };

  // Download Final Report as PDF — only triggered by explicit user action
  const handleDownloadFinalReportPDF = async () => {
    if (!finalReportContent) {
      window.alert('Generate the AI report first before downloading.');
      return;
    }
    setFinalReportDownloadLoading(true);
    try {
      const latestFeedback = feedbackRecords.length > 0 ? feedbackRecords : await getEventFeedback(event.id).catch(() => []);
      const pdf = await generateFinalEventReport(event, latestFeedback, finalReportContent);
      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${event.id || 'event'}-${new Date().toISOString().split('T')[0]}-final-report.pdf`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }, 500);
    } catch (error) {
      console.error('PDF download failed:', error);
      window.alert('Failed to download PDF. Please try again.');
    } finally {
      setFinalReportDownloadLoading(false);
    }
  };

  const createEventReportPdf = (records = feedbackRecords) => generateFinalEventReport(event, records);

  const createLegacyEventReportPdf = async () => {
    // Capture event data snapshot to prevent changes during generation
    const eventSnapshot = {
      id: event?.id || 'N/A',
      name: event?.name || 'Untitled Event',
      department: event?.department || 'N/A',
      date: event?.date || 'N/A',
      venue: event?.venue || 'N/A',
      objective: event?.objective || 'N/A',
      description: event?.description || 'N/A',
      actualParticipants: event?.actualParticipants || 0,
      attendance: event?.attendance || 0,
      feedbackScore: event?.feedbackScore || 0,
      coordinator: event?.coordinator || 'N/A',
      startTime: event?.startTime || 'N/A',
      endTime: event?.endTime || 'N/A',
      expectedParticipants: event?.expectedParticipants || 0,
    };

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4 size
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    
    let yPosition = 800;
    const margin = 40;
    const pageWidth = 595 - (2 * margin);

    // Helper function for text wrapping
    const drawText = (text: string, size: number, bold: boolean = false, color = rgb(0.12, 0.16, 0.23)) => {
      const selectedFont = bold ? boldFont : font;
      const words = text.split(' ');
      let line = '';
      const lineHeight = size + 4;

      words.forEach(word => {
        const testLine = line + (line ? ' ' : '') + word;
        const textWidth = testLine.length * (size * 0.5);
        
        if (textWidth > pageWidth && line) {
          page.drawText(line, { x: margin, y: yPosition, size, font: selectedFont, color });
          yPosition -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      });

      if (line) {
        page.drawText(line, { x: margin, y: yPosition, size, font: selectedFont, color });
        yPosition -= lineHeight;
      }
    };

    // Header
    drawText('ACADEMIC EVENT HUB', 16, true, rgb(0.22, 0.19, 0.51));
    drawText('EVENT REPORT', 14, true, rgb(0.22, 0.19, 0.51));
    yPosition -= 10;

    // Divider line
    page.drawLine({ start: { x: margin, y: yPosition }, end: { x: 595 - margin, y: yPosition }, thickness: 1, color: rgb(0.22, 0.19, 0.51) });
    yPosition -= 20;

    // Event Title
    drawText(`Event: ${eventSnapshot.name}`, 13, true);
    yPosition -= 8;

    // Event Details Grid
    drawText(`Department: ${eventSnapshot.department}`, 10, false);
    drawText(`Coordinator: ${eventSnapshot.coordinator}`, 10, false);
    drawText(`Date: ${eventSnapshot.date}`, 10, false);
    drawText(`Time: ${eventSnapshot.startTime} - ${eventSnapshot.endTime}`, 10, false);
    drawText(`Venue: ${eventSnapshot.venue}`, 10, false);
    yPosition -= 8;

    // Objective Section
    drawText('Objective', 11, true, rgb(0.22, 0.19, 0.51));
    drawText(eventSnapshot.objective, 9, false);
    yPosition -= 8;

    // Description Section
    drawText('Description', 11, true, rgb(0.22, 0.19, 0.51));
    drawText(eventSnapshot.description, 9, false);
    yPosition -= 10;

    // Divider
    page.drawLine({ start: { x: margin, y: yPosition }, end: { x: 595 - margin, y: yPosition }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    yPosition -= 12;

    // Statistics Section
    drawText('Event Statistics', 11, true, rgb(0.22, 0.19, 0.51));
    drawText(`Expected Participants: ${eventSnapshot.expectedParticipants}`, 9, false);
    drawText(`Actual Participants: ${eventSnapshot.actualParticipants}`, 9, false);
    drawText(`Attendance Rate: ${eventSnapshot.attendance}%`, 9, false);
    drawText(`Feedback Score: ${eventSnapshot.feedbackScore}/5.0`, 9, false);
    yPosition -= 12;

    // Footer
    drawText(`Report Generated: ${new Date().toLocaleString()}`, 8, false, rgb(0.6, 0.6, 0.6));
    drawText(`Document ID: ${eventSnapshot.id}`, 8, false, rgb(0.6, 0.6, 0.6));

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
    lines.forEach((line, index) => {
      if (line) {
        page.drawText(line.slice(0, 105), {
          x: 50, y: 770 - index * 25, size: index === 0 ? 18 : 11, font,
          color: index === 0 ? rgb(0.22, 0.19, 0.51) : rgb(0.12, 0.16, 0.23)
        });
      }
    });
    return pdf;
  };


  const downloadPdf = async (pdf: PDFDocument, filename: string) => {
    try {
      const bytes = await pdf.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }, 100);
    } catch (error) {
      console.error('PDF download error:', error);
      throw new Error('Failed to generate PDF download');
    }
    const bytes = await pdf.save();
    const objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleDownloadReport = async () => {
    if (!event) {
      window.alert('Event data not loaded. Please refresh the page.');
      return;
    }
    
    setReportDownloadLoading(true);
    try {
      const pdf = await createEventReportPdf();
      const filename = `${event.id || 'report'}-${new Date().toISOString().split('T')[0]}-event-report.pdf`;
      await downloadPdf(pdf, filename);
      // Optional: Show success message
      console.log('Report downloaded successfully:', filename);
    } catch (error) {
      console.error('Report download failed:', error);
      window.alert('Failed to download report. Please try again.');
    } finally {
      setReportDownloadLoading(false);
    }
  };

  const handleDownloadMergedReport = async (): Promise<boolean> => {
    if (!event) {
      window.alert('Event data not loaded. Please refresh the page.');
      return false;
    }
    
    setMergedReportLoading(true);
    try {
      const currentDocuments = await getEventDocuments(event.id);
      if (!currentDocuments.length) {
        window.alert('Upload documents for this event before generating the merged report.');
        return false;
      }
      const orderedIds = docOrder.flatMap(index => {
        const category = documentCategoryForDisplay(documents[index].name);
        return currentDocuments.filter(document => document.category === category).map(document => document.id);
      });
      const includedIds = new Set(orderedIds);
      currentDocuments.forEach(document => { if (!includedIds.has(document.id)) orderedIds.push(document.id); });
      const { bytes } = await generateMergedEventReport(event.id, orderedIds);
      const safeName = event.name.replace(/[^a-z0-9+]+/gi, '_').replace(/^_+|_+$/g, '') || event.id;
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      link.href = objectUrl;
      link.download = `${safeName}_Merged_Report.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setEventDocuments(currentDocuments);
      return true;
    } catch (error) {
      console.error('Merged report download failed:', error);
      const message = error && typeof error === 'object' && 'response' in error
        ? ((error.response as { data?: { message?: string } })?.data?.message || 'Unable to generate merged report. Please try again.')
        : 'Unable to generate merged report. Please try again.';
      window.alert(message);
      return false;
    } finally {
      setMergedReportLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!event) return;
    const confirmMsg = `Are you sure you want to delete "${event.name}"?\n\nWARNING: All event-related data will be permanently deleted including in the database (uploaded documents, attendance records, feedback forms, etc.).`;
    if (window.confirm(confirmMsg)) {
      try {
        await deleteEvent(event.id);
        alert(`Event "${event.name}" and all related data have been permanently deleted including in the database.`);
        navigate('all-events');
      } catch (err: any) {
        alert(`Failed to delete event: ${err.response?.data?.message || err.message}`);
      }
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('all-events')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            ← Back to Events
          </button>
          <button
            onClick={() => void handleDeleteEvent()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            🗑️ Delete Event
          </button>
        </div>
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
                    {name.split(' ').map((word: string) => word[0]).join('').slice(0, 2)}
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
                    onClick={() => setAttendanceRecords((prev) => prev.map((s) => ({ ...s, status: '' as AttendanceStatus })))}
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
                    className={`border-2 rounded-2xl p-6 text-center space-y-3 transition-all ${
                      hardCopyScanning
                        ? 'border-indigo-400 bg-indigo-50/50 shadow-inner'
                        : 'border-dashed border-indigo-200 bg-indigo-50/30 hover:border-indigo-400'
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!hardCopyScanning && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const droppedFiles = Array.from(e.dataTransfer.files);
                        setSelectedHardCopyFiles((prev) => [...prev, ...droppedFiles]);
                      }
                    }}
                  >
                    {hardCopyScanning ? (
                      <div className="max-w-md mx-auto space-y-3 py-2">
                        <div className="flex items-center justify-center gap-3">
                          <span className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin inline-block" />
                          <div className="text-left">
                            <div className="text-sm font-bold text-slate-800">
                              Scanning Hard Copy Attendance
                            </div>
                            <div className="text-xs text-indigo-600 font-medium">
                              {hardCopyProgressStage || 'Processing sheets with Multimodal AI Vision...'}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar and Percentage Indicator */}
                        <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-700 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                              AI Vision Progress
                            </span>
                            <span className="text-indigo-600 text-sm font-black tracking-tight">
                              {hardCopyProgressPercentage}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
                            <div
                              className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 h-full rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${hardCopyProgressPercentage}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                            <span className="truncate max-w-[200px]">{hardCopyFileName || 'Document sheets'}</span>
                            <span className="font-semibold text-indigo-700">{hardCopyProgressPercentage}% completed</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-5xl">📄</div>
                        <div className="text-slate-700 font-medium text-sm">
                          Drop physical attendance sheets here or click Browse & Add Sheets
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
                      </>
                    )}
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
                          disabled={hardCopyScanning}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold disabled:opacity-40"
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
                              disabled={hardCopyScanning}
                              className="text-slate-400 hover:text-rose-600 font-bold px-2 py-1 disabled:opacity-30"
                              title="Remove file"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        {hardCopyScanning && (
                          <div className="mb-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-sm space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-700 truncate max-w-[240px]">
                                {hardCopyProgressStage || 'Processing sheets...'}
                              </span>
                              <span className="text-indigo-600 text-xs font-black">{hardCopyProgressPercentage}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-indigo-500 to-violet-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${hardCopyProgressPercentage}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => handleHardCopyScanFile(selectedHardCopyFiles)}
                          disabled={hardCopyScanning}
                          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold shadow-md disabled:opacity-75 transition-all flex items-center justify-center gap-2"
                        >
                          {hardCopyScanning ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Processing... {hardCopyProgressPercentage}% completed</span>
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
                  <h4 className="font-semibold text-sm text-slate-800 flex items-center justify-between">
                    <span>Export & Templates</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 uppercase tracking-wider">Excel & PDF</span>
                  </h4>
                  <p className="text-xs text-slate-500">Download starter template or export full student attendance roster in Excel (.xlsx) or PDF (.pdf) format.</p>

                  <div className="flex flex-col gap-2.5">
                    {/* Excel Attendance Download */}
                    <button
                      onClick={handleExportAttendanceExcel}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      📊 Export Attendance Excel (.xlsx)
                    </button>

                    {/* PDF Attendance Download */}
                    <button
                      onClick={handleExportAttendancePdf}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      📄 Export Attendance Report (PDF)
                    </button>

                    {/* Template Downloads */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                      <button
                        onClick={handleDownloadStudentTemplateExcel}
                        className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        📥 Template (.xlsx)
                      </button>
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
                        className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        📄 Template (.csv)
                      </button>
                    </div>
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
                  <h2 className="text-xl font-bold font-heading text-indigo-900 tracking-wider">SONA COLLEGE OF TECHNOLOGY,SALEM</h2>
                  <p className="text-sm font-bold text-indigo-700">Department of Information Technology</p>
                  <p className="text-xs text-slate-500">Official Student On-Duty (OD) Recommendation Form</p>
                  <p className="text-xs text-slate-400 font-mono">Ref: OD/{event.academicYear || '2025-26'}/{event.id}</p>
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
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div><h3 className="font-bold font-heading text-slate-800">Student Feedback Form</h3><p className="text-sm text-slate-500 mt-0.5">Create the event-linked form students will see.</p></div>
              <select value={feedbackFormStatus} onChange={e => setFeedbackFormStatus(e.target.value as 'Draft' | 'Published' | 'Closed')} className="px-3 py-2 border border-slate-200 rounded-xl text-sm"><option>Draft</option><option>Published</option><option>Closed</option></select>
            </div>
            <input value={feedbackFormTitle} onChange={e => setFeedbackFormTitle(e.target.value)} placeholder="Form title" className="mt-4 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
            <div className="space-y-3 mt-3">{feedbackFormQuestions.map((question, index) => <div key={question.id} className="p-3 border border-slate-100 rounded-xl space-y-2"><div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center"><input value={question.text} onChange={e => setFeedbackFormQuestions(previous => previous.map(item => item.id === question.id ? { ...item, text: e.target.value } : item))} placeholder={`Question ${index + 1}`} className="px-3 py-2 border border-slate-200 rounded-xl text-sm" /><select value={question.type} onChange={e => setFeedbackFormQuestions(previous => previous.map(item => item.id === question.id ? { ...item, type: e.target.value as FeedbackQuestion['type'], options: e.target.value === 'multiple-choice' ? (item.options?.length ? item.options : ['']) : item.options } : item))} className="px-2 py-2 border border-slate-200 rounded-xl text-sm"><option value="text">Text</option><option value="rating">Rating</option><option value="yes-no">Yes / No</option><option value="multiple-choice">Multiple Choice</option></select><label className="text-xs text-slate-500 flex items-center gap-1"><input type="checkbox" checked={Boolean(question.required)} onChange={e => setFeedbackFormQuestions(previous => previous.map(item => item.id === question.id ? { ...item, required: e.target.checked } : item))} /> Required</label><button onClick={() => setFeedbackFormQuestions(previous => previous.filter(item => item.id !== question.id))} className="text-xs text-red-500">Remove</button></div>{question.type === 'multiple-choice' && <input value={(question.options || []).join(', ')} onChange={e => setFeedbackFormQuestions(previous => previous.map(item => item.id === question.id ? { ...item, options: e.target.value.split(',') } : item))} placeholder="Options separated by commas (e.g. Excellent, Good, Average)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />}</div>)}</div>
            <div className="flex gap-2 mt-4"><button onClick={addFeedbackQuestion} className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600">Add Question</button><button onClick={saveEventFeedbackForm} disabled={feedbackFormSaving} className="px-4 py-2 bg-indigo-600 disabled:bg-indigo-300 text-white rounded-xl text-sm font-semibold">{feedbackFormSaving ? 'Saving...' : 'Save Feedback Form'}</button></div>
            {feedbackFormMessage && <p className="text-sm mt-3 text-slate-600">{feedbackFormMessage}</p>}
          </div>
          {/* Submission stats */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold font-heading text-slate-800">Feedback Submissions</h3>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-700">
                {feedbackAnalyticsLoading ? 'Loading...' : `${feedbackAnalytics?.submittedStudents ?? 0} / ${feedbackAnalytics?.totalStudents ?? 0}`}
              </span>
            </div>
            <div className="mb-3">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${feedbackAnalytics?.submissionPercentage ?? 0}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {feedbackAnalyticsLoading ? 'Loading submission progress...' : `${feedbackAnalytics?.submittedStudents ?? 0} of ${feedbackAnalytics?.totalStudents ?? 0} students submitted feedback`}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-h-52 overflow-y-auto">
              {!feedbackRecords.length && !feedbackAnalytics?.totalResponses && <div className="text-sm text-slate-500">No feedback responses were recorded for this event.</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Summary */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-4">Feedback Summary</h3>
              <div className="text-center mb-5">
                <div className="text-5xl font-bold font-heading text-indigo-600">{feedbackAnalytics?.averageRating == null ? 'Not Available' : `${feedbackAnalytics.averageRating.toFixed(2)}/5`}</div>
                <div className="text-slate-400 text-sm mt-1">Average Rating / 5</div>
                <div className="flex justify-center gap-0.5 mt-2">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className={`text-xl ${feedbackOverallValues.length && i <= Math.round(feedbackOverallValues.reduce((sum, value) => sum + value, 0) / feedbackOverallValues.length) ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                  ))}
                </div>
                <div className="text-xs text-slate-400 mt-1">{feedbackAnalyticsLoading ? 'Loading responses...' : `${feedbackAnalytics?.totalResponses ?? feedbackRecords.length} total responses`}</div>
              </div>
              <div className="space-y-2">
                {feedbackDistribution.map(f => (
                  <div key={f.rating} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-12">{f.rating} Stars</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(feedbackAnalytics?.totalResponses || feedbackRecords.length) ? (f.count / (feedbackAnalytics?.totalResponses || feedbackRecords.length)) * 100 : 0}%` }} />
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
                {feedbackAnalytics?.questionAnalysis?.length ? feedbackAnalytics.questionAnalysis.map(q => (
                  <div key={q.id} className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{q.text}</span>
                      <span className="font-semibold text-slate-800">{q.type === 'rating' && q.average != null ? `${q.average.toFixed(2)}/5` : q.type === 'text' ? `${q.comments?.length || 0} responses` : 'Responses'}</span>
                    </div>
                    {q.type === 'rating' && <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${q.average == null ? 0 : q.average * 20}%` }} /></div>}
                    {q.distribution && <div className="flex flex-wrap gap-2 mt-2">{Object.entries(q.distribution).map(([option, count]) => <span key={option} className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{option}: {count}</span>)}</div>}
                  </div>
                )) : <p className="text-sm text-slate-500">{feedbackAnalyticsLoading ? 'Loading analysis...' : 'No published feedback form or responses are available.'}</p>}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold font-heading text-slate-800 mb-3">Student Comments</h3>
                <div className="space-y-3">
                  {feedbackComments.map((c, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
                        S{i+1}
                      </div>
                      <p className="text-sm text-slate-600">{c}</p>
                    </div>
                  ))}
                  {!feedbackComments.length && <p className="text-sm text-slate-500">{feedbackRecords.length ? 'No student comments were recorded.' : 'No feedback responses were recorded for this event.'}</p>}
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
              onClick={() => navigate('documentation', eventId)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium"
            >
              + Add Other Document
            </button>
          </div>
          {documentError && <p className="text-sm text-red-600">{documentError}</p>}

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
                {documentCategories.map((doc, i) => {
                  const uploaded = eventDocuments.find(item => item.category === doc.category || item.documentType === doc.category);
                  return (
                  <tr key={doc.category} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{doc.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${docStatusColors[uploaded?.status || 'Pending'] || docStatusColors.Pending}`}>{uploaded?.status || 'Pending'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {uploaded ? (
                          <>
                            <button onClick={() => openEventDocument(uploaded)} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">View</button>
                            <button onClick={() => downloadEventDocument(uploaded)} className="text-xs text-green-600 hover:text-green-800 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50">Download</button>
                            <button
                              onClick={() => beginDocumentUpload(doc.category, uploaded.name, uploaded.id)}
                              className="text-xs text-amber-600 hover:text-amber-800 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-50"
                            >
                              Replace
                            </button>
                            <button onClick={() => deleteEventDocumentRecord(uploaded)} className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">Delete</button>
                          </>
                        ) : (
                          <button
                            onClick={() => beginDocumentUpload(doc.category, doc.name)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50"
                          >
                            Upload Now
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {eventDocuments.filter(document => !documentCategories.some(item => item.category === document.category || item.category === document.documentType)).map((document, i) => (
                  <tr key={document.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400 text-xs">{documentCategories.length + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{document.name}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{document.status || 'Uploaded'}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEventDocument(document)} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg">View</button><button onClick={() => downloadEventDocument(document)} className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg">Download</button><button onClick={() => deleteEventDocumentRecord(document)} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg">Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'final-report' && (
        <div className="space-y-4">
          {!finalReportGenerated ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center space-y-4">
              <div className="text-5xl mb-2">✨</div>
              <h3 className="text-xl font-bold font-heading text-slate-800">AI Final Report Generator</h3>
              <p className="text-slate-500 text-sm max-w-lg mx-auto">
                Generate a comprehensive, AI-analyzed event report combining event overview, attendance statistics, student feedback analytics, and uploaded documents.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleGenerateAIFinalReport}
                  disabled={finalReportLoading}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm disabled:opacity-60 transition-all hover:shadow-md"
                >
                  {finalReportLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating AI Report...
                    </span>
                  ) : '✨ Generate AI Final Report'}
                </button>
              </div>
              {finalReportError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm max-w-md mx-auto">
                  {finalReportError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-semibold text-slate-700">AI Report Ready</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleDownloadFinalReportPDF}
                    disabled={finalReportDownloadLoading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-60 flex items-center gap-2"
                  >
                    {finalReportDownloadLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Preparing PDF...
                      </span>
                    ) : '⬇ Download PDF'}
                  </button>
                  <button
                    onClick={handleGenerateAIFinalReport}
                    disabled={finalReportLoading}
                    className="px-4 py-2.5 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-50 disabled:opacity-60 flex items-center gap-2"
                  >
                    {finalReportLoading ? 'Generating...' : '🔄 Regenerate Report'}
                  </button>
                </div>
              </div>

              {/* Inline Report View */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 space-y-6">
                {/* Header Branding */}
                <div className="text-center border-b-2 border-indigo-600 pb-6 space-y-1">
                  <h1 className="text-2xl font-bold font-heading text-indigo-900 tracking-wider">SONA COLLEGE OF TECHNOLOGY,SALEM</h1>
                  <h2 className="text-base font-bold text-indigo-700">Department of Information Technology</h2>
                  <div className="pt-3">
                    <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-800 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-200">
                      FINAL EVENT REPORT
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 pt-2">{event.name}</h3>
                  <p className="text-xs text-slate-500">
                    {event.type && `Type: ${event.type}`}
                    {event.date && ` | Date: ${event.date}`}
                    {event.startTime && event.endTime && ` | Time: ${event.startTime} - ${event.endTime}`}
                    {event.venue && ` | Venue: ${event.venue}`}
                  </p>
                </div>

                {/* AI Content Sections */}
                {finalReportContent && (
                  <div className="space-y-6 text-slate-700 text-sm">
                    {/* Event Overview */}
                    {finalReportContent.eventOverview && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-1 text-base">1. Event Overview</h4>
                        <p className="leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{finalReportContent.eventOverview}</p>
                      </div>
                    )}

                    {/* Event Objectives */}
                    {finalReportContent.eventObjectives && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-1 text-base">2. Objectives</h4>
                        <p className="leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{finalReportContent.eventObjectives}</p>
                      </div>
                    )}

                    {/* Resource Person */}
                    {finalReportContent.resourcePerson && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-1 text-base">3. Resource Person Details</h4>
                        <p className="leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{finalReportContent.resourcePerson}</p>
                      </div>
                    )}

                    {/* Attendance Analysis */}
                    {finalReportContent.attendanceAnalysis && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-1 text-base">4. Attendance Summary & Analysis</h4>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                          <p className="leading-relaxed">{finalReportContent.attendanceAnalysis.summary}</p>
                          {finalReportContent.attendanceAnalysis.statistics && (
                            <div className="p-3 bg-white rounded-lg border border-slate-200 font-mono text-xs font-semibold text-indigo-900">
                              {finalReportContent.attendanceAnalysis.statistics}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Feedback Analysis */}
                    {finalReportContent.feedbackAnalysis && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-1 text-base">5. Feedback Analysis (Primary Evaluation)</h4>
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-3">
                          <p className="leading-relaxed">{finalReportContent.feedbackAnalysis.overview}</p>
                          {finalReportContent.feedbackAnalysis.ratingsSummary && (
                            <p className="font-medium text-slate-800">{finalReportContent.feedbackAnalysis.ratingsSummary}</p>
                          )}
                          {finalReportContent.feedbackAnalysis.positiveObservations && finalReportContent.feedbackAnalysis.positiveObservations.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-emerald-800 mb-1">Positive Highlights:</h5>
                              <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                                {finalReportContent.feedbackAnalysis.positiveObservations.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {finalReportContent.feedbackAnalysis.studentSentiment && (
                            <p className="text-xs italic text-slate-600 border-t border-slate-200 pt-2">
                              <strong>Student Sentiment:</strong> {finalReportContent.feedbackAnalysis.studentSentiment}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Strengths */}
                    {finalReportContent.eventStrengths && finalReportContent.eventStrengths.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-1 text-base">6. Key Strengths</h4>
                        <ul className="bg-slate-50 p-4 rounded-xl border border-slate-100 list-disc list-inside space-y-1.5">
                          {finalReportContent.eventStrengths.map((item, idx) => (
                            <li key={idx} className="leading-relaxed">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Areas for Improvement */}
                    {finalReportContent.areasForImprovement && finalReportContent.areasForImprovement.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-1 text-base">7. Areas for Improvement</h4>
                        <ul className="bg-slate-50 p-4 rounded-xl border border-slate-100 list-disc list-inside space-y-1.5">
                          {finalReportContent.areasForImprovement.map((item, idx) => (
                            <li key={idx} className="leading-relaxed">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {finalReportContent.recommendations && finalReportContent.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-1 text-base">8. Actionable Recommendations</h4>
                        <ul className="bg-slate-50 p-4 rounded-xl border border-slate-100 list-disc list-inside space-y-1.5">
                          {finalReportContent.recommendations.map((item, idx) => (
                            <li key={idx} className="leading-relaxed">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Overall Assessment */}
                    {finalReportContent.overallAssessment && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-indigo-900 border-b border-slate-100 pb-1 text-base">9. Overall Assessment & Conclusion</h4>
                        <p className="leading-relaxed bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 font-medium text-slate-800">{finalReportContent.overallAssessment}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Official Signatures */}
                <div className="border-t border-slate-200 pt-8 mt-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center text-sm">
                    <div>
                      <div className="h-14 border-b border-slate-300 mb-2 flex items-end justify-center pb-1">
                        <span className="font-semibold text-slate-800">{event.coordinator || ''}</span>
                      </div>
                      <div className="font-bold text-slate-800">Event Coordinator</div>
                    </div>
                    <div>
                      <div className="h-14 border-b border-slate-300 mb-2" />
                      <div className="font-bold text-slate-800">Head of Department</div>
                    </div>
                    <div>
                      <div className="h-14 border-b border-slate-300 mb-2" />
                      <div className="font-bold text-slate-800">Principal / Authorized Signatory</div>
                    </div>
                  </div>
                </div>
              </div>
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
                    const matchingDocuments = eventDocuments.filter(document => document.category === documentCategoryForDisplay(doc.name));
                    const hasFile = matchingDocuments.length > 0;
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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${docStatusColors[matchingDocuments[0]?.status || 'Pending'] || docStatusColors.Pending}`}>{matchingDocuments[0]?.status || 'Pending'}</span>
                        {!hasFile && <span className="text-xs text-slate-400 italic">Not uploaded — will be skipped</span>}
                        {matchingDocuments.length > 1 && <span className="text-xs text-slate-400">{matchingDocuments.length} files</span>}
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
                  onClick={async () => { const generated = await handleDownloadMergedReport(); setMergedReportGenerated(generated); }}
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
                  </>
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold font-heading text-slate-800 mb-4">Merged Documents</h3>
                <div className="space-y-2 mb-5">
                  {docOrder.filter(i => eventDocuments.some(document => document.category === documentCategoryForDisplay(documents[i].name))).map((docIdx, pos) => (
                    <div key={docIdx} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">{pos + 1}</span>
                      <span className="text-sm text-slate-800 font-medium">{documents[docIdx].name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{eventDocuments.filter(document => document.category === documentCategoryForDisplay(documents[docIdx].name)).map(document => document.name).join(', ')}</span>
                    </div>
                  ))}
                </div>

                {mergedReportGenerated ? (
                  <div className="border border-indigo-200 rounded-2xl overflow-hidden">
                    <div className="p-6 text-sm text-slate-700 bg-white">
                      <p>The merged PDF contains only the original uploaded PDF and image files for this event. Original pages, formatting, colors, signatures, and images are preserved.</p>
                      <p className="text-xs text-slate-500 mt-3">Download completed as {event.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_Merged_Report.pdf</p>
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
                <label className="text-xs text-slate-500 mb-1 block">Document Category</label>
                <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                  {documentCategories.map(item => <option key={item.category} value={item.category}>{item.name}</option>)}
                </select>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                <div className="text-2xl mb-2">📁</div>
                <div className="text-sm text-slate-600">Drop files here or click to browse</div>
                <div className="text-xs text-slate-400 mt-1">PDF, DOC, XLSX, JPG, PNG supported</div>
                <input id="event-document-files" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.doc,.docx" multiple className="hidden" onChange={e => setUploadFiles(Array.from(e.target.files || []))} />
                <label htmlFor="event-document-files" className="inline-block mt-3 px-4 py-1.5 bg-indigo-600 text-white text-xs rounded-xl cursor-pointer">Browse Files</label>
                {uploadFiles.length > 0 && <div className="text-xs text-green-600 mt-2">{uploadFiles.length} file(s) selected: {uploadFiles[0].name}</div>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowUploadModal(false); setUploadFiles([]); setReplaceDocumentId(null); }} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
                <button
                  onClick={async () => {
                    const file = uploadFiles[0];
                    if (!file) { setDocumentError('Select a file before uploading.'); return; }
                    try {
                      if (replaceDocumentId) await replaceEventDocument(replaceDocumentId, file, uploadDocName || file.name);
                      else await uploadEventDocument(eventId, file, uploadCategory, uploadDocName || file.name);
                      await refreshEventDocuments();
                      setUploadFiles([]);
                      setReplaceDocumentId(null);
                      setShowUploadModal(false);
                    } catch { setDocumentError('Unable to save this document. Please try again.'); }
                  }}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium"
                >Upload Document</button>
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
                  <select
                    value={addStudentForm.department || 'Information Technology'}
                    onChange={(e) => setAddStudentForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-slate-50 font-medium text-slate-800 text-xs"
                  >
                    <option value="Information Technology">Information Technology</option>
                    <option value="Artificial Intelligence and Data Science">Artificial Intelligence and Data Science</option>
                  </select>
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
                  disabled={addingStudentLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  {addingStudentLoading ? (
                    <>
                      <span className="animate-spin text-sm">⏳</span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>➕ Add Student</span>
                  )}
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
