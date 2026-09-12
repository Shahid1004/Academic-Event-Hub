import { useEffect, useState } from 'react';
import { eventTypes, academicYears } from '../data/sampleData';
import type { EventRecord } from '../types';
import { getEvents } from '../services/api';

interface ReportsProps { academicYear?: string; }

export default function Reports({ academicYear = '' }: ReportsProps) {
  const [yearFilter, setYearFilter] = useState('2025-26');
  const [semFilter, setSemFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [coordinatorFilter, setCoordinatorFilter] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('ALL');
  const [generating, setGenerating] = useState<string | null>(null);
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
    {
      id: 'individual',
      label: 'Individual Event Report',
      desc: 'NAAC compliant detailed event summary report with photo proof & attendance',
      icon: (
        <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'department',
      label: 'Departmental Annual Dossier',
      desc: 'Consolidated performance overview for IT or AIDS department events',
      icon: (
        <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5m-5 0V11m0 0H9m4 0h2" />
        </svg>
      )
    },
    {
      id: 'semester',
      label: 'Semester Summary Booklet',
      desc: 'Odd / Even semester curriculum audit report for accreditation bodies',
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      id: 'annual',
      label: 'Academic Year Master Report',
      desc: 'Comprehensive annual statistical analysis and event registry report',
      icon: (
        <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'combined',
      label: 'Joint IT + AI/DS Event Report',
      desc: 'Collaborative events report covering inter-departmental activities',
      icon: (
        <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    },
  ];

  const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500";
  const labelCls = "text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Institutional Reports Module</h1>
        <p className="text-slate-500 text-sm mt-0.5 font-medium">Generate NAAC & NBA compliant documentation and consolidated reports</p>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold font-heading text-slate-900 text-sm">Scope Filter Criteria</h3>
          <span className="text-xs font-medium text-slate-500">
            Matching Events: <span className="text-indigo-600 font-bold">{filtered.length}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Academic Year</label>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className={inputCls}>
              <option value="ALL">All Years</option>
              {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Semester</label>
            <select value={semFilter} onChange={e => setSemFilter(e.target.value)} className={inputCls}>
              <option value="ALL">All Semesters</option>
              <option value="I">Odd Semester (I)</option>
              <option value="II">Even Semester (II)</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Department</label>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className={inputCls}>
              <option value="ALL">All Departments</option>
              <option value="IT">IT</option>
              <option value="AIDS">AIDS</option>
              <option value="BOTH">BOTH (IT+AIDS)</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Event Type</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={inputCls}>
              <option value="ALL">All Event Types</option>
              {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Date From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Date To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Coordinator Name</label>
            <input value={coordinatorFilter} onChange={e => setCoordinatorFilter(e.target.value)} placeholder="Filter by faculty..." className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Report Audit Status</label>
            <select value={reportStatusFilter} onChange={e => setReportStatusFilter(e.target.value)} className={inputCls}>
              <option value="ALL">All Statuses</option>
              <option value="Not Generated">Not Generated</option>
              <option value="Draft">Draft</option>
              <option value="Generated">Generated</option>
              <option value="Approved">Approved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Action Cards */}
      <div>
        <h3 className="font-bold font-heading text-slate-900 text-sm mb-3">Available Institutional Reports</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map(rt => (
            <div key={rt.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:border-indigo-300 transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform">
                  {rt.icon}
                </div>
                <h4 className="font-bold font-heading text-slate-900 text-sm">{rt.label}</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">{rt.desc}</p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleGenerate(rt.id)}
                  disabled={generating === rt.id}
                  className="flex-1 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-60"
                >
                  {generating === rt.id ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Compiling...
                    </span>
                  ) : 'Generate Report'}
                </button>
                <button className="px-3 py-2 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 transition-all">
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scope Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold font-heading text-slate-900 text-sm">Events Included in Active Scope ({filtered.length})</h3>
          <div className="flex gap-2">
            <button className="text-xs font-semibold border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Batch PDF Export
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {['Event ID', 'Title', 'Type', 'Dept', 'Date', 'Participants', 'Doc Status', 'Report Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      No events matched the current filter scope.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e, i) => (
                    <tr key={e.id} className={`hover:bg-indigo-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{e.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{e.name}</td>
                      <td className="px-4 py-3 text-slate-500">{e.type}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          e.department === 'IT' ? 'bg-blue-50 text-blue-700' :
                          e.department === 'AIDS' ? 'bg-purple-50 text-purple-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {e.department}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{e.date}</td>
                      <td className="px-4 py-3 text-slate-900 font-bold">{e.actualParticipants || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          e.docStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                          e.docStatus === 'Partial' ? 'bg-amber-50 text-amber-700' :
                          'bg-rose-50 text-rose-700'
                        }`}>
                          {e.docStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          e.reportStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                          e.reportStatus === 'Generated' ? 'bg-blue-50 text-blue-700' :
                          e.reportStatus === 'Draft' ? 'bg-amber-50 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {e.reportStatus}
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
    </div>
  );
}
