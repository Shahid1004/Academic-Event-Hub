import axios from 'axios';
import type { AppSettings, CreateEventPayload, DashboardSummary, EventRecord, UserProfile } from '../types';

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
