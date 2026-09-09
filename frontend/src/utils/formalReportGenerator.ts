// Formal Academic Event Report Generation
// Path: frontend/src/utils/formalReportGenerator.ts

import { EventRecord } from '../types';

export interface ReportFilters {
  type: 'month' | 'semester' | 'year';
  month?: number; // 1-12
  year?: number;
  semester?: 'odd' | 'even';
  academicYear?: string; // e.g., "2025-26"
  department?: string; // Optional: specific department
  eventType?: string; // Optional: specific event type
}

export interface ReportSummaryCards {
  totalEvents: number;
  totalParticipants: number;
  eventTypes: number;
  facultyCoordinators: number;
  mostConductedType?: string;
  mostActiveDepart?: string;
  highestParticipationEvent?: string;
}

export interface MonthwiseSummaryRow {
  month: string;
  eventCount: number;
  totalParticipants: number;
}

export interface EventTypeSummaryRow {
  eventType: string;
  eventCount: number;
  participants: number;
}

export interface DepartmentSummaryRow {
  department: string;
  eventCount: number;
  participants: number;
}

export interface FormalReportData {
  // Header Information
  header: {
    institution: string;
    department: string;
    reportTitle: string;
    period: string;
    academicYear: string;
    generatedDate: string;
  };

  // Summary Cards
  summary: ReportSummaryCards;

  // Month-wise Summary (for semester and year reports)
  monthwiseSummary: MonthwiseSummaryRow[];

  // Event Type Summary
  eventTypeSummary: EventTypeSummaryRow[];

  // Department Summary
  departmentSummary: DepartmentSummaryRow[];

  // Detailed Events
  detailedEvents: EventRecord[];

  // Key Findings
  keyFindings: string[];

  // Conclusion
  conclusion: string;

  // Statistics
  statistics: {
    totalEvents: number;
    totalParticipants: number;
    averageParticipants: number;
    uniqueFaculty: number;
    eventsByMonth: Record<string, number>;
    participantsByMonth: Record<string, number>;
    eventsByType: Record<string, number>;
    participantsByType: Record<string, number>;
    eventsByDepartment: Record<string, number>;
    participantsByDepartment: Record<string, number>;
  };
}

const normalizeAcademicYear = (academicYear: string): string => {
  const [start, end] = academicYear.split('-').map(Number);
  if (!start || !end) return academicYear;
  return `${start}-${end < 100 ? 2000 + end : end}`;
};

const getEventAcademicYear = (event: EventRecord, eventDate: Date): string => {
  if (event.academicYear) return normalizeAcademicYear(event.academicYear);
  const eventYear = eventDate.getFullYear();
  return eventDate.getMonth() + 1 >= 8
    ? `${eventYear}-${eventYear + 1}`
    : `${eventYear - 1}-${eventYear}`;
};

const isSemesterMatch = (value: string | undefined, requested: 'odd' | 'even'): boolean => {
  const semester = (value || '').toLowerCase();
  return requested === 'odd'
    ? ['odd', 'i', '1', 'first'].includes(semester)
    : ['even', 'ii', '2', 'second'].includes(semester);
};

// Filter events based on selected period and optional filters
export const filterEventsByPeriod = (
  events: EventRecord[],
  filters: ReportFilters
): EventRecord[] => {
  return events.filter(event => {
    if (!event.date) return false;

    const eventDate = new Date(event.date);
    if (Number.isNaN(eventDate.getTime())) return false;
    const eventMonth = eventDate.getMonth() + 1;
    const eventYear = eventDate.getFullYear();

    // Filter by report type
    let typeMatch = false;

    if (filters.type === 'month' && filters.month && filters.year) {
      typeMatch = eventMonth === filters.month && eventYear === filters.year;
    } else if (filters.type === 'semester' && filters.semester && filters.academicYear) {
      const eventAcademicYear = getEventAcademicYear(event, eventDate);
      typeMatch =
        eventAcademicYear === normalizeAcademicYear(filters.academicYear) &&
        isSemesterMatch(event.semester, filters.semester);
    } else if (filters.type === 'year' && filters.academicYear) {
      typeMatch = getEventAcademicYear(event, eventDate) === normalizeAcademicYear(filters.academicYear);
    }

    if (!typeMatch) return false;

    // Apply optional filters
    if (filters.department && event.department !== filters.department) return false;
    if (filters.eventType && event.type !== filters.eventType) return false;

    return true;
  });
};

// Generate summary cards
export const generateSummaryCards = (events: EventRecord[]): ReportSummaryCards => {
  const uniqueTypes = new Set(events.map(e => e.type)).size;
  const uniqueFaculty = new Set(events.map(e => e.coordinator).filter(Boolean)).size;
  const totalParticipants = events.reduce((sum, e) => sum + (e.actualParticipants || 0), 0);

  // Most conducted event type
  const typeCount: Record<string, number> = {};
  events.forEach(e => {
    typeCount[e.type] = (typeCount[e.type] || 0) + 1;
  });
  const mostConductedType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Most active department
  const deptCount: Record<string, number> = {};
  events.forEach(e => {
    deptCount[e.department] = (deptCount[e.department] || 0) + 1;
  });
  const mostActiveDepart = Object.entries(deptCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Highest participation event
  const highestEvent = events.reduce<EventRecord | undefined>((max, event) =>
    !max || (event.actualParticipants || 0) > (max.actualParticipants || 0) ? event : max,
    undefined
  );
  const highestParticipationEvent = highestEvent
    ? `${highestEvent.name} (${highestEvent.actualParticipants})`
    : 'N/A';

  return {
    totalEvents: events.length,
    totalParticipants,
    eventTypes: uniqueTypes,
    facultyCoordinators: uniqueFaculty,
    mostConductedType,
    mostActiveDepart,
    highestParticipationEvent,
  };
};

// Generate month-wise summary
export const generateMonthwiseSummary = (events: EventRecord[]): MonthwiseSummaryRow[] => {
  const monthData: Record<string, { events: number; participants: number }> = {};

  events.forEach(event => {
    const date = new Date(event.date);
    const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });

    if (!monthData[monthKey]) {
      monthData[monthKey] = { events: 0, participants: 0 };
    }

    monthData[monthKey].events += 1;
    monthData[monthKey].participants += event.actualParticipants || 0;
  });

  // Sort by date
  return Object.entries(monthData)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([month, data]) => ({
      month,
      eventCount: data.events,
      totalParticipants: data.participants,
    }));
};

// Generate event type summary
export const generateEventTypeSummary = (events: EventRecord[]): EventTypeSummaryRow[] => {
  const typeData: Record<string, { count: number; participants: number }> = {};

  events.forEach(event => {
    const type = event.type || 'Other';
    if (!typeData[type]) {
      typeData[type] = { count: 0, participants: 0 };
    }
    typeData[type].count += 1;
    typeData[type].participants += event.actualParticipants || 0;
  });

  return Object.entries(typeData)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([type, data]) => ({
      eventType: type,
      eventCount: data.count,
      participants: data.participants,
    }));
};

// Generate department summary
export const generateDepartmentSummary = (events: EventRecord[]): DepartmentSummaryRow[] => {
  const deptData: Record<string, { count: number; participants: number }> = {};

  events.forEach(event => {
    const dept = event.department || 'Unknown';
    if (!deptData[dept]) {
      deptData[dept] = { count: 0, participants: 0 };
    }
    deptData[dept].count += 1;
    deptData[dept].participants += event.actualParticipants || 0;
  });

  return Object.entries(deptData)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([dept, data]) => ({
      department: dept,
      eventCount: data.count,
      participants: data.participants,
    }));
};

// Generate statistics
export const generateStatistics = (events: EventRecord[]) => {
  const totalParticipants = events.reduce((sum, e) => sum + (e.actualParticipants || 0), 0);
  const averageParticipants = events.length > 0 ? Math.round(totalParticipants / events.length) : 0;
  const uniqueFaculty = new Set(events.map(e => e.coordinator).filter(Boolean)).size;

  const eventsByMonth: Record<string, number> = {};
  const participantsByMonth: Record<string, number> = {};
  const eventsByType: Record<string, number> = {};
  const participantsByType: Record<string, number> = {};
  const eventsByDepartment: Record<string, number> = {};
  const participantsByDepartment: Record<string, number> = {};

  events.forEach(event => {
    const monthKey = new Date(event.date).toLocaleString('default', { month: 'long', year: 'numeric' });
    const type = event.type || 'Other';
    const dept = event.department || 'Unknown';
    const participants = event.actualParticipants || 0;

    eventsByMonth[monthKey] = (eventsByMonth[monthKey] || 0) + 1;
    participantsByMonth[monthKey] = (participantsByMonth[monthKey] || 0) + participants;

    eventsByType[type] = (eventsByType[type] || 0) + 1;
    participantsByType[type] = (participantsByType[type] || 0) + participants;

    eventsByDepartment[dept] = (eventsByDepartment[dept] || 0) + 1;
    participantsByDepartment[dept] = (participantsByDepartment[dept] || 0) + participants;
  });

  return {
    totalEvents: events.length,
    totalParticipants,
    averageParticipants,
    uniqueFaculty,
    eventsByMonth,
    participantsByMonth,
    eventsByType,
    participantsByType,
    eventsByDepartment,
    participantsByDepartment,
  };
};

// Generate key findings
export const generateKeyFindings = (
  events: EventRecord[],
  filters: ReportFilters,
  stats: any
): string[] => {
  const findings: string[] = [];

  if (events.length === 0) return findings;

  // 1. Total events
  findings.push(
    `A total of ${events.length} academic event(s) were conducted during the selected ${filters.type} period.`
  );

  // 2. Most active month (for reports with multiple months)
  const eventsByMonth = stats.eventsByMonth;
  if (Object.keys(eventsByMonth).length > 0) {
    const mostActiveMonth = Object.entries(eventsByMonth).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    findings.push(
      `${mostActiveMonth[0]} recorded the highest number of academic events with ${mostActiveMonth[1]} event(s).`
    );
  }

  // 3. Event type analysis
  if (stats.eventsByType && Object.keys(stats.eventsByType).length > 0) {
    const mostCommonType = Object.entries(stats.eventsByType).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    findings.push(
      `${mostCommonType[0]} was the most frequently conducted event type with ${mostCommonType[1]} occurrence(s).`
    );
  }

  // 4. Most active department
  if (stats.eventsByDepartment && Object.keys(stats.eventsByDepartment).length > 0) {
    const mostActiveDept = Object.entries(stats.eventsByDepartment).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    findings.push(`${mostActiveDept[0]} demonstrated the highest engagement with ${mostActiveDept[1]} event(s).`);
  }

  // 5. Participation metrics
  findings.push(
    `The academic events engaged a total of ${stats.totalParticipants} participant(s) with an average of ${stats.averageParticipants} participant(s) per event.`
  );

  // 6. Faculty involvement
  findings.push(
    `A total of ${stats.uniqueFaculty} faculty coordinator(s) were instrumental in organizing and executing these events.`
  );

  // 7. Highest participation event
  const maxEvent = events.reduce((max, e) =>
    (e.actualParticipants || 0) > (max.actualParticipants || 0) ? e : max
  );
  if (maxEvent && maxEvent.actualParticipants) {
    findings.push(
      `"${maxEvent.name}" achieved the highest participation with ${maxEvent.actualParticipants} attendees.`
    );
  }

  // 8. Department diversity
  const deptCount = Object.keys(stats.eventsByDepartment).length;
  if (deptCount > 1) {
    findings.push(
      `Academic activities were undertaken collaboratively across ${deptCount} department(s), fostering interdisciplinary engagement.`
    );
  }

  // 9. High attendance events
  const highAttendanceEvents = events.filter(e => (e.attendance || 0) >= 80).length;
  if (highAttendanceEvents > 0) {
    findings.push(
      `${highAttendanceEvents} event(s) achieved outstanding attendance rates of 80% or more, indicating strong student engagement.`
    );
  }

  // 10. Participation diversity
  if (events.length > 1 && Object.keys(stats.eventsByType).length > 0) {
    const typeCount = Object.keys(stats.eventsByType).length;
    findings.push(
      `The diversity in event types (${typeCount} categories) demonstrates a comprehensive approach to academic enrichment.`
    );
  }

  return findings.slice(0, 10);
};

// Generate formal conclusion
export const generateConclusion = (
  filters: ReportFilters,
  events: EventRecord[],
  stats: any
): string => {
  if (events.length === 0) {
    return 'No events were conducted during the selected reporting period.';
  }

  const periodText =
    filters.type === 'month'
      ? `${new Date(filters.year || 0, (filters.month || 1) - 1).toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        })}`
      : filters.type === 'semester'
      ? `${filters.semester === 'odd' ? 'Odd' : 'Even'} Semester of Academic Year ${filters.academicYear}`
      : `Academic Year ${filters.academicYear}`;

  const conclusion = `The institution's commitment to holistic development and academic excellence is evident from the successful execution of ${events.length} events during ${periodText}, engaging ${stats.totalParticipants} participants across various disciplines. The diverse event portfolio, spanning ${Object.keys(stats.eventsByType).length} event types and coordinated by ${stats.uniqueFaculty} faculty members, underscores the collaborative effort in creating an intellectually stimulating environment. The active participation from multiple departments and the high attendance rates at several events reflect institutional commitment to fostering academic discourse, professional development, and student engagement. These initiatives contribute significantly to the overall academic ecosystem and align with the institution's vision of comprehensive education and research excellence.`;

  return conclusion;
};

// Generate complete formal report
export const generateFormalReport = (
  events: EventRecord[],
  filters: ReportFilters
): FormalReportData => {
  const filteredEvents = filterEventsByPeriod(events, filters);
  const summary = generateSummaryCards(filteredEvents);
  const monthwiseSummary = generateMonthwiseSummary(filteredEvents);
  const eventTypeSummary = generateEventTypeSummary(filteredEvents);
  const departmentSummary = generateDepartmentSummary(filteredEvents);
  const statistics = generateStatistics(filteredEvents);
  const keyFindings = generateKeyFindings(filteredEvents, filters, statistics);
  const conclusion = generateConclusion(filters, filteredEvents, statistics);

  // Sort events chronologically
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const periodText =
    filters.type === 'month'
      ? `${new Date(filters.year || 0, (filters.month || 1) - 1).toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        })}`
      : filters.type === 'semester'
      ? `${filters.semester === 'odd' ? 'Odd' : 'Even'} Semester, ${filters.academicYear}`
      : `${filters.academicYear}`;

  return {
    header: {
      institution: 'Sona College of Technology',
      department: filters.department || 'Department of Information Technology',
      reportTitle:
        filters.type === 'month'
          ? 'MONTHLY ACADEMIC EVENT REPORT'
          : filters.type === 'semester'
          ? 'SEMESTER ACADEMIC EVENT REPORT'
          : 'ACADEMIC YEAR EVENT REPORT',
      period: periodText,
      academicYear: filters.academicYear || new Date().getFullYear().toString(),
      generatedDate: new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    },
    summary,
    monthwiseSummary,
    eventTypeSummary,
    departmentSummary,
    detailedEvents: sortedEvents,
    keyFindings,
    conclusion,
    statistics,
  };
};
