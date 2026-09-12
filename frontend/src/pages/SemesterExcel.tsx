import { academicYears } from '../data/sampleData';
import * as XLSX from 'xlsx';
import { useEffect, useState } from 'react';
import type { EventRecord } from '../types';
import { getEvents } from '../services/api';

interface SemesterExcelProps { academicYear?: string; }

export default function SemesterExcel({ academicYear = '' }: SemesterExcelProps) {
  const [yearFilter, setYearFilter] = useState('ALL');
  const [semFilter, setSemFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isExporting, setIsExporting] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);

  useEffect(() => {
    getEvents({ academicYear: academicYear || undefined }).then(setEvents).catch(() => setEvents([]));
    if (academicYear) setYearFilter(academicYear);
  }, [academicYear]);

  const filtered = events.filter(e => {
    const matchYear = yearFilter === 'ALL' || e.academicYear === yearFilter;
    const matchSem = semFilter === 'ALL' || e.semester === semFilter;
    const matchDept = deptFilter === 'ALL' || e.department === deptFilter;
    const matchFrom = !fromDate || e.date >= fromDate;
    const matchTo = !toDate || e.date <= toDate;
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.type.toLowerCase().includes(search.toLowerCase());
    return matchYear && matchSem && matchDept && matchFrom && matchTo && matchSearch;
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortCol === 'date') return a.date.localeCompare(b.date) * dir;
    if (sortCol === 'name') return a.name.localeCompare(b.name) * dir;
    if (sortCol === 'participants') return ((a.actualParticipants || 0) - (b.actualParticipants || 0)) * dir;
    return 0;
  });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);

      const exportData = filtered.map((e, i) => ({
        'S.No': i + 1,
        'Academic Year': e.academicYear,
        'Semester': `Sem ${e.semester}`,
        'Department': e.department,
        'Year/Class': (e.targetStudents || '').split(' ').slice(0, 3).join(' '),
        'Event Type': e.type,
        'Event Name': e.name,
        'Event Date': e.date,
        'Time': `${e.startTime}–${e.endTime}`,
        'Coordinator': e.coordinator.split(' ').slice(0, 2).join(' '),
        'Resource Person': e.resourcePerson?.name || '',
        'Designation': e.resourcePerson?.designation || '',
        'Organization': e.resourcePerson?.organization || '',
        'Mode': e.mode,
        'Venue': e.venue,
        'Participants': e.actualParticipants || '—',
        'Attendance %': e.attendance > 0 ? `${e.attendance}%` : '—',
        'Feedback Score': e.feedbackScore > 0 ? e.feedbackScore : '—',
        'Doc Status': e.docStatus,
        'Status': e.status,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Events');

      const colWidths = [
        { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
        { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
        { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 18 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      ];
      ws['!cols'] = colWidths;

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Semester-Events-${yearFilter}-${semFilter}-${timestamp}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Failed to export Excel file');
    } finally {
      setIsExporting(false);
    }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-indigo-200">{sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  );

  const columns = [
    { key: 'sno', label: 'S.No', sortable: false },
    { key: 'academicYear', label: 'Academic Year', sortable: false },
    { key: 'semester', label: 'Semester', sortable: false },
    { key: 'department', label: 'Department', sortable: false },
    { key: 'class', label: 'Year/Class', sortable: false },
    { key: 'type', label: 'Event Type', sortable: false },
    { key: 'name', label: 'Event Name', sortable: true },
    { key: 'date', label: 'Event Date', sortable: true },
    { key: 'time', label: 'Time', sortable: false },
    { key: 'coordinator', label: 'Coordinator', sortable: false },
    { key: 'resourcePerson', label: 'Resource Person', sortable: false },
    { key: 'rpDesignation', label: 'Designation', sortable: false },
    { key: 'organization', label: 'Organization', sortable: false },
    { key: 'mode', label: 'Mode', sortable: false },
    { key: 'venue', label: 'Venue', sortable: false },
    { key: 'participants', label: 'Participants', sortable: true },
    { key: 'attendance', label: 'Attendance %', sortable: false },
    { key: 'feedback', label: 'Feedback', sortable: false },
    { key: 'docStatus', label: 'Doc Status', sortable: false },
    { key: 'status', label: 'Status', sortable: false },
  ];

  const inputCls = "px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Semester Event Master Register</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">Consolidated spreadsheet data grid for departmental academic events</p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={isExporting || filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isExporting ? 'Generating Excel...' : 'Export Consolidated Excel'}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex flex-wrap gap-2.5">
          <input
            type="text"
            placeholder="Search dataset..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={inputCls + ' min-w-[200px] flex-1'}
          />

          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={inputCls}>
            <option value="ALL">All Academic Years</option>
            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <select value={semFilter} onChange={e => setSemFilter(e.target.value)} className={inputCls}>
            <option value="ALL">All Semesters</option>
            <option value="I">Odd Semester (I)</option>
            <option value="II">Even Semester (II)</option>
          </select>

          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className={inputCls}>
            <option value="ALL">All Departments</option>
            <option value="IT">IT</option>
            <option value="AIDS">AIDS</option>
            <option value="BOTH">BOTH</option>
          </select>

          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputCls} />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputCls} />
        </div>

        <div className="text-xs font-medium text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
          <span>Showing <strong className="text-slate-900">{filtered.length}</strong> event records</span>
          {(search || yearFilter !== 'ALL' || semFilter !== 'ALL' || deptFilter !== 'ALL' || fromDate || toDate) && (
            <button
              onClick={() => { setSearch(''); setYearFilter('ALL'); setSemFilter('ALL'); setDeptFilter('ALL'); setFromDate(''); setToDate(''); }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Grid Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900 text-white font-heading">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`px-3 py-3 font-semibold whitespace-nowrap border-r border-slate-800 text-[11px] uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    {col.label}{col.sortable && <SortIcon col={col.key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={20} className="py-12 text-center text-slate-400">
                    No matching event rows in scope.
                  </td>
                </tr>
              ) : (
                filtered.map((e, i) => (
                  <tr key={e.id} className={`hover:bg-indigo-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <td className="px-3 py-2.5 text-slate-400 font-mono text-[11px] border-r border-slate-100">{i + 1}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 font-medium text-slate-700">{e.academicYear}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-slate-600 whitespace-nowrap">{e.semester === 'I' ? 'Odd' : 'Even'}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        e.department === 'IT' ? 'bg-blue-50 text-blue-700' :
                        e.department === 'AIDS' ? 'bg-purple-50 text-purple-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {e.department}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-slate-600 whitespace-nowrap">{(e.targetStudents || '').split(' ').slice(0, 3).join(' ') || '—'}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-slate-700 font-medium whitespace-nowrap">{e.type}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 border-r border-slate-100 max-w-52 truncate" title={e.name}>{e.name}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 whitespace-nowrap font-mono text-slate-700">{e.date}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 whitespace-nowrap text-slate-500">{e.startTime}–{e.endTime}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 whitespace-nowrap text-slate-700 max-w-36 truncate">{e.coordinator}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 whitespace-nowrap text-slate-700 max-w-36 truncate">{e.resourcePerson?.name || '—'}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-slate-500 max-w-32 truncate">{e.resourcePerson?.designation || '—'}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-slate-500 max-w-32 truncate">{e.resourcePerson?.organization || '—'}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-slate-600">{e.mode}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-slate-600 max-w-32 truncate">{e.venue}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-center font-bold text-slate-900">{e.actualParticipants || '—'}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-center text-slate-700 font-medium">{e.attendance > 0 ? `${e.attendance}%` : '—'}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 text-center">{e.feedbackScore > 0 ? `⭐ ${e.feedbackScore}` : '—'}</td>
                    <td className="px-3 py-2.5 border-r border-slate-100 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        e.docStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                        e.docStatus === 'Partial' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {e.docStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        e.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {e.status}
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
