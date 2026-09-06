import { useEffect, useState } from 'react';
import type { EventRecord, Page } from '../types';
import { sampleEvents } from '../data/sampleData';
import { eventTypeColors } from './Dashboard';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { generateFinalEventReport } from '../utils/finalEventReportGenerator';
import { getEventAttendance, getEventDocumentBytes, getEventDocuments, getEventFeedback, type EventAttendanceSummary, type EventDocumentRecord, type EventFeedbackRecord } from '../services/api';

interface EventDetailsProps {
  eventId: string;
  navigate: (page: Page, eventId?: string) => void;
}   

type Tab = 'overview' | 'attendance' | 'feedback' | 'documents' | 'ai-analysis' | 'final-report' | 'merged-report';
type MergeItem = EventDocumentRecord & { localFile?: File };

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

export default function EventDetails({ eventId, navigate }: EventDetailsProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [attendanceFilter, setAttendanceFilter] = useState<'All' | 'P' | 'A' | 'OD'>('All');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [studentStatuses, setStudentStatuses] = useState<Record<string, 'P' | 'A' | 'OD'>>(
    Object.fromEntries(students.map(s => [s.reg, s.status]))
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportDownloadLoading, setReportDownloadLoading] = useState(false);
  const [showOtherDocModal, setShowOtherDocModal] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState<'online' | 'hardcopy'>('online');
  const [hardCopyUploaded, setHardCopyUploaded] = useState(false);
  const [hardCopyStatuses, setHardCopyStatuses] = useState<Record<string, 'P' | 'A'>>(
    Object.fromEntries(students.map(s => [s.reg, 'A' as const]))
  );
  const [googleFormLink, setGoogleFormLink] = useState('');
  const [docOrder, setDocOrder] = useState<number[]>(documents.map((_, i) => i));
  const [mergedReportGenerated, setMergedReportGenerated] = useState(false);
  const [mergedReportLoading, setMergedReportLoading] = useState(false);
  const [showArrangeStep, setShowArrangeStep] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [feedbackRecords, setFeedbackRecords] = useState<EventFeedbackRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<EventAttendanceSummary | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const event = sampleEvents.find(e => e.id === eventId) || sampleEvents[0];
  useEffect(() => {
    let active = true;
    setFeedbackLoading(true);
    setFeedbackError(null);
    getEventFeedback(eventId)
      .then(records => { if (active) setFeedbackRecords(records); })
      .catch(error => { console.error('Feedback lookup failed:', error); if (active) setFeedbackError('Unable to load feedback records.'); })
      .finally(() => { if (active) setFeedbackLoading(false); });
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
  const feedbackDistribution = [5, 4, 3, 2, 1].map(rating => ({ rating, count: feedbackOverallValues.filter(value => Math.round(value) === rating).length }));
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
  const feedbackComments = feedbackRecords
    .map(record => record.comment || record.comments || record.response)
    .filter((comment): comment is string => typeof comment === 'string' && comment.trim().length > 0);
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

  const handleGenAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const [latestFeedback, latestAttendance] = await Promise.all([
        getEventFeedback(event.id),
        getEventAttendance(event.id),
      ]);
      setFeedbackRecords(latestFeedback);
      setAttendanceSummary(latestAttendance);
      setAiAnalysis(buildAiAnalysis(event, latestAttendance, latestFeedback));
      setAiGenerated(true);
    } catch (error) {
      console.error('AI analysis data lookup failed:', error);
      setAiError('Unable to load the selected event attendance and feedback data.');
    } finally {
      setAiLoading(false);
    }
  };
  const handleGenReport = async () => {
    setReportLoading(true);
    try {
      const latestFeedback = await getEventFeedback(event.id);
      setFeedbackRecords(latestFeedback);
      const pdf = await createEventReportPdf(latestFeedback);
      await downloadPdf(pdf, `${event.id || 'event'}-final-report.pdf`);
      setReportGenerated(true);
    } catch (error) {
      console.error('Final report generation failed:', error);
      window.alert('Failed to generate the final report. Please try again.');
    } finally {
      setReportLoading(false);
    }
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

    return pdf;
  };

  const createEventReportPdf = (records = feedbackRecords) => generateFinalEventReport(event, records);

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
      const mergedPdf = await PDFDocument.create();
      const remoteDocuments: EventDocumentRecord[] = await getEventDocuments(event.id).catch(error => {
        console.error('Event document lookup failed:', error);
        return [];
      });
      const localDocuments: MergeItem[] = docOrder.flatMap(index => (uploadedFiles[documents[index].name] || []).map(file => ({
        id: `local-${index}-${file.name}`,
        name: file.name,
        type: file.type,
        url: '',
        category: documents[index].name,
        uploadedDate: new Date().toISOString(),
        localFile: file,
        order: index,
      })));
      const mergeItems: MergeItem[] = [
        ...remoteDocuments.map(file => ({ ...file, order: file.order ?? 0 })),
        ...localDocuments.map(file => ({ ...file, order: file.order + remoteDocuments.length })),
      ].sort((left, right) => left.order - right.order);

      if (!mergeItems.length) {
        window.alert('No documents or photos have been uploaded for this event.');
        return false;
      }

      let mergedPageCount = 0;
      const skippedFiles: string[] = [];
      for (const file of mergeItems) {
        const bytes = file.localFile ? await file.localFile.arrayBuffer() : await getEventDocumentBytes(file.url);
        const fileType = (file.type || '').toLowerCase();
        const fileName = file.name.toLowerCase();
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
          const sourcePdf = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
          pages.forEach(sourcePage => { mergedPdf.addPage(sourcePage); mergedPageCount += 1; });
        } else if (fileType === 'image/jpeg' || fileType === 'image/jpg' || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
          const image = await mergedPdf.embedJpg(bytes);
          const page = mergedPdf.addPage([595, 842]);
          const scale = Math.min(555 / image.width, 790 / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          page.drawImage(image, { x: (595 - width) / 2, y: (842 - height) / 2, width, height });
          mergedPageCount += 1;
        } else if (fileType === 'image/png' || fileName.endsWith('.png')) {
          const image = await mergedPdf.embedPng(bytes);
          const page = mergedPdf.addPage([595, 842]);
          const scale = Math.min(555 / image.width, 790 / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          page.drawImage(image, { x: (595 - width) / 2, y: (842 - height) / 2, width, height });
          mergedPageCount += 1;
        } else {
          skippedFiles.push(file.name);
        }
      }

      if (!mergedPageCount) {
        window.alert('No documents or photos have been uploaded for this event.');
        return false;
      }
      const filename = `${event.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_Merged_Report.pdf`;
      await downloadPdf(mergedPdf, filename);
      if (skippedFiles.length) {
        window.alert(`Merged PDF created. These original files remain available for download but could not be converted to PDF pages: ${skippedFiles.join(', ')}`);
      }
      console.log('Merged report downloaded successfully:', filename);
      return true;
    } catch (error) {
      console.error('Merged report download failed:', error);
      window.alert('Failed to download merged report. Please try again.');
      return false;
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
                {feedbackRecords.length} responses recorded
              </span>
            </div>
            <div className="mb-3">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${feedbackOverallValues.length ? (feedbackOverallValues.filter(value => value >= 4).length / feedbackOverallValues.length) * 100 : 0}%` }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {feedbackHighRating} of recorded ratings are 4 or above
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-h-52 overflow-y-auto">
              {feedbackRecords.length ? <div className="text-sm text-slate-600">Feedback records are linked to event ID <strong>{event.id}</strong> and are used by the Final Report and AI Analysis.</div> : <div className="text-sm text-slate-500">No feedback responses were recorded for this event.</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Summary */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-4">Feedback Summary</h3>
              <div className="text-center mb-5">
                <div className="text-5xl font-bold font-heading text-indigo-600">{feedbackAverage(feedbackRecords, 'overallRating', 'overall', 'rating', 'overallScore')}</div>
                <div className="text-slate-400 text-sm mt-1">Average Rating / 5</div>
                <div className="flex justify-center gap-0.5 mt-2">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className={`text-xl ${feedbackOverallValues.length && i <= Math.round(feedbackOverallValues.reduce((sum, value) => sum + value, 0) / feedbackOverallValues.length) ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                  ))}
                </div>
                <div className="text-xs text-slate-400 mt-1">{feedbackRecords.length} total responses</div>
              </div>
              <div className="space-y-2">
                {feedbackDistribution.map(f => (
                  <div key={f.rating} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-12">{f.rating} Stars</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${feedbackRecords.length ? (f.count / feedbackRecords.length) * 100 : 0}%` }} />
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
                {feedbackQuestions.map(q => (
                  <div key={q.q} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{q.q}</span>
                      <span className="font-semibold text-slate-800">{q.average}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${q.average === 'Not Available' ? 0 : Number(q.average.split('/')[0]) * 20}%` }} />
                    </div>
                  </div>
                ))}
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
              {aiError && <p className="text-sm text-red-600 mt-4">{aiError}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🤖</span>
                  <span className="font-bold font-heading text-indigo-800">AI-Generated Executive Summary</span>
                  <span className="ml-auto text-xs text-indigo-400">Generated just now</span>
                </div>
                <p className="text-sm text-slate-700 mt-2">{aiAnalysis?.executiveSummary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 md:col-span-2">
                  <h4 className="font-semibold text-slate-800 mb-3">Event Data Used</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-600">
                    <p><strong>Event:</strong> {event.name}</p><p><strong>Type:</strong> {event.type}</p>
                    <p><strong>Department:</strong> {event.department}</p><p><strong>Date:</strong> {event.date}</p>
                    <p><strong>Venue:</strong> {event.venue}</p><p><strong>Coordinator:</strong> {event.coordinator}</p>
                    <p className="md:col-span-2"><strong>Objective:</strong> {event.objective || 'Not Available'}</p>
                    <p className="md:col-span-2"><strong>Topics Covered:</strong> {reportTopics}</p>
                  </div>
                </div>
                {[
                  { title: 'A. Overall Event Performance', items: [aiAnalysis?.overallPerformance || 'Not Available'] },
                  { title: 'B. Attendance Analysis', items: [aiAnalysis?.attendance || 'Not Available', `Expected: ${attendanceSummary?.expectedParticipants ?? 'Not Available'}`, `Actual: ${attendanceSummary?.actualParticipants ?? 'Not Available'}`, `Present: ${attendanceSummary?.present ?? 'Not Available'}`, `Absent: ${attendanceSummary?.absent ?? 'Not Available'}`, `Attendance: ${attendanceSummary?.attendancePercentage === undefined ? 'Not Available' : `${attendanceSummary.attendancePercentage.toFixed(1)}%`}`] },
                  { title: 'C. Feedback Analysis', items: [aiAnalysis?.feedback || 'Not Available', `Overall rating: ${feedbackAverage(feedbackRecords, 'overallRating', 'overall', 'rating', 'overallScore')}`, `Session content: ${feedbackAverage(feedbackRecords, 'sessionContentRating', 'contentRating', 'content', 'sessionContent')}`, `Speaker effectiveness: ${feedbackAverage(feedbackRecords, 'speakerEffectivenessRating', 'speakerRating', 'speakerEffectiveness', 'speaker')}`, `Usefulness: ${feedbackAverage(feedbackRecords, 'usefulnessToStudents', 'usefulnessRating', 'usefulness', 'relevanceRating')}`, `Overall satisfaction/response: ${feedbackAverage(feedbackRecords, 'overallSatisfaction', 'satisfactionRating', 'satisfaction') === 'Not Available' ? feedbackText(feedbackRecords, 'overallSatisfaction', 'satisfactionResponse', 'response') : feedbackAverage(feedbackRecords, 'overallSatisfaction', 'satisfactionRating', 'satisfaction')}`, `Positive ratings: ${feedbackHighRating}`] },
                  { title: 'D. Key Strengths', items: aiAnalysis?.strengths || [] },
                  { title: 'E. Areas for Improvement', items: aiAnalysis?.improvements || [] },
                  { title: 'F. Key Outcomes', items: aiAnalysis?.outcomes || [] },
                  { title: 'G. Recommendations', items: aiAnalysis?.recommendations || [] },
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

              {Object.keys(attendanceSummary?.departmentParticipation || {}).length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h4 className="font-semibold text-slate-800 mb-3">Department-wise Participation</h4>
                  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100 text-left"><th className="py-2">Department</th><th className="py-2">Present</th><th className="py-2">Absent</th><th className="py-2">Total</th></tr></thead><tbody>{Object.entries(attendanceSummary?.departmentParticipation || {}).map(([department, values]) => <tr key={department} className="border-b border-slate-50"><td className="py-2">{department}</td><td className="py-2">{values.present}</td><td className="py-2">{values.absent}</td><td className="py-2">{values.total}</td></tr>)}</tbody></table></div>
                </div>
              )}

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h4 className="font-semibold text-slate-800 mb-2">Student Comments</h4>
                {feedbackRecords.length === 0 ? <p className="text-sm text-slate-500">No feedback responses were recorded for this event.</p> : feedbackComments.length ? feedbackComments.map((comment, index) => <p key={`${comment}-${index}`} className="text-sm text-slate-600 border-b border-slate-50 py-2">{comment}</p>) : <p className="text-sm text-slate-500">No student comments were recorded.</p>}
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
                <div className="font-bold text-lg font-heading text-slate-900">ACADEMIC EVENT HUB</div>
                <div className="text-slate-600">Department: {reportValue(event.department)}</div>
                <div className="mt-3 font-bold text-base font-heading text-indigo-700">FINAL EVENT REPORT</div>
                <div className="text-slate-600 text-sm mt-1">{reportValue(event.name)}</div>
                <div className="text-slate-500 text-xs mt-1">Date: {reportValue(event.date)} | Time: {event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : 'Not Available'} | Venue: {reportValue(event.venue)}</div>
              </div>

              {reportSections.map(section => (
                <div key={section.num}>
                  <h4 className="font-bold font-heading text-slate-800 mb-2">{section.num}. {section.title}</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{section.content}</p>
                </div>
              ))}

              {/* Signatures */}
              <div className="border-t border-slate-200 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center text-sm text-slate-600">
                  <div>
                    <div className="h-12 border-b border-slate-300 mb-2" />
                    <div className="font-medium">{reportValue(event.coordinator)}</div>
                    <div className="text-xs text-slate-400">Event Coordinator</div>
                  </div>
                  <div>
                    <div className="h-12 border-b border-slate-300 mb-2" />
                    <div className="font-medium">Not Available</div>
                    <div className="text-xs text-slate-400">Head of Department</div>
                  </div>
                  <div>
                    <div className="h-12 border-b border-slate-300 mb-2" />
                    <div className="font-medium">Not Available</div>
                    <div className="text-xs text-slate-400">Principal / Authorized Signatory</div>
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
                    const hasFile = (uploadedFiles[doc.name] || []).length > 0;
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
                    <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">🖨️ Print</button>
                  </>
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold font-heading text-slate-800 mb-4">Merge Order Confirmed</h3>
                <div className="space-y-2 mb-5">
                  {docOrder.filter(i => (uploadedFiles[documents[i].name] || []).length > 0).map((docIdx, pos) => (
                    <div key={docIdx} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">{pos + 1}</span>
                      <span className="text-sm text-slate-800 font-medium">{documents[docIdx].name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{(uploadedFiles[documents[docIdx].name] || []).map(file => file.name).join(', ')}</span>
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
    </div>
  );
}
