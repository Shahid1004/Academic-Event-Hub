export type UserRole = 'admin' | 'hod' | 'coordinator' | 'faculty';

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