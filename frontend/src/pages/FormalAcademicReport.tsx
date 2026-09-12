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

  useEffect(() => {
    getEvents().then(data => { setEvents(data); }).catch(() => setEvents([]));
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

  const selectClass = 'px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
  const cellClass = 'px-3 py-2.5 border-r border-slate-100 align-top';
  const sortLabel = (label: string, column: SortColumn) => (
    <button type="button" onClick={() => toggleSort(column)} className="font-semibold hover:text-indigo-200 whitespace-nowrap">
      {label} {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
    </button>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('dashboard')} className="text-xs text-indigo-600 font-semibold hover:underline mb-1 flex items-center gap-1">
            &larr; Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Formal Academic Event Dossier</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">
            Scope: <strong className="text-slate-900">{formatPeriod(appliedFilters)}</strong> &bull; <strong className="text-indigo-600">{displayedEvents.length}</strong> matching records
          </p>
        </div>

        <button
          onClick={exportExcel}
          disabled={isExporting || displayedEvents.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isExporting ? 'Exporting...' : 'Export Excel Dossier'}
        </button>
      </div>

      {/* Scope Filter Config Panel */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-bold font-heading text-slate-900 text-sm pb-2 border-b border-slate-100">Search &amp; Filter Events</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Report Period</label>
            <select className={`${selectClass} w-full`} value={filters.type} onChange={e => updateFilter('type', e.target.value as ReportType)}>
              <option value="month">Monthly Report</option>
              <option value="semester">Semester Report</option>
              <option value="year">Academic Year Report</option>
            </select>
          </div>

          {filters.type === 'month' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Month</label>
                <select className={`${selectClass} w-full`} value={filters.month} onChange={e => updateFilter('month', Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString('en', { month: 'long' })}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Year</label>
                <select className={`${selectClass} w-full`} value={filters.year} onChange={e => updateFilter('year', Number(e.target.value))}>
                  {Array.from(new Set([filters.year, ...events.map(event => new Date(event.date).getFullYear()).filter(Boolean)])).sort().map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
            </>
          )}

          {filters.type !== 'month' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Year</label>
              <select className={`${selectClass} w-full`} value={filters.academicYear} onChange={e => updateFilter('academicYear', e.target.value)}>
                {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
          )}

          {filters.type === 'semester' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Semester</label>
              <select className={`${selectClass} w-full`} value={filters.semester} onChange={e => updateFilter('semester', e.target.value as 'odd' | 'even')}>
                <option value="odd">Odd Semester (I)</option>
                <option value="even">Even Semester (II)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
            <select className={`${selectClass} w-full`} value={filters.department} onChange={e => updateFilter('department', e.target.value)}>
              <option value="ALL">All Departments</option>
              {availableDepartments.map(department => <option key={department} value={department}>{department}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Event Category</label>
            <select className={`${selectClass} w-full`} value={filters.eventType} onChange={e => updateFilter('eventType', e.target.value)}>
              <option value="ALL">All Event Types</option>
              {availableTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button onClick={generate} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            Search
          </button>
          <button onClick={reset} className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-all">
            Reset Filters
          </button>
        </div>
      </section>

      {/* Grid Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs border-collapse min-w-[2200px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900 text-white font-heading">
                <th className={`${cellClass} text-left`}>S.No</th>
                <th className={`${cellClass} text-left`}>Academic Year</th>
                <th className={`${cellClass} text-left`}>Semester</th>
                <th className={`${cellClass} text-left`}>Department</th>
                <th className={`${cellClass} text-left`}>Year / Class</th>
                <th className={`${cellClass} text-left`}>Event Type</th>
                <th className={`${cellClass} text-left`}>{sortLabel('Event Name', 'name')}</th>
                <th className={`${cellClass} text-left`}>{sortLabel('Event Date', 'date')}</th>
                <th className={`${cellClass} text-left`}>Time</th>
                <th className={`${cellClass} text-left`}>Coordinator</th>
                <th className={`${cellClass} text-left`}>Resource Person</th>
                <th className={`${cellClass} text-left`}>Designation</th>
                <th className={`${cellClass} text-left`}>Organization</th>
                <th className={`${cellClass} text-left`}>Mode</th>
                <th className={`${cellClass} text-left`}>Venue</th>
                <th className={`${cellClass} text-left`}>Sponsored By</th>
                <th className={`${cellClass} text-right`}>{sortLabel('Participants', 'participants')}</th>
                <th className={`${cellClass} text-right`}>Attendance %</th>
                <th className={`${cellClass} text-right`}>Feedback</th>
                <th className={`${cellClass} text-left`}>Doc Status</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedEvents.length === 0 ? (
                <tr>
                  <td colSpan={21} className="py-12 text-center text-slate-400 text-xs">
                    No academic event records matched the specified scope parameters.
                  </td>
                </tr>
              ) : (
                displayedEvents.map((event, index) => (
                  <tr key={event.id} className={`hover:bg-indigo-50/30 transition-colors ${index % 2 ? 'bg-slate-50/40' : 'bg-white'}`}>
                    <td className={`${cellClass} font-mono text-[11px] text-slate-400`}>{index + 1}</td>
                    <td className={cellClass}>{missing(event.academicYear)}</td>
                    <td className={cellClass}>{missing(event.semester)}</td>
                    <td className={cellClass}><span className="font-semibold text-slate-800">{missing(event.department)}</span></td>
                    <td className={cellClass}>{missing(event.targetStudents)}</td>
                    <td className={cellClass}>{missing(event.type)}</td>
                    <td className={`${cellClass} font-bold text-slate-900 max-w-64 truncate`}>{missing(event.name)}</td>
                    <td className={`${cellClass} whitespace-nowrap font-mono text-slate-700`}>{missing(event.date)}</td>
                    <td className={`${cellClass} whitespace-nowrap text-slate-500`}>{event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : '—'}</td>
                    <td className={`${cellClass} max-w-56 truncate`}>{[event.coordinator, ...(event.additionalCoordinators || [])].filter(Boolean).join(', ') || '—'}</td>
                    <td className={`${cellClass} max-w-48 truncate`}>{missing(event.resourcePerson?.name)}</td>
                    <td className={`${cellClass} max-w-40 truncate text-slate-500`}>{missing(event.resourcePerson?.designation)}</td>
                    <td className={`${cellClass} max-w-44 truncate text-slate-500`}>{missing(event.resourcePerson?.organization)}</td>
                    <td className={cellClass}>{missing(event.mode)}</td>
                    <td className={`${cellClass} max-w-48 truncate text-slate-600`}>{missing(event.venue)}</td>
                    <td className={`${cellClass} max-w-40 text-slate-500`}>{missing(event.sponsoredBy)}</td>
                    <td className={`${cellClass} text-right font-bold text-slate-900`}>{event.actualParticipants ?? '—'}</td>
                    <td className={`${cellClass} text-right font-medium text-slate-700`}>{event.attendance ? `${event.attendance}%` : '—'}</td>
                    <td className={`${cellClass} text-right`}>{event.feedbackScore ? `⭐ ${event.feedbackScore}` : '—'}</td>
                    <td className={cellClass}>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        event.docStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {missing(event.docStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        event.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {missing(event.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
