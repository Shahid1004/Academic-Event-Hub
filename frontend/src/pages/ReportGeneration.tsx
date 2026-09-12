import React, { useState, useMemo } from 'react';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { ReportFilters, generateReport } from '../utils/reportGenerator';
import { EventRecord, Page } from '../types';

interface ReportGenerationProps {
  events: EventRecord[];
  navigate: (page: Page) => void;
}

export const ReportGeneration: React.FC<ReportGenerationProps> = ({ events, navigate }) => {
  const [filters, setFilters] = useState<ReportFilters>({ type: 'month', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [activeSection, setActiveSection] = useState<'summary' | 'events' | 'statistics' | 'findings' | 'conclusion'>('summary');

  const report = useMemo(() => generateReport(events, filters, events), [events, filters]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const generatePdf = async () => {
    const pdf = await PDFDocument.create();
    let page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    let yPosition = 800;
    const margin = 40;
    const pageWidth = 595 - (2 * margin);
    const lineHeight = 12;

    const drawText = (text: string, size: number, bold: boolean = false) => {
      if (yPosition < 50) {
        page = pdf.addPage([595, 842]);
        yPosition = 800;
      }
      const selectedFont = bold ? boldFont : font;
      const words = text.split(' ');
      let line = '';

      words.forEach(word => {
        const testLine = line + (line ? ' ' : '') + word;
        if (testLine.length * (size * 0.5) > pageWidth && line) {
          page.drawText(line, { x: margin, y: yPosition, size, font: selectedFont });
          yPosition -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      });

      if (line) {
        page.drawText(line, { x: margin, y: yPosition, size, font: selectedFont });
        yPosition -= lineHeight;
      }
    };

    drawText(report.header.institution, 14, true);
    drawText(report.header.title, 12, true);
    drawText(`Period: ${report.header.selectedPeriod}`, 10);
    drawText(`Generated: ${report.header.generatedDate}`, 10);
    yPosition -= 10;

    drawText('EXECUTIVE SUMMARY', 11, true);
    drawText(`Total Events: ${report.summary.totalEvents}`, 9);
    drawText(`Total Participants: ${report.summary.totalParticipants}`, 9);
    drawText(`Faculty Coordinators: ${report.summary.facultyCoordinators}`, 9);
    yPosition -= 10;

    drawText('EVENTS CONDUCTED', 11, true);
    report.events.slice(0, 10).forEach((event, idx) => {
      drawText(`${idx + 1}. ${event.name} - ${event.date}`, 8);
    });
    yPosition -= 10;

    drawText('KEY FINDINGS', 11, true);
    report.keyFindings.forEach((finding, idx) => {
      drawText(`${idx + 1}. ${finding}`, 8);
    });
    yPosition -= 10;

    drawText('CONCLUSION', 11, true);
    drawText(report.conclusion, 8);

    const bytes = await pdf.save();
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `Academic-Event-Report-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const selectCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
  const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('dashboard')} className="text-xs text-indigo-600 font-semibold hover:underline mb-1 flex items-center gap-1">
            &larr; Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Academic Event Report Compiler</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Generate formatted executive summary reports and download PDF documentation</p>
        </div>

        <button
          onClick={generatePdf}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF Report
        </button>
      </div>

      {/* Filter Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
        <h2 className="font-bold font-heading text-slate-900 text-sm pb-2 border-b border-slate-100">Report Filter Scope</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Report Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className={selectCls}
            >
              <option value="month">Monthly Report</option>
              <option value="semester">Semester Report</option>
              <option value="year">Academic Year Report</option>
            </select>
          </div>

          {filters.type === 'month' && (
            <>
              <div>
                <label className={labelCls}>Month</label>
                <select
                  value={filters.month}
                  onChange={(e) => handleFilterChange('month', parseInt(e.target.value))}
                  className={selectCls}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Year</label>
                <select
                  value={filters.year}
                  onChange={(e) => handleFilterChange('year', parseInt(e.target.value))}
                  className={selectCls}
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
              </div>
            </>
          )}

          {filters.type === 'semester' && (
            <>
              <div>
                <label className={labelCls}>Semester</label>
                <select
                  value={filters.semester}
                  onChange={(e) => handleFilterChange('semester', e.target.value)}
                  className={selectCls}
                >
                  <option value="odd">Odd Semester</option>
                  <option value="even">Even Semester</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Academic Year</label>
                <select
                  value={filters.academicYear}
                  onChange={(e) => handleFilterChange('academicYear', e.target.value)}
                  className={selectCls}
                >
                  <option value="2023-24">2023-24</option>
                  <option value="2024-25">2024-25</option>
                  <option value="2025-26">2025-26</option>
                </select>
              </div>
            </>
          )}

          {filters.type === 'year' && (
            <div>
              <label className={labelCls}>Academic Year</label>
              <select
                value={filters.academicYear}
                onChange={(e) => handleFilterChange('academicYear', e.target.value)}
                className={selectCls}
              >
                <option value="2023-24">2023-24</option>
                <option value="2024-25">2024-25</option>
                <option value="2025-26">2025-26</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Report Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Section Navigation Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/60 overflow-x-auto p-1.5 gap-1">
          {[
            { id: 'summary', label: 'Executive Summary' },
            { id: 'events', label: 'Events Catalogue' },
            { id: 'statistics', label: 'Statistical Breakdown' },
            { id: 'findings', label: 'Key Findings' },
            { id: 'conclusion', label: 'Conclusion' }
          ].map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeSection === section.id
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeSection === 'summary' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold font-heading text-slate-900">{report.header.title}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                  <div className="text-2xl font-extrabold font-heading text-indigo-600">{report.summary.totalEvents}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">Total Events</div>
                </div>
                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                  <div className="text-2xl font-extrabold font-heading text-emerald-600">{report.summary.totalParticipants.toLocaleString()}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">Total Participants</div>
                </div>
                <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100">
                  <div className="text-2xl font-extrabold font-heading text-purple-600">{report.summary.facultyCoordinators}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">Faculty Coordinators</div>
                </div>
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-100">
                  <div className="text-2xl font-extrabold font-heading text-amber-600">{Object.keys(report.statistics.eventsByType).length}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">Event Categories</div>
                </div>
              </div>
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-2 text-xs">
                <h3 className="font-bold text-slate-900 text-sm mb-2">Report Metadata</h3>
                <p><span className="font-semibold text-slate-600">Institution:</span> {report.header.institution}</p>
                <p><span className="font-semibold text-slate-600">Scope Period:</span> {report.header.selectedPeriod}</p>
                <p><span className="font-semibold text-slate-600">Academic Session:</span> {report.header.academicYear}</p>
                <p><span className="font-semibold text-slate-600">Compilation Timestamp:</span> {report.header.generatedDate}</p>
              </div>
            </div>
          )}

          {activeSection === 'events' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold font-heading text-slate-900">Events Conducted Catalogue</h2>
              <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Event Title</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dept</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Coordinator</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Participants</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.events.map((event, idx) => (
                      <tr key={event.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{event.name}</td>
                        <td className="px-4 py-3 text-slate-600">{event.type}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{event.date}</td>
                        <td className="px-4 py-3 font-semibold text-indigo-600">{event.department}</td>
                        <td className="px-4 py-3 text-slate-700">{event.coordinator}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{event.actualParticipants || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'statistics' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold font-heading text-slate-900">Statistical Analysis Overview</h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Most Active Department</div>
                  <div className="text-lg font-bold font-heading text-indigo-600 mt-1">{report.statistics.mostActiveDepartment}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Primary Event Category</div>
                  <div className="text-lg font-bold font-heading text-purple-600 mt-1">{report.statistics.mostCommonEventType}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Total Verified Participants</div>
                  <div className="text-lg font-bold font-heading text-emerald-600 mt-1">{report.statistics.participantCount.toLocaleString()}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">Events by Type</h3>
                  <div className="space-y-2.5">
                    {Object.entries(report.statistics.eventsByType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center text-xs">
                        <span className="font-medium text-slate-700">{type}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(count / (report.summary.totalEvents || 1)) * 100}%` }} />
                          </div>
                          <span className="font-bold text-slate-900 min-w-4 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">Events by Department</h3>
                  <div className="space-y-2.5">
                    {Object.entries(report.statistics.eventsByDepartment).map(([dept, count]) => (
                      <div key={dept} className="flex justify-between items-center text-xs">
                        <span className="font-medium text-slate-700">{dept}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(count / (report.summary.totalEvents || 1)) * 100}%` }} />
                          </div>
                          <span className="font-bold text-slate-900 min-w-4 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'findings' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold font-heading text-slate-900">Key Analytical Findings</h2>
              <div className="space-y-3">
                {report.keyFindings.map((finding, idx) => (
                  <div key={idx} className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div className="text-xs text-slate-800 font-medium leading-relaxed mt-0.5">{finding}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'conclusion' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold font-heading text-slate-900">Executive Conclusion</h2>
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200/80">
                <p className="text-slate-800 text-xs leading-relaxed font-medium">{report.conclusion}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportGeneration;
