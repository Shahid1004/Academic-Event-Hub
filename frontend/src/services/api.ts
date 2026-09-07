import axios from 'axios';
import type { AppSettings, AttendanceStatus, AttendanceSummary, CreateEventPayload, DashboardSummary, EventRecord, StudentAttendanceRecord, UserProfile } from '../types';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

export interface EventFeedbackRecord {
  id?: string;
  _id?: string;
  eventId?: string;
  overallRating?: number;
  sessionContentRating?: number;
  speakerEffectivenessRating?: number;
  usefulnessToStudents?: number;
  overallSatisfaction?: number;
  response?: string;
  comment?: string;
  comments?: string;
  [key: string]: unknown;
}

export async function getEventFeedback(eventId: string) {
  const response = await axios.get<{ success: boolean; data: EventFeedbackRecord[] }>(
    `${apiUrl}/api/feedback/event/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data.data || [];
}

export interface EventAttendanceSummary {
  source: 'attendance-records' | 'event-record';
  expectedParticipants?: number;
  actualParticipants?: number;
  present?: number;
  absent?: number;
  attendancePercentage?: number;
  departmentParticipation?: Record<string, { present: number; absent: number; total: number }>;
}

export async function getEventAttendance(eventId: string) {
  const response = await axios.get<{ success: boolean; data: EventAttendanceSummary }>(
    `${apiUrl}/api/attendance/event/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data.data;
}

export interface EventDocumentRecord {
  id: string;
  documentId?: string;
  eventId?: string;
  name: string;
  documentName?: string;
  fileName?: string;
  type: string;
  mimeType?: string;
  url: string;
  fileUrl?: string;
  order: number;
  category: string;
  documentType?: string;
  size?: number;
  status?: string;
  uploadedDate: string;
  uploadedAt?: string;
}

export async function getEventDocuments(eventId: string) {
  const response = await axios.get<{ success: boolean; data: EventDocumentRecord[] }>(
    `${apiUrl}/api/event-documents/event/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data.data || [];
}

export async function uploadEventDocument(eventId: string, file: File, category: string, documentName: string, onProgress?: (value: number) => void) {
  const body = new FormData();
  body.append('file', file);
  body.append('eventId', eventId);
  body.append('category', category);
  body.append('documentType', category);
  body.append('documentName', documentName);
  const response = await axios.post<{ success: boolean; data: EventDocumentRecord }>(
    `${apiUrl}/api/event-documents/event/${encodeURIComponent(eventId)}`, body,
    { headers: { Authorization: `Bearer ${getToken()}` }, onUploadProgress: progress => onProgress?.(progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0) }
  );
  if (!response.data?.data) throw new Error('Upload succeeded but the server returned no document record.');
  return response.data.data;
}

export async function deleteEventDocument(documentId: string) {
  await axios.delete(`${apiUrl}/api/event-documents/${encodeURIComponent(documentId)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
}

export async function getEventDocumentBytes(url: string) {
  const resolvedUrl = /^https?:\/\//i.test(url) ? url : `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  const response = await axios.get<ArrayBuffer>(resolvedUrl, {
    responseType: 'arraybuffer',
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  return response.data;
}

export async function getDashboardSummary(academicYear?: string, department = 'ALL') {
  const response = await axios.get<{ success: boolean; data: DashboardSummary }>(
    `${apiUrl}/api/dashboard/summary`,
    {
      params: { academicYear: academicYear || undefined, department },
      headers: { Authorization: `Bearer ${getToken()}` }
    }
  );
  return response.data.data;
}

export async function getEvents(params: Record<string, string | undefined> = {}) {
  const response = await axios.get<{ success: boolean; data: EventRecord[] }>(
    `${apiUrl}/api/events`,
    { params, headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data.data.map((event) => ({
    ...event,
    date: event.date ? event.date.slice(0, 10) : '',
    dateTo: event.dateTo ? event.dateTo.slice(0, 10) : event.date ? event.date.slice(0, 10) : '',
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    venue: event.venue || '',
    sponsoredBy: event.sponsoredBy || '',
    coordinator: event.coordinator || '',
    resourcePerson: {
      name: event.resourcePerson?.name || '',
      designation: event.resourcePerson?.designation || '',
      organization: event.resourcePerson?.organization || '',
      contact: event.resourcePerson?.contact || '',
      email: event.resourcePerson?.email || '',
    },
    actualParticipants: event.actualParticipants || 0,
    attendance: event.attendance || 0,
    feedbackScore: event.feedbackScore || 0,
    docStatus: event.docStatus || 'Pending',
    reportStatus: event.reportStatus || 'Not Generated',
  }));
}

export async function getCalendarEvents(params: Record<string, string | undefined> = {}) {
  const response = await axios.get<{ success: boolean; data: EventRecord[] }>(
    `${apiUrl}/api/events/calendar`,
    { params, headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data.data.map((event) => ({
    ...event,
    date: event.date ? event.date.slice(0, 10) : '',
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    venue: event.venue || '',
    status: event.status || 'Upcoming',
  }));
}

export async function createEvent(payload: CreateEventPayload) {
  const response = await axios.post<{ success: boolean; data: EventRecord }>(
    `${apiUrl}/api/events`, payload,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data.data;
}

export async function getSettings() {
  const response = await axios.get<{ settings: AppSettings; profile: UserProfile }>(
    `${apiUrl}/api/settings`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data;
}

export async function updateSettings(settings: Partial<AppSettings>) {
  const response = await axios.patch<{ settings: AppSettings }>(
    `${apiUrl}/api/settings`, settings,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data.settings;
}

export async function updateProfile(profile: Partial<UserProfile>) {
  const response = await axios.patch<{ profile: UserProfile }>(
    `${apiUrl}/api/settings/profile`, profile,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data.profile;
}

export async function getUsers() {
  const response = await axios.get<{ users: UserProfile[] }>(
    `${apiUrl}/api/users`,
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return response.data.users;
}

export async function getEventAttendanceApi(eventId: string) {
  try {
    const response = await axios.get<{
      success: boolean;
      data: { eventId: string; summary: AttendanceSummary; records: StudentAttendanceRecord[] };
    }>(`${apiUrl}/api/attendance/event/${eventId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.data.data;
  } catch (err) {
    console.warn('API getEventAttendance failed, using local mode fallback:', err);
    return null;
  }
}

export async function saveEventAttendanceApi(eventId: string, records: StudentAttendanceRecord[]) {
  try {
    const response = await axios.post<{
      success: boolean;
      summary: AttendanceSummary;
      records: StudentAttendanceRecord[];
    }>(`${apiUrl}/api/attendance/event/${eventId}/batch`, { records }, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.data;
  } catch (err) {
    console.warn('API saveEventAttendance failed, using local mode fallback:', err);
    return null;
  }
}

export async function importEventAttendanceRosterApi(eventId: string, students: Array<{ regNo: string; studentName: string; department?: string; className?: string }>) {
  try {
    const token = getToken();
    if (!token) {
      console.error('No authentication token found. Please log in again.');
      return { success: false, message: 'Authentication required. Please log in again.' };
    }

    const response = await axios.post<{
      success: boolean;
      message: string;
      data: {
        importedCount: number;
        duplicates: Array<{ regNo: string; studentName: string; reason: string }>;
        invalidRows: Array<{ row: Record<string, string>; reason: string }>;
        existingMatches: number;
        summary: AttendanceSummary;
        records: StudentAttendanceRecord[];
      };
    }>(`${apiUrl}/api/attendance/event/${eventId}/import`, { students }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || 'Failed to import student roster';
    const statusCode = err.response?.status;
    console.error(`API importEventAttendanceRoster failed [${statusCode}]:`, errorMessage);
    return { success: false, message: errorMessage };
  }
}

export async function qrCheckInApi(eventId: string, regNo: string, studentName?: string) {
  try {
    const response = await axios.post<{
      success: boolean;
      message: string;
      data: StudentAttendanceRecord;
    }>(`${apiUrl}/api/attendance/event/${eventId}/qr-checkin`, { regNo, studentName });
    return response.data;
  } catch (err) {
    console.warn('API qrCheckIn failed, using local mode fallback:', err);
    return null;
  }
}

export async function scanHardCopyAttendanceApi(filesInput?: File | File[], sheetType: 'signed' | 'participant_list' = 'signed', eventId?: string) {
  try {
    const token = getToken();
    const formData = new FormData();

    if (Array.isArray(filesInput)) {
      filesInput.forEach((f) => formData.append('files', f));
      if (filesInput.length > 0) {
        formData.append('file', filesInput[0]);
      }
    } else if (filesInput) {
      formData.append('file', filesInput);
      formData.append('files', filesInput);
    }

    formData.append('sheetType', sheetType);
    if (eventId) {
      formData.append('eventId', eventId);
    }

    const response = await axios.post<{
      success: boolean;
      message: string;
      rawRowCandidates?: number;
      reason?: string;
      error?: string;
      debug?: any;
      data: {
        sessionId: string;
        totalRowsDetected: number;
        extractedCount: number;
        presentCount: number;
        absentCount: number;
        deptDistribution: Record<string, number>;
        sheetType: string;
        validationPassed: boolean;
        students: Array<{
          rowNumber?: number;
          regNo: string;
          studentName: string;
          className: string;
          department: string;
          signaturePresent: boolean;
          status: AttendanceStatus;
          confidence: number;
          isUncertain: boolean;
          uncertainFields: string[];
          isMatchedToRoster?: boolean;
          sourceFiles?: string[];
        }>;
      };
      summary?: {
        totalFilesUploaded: number;
        successfulFilesCount: number;
        failedFilesCount: number;
        totalRowsExtracted: number;
        uniqueStudents: number;
        duplicatesRemoved: number;
        present: number;
        absent: number;
        fileResults?: Array<{
          fileName: string;
          status: 'success' | 'failed';
          extractedCount: number;
          error?: string | null;
          providerUsed?: string;
          modelUsed?: string;
        }>;
      };
    }>(`${apiUrl}/api/attendance/scan-hardcopy`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || 'Failed to scan physical attendance sheet';
    const debugInfo = err.response?.data?.debug;
    if (debugInfo) {
      console.error('API scanHardCopyAttendance debug info:', debugInfo);
    }
    console.error('API scanHardCopyAttendance failed:', errorMessage);
    return { success: false, message: errorMessage, data: null, summary: undefined };
  }
}
