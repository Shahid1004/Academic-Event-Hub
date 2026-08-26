import { useState } from 'react';
import { sampleEvents, eventTypes, academicYears } from '../data/sampleData';

export default function Reports() {
  const [yearFilter, setYearFilter] = useState('2025-26');
  const [semFilter, setSemFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [coordinatorFilter, setCoordinatorFilter] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('ALL');
  const [generating, setGenerating] = useState<string | null>(null);

  const filtered = sampleEvents.filter(e => {
    const matchYear = yearFilter === 'ALL' || e.academicYear === yearFilter;
    const matchSem = semFilter === 'ALL' || e.semester === semFilter;
    const matchDept = deptFilter === 'ALL' || e.department === deptFilter;
    const matchFrom = !fromDate || e.date >= fromDate;
    const matchTo = !toDate || e.date <= toDate;
    const matchType = typeFilter === 'ALL' || e.type === typeFilter;
    const matchCoord = !coordinatorFilter || e.coordinator.toLowerCase().includes(coordinatorFilter.toLowerCase());
    const matchStatus = reportStatusFilter === 'ALL' || e.reportStatus === reportStatusFilter;
    return matchYear && matchSem && matchDept && matchFrom && matchTo && matchType && matchCoord && matchStatus;
  });

  const handleGenerate = (type: string) => {
    setGenerating(type);
    setTimeout(() => setGenerating(null), 2000);
  };

  const reportTypes = [
    { id: 'individual', label: 'Individual Event Report', desc: 'Detailed report for a specific event', icon: '📄' },
    { id: 'department', label: 'Department Event Report', desc: 'All events for a department', icon: '🏢' },
    { id: 'semester', label: 'Semester Report', desc: 'Summary for the entire semester', icon: '📚' },
    { id: 'annual', label: 'Academic Year Report', desc: 'Annual comprehensive report', icon: '📅' },
    { id: 'combined', label: 'Combined IT + AIDS Report', desc: 'Joint department report', icon: '🔗' },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">Reports Module</h1>
        <p className="text-slate-500 text-sm">Generate and download academic event reports</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3">Filter Events for Report</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Academic Year</label>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="ALL">All Years</option>
              {academicYears.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Semester</label>
            <select value={semFilter} onChange={e => setSemFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="ALL">All Semesters</option>
              <option value="I">Odd semester</option>
              <option value="II">Even semester</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Department</label>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="ALL">All</option>
              <option value="IT">IT</option>
              <option value="AIDS">AIDS</option>
              <option value="BOTH">BOTH</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Event Type</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="ALL">All Types</option>
              {eventTypes.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Date From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Date To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Coordinator</label>
            <input value={coordinatorFilter} onChange={e => setCoordinatorFilter(e.target.value)} placeholder="Search coordinator..." className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Report Status</label>
            <select value={reportStatusFilter} onChange={e => setReportStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="ALL">All</option>
              <option>Not Generated</option>
              <option>Draft</option>
              <option>Generated</option>
              <option>Approved</option>
            </select>
          </div>
        </div>
        <div className="mt-3 text-sm text-slate-500">{filtered.length} events match your filters</div>
      </div>

      {/* Generate Report Cards */}
      <div>
        <h3 className="font-bold font-heading text-slate-800 mb-3">Generate Reports</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map(rt => (
            <div key={rt.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="text-3xl mb-3">{rt.icon}</div>
              <h4 className="font-bold font-heading text-slate-800">{rt.label}</h4>
              <p className="text-sm text-slate-500 mt-1 mb-4">{rt.desc}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerate(rt.id)}
                  disabled={generating === rt.id}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium disabled:opacity-60"
                >
                  {generating === rt.id ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </span>
                  ) : 'Generate'}
                </button>
                <button className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">Preview</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Events Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold font-heading text-slate-800">Events in Scope ({filtered.length})</h3>
          <div className="flex gap-2">
            <button className="text-sm border border-green-200 text-green-700 px-3 py-1.5 rounded-xl hover:bg-green-50">📥 Download PDF</button>
            <button className="text-sm border border-blue-200 text-blue-700 px-3 py-1.5 rounded-xl hover:bg-blue-50">🖨️ Print</button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['ID', 'Event Name', 'Type', 'Dept', 'Date', 'Participants', 'Doc Status', 'Report Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} className={`border-b border-slate-50 hover:bg-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/20'}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{e.type}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.department === 'IT' ? 'bg-blue-100 text-blue-700' : e.department === 'AIDS' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>{e.department}</span></td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3 text-slate-700">{e.actualParticipants || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.docStatus === 'Completed' ? 'bg-green-100 text-green-700' : e.docStatus === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{e.docStatus}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.reportStatus === 'Approved' ? 'bg-green-100 text-green-700' : e.reportStatus === 'Generated' ? 'bg-blue-100 text-blue-700' : e.reportStatus === 'Draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{e.reportStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
