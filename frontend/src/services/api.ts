import axios from 'axios';
import type { AppSettings, CreateEventPayload, DashboardSummary, EventRecord, UserProfile } from '../types';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

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
