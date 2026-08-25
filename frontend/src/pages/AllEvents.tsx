import { useEffect, useState } from 'react';
import type { Department, EventRecord, EventType, Page } from '../types';
import { eventTypes, academicYears } from '../data/sampleData';
import { eventTypeColors } from './Dashboard';
import { getEvents } from '../services/api';
import * as XLSX from 'xlsx';

interface AllEventsProps {
  navigate: (page: Page, eventId?: string) => void;
  filterDept?: Department;
  title?: string;
}

export default function AllEvents({ navigate, filterDept, title = 'All Events' }: AllEventsProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<Department | 'ALL'>(filterDept || 'ALL');
  const [typeFilter, setTypeFilter] = useState<EventType | 'ALL'>('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
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
        if (active) setError('Unable to load events. Check the backend connection.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadEvents();
    const interval = window.setInterval(loadEvents, 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const filtered = events
    .filter(e => {
      const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.id.toLowerCase().includes(search.toLowerCase()) ||
        e.coordinator.toLowerCase().includes(search.toLowerCase()) ||
        e.resourcePerson.name.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'ALL' || e.department === deptFilter;
      const matchType = typeFilter === 'ALL' || e.type === typeFilter;
      const matchYear = yearFilter === 'ALL' || e.academicYear === yearFilter;
      const matchFrom = !fromDate || e.date >= fromDate;
      const matchTo = !toDate || e.date <= toDate;
      return matchSearch && matchDept && matchType && matchYear && matchFrom && matchTo;
    })
    .sort((a, b) => {
      if (sortBy === 'date') return b.date.localeCompare(a.date);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.actualParticipants - a.actualParticipants;
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

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">{title}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{filtered.length} events found</p>
        </div>
        <button
          onClick={() => navigate('create-event')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm"
        >
          <span className="text-lg leading-none">+</span> Create Event
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name, ID, faculty coordinator..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
          />
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value as any)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="ALL">All Departments</option>
            <option value="IT">IT</option>
            <option value="AIDS">AIDS</option>
            <option value="BOTH">BOTH</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="ALL">All Types</option>
            {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="ALL">All Years</option>
            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">From:</span>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">To:</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="date">Sort: Date</option>
            <option value="name">Sort: Name</option>
            <option value="participants">Sort: Participants</option>
          </select>
          <button
            onClick={() => { setSearch(''); setDeptFilter('ALL'); setTypeFilter('ALL'); setYearFilter('ALL'); setFromDate(''); setToDate(''); }}
            className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-3 py-1.5 rounded-xl bg-slate-50"
          >
            Clear Filters
          </button>
          <button onClick={exportExcel} disabled={!filtered.length} className="text-xs text-green-700 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed border border-green-200 px-3 py-1.5 rounded-xl bg-green-50 font-medium ml-auto">
            📥 Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Event Name', 'Type', 'Dept', 'Year(s)', 'Date', 'Time', 'Venue', 'Faculty Coordinators', 'Resource Person', 'Sponsored By', 'Participants', 'Attendance', 'Feedback', 'Doc Status', 'Report', 'Action'].map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={16} className="text-center py-12 text-slate-400">Loading events...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-2">🔍</div>
                    <div className="font-medium">No events found</div>
                    <div className="text-xs mt-1">Try adjusting your filters</div>
                  </td>
                </tr>
              ) : filtered.map((event, i) => (
                <tr key={event.id} className={`border-b border-slate-50 hover:bg-indigo-50/30 cursor-pointer ${i % 2 === 0 ? '' : 'bg-slate-50/20'}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate('event-details', event.id)} className="text-left">
                      <div className="font-medium text-slate-800 hover:text-indigo-700">{event.name}</div>
                      <div className="text-xs text-slate-400">{event.id}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${eventTypeColors[event.type] || 'bg-gray-100 text-gray-700'}`}>{event.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      event.department === 'IT' ? 'bg-blue-100 text-blue-700' :
                      event.department === 'AIDS' ? 'bg-violet-100 text-violet-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{event.department === 'BOTH' ? 'BOTH – IT+AIDS' : event.department}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{event.targetYears?.length ? event.targetYears.map(year => `Year ${year}`).join(', ') : event.targetStudents || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{event.dateTo && event.dateTo !== event.date ? `${event.date} - ${event.dateTo}` : event.date}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{event.startTime}–{event.endTime}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs max-w-28 truncate">{event.venue}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs max-w-52">
                    <div>{event.assignedFaculty?.length ? 'Faculty Coordinators' : event.coordinator}</div>
                    {event.assignedFaculty?.length ? <div className="text-[10px] text-indigo-500 truncate" title={event.assignedFaculty.map(manager => typeof manager === 'string' ? manager : `${manager.name}${manager.designation ? ` (${manager.designation})` : ''}`).join(', ')}>{event.assignedFaculty.map(manager => typeof manager === 'string' ? manager : `${manager.name}${manager.designation ? ` (${manager.designation})` : ''}`).join(', ')}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{event.resourcePerson.name}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{event.sponsoredBy || '—'}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium text-center">{event.actualParticipants || '—'}</td>
                  <td className="px-4 py-3">
                    {event.attendance > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${event.attendance}%` }} />
                        </div>
                        <span className="text-xs text-slate-600">{event.attendance}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {event.feedbackScore > 0 ? <span className="text-amber-600 font-medium text-xs">⭐ {event.feedbackScore}</span> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      event.docStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                      event.docStatus === 'Partial' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{event.docStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                      event.reportStatus === 'Approved' ? 'bg-green-100 text-green-700' :
                      event.reportStatus === 'Generated' ? 'bg-blue-100 text-blue-700' :
                      event.reportStatus === 'Draft' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{event.reportStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate('event-details', event.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50 whitespace-nowrap"
                    >
                      View Event
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
