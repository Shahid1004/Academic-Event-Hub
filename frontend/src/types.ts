export type Department = 'IT' | 'AIDS' | 'BOTH';
export type EventType = 'Hackathon' | 'Vervathon' | 'Guest Lecture' | 'Workshop' | 'Webinar' | 'Seminar' | 'Symposium' | 'FDP' | 'Training Event' | 'Conference' | 'Joint Event' | 'Other';
export type EventStatus = 'Upcoming' | 'In Progress' | 'Completed' | 'Cancelled';
export type DocStatus = 'Pending' | 'Partial' | 'Completed';
export type ReportStatus = 'Not Generated' | 'Draft' | 'Generated' | 'Approved';

export interface ResourcePerson {
  name: string;
  designation: string;
  organization: string;
  contact: string;
  email: string;
}

export interface Event {
  id: string;
  name: string;
  type: EventType;
  department: Department;
  academicYear: string;
  semester: 'I' | 'II';
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  mode: 'Offline' | 'Online' | 'Hybrid';
  coordinator: string;
  additionalCoordinators: string[];
  resourcePerson: ResourcePerson;
  targetStudents: string;
  expectedParticipants: number;
  actualParticipants: number;
  attendance: number;
  feedbackScore: number;
  objective: string;
  description: string;
  docStatus: DocStatus;
  reportStatus: ReportStatus;
  status: EventStatus;
}

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
  | 'semester-excel';
