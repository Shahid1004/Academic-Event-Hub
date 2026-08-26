export type UserRole = 'admin' | 'hod' | 'coordinator' | 'faculty';

export type Department = 'IT' | 'AIDS' | 'BOTH';

export type Page =
  | 'login'
  | 'dashboard'
  | 'it-dashboard'
  | 'aids-dashboard'
  | 'all-events'
  | 'joint-events'
  | 'calendar'
  | 'assigned-events'
  | 'documentation'
  | 'reports'
  | 'analytics'
  | 'settings'
  | 'event-details'
  | 'create-event'
  | 'semester-excel'
  | 'user-management';

export interface DashboardSummary {
  totalEvents: number;
  completedEvents: number;
  pendingDocumentation: number;
  upcomingEvents: number;
  totalParticipants: number;
  averageAttendance: number;
  averageFeedback: number;
  eventsByType: { type: string; count: number }[];
  recentEvents: {
    eventId: string;
    eventName: string;
    type: string;
    department: string;
    date?: string;
    coordinator?: string;
    participants: number;
    attendance: number;
    status?: string;
  }[];
  academicYears: string[];
}

export type Department = 'IT' | 'AIDS' | 'BOTH';

export type EventType =
  | 'Hackathon'
  | 'Vervathon'
  | 'Guest Lecture'
  | 'Workshop'
  | 'Webinar'
  | 'Seminar'
  | 'Symposium'
  | 'FDP'
  | 'Training Event'
  | 'Conference'
  | 'Joint Event'
  | 'Other';

export interface EventRecord {
  id: string;
  name: string;
  type: string;
  department: Department;
  academicYear: string;
  date: string;
  dateTo?: string;
  startTime: string;
  endTime: string;
  venue: string;
  mode: string;
  coordinator: string;
  resourcePerson: { name: string; designation: string; organization: string; contact: string; email: string };
  actualParticipants: number;
  attendance: number;
  feedbackScore: number;
  docStatus: string;
  reportStatus: string;
  status?: string;
  semester?: string;
  additionalCoordinators?: string[];
  targetStudents?: string;
  expectedParticipants?: number;
  objective?: string;
  description?: string;
  assignedFaculty?: (string | { id: string; name: string; email?: string; department?: string; designation?: string })[];
  sponsoredBy?: string;
  targetYears?: number[];
}

export interface Event extends EventRecord {
  type: EventType;
  status: string;
  semester: string;
  additionalCoordinators: string[];
  targetStudents: string;
  expectedParticipants: number;
  objective: string;
  description: string;
}

export interface CreateEventPayload {
  name: string;
  type: string;
  department: Department;
  academicYear: string;
  semester: string;
  date: string;
  dateTo: string;
  startTime: string;
  endTime: string;
  venue: string;
  mode: string;
  targetStudents: string;
  coordinator: string;
  additionalCoordinators: string;
  assignedFaculty: string[];
  targetYears: number[];
  sponsoredBy: string;
  expectedParticipants: string;
  resourcePerson: EventRecord['resourcePerson'];
  objective: string;
  description: string;
  hodAssignment: string;
  status: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  active: boolean;
  employeeId?: string;
  phone?: string;
  designation?: string;
  avatarColor?: string;
}

export interface AppSettings {
  academicYears: { name: string; current: boolean }[];
  departments: { name: string; code: string; hod: string; strength: number }[];
  eventTypes: string[];
  documentCategories: string[];
  notifications: Record<string, boolean>;
  theme: { mode: 'light' | 'dark'; contrast: 'normal' | 'high'; accent: 'indigo' | 'blue' | 'teal' | 'rose' };
}