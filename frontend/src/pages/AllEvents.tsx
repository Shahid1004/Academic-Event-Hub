import { useEffect, useState } from 'react';
import type { Department, EventRecord, EventType, Page } from '../types';
import { eventTypes, academicYears } from '../data/sampleData';
import { eventTypeColors } from './Dashboard';
import { deleteEvent, getEvents } from '../services/api';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface AllEventsProps {
  navigate: (page: Page, eventId?: string) => void;
  filterDept?: Department;
  title?: string;
  academicYear?: string;
}

export default function AllEvents({ navigate, filterDept, title = 'All Academic Events', academicYear = '' }: AllEventsProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<Department | 'ALL'>(filterDept || 'ALL');
  const [typeFilter, setTypeFilter] = useState<EventType | 'ALL'>('ALL');
  const [yearFilter, setYearFilter] = useState(academicYear || 'ALL');
  const [semesterFilter, setSemesterFilter] = useState<'ALL' | 'I' | 'II'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'participants'>('date');
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      try {
        const data = await getEvents();
        if (active) { setEvents(data); setError(''); }
      } catch {
        if (active) setError('Unable to load events. Check backend connection.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadEvents();
    const interval = window.setInterval(loadEvents, 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    setYearFilter(academicYear || 'ALL');
  }, [academicYear]);

  const filtered = events
    .filter(e => {
      const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.id.toLowerCase().includes(search.toLowerCase()) ||
        e.coordinator.toLowerCase().includes(search.toLowerCase()) ||
        e.resourcePerson?.name?.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'ALL' || e.department === deptFilter;
      const matchType = typeFilter === 'ALL' || e.type === typeFilter;
      const matchYear = yearFilter === 'ALL' || e.academicYear === yearFilter;
      const matchSemester = semesterFilter === 'ALL' || e.semester === semesterFilter;
      const matchFrom = !fromDate || e.date >= fromDate;
      const matchTo = !toDate || e.date <= toDate;
      return matchSearch && matchDept && matchType && matchYear && matchSemester && matchFrom && matchTo;
    })
    .sort((a, b) => {
      if (sortBy === 'date') return b.date.localeCompare(a.date);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (b.actualParticipants || 0) - (a.actualParticipants || 0);
    });

  const exportExcel = () => {
    const columns = [
      'S.No',
      'Year',
      'Event Type',
      'Date (From)',
      'Date (To)',
      'Time',
      'Name of the Faculty Coordinator(s) with Designation',
      'Events Organized',
      'Event Title',
      'Resource Person Details',
      'Venue',
      'Sponsored By',
      'No. of Participants Attended',
    ];
    const rows: (string | number)[][] = [
      ['Sona College of Technology'],
      [`${filtered[0]?.department || 'All Departments'} Department | Academic Year ${filtered[0]?.academicYear || 'All Years'}`],
      columns,
    ];
    let serialNumber = 1;
    let previousMonth = '';
    [...filtered].sort((a, b) => a.date.localeCompare(b.date)).forEach(event => {
      const eventDate = event.date ? new Date(`${event.date}T00:00:00`) : null;
      const monthLabel = eventDate ? eventDate.toLocaleString('en-US', { month: 'long' }).toUpperCase() : '';
      if (monthLabel && monthLabel !== previousMonth) {
        rows.push([monthLabel]);
        previousMonth = monthLabel;
      }

      const coordinators = event.assignedFaculty?.map(manager => {
        if (typeof manager === 'string') return manager;
        return `${manager.name}${manager.designation ? ` (${manager.designation})` : ''}`;
      }).join(', ') || event.coordinator;
      const resource = event.resourcePerson;
      const resourceDetails = [resource?.name, resource?.designation, resource?.organization, resource?.contact, resource?.email]
        .filter(Boolean)
        .join(' | ');

      rows.push([
        serialNumber++,
        event.targetYears?.length ? event.targetYears.map(year => `Year ${year}`).join(', ') : event.targetStudents || event.semester || '',
        event.type,
        event.dateTo || event.date,
        event.date,
        [event.startTime, event.endTime].filter(Boolean).join(' to '),
        coordinators,
        event.academicYear,
        event.name,
        resourceDetails,
        event.venue,
        '',
        event.actualParticipants || 0,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
    ];
    worksheet['!autofilter'] = { ref: `A3:M${rows.length}` };
    worksheet['!cols'] = [
      { wch: 7 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
      { wch: 20 }, { wch: 42 }, { wch: 18 }, { wch: 48 }, { wch: 48 },
      { wch: 28 }, { wch: 18 }, { wch: 24 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidated Events');
    XLSX.writeFile(workbook, `consolidated-events-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPdf = async () => {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([842, 595]); // Landscape A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const dept = filtered[0]?.department || 'All Departments';
    const academicYr = filtered[0]?.academicYear || 'All Years';
    const today = new Date().toLocaleDateString('en-IN');

    let yPosition = 550;
    const margin = 30;

    page.drawText('Sona College of Technology', { x: margin, y: yPosition, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
    yPosition -= 18;
    page.drawText(`${dept} Department | Academic Year: ${academicYr} | Generated: ${today}`, { x: margin, y: yPosition, size: 10, font, color: rgb(0.3, 0.3, 0.4) });
    yPosition -= 25;

    // Headers
    const headers = ['#', 'Academic Year', 'Type', 'Dept', 'Date', 'Event Name', 'Coordinator', 'Resource Person', 'Venue', 'Participants'];
    const colX = [30, 50, 120, 190, 230, 290, 480, 600, 710, 780];

    headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i], y: yPosition, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.6) });
    });

    yPosition -= 14;
    page.drawLine({ start: { x: margin, y: yPosition }, end: { x: 812, y: yPosition }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    yPosition -= 15;

    const sortedEvents = [...filtered].sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      if (yPosition < 40) {
        page = pdfDoc.addPage([842, 595]);
        yPosition = 550;
      }

      const row = [
        String(i + 1),
        (event.academicYear || '—').substring(0, 12),
        (event.type || '—').substring(0, 12),
        (event.department || '—').substring(0, 6),
        (event.date || '—').substring(0, 10),
        (event.name || '—').substring(0, 32),
        (event.coordinator || '—').substring(0, 20),
        (event.resourcePerson?.name || '—').substring(0, 18),
        (event.venue || '—').substring(0, 12),
        String(event.actualParticipants || 0),
      ];

      row.forEach((cell, idx) => {
        page.drawText(cell, { x: colX[idx], y: yPosition, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
      });

      yPosition -= 14;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `consolidated-events-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (e: React.MouseEvent, eventId: string, eventName: string) => {
    e.stopPropagation();
    const confirmMsg = `Are you sure you want to delete "${eventName}"?\n\nWARNING: All event-related data will be permanently deleted including in the database (uploaded documents, attendance records, feedback forms, etc.).`;
    if (window.confirm(confirmMsg)) {
      try {
        await deleteEvent(eventId);
        alert(`Event "${eventName}" and all related data have been permanently deleted including in the database.`);
        setEvents(prev => prev.filter(ev => ev.id !== eventId));
      } catch (err: any) {
        alert(`Failed to delete event: ${err.response?.data?.message || err.message}`);
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">{title}</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">
            Showing <span className="text-slate-900 font-semibold">{filtered.length}</span> of {events.length} total events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportExcel}
            disabled={!filtered.length}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 disabled:opacity-50 text-xs font-semibold rounded-xl transition-all shadow-sm"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Consolidated Excel
          </button>
          <button
            onClick={() => navigate('create-event')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Event
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex flex-wrap gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by title, ID, coordinator, resource..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Departments</option>
            <option value="IT">IT</option>
            <option value="AIDS">AIDS</option>
            <option value="BOTH">BOTH (IT+AIDS)</option>
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Event Types</option>
            {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Academic Years</option>
            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <select
            value={semesterFilter}
            onChange={e => setSemesterFilter(e.target.value as 'ALL' | 'I' | 'II')}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="ALL">All Semesters</option>
            <option value="I">Odd Semester (I)</option>
            <option value="II">Even Semester (II)</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="date">Date (Newest First)</option>
              <option value="name">Event Name (A-Z)</option>
              <option value="participants">Participants Count</option>
            </select>
          </div>

          {(search || deptFilter !== 'ALL' || typeFilter !== 'ALL' || yearFilter !== 'ALL' || semesterFilter !== 'ALL' || fromDate || toDate) && (
            <button
              onClick={() => { setSearch(''); setDeptFilter('ALL'); setTypeFilter('ALL'); setYearFilter('ALL'); setSemesterFilter('ALL'); setFromDate(''); setToDate(''); }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-xl bg-slate-50 transition-all ml-auto"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                {[
                  'Event Name', 'Type', 'Dept', 'Year(s)', 'Date', 'Time', 'Venue',
                  'Faculty Coordinators', 'Resource Person', 'Sponsored By', 'Participants',
                  'Attendance', 'Feedback', 'Doc Status', 'Report', 'Action'
                ].map(col => (
                  <th key={col} className="px-4 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={16} className="text-center py-16 text-slate-400">
                    <div className="inline-flex items-center gap-2 text-sm font-medium">
                      <svg className="animate-spin h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading academic events catalog...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center py-16 text-slate-400">
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="font-semibold text-slate-700 text-sm">No matching events found</div>
                    <div className="text-xs text-slate-400 mt-1">Try adjusting search query or active filter settings</div>
                  </td>
                </tr>
              ) : (
                filtered.map((event, i) => (
                  <tr
                    key={event.id}
                    onClick={() => navigate('event-details', event.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('event-details', event.id); }}
                    tabIndex={0}
                    role="button"
                    className={`hover:bg-indigo-50/40 transition-colors cursor-pointer ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                  >
                    <td className="px-4 py-3.5">
                      <button onClick={() => navigate('event-details', event.id)} className="text-left group">
                        <div className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{event.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{event.id}</div>
                      </button>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${eventTypeColors[event.type] || 'bg-slate-100 text-slate-700'}`}>
                        {event.type}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        event.department === 'IT' ? 'bg-blue-50 text-blue-700 border border-blue-200/60' :
                        event.department === 'AIDS' ? 'bg-purple-50 text-purple-700 border border-purple-200/60' :
                        'bg-amber-50 text-amber-700 border border-amber-200/60'
                      }`}>
                        {event.department === 'BOTH' ? 'BOTH' : event.department}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap font-medium">
                      {event.targetYears?.length ? event.targetYears.map(year => `Yr ${year}`).join(', ') : event.targetStudents || '—'}
                    </td>

                    <td className="px-4 py-3.5 text-slate-700 font-medium whitespace-nowrap">
                      {event.dateTo && event.dateTo !== event.date ? `${event.date} to ${event.dateTo}` : event.date}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      {[event.startTime, event.endTime].filter(Boolean).join(' - ') || '—'}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 max-w-[130px] truncate" title={event.venue}>
                      {event.venue}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 max-w-[180px]">
                      <div className="font-medium truncate">{event.coordinator}</div>
                      {event.assignedFaculty?.length ? (
                        <div className="text-[10px] text-indigo-600 font-semibold truncate" title={event.assignedFaculty.map(m => typeof m === 'string' ? m : m.name).join(', ')}>
                          +{event.assignedFaculty.length} assigned
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap max-w-[140px] truncate" title={event.resourcePerson?.name}>
                      {event.resourcePerson?.name || '—'}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      {event.sponsoredBy || '—'}
                    </td>

                    <td className="px-4 py-3.5 text-slate-900 font-bold text-center">
                      {event.actualParticipants || '—'}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {event.attendance > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${event.attendance}%` }} />
                          </div>
                          <span className="text-slate-700 font-semibold">{event.attendance}%</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {event.feedbackScore > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                          <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {event.feedbackScore}
                        </span>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        event.docStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' :
                        event.docStatus === 'Partial' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                        'bg-rose-50 text-rose-700 border border-rose-200/60'
                      }`}>
                        {event.docStatus}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        event.reportStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' :
                        event.reportStatus === 'Generated' ? 'bg-blue-50 text-blue-700 border border-blue-200/60' :
                        event.reportStatus === 'Draft' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {event.reportStatus}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('event-details', event.id); }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 rounded-lg transition-all"
                        >
                          View
                        </button>
                        <button
                          onClick={(e) => void handleDelete(e, event.id, event.name)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 rounded-lg transition-all"
                        >
                          Delete
                        </button>
                      </div>
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
