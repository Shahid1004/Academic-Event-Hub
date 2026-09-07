// Report generation utilities for Academic Event Hub
// Path: frontend/src/utils/reportGenerator.ts

import { EventRecord } from '../types';

export interface ReportFilters {
  type: 'month' | 'semester' | 'year';
  month?: number; // 1-12
  year?: number;
  semester?: 'odd' | 'even';
  academicYear?: string; // e.g., "2023-24"
}

export interface EventStats {
  totalEvents: number;
  workshops: number;
  seminars: number;
  conferences: number;
  fdps: number;
  guestLectures: number;
  otherEvents: number;
  totalParticipants: number;
  facultyCoordinators: number;
}

export interface ReportData {
  header: {
    institution: string;
    department: string;
    title: string;
    selectedPeriod: string;
    academicYear: string;
    generatedDate: string;
  };
  summary: EventStats;
  events: EventRecord[];
  statistics: {
    eventsByType: Record<string, number>;
    eventsByDepartment: Record<string, number>;
    eventsByMonth: Record<string, number>;
    participantCount: number;
    facultyParticipation: number;
    mostActiveDepartment: string;
    mostCommonEventType: string;
  };
  comparison: {
    previousPeriodEvents: number;
    eventChange: number;
    percentChange: number;
    participantChange: number;
  };
  keyFindings: string[];
  conclusion: string;
}

// Filter events based on selected period
export const filterEventsByPeriod = (events: EventRecord[], filters: ReportFilters): EventRecord[] => {
  return events.filter(event => {
    const eventDate = new Date(event.date);
    const eventMonth = eventDate.getMonth() + 1;
    const eventYear = eventDate.getFullYear();

    if (filters.type === 'month' && filters.month && filters.year) {
      return eventMonth === filters.month && eventYear === filters.year;
    }

    if (filters.type === 'semester' && filters.semester && filters.academicYear) {
      const [startYear] = filters.academicYear.split('-').map(Number);
      const semester = event.semester || 'odd';
      const eventAcademicYear = eventMonth >= 8 ? `${eventYear}-${eventYear + 1}` : `${eventYear - 1}-${eventYear}`;
      return eventAcademicYear === filters.academicYear && semester === filters.semester;
    }

    if (filters.type === 'year' && filters.academicYear) {
      const eventAcademicYear = eventMonth >= 8 ? `${eventYear}-${eventYear + 1}` : `${eventYear - 1}-${eventYear}`;
      return eventAcademicYear === filters.academicYear;
    }

    return false;
  });
};

// Generate executive summary
export const generateExecutiveSummary = (events: EventRecord[]): EventStats => {
  const eventTypes: Record<string, number> = {};

  events.forEach(event => {
    const type = event.type || 'Other';
    eventTypes[type] = (eventTypes[type] || 0) + 1;
  });

  const uniqueCoordinators = new Set(events.map(e => e.coordinator)).size;

  return {
    totalEvents: events.length,
    workshops: eventTypes['Hackathon'] || eventTypes['Workshop'] || 0,
    seminars: eventTypes['Seminar'] || 0,
    conferences: eventTypes['Conference'] || 0,
    fdps: eventTypes['FDP'] || 0,
    guestLectures: eventTypes['Guest Lecture'] || 0,
    otherEvents: events.length - Object.values(eventTypes).reduce((a, b) => a + b, 0),
    totalParticipants: events.reduce((sum, event) => sum + (event.actualParticipants || 0), 0),
    facultyCoordinators: uniqueCoordinators,
  };
};

// Generate statistical analysis
export const generateStatistics = (events: EventRecord[]) => {
  const eventsByType: Record<string, number> = {};
  const eventsByDepartment: Record<string, number> = {};
  const eventsByMonth: Record<string, number> = {};
  let totalParticipants = 0;
  let facultyParticipation = 0;

  events.forEach(event => {
    // Events by type
    const type = event.type || 'Other';
    eventsByType[type] = (eventsByType[type] || 0) + 1;

    // Events by department
    const dept = event.department || 'Unknown';
    eventsByDepartment[dept] = (eventsByDepartment[dept] || 0) + 1;

    // Events by month
    const month = new Date(event.date).toLocaleString('default', { month: 'long' });
    eventsByMonth[month] = (eventsByMonth[month] || 0) + 1;

    // Participants
    totalParticipants += event.actualParticipants || 0;
    facultyParticipation += (event.assignedFaculty?.length || 0);
  });

  const mostActiveDepartment = Object.entries(eventsByDepartment).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  const mostCommonEventType = Object.entries(eventsByType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  return {
    eventsByType,
    eventsByDepartment,
    eventsByMonth,
    participantCount: totalParticipants,
    facultyParticipation,
    mostActiveDepartment,
    mostCommonEventType,
  };
};

// Generate key findings
export const generateKeyFindings = (
  events: EventRecord[],
  stats: any,
  comparison: any
): string[] => {
  const findings: string[] = [];

  if (events.length > 0) {
    findings.push(`Total of ${events.length} academic events were conducted during the selected period.`);
  }

  if (comparison.percentChange > 0) {
    findings.push(`Event count increased by ${comparison.percentChange.toFixed(1)}% compared to the previous period.`);
  } else if (comparison.percentChange < 0) {
    findings.push(`Event count decreased by ${Math.abs(comparison.percentChange).toFixed(1)}% compared to the previous period.`);
  }

  const topDept = stats.mostActiveDepartment;
  findings.push(`${topDept} department demonstrated the highest engagement with most events organized.`);

  const topEventType = stats.mostCommonEventType;
  const typeCount = stats.eventsByType[topEventType] || 0;
  findings.push(`${topEventType} was the most frequently conducted event type (${typeCount} events).`);

  const avgParticipants = events.length > 0 ? Math.round(stats.participantCount / events.length) : 0;
  findings.push(`Average participation per event was ${avgParticipants} participants.`);

  const eventWithMostParticipants = events.reduce((max, event) => 
    (event.actualParticipants || 0) > (max.actualParticipants || 0) ? event : max
  );
  if (eventWithMostParticipants) {
    findings.push(`"${eventWithMostParticipants.name}" attracted the highest participation with ${eventWithMostParticipants.actualParticipants} participants.`);
  }

  if (stats.participantCount > 0) {
    findings.push(`Total academic engagement reached ${stats.participantCount} participant instances across all events.`);
  }

  const highAttendanceEvents = events.filter(e => (e.attendance || 0) >= 80).length;
  if (highAttendanceEvents > 0) {
    findings.push(`${highAttendanceEvents} events achieved 80%+ attendance rate, indicating strong student engagement.`);
  }

  return findings.slice(0, 10);
};

// Generate professional conclusion
export const generateConclusion = (
  filters: ReportFilters,
  events: EventRecord[],
  stats: any
): string => {
  const periodText = filters.type === 'month' 
    ? `${new Date(filters.year || 0, (filters.month || 1) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`
    : filters.type === 'semester'
    ? `${filters.semester === 'odd' ? 'Odd' : 'Even'} Semester ${filters.academicYear}`
    : `Academic Year ${filters.academicYear}`;

  return `The Academic Event Hub successfully facilitated and documented ${events.length} academic events during ${periodText}, demonstrating strong institutional commitment to academic excellence and faculty development. With ${stats.participantCount} total participants and engagement across multiple event categories, the institution has created a vibrant academic ecosystem. The active participation from ${stats.facultyParticipation} faculty members and the engagement of ${Object.keys(stats.eventsByDepartment).length} departments reflects a collaborative approach to academic enrichment. These metrics underscore the institution's dedication to fostering intellectual discourse, professional development, and holistic student engagement across disciplines.`;
};

// Generate complete report
export const generateReport = (
  events: EventRecord[],
  filters: ReportFilters,
  allEvents: EventRecord[] = []
): ReportData => {
  const filteredEvents = filterEventsByPeriod(events, filters);
  const summary = generateExecutiveSummary(filteredEvents);
  const statistics = generateStatistics(filteredEvents);
  
  // Calculate comparison with previous period
  let previousPeriodEvents = 0;
  if (filters.type === 'month' && filters.month && filters.year) {
    const prevMonth = filters.month === 1 ? 12 : filters.month - 1;
    const prevYear = filters.month === 1 ? filters.year - 1 : filters.year;
    const prevFilters = { ...filters, month: prevMonth, year: prevYear };
    previousPeriodEvents = filterEventsByPeriod(allEvents, prevFilters).length;
  }

  const comparison = {
    previousPeriodEvents,
    eventChange: filteredEvents.length - previousPeriodEvents,
    percentChange: previousPeriodEvents > 0 ? ((filteredEvents.length - previousPeriodEvents) / previousPeriodEvents) * 100 : 0,
    participantChange: 0,
  };

  const keyFindings = generateKeyFindings(filteredEvents, statistics, comparison);
  const conclusion = generateConclusion(filters, filteredEvents, statistics);

  const periodText = filters.type === 'month' 
    ? `${new Date(filters.year || 0, (filters.month || 1) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`
    : filters.type === 'semester'
    ? `${filters.semester === 'odd' ? 'Odd' : 'Even'} Semester`
    : `Year ${filters.academicYear}`;

  return {
    header: {
      institution: 'Academic Event Hub',
      department: filters.type === 'year' ? 'All Departments' : 'Department',
      title: `${periodText} Event Report`,
      selectedPeriod: periodText,
      academicYear: filters.academicYear || new Date().getFullYear().toString(),
      generatedDate: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
    },
    summary,
    events: filteredEvents,
    statistics,
    comparison,
    keyFindings,
    conclusion,
  };
};
