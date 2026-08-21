import { useState } from 'react';
import { sampleEvents, academicYears, eventTypes } from '../data/sampleData';

export default function SemesterExcel() {
  const [yearFilter, setYearFilter] = useState('2025-26');
  const [semFilter, setSemFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = sampleEvents.filter(e => {
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
    if (sortCol === 'participants') return (a.actualParticipants - b.actualParticipants) * dir;
    return 0;
  });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-slate-300">{sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
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

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">Semester Event Register</h1>
        <p className="text-slate-500 text-sm mt-0.5">Excel-style dataset of all events conducted during the semester</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 min-w-44 flex-1"
          />
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="ALL">All Years</option>
            {academicYears.map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={semFilter} onChange={e => setSemFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="ALL">All Semesters</option>
            <option value="I">Semester I</option>
            <option value="II">Semester II</option>
          </select>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="ALL">All Departments</option>
            <option value="IT">IT</option>
            <option value="AIDS">AIDS</option>
            <option value="BOTH">BOTH</option>
          </select>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <button className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium">📥 Export Excel</button>
          <button className="px-3 py-2 border border-green-200 text-green-700 rounded-xl text-sm hover:bg-green-50">⬇️ Download Excel</button>
        </div>
        <div className="mt-2 text-xs text-slate-500">{filtered.length} records</div>
      </div>

      {/* Excel Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-indigo-600 text-white">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 text-left font-semibold whitespace-nowrap border-r border-indigo-500 ${col.sortable ? 'cursor-pointer hover:bg-indigo-700' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    {col.label}{col.sortable && <SortIcon col={col.key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} className={`border-b border-slate-100 hover:bg-indigo-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <td className="px-3 py-2 text-slate-500 border-r border-slate-100">{i + 1}</td>
                  <td className="px-3 py-2 border-r border-slate-100">{e.academicYear}</td>
                  <td className="px-3 py-2 border-r border-slate-100">Sem {e.semester}</td>
                  <td className="px-3 py-2 border-r border-slate-100">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${e.department === 'IT' ? 'bg-blue-100 text-blue-700' : e.department === 'AIDS' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>{e.department}</span>
                  </td>
                  <td className="px-3 py-2 border-r border-slate-100">{e.targetStudents.split(' ').slice(0, 3).join(' ')}</td>
                  <td className="px-3 py-2 border-r border-slate-100">{e.type}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 border-r border-slate-100 max-w-48">{e.name}</td>
                  <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">{e.date}</td>
                  <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">{e.startTime}–{e.endTime}</td>
                  <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">{e.coordinator.split(' ').slice(0, 2).join(' ')}</td>
                  <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap">{e.resourcePerson.name}</td>
                  <td className="px-3 py-2 border-r border-slate-100">{e.resourcePerson.designation}</td>
                  <td className="px-3 py-2 border-r border-slate-100">{e.resourcePerson.organization}</td>
                  <td className="px-3 py-2 border-r border-slate-100">{e.mode}</td>
                  <td className="px-3 py-2 border-r border-slate-100 max-w-32 truncate">{e.venue}</td>
                  <td className="px-3 py-2 border-r border-slate-100 text-center font-medium">{e.actualParticipants || '—'}</td>
                  <td className="px-3 py-2 border-r border-slate-100 text-center">{e.attendance > 0 ? `${e.attendance}%` : '—'}</td>
                  <td className="px-3 py-2 border-r border-slate-100 text-center">{e.feedbackScore > 0 ? `⭐${e.feedbackScore}` : '—'}</td>
                  <td className="px-3 py-2 border-r border-slate-100"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${e.docStatus === 'Completed' ? 'bg-green-100 text-green-700' : e.docStatus === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{e.docStatus}</span></td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${e.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
