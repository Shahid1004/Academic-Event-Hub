import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { EventRecord, Page } from '../types';
import { getEvents } from '../services/api';

interface FormalAcademicReportProps {
  events?: EventRecord[];
  navigate: (page: Page) => void;
}

type ReportType = 'all' | 'month' | 'semester' | 'year';
type SortColumn = 'name' | 'date' | 'participants';

interface ReportFilters {
  type: ReportType;
  month: number;
  year: number;
  academicYear: string;
  semester: 'odd' | 'even' | 'all';
  department: string;
  eventType: string;
  semesterFilter: string;
  search: string;
  fromDate: string;
  toDate: string;
}

const missing = (value: unknown) => value === undefined || value === null || value === '' ? '—' : String(value);
const normalizeAcademicYear = (value: string) => {
  const [start, end] = value.split('-').map(Number);
  return start && end ? `${start}-${end < 100 ? 2000 + end : end}` : value;
};
const academicYearMatches = (event: EventRecord, selected: string) => !selected || selected === 'ALL' || normalizeAcademicYear(event.academicYear || '') === normalizeAcademicYear(selected);
const semesterMatches = (event: EventRecord, selected: 'odd' | 'even' | 'all') => {
  if (selected === 'all') return true;
  const value = (event.semester || '').toLowerCase();
  return selected === 'odd' ? ['odd', 'i', '1', 'first'].includes(value) : ['even', 'ii', '2', 'second'].includes(value);
};
const formatPeriod = (filters: ReportFilters) => {
  if (filters.type === 'all') return 'All Period';
  if (filters.type === 'month') return `${new Date(2024, filters.month - 1).toLocaleString('en', { month: 'long' })} ${filters.year}`;
  return filters.type === 'semester' ? `${filters.academicYear || 'All Years'} / ${filters.semester === 'odd' ? 'Odd' : 'Even'}` : (filters.academicYear || 'All Years');
};

const eventRows = (events: EventRecord[]) => events.map((event, index) => ({
  'S.No': index + 1,
  'Academic Year': missing(event.academicYear),
  Semester: missing(event.semester),
  'Department / Branch': missing(event.department),
  'Year / Class': missing(event.targetStudents),
  'Event Type': missing(event.type),
  'Event Name': missing(event.name),
  'Event Date': missing(event.date),
  Time: event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : '—',
  Coordinator: [event.coordinator, ...(event.additionalCoordinators || [])].filter(Boolean).join(', ') || '—',
  'Resource Person': missing(event.resourcePerson?.name),
  Designation: missing(event.resourcePerson?.designation),
  Organization: missing(event.resourcePerson?.organization),
  Mode: missing(event.mode),
  Venue: missing(event.venue),
  'Sponsored By': missing(event.sponsoredBy),
  Participants: event.actualParticipants ?? '—',
  'Attendance %': event.attendance === undefined || event.attendance === null || event.attendance === 0 ? '—' : `${event.attendance}%`,
  Feedback: event.feedbackScore === undefined || event.feedbackScore === null || event.feedbackScore === 0 ? '—' : event.feedbackScore,
  'Document Status': missing(event.docStatus),
  Status: missing(event.status),
}));

export default function FormalAcademicReport({ events: initialEvents = [], navigate }: FormalAcademicReportProps) {
  const [events, setEvents] = useState<EventRecord[]>(initialEvents);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents().then(data => { setEvents(data); }).catch(() => setEvents([])).finally(() => setLoading(false));
  }, []);

  const availableYears = Array.from(new Set(events.map(event => event.academicYear).filter(Boolean))).sort();
  const availableDepartments = Array.from(new Set(events.map(event => event.department).filter(Boolean))).sort();
  const availableTypes = Array.from(new Set(events.map(event => event.type).filter(Boolean))).sort();
  const initialFilters: ReportFilters = {
    type: 'all', month: new Date().getMonth() + 1, year: new Date().getFullYear(), academicYear: 'ALL',
    semester: 'all', department: 'ALL', eventType: 'ALL', semesterFilter: 'ALL', search: '', fromDate: '', toDate: '',
  };
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(initialFilters);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isExporting, setIsExporting] = useState(false);

  const reportEvents = useMemo(() => events.filter(event => {
    if (!event.date) return false;
    const date = new Date(event.date);
    if (Number.isNaN(date.getTime())) return false;
    if (appliedFilters.type === 'month' && (date.getMonth() + 1 !== appliedFilters.month || date.getFullYear() !== appliedFilters.year)) return false;
    if (appliedFilters.type !== 'month' && !academicYearMatches(event, appliedFilters.academicYear)) return false;
    if (appliedFilters.type === 'semester' && !semesterMatches(event, appliedFilters.semester)) return false;
    if (appliedFilters.department !== 'ALL' && event.department !== appliedFilters.department) return false;
    if (appliedFilters.eventType !== 'ALL' && event.type !== appliedFilters.eventType) return false;
    return true;
  }), [events, appliedFilters]);

  const displayedEvents = useMemo(() => [...reportEvents].filter(event => {
    const search = appliedFilters.search.trim().toLowerCase();
    const matchesSearch = !search || [event.name, event.type, event.department, event.coordinator, event.venue].some(value => String(value || '').toLowerCase().includes(search));
    const matchesSemester = appliedFilters.semesterFilter === 'ALL' || semesterMatches(event, appliedFilters.semesterFilter === 'odd' ? 'odd' : 'even');
    const matchesFrom = !appliedFilters.fromDate || event.date >= appliedFilters.fromDate;
    const matchesTo = !appliedFilters.toDate || event.date <= appliedFilters.toDate;
    return matchesSearch && matchesSemester && matchesFrom && matchesTo;
  }).sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    if (sortColumn === 'name') return left.name.localeCompare(right.name) * direction;
    if (sortColumn === 'participants') return ((left.actualParticipants ?? -1) - (right.actualParticipants ?? -1)) * direction;
    return (new Date(left.date).getTime() - new Date(right.date).getTime()) * direction;
  }), [reportEvents, appliedFilters, sortColumn, sortDirection]);

  const updateFilter = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => setFilters(previous => ({ ...previous, [key]: value }));
  const generate = () => setAppliedFilters({ ...filters });
  const reset = () => { setFilters(initialFilters); setAppliedFilters(initialFilters); };
  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) setSortDirection(previous => previous === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(column); setSortDirection('asc'); }
  };

  const exportExcel = () => {
    try {
      setIsExporting(true);
      const rows = eventRows(displayedEvents);
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [6, 14, 10, 18, 18, 16, 30, 14, 16, 28, 24, 18, 22, 12, 24, 18, 12, 13, 12, 18, 14].map(wch => ({ wch }));
      worksheet['!autofilter'] = { ref: worksheet['!ref'] || 'A1:U1' };
      worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Events');
      let filename = `Academic-Year-Events-${appliedFilters.academicYear}.xlsx`;
      if (appliedFilters.type === 'month') filename = `Monthly-Events-${new Date(2024, appliedFilters.month - 1).toLocaleString('en', { month: 'long' })}-${appliedFilters.year}.xlsx`;
      if (appliedFilters.type === 'semester') filename = `Semester-Events-${appliedFilters.academicYear}-${appliedFilters.semester === 'odd' ? 'Odd' : 'Even'}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } finally {
      setIsExporting(false);
    }
  };

  const selectClass = 'px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const cellClass = 'px-3 py-2 border-r border-slate-100 align-top';
  const sortLabel = (label: string, column: SortColumn) => <button type="button" onClick={() => toggleSort(column)} className="font-semibold hover:text-indigo-100 whitespace-nowrap">{label} {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</button>;

  return (
    <div className="p-6 space-y-5 min-h-screen bg-slate-50">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('dashboard')} className="text-sm text-indigo-600 hover:text-indigo-800 mb-2">← Back to Dashboard</button>
          <h1 className="text-3xl font-bold text-slate-900">Academic Event Report</h1>
          <div className="text-sm text-slate-600 mt-2 space-x-4">
            <span>Report Type: <strong>{appliedFilters.type === 'month' ? 'Monthly' : appliedFilters.type === 'semester' ? 'Semester' : 'Academic Year'}</strong></span>
            <span>Period: <strong>{formatPeriod(appliedFilters)}</strong></span>
            <span>Records: <strong>{displayedEvents.length}</strong></span>
          </div>
        </div>
        <button onClick={exportExcel} disabled={isExporting || displayedEvents.length === 0} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-sm font-semibold">{isExporting ? 'Exporting...' : 'Export Excel'}</button>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <label className="text-xs font-semibold text-slate-600">Report Type<select className={`${selectClass} mt-1 w-full`} value={filters.type} onChange={event => updateFilter('type', event.target.value as ReportType)}><option value="month">Monthly Report</option><option value="semester">Semester Report</option><option value="year">Academic Year Report</option></select></label>
          {filters.type === 'month' && <>
            <label className="text-xs font-semibold text-slate-600">Month<select className={`${selectClass} mt-1 w-full`} value={filters.month} onChange={event => updateFilter('month', Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2024, index).toLocaleString('en', { month: 'long' })}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Year<select className={`${selectClass} mt-1 w-full`} value={filters.year} onChange={event => updateFilter('year', Number(event.target.value))}>{Array.from(new Set([filters.year, ...events.map(event => new Date(event.date).getFullYear()).filter(Boolean)])).sort().map(year => <option key={year} value={year}>{year}</option>)}</select></label>
          </>}
          {filters.type !== 'month' && <label className="text-xs font-semibold text-slate-600">Academic Year<select className={`${selectClass} mt-1 w-full`} value={filters.academicYear} onChange={event => updateFilter('academicYear', event.target.value)}>{availableYears.map(year => <option key={year} value={year}>{year}</option>)}</select></label>}
          {filters.type === 'semester' && <label className="text-xs font-semibold text-slate-600">Semester<select className={`${selectClass} mt-1 w-full`} value={filters.semester} onChange={event => updateFilter('semester', event.target.value as 'odd' | 'even')}><option value="odd">Odd / I</option><option value="even">Even / II</option></select></label>}
          <label className="text-xs font-semibold text-slate-600">Department<select className={`${selectClass} mt-1 w-full`} value={filters.department} onChange={event => updateFilter('department', event.target.value)}><option value="ALL">All Departments</option>{availableDepartments.map(department => <option key={department} value={department}>{department}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Event Type<select className={`${selectClass} mt-1 w-full`} value={filters.eventType} onChange={event => updateFilter('eventType', event.target.value)}><option value="ALL">All Event Types</option>{availableTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <button onClick={generate} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold">Generate</button>
          <button onClick={reset} className="px-5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold">Reset</button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3">
          <input className={`${selectClass} flex-1 min-w-56`} placeholder="Search events..." value={filters.search} onChange={event => { updateFilter('search', event.target.value); setAppliedFilters(previous => ({ ...previous, search: event.target.value })); }} />
          <select className={selectClass} value={filters.semesterFilter} onChange={event => { updateFilter('semesterFilter', event.target.value); setAppliedFilters(previous => ({ ...previous, semesterFilter: event.target.value })); }}><option value="ALL">All Semesters</option><option value="odd">Odd / I</option><option value="even">Even / II</option></select>
          <label className="text-xs text-slate-500">From<input type="date" className={`${selectClass} ml-2`} value={filters.fromDate} onChange={event => { updateFilter('fromDate', event.target.value); setAppliedFilters(previous => ({ ...previous, fromDate: event.target.value })); }} /></label>
          <label className="text-xs text-slate-500">To<input type="date" className={`${selectClass} ml-2`} value={filters.toDate} onChange={event => { updateFilter('toDate', event.target.value); setAppliedFilters(previous => ({ ...previous, toDate: event.target.value })); }} /></label>
        </div>
        <div className="text-sm font-semibold text-slate-700">Showing {displayedEvents.length} records</div>
      </section>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[2200px]">
            <thead><tr className="bg-indigo-700 text-white">
              <th className={`${cellClass} text-left`}>S.No</th><th className={`${cellClass} text-left`}>Academic Year</th><th className={`${cellClass} text-left`}>Semester</th><th className={`${cellClass} text-left`}>Department / Branch</th><th className={`${cellClass} text-left`}>Year / Class</th><th className={`${cellClass} text-left`}>Event Type</th><th className={`${cellClass} text-left`}>{sortLabel('Event Name', 'name')}</th><th className={`${cellClass} text-left`}>{sortLabel('Event Date', 'date')}</th><th className={`${cellClass} text-left`}>Time</th><th className={`${cellClass} text-left`}>Coordinator</th><th className={`${cellClass} text-left`}>Resource Person</th><th className={`${cellClass} text-left`}>Designation</th><th className={`${cellClass} text-left`}>Organization</th><th className={`${cellClass} text-left`}>Mode</th><th className={`${cellClass} text-left`}>Venue</th><th className={`${cellClass} text-left`}>Sponsored By</th><th className={`${cellClass} text-right`}>{sortLabel('Participants', 'participants')}</th><th className={`${cellClass} text-right`}>Attendance %</th><th className={`${cellClass} text-right`}>Feedback</th><th className={`${cellClass} text-left`}>Document Status</th><th className="px-3 py-2 text-left">Status</th>
            </tr></thead>
            <tbody>{displayedEvents.map((event, index) => <tr key={event.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 ${index % 2 ? 'bg-slate-50/40' : 'bg-white'}`}>
              <td className={cellClass}>{index + 1}</td><td className={cellClass}>{missing(event.academicYear)}</td><td className={cellClass}>{missing(event.semester)}</td><td className={cellClass}>{missing(event.department)}</td><td className={cellClass}>{missing(event.targetStudents)}</td><td className={cellClass}>{missing(event.type)}</td><td className={`${cellClass} font-medium max-w-64`}>{missing(event.name)}</td><td className={`${cellClass} whitespace-nowrap`}>{missing(event.date)}</td><td className={`${cellClass} whitespace-nowrap`}>{event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : '—'}</td><td className={`${cellClass} max-w-56`}>{[event.coordinator, ...(event.additionalCoordinators || [])].filter(Boolean).join(', ') || '—'}</td><td className={`${cellClass} max-w-48`}>{missing(event.resourcePerson?.name)}</td><td className={`${cellClass} max-w-40`}>{missing(event.resourcePerson?.designation)}</td><td className={`${cellClass} max-w-44`}>{missing(event.resourcePerson?.organization)}</td><td className={cellClass}>{missing(event.mode)}</td><td className={`${cellClass} max-w-48`}>{missing(event.venue)}</td><td className={`${cellClass} max-w-40`}>{missing(event.sponsoredBy)}</td><td className={`${cellClass} text-right font-semibold`}>{event.actualParticipants ?? '—'}</td><td className={`${cellClass} text-right`}>{event.attendance ? `${event.attendance}%` : '—'}</td><td className={`${cellClass} text-right`}>{event.feedbackScore ? event.feedbackScore : '—'}</td><td className={cellClass}>{missing(event.docStatus)}</td><td className="px-3 py-2">{missing(event.status)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {displayedEvents.length === 0 && <div className="p-10 text-center text-slate-500">No events match the selected filters.</div>}
      </div>
    </div>
  );
}
