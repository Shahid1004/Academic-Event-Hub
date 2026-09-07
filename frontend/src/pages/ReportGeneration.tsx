// Academic Event Report Generation Page
// Path: frontend/src/pages/ReportGeneration.tsx

import React, { useState, useMemo } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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
    let page = pdf.addPage([595, 842]); // A4
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

    // Header
    drawText(report.header.institution, 14, true);
    drawText(report.header.title, 12, true);
    drawText(`Period: ${report.header.selectedPeriod}`, 10);
    drawText(`Generated: ${report.header.generatedDate}`, 10);
    yPosition -= 10;

    // Summary
    drawText('EXECUTIVE SUMMARY', 11, true);
    drawText(`Total Events: ${report.summary.totalEvents}`, 9);
    drawText(`Total Participants: ${report.summary.totalParticipants}`, 9);
    drawText(`Faculty Coordinators: ${report.summary.facultyCoordinators}`, 9);
    yPosition -= 10;

    // Events Table
    drawText('EVENTS CONDUCTED', 11, true);
    report.events.slice(0, 10).forEach((event, idx) => {
      drawText(`${idx + 1}. ${event.name} - ${event.date}`, 8);
    });
    yPosition -= 10;

    // Key Findings
    drawText('KEY FINDINGS', 11, true);
    report.keyFindings.forEach((finding, idx) => {
      drawText(`${idx + 1}. ${finding}`, 8);
    });
    yPosition -= 10;

    // Conclusion
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

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate('dashboard')} className="text-blue-600 hover:text-blue-800 mb-4">
          ← Back to Dashboard
        </button>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Academic Event Report Generation</h1>
        <p className="text-slate-600">Generate comprehensive reports based on selected time periods</p>
      </div>

      {/* Filter Panel */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-slate-200">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Report Filters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Report Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="month">Month</option>
              <option value="semester">Semester</option>
              <option value="year">Academic Year</option>
            </select>
          </div>

          {/* Month/Semester/Year Selection */}
          {filters.type === 'month' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Month</label>
                <select
                  value={filters.month}
                  onChange={(e) => handleFilterChange('month', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
                <select
                  value={filters.year}
                  onChange={(e) => handleFilterChange('year', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Semester</label>
                <select
                  value={filters.semester}
                  onChange={(e) => handleFilterChange('semester', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="odd">Odd</option>
                  <option value="even">Even</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Academic Year</label>
                <select
                  value={filters.academicYear}
                  onChange={(e) => handleFilterChange('academicYear', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
              <label className="block text-sm font-medium text-slate-700 mb-2">Academic Year</label>
              <select
                value={filters.academicYear}
                onChange={(e) => handleFilterChange('academicYear', e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="2023-24">2023-24</option>
                <option value="2024-25">2024-25</option>
                <option value="2025-26">2025-26</option>
              </select>
            </div>
          )}
        </div>

        <button
          onClick={generatePdf}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition"
        >
          📥 Download as PDF
        </button>
      </div>

      {/* Report Sections */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Section Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
          {['summary', 'events', 'statistics', 'findings', 'conclusion'].map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section as any)}
              className={`px-6 py-3 font-medium capitalize whitespace-nowrap transition ${
                activeSection === section
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {section === 'summary' && '📊 Summary'}
              {section === 'events' && '📋 Events'}
              {section === 'statistics' && '📈 Statistics'}
              {section === 'findings' && '🔍 Findings'}
              {section === 'conclusion' && '✅ Conclusion'}
            </button>
          ))}
        </div>

        {/* Section Content */}
        <div className="p-8">
          {/* Executive Summary */}
          {activeSection === 'summary' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">{report.header.title}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600">{report.summary.totalEvents}</div>
                  <div className="text-sm text-slate-600">Total Events</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600">{report.summary.totalParticipants}</div>
                  <div className="text-sm text-slate-600">Participants</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="text-3xl font-bold text-purple-600">{report.summary.facultyCoordinators}</div>
                  <div className="text-sm text-slate-600">Faculty</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="text-3xl font-bold text-orange-600">{Object.keys(report.statistics.eventsByType).length}</div>
                  <div className="text-sm text-slate-600">Event Types</div>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-4">Report Details</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Institution:</span> {report.header.institution}</p>
                  <p><span className="font-medium">Period:</span> {report.header.selectedPeriod}</p>
                  <p><span className="font-medium">Academic Year:</span> {report.header.academicYear}</p>
                  <p><span className="font-medium">Generated:</span> {report.header.generatedDate}</p>
                </div>
              </div>
            </div>
          )}

          {/* Events Table */}
          {activeSection === 'events' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Events Conducted</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-300">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">S.No</th>
                      <th className="px-4 py-3 text-left font-semibold">Event Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Type</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Department</th>
                      <th className="px-4 py-3 text-left font-semibold">Coordinator</th>
                      <th className="px-4 py-3 text-right font-semibold">Participants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.events.map((event, idx) => (
                      <tr key={event.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-4 py-3">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium">{event.name}</td>
                        <td className="px-4 py-3">{event.type}</td>
                        <td className="px-4 py-3">{event.date}</td>
                        <td className="px-4 py-3">{event.department}</td>
                        <td className="px-4 py-3">{event.coordinator}</td>
                        <td className="px-4 py-3 text-right font-medium">{event.actualParticipants || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Statistics */}
          {activeSection === 'statistics' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">Statistical Analysis</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="text-sm text-slate-600">Most Active Department</div>
                  <div className="text-xl font-bold text-slate-900">{report.statistics.mostActiveDepartment}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="text-sm text-slate-600">Most Common Event Type</div>
                  <div className="text-xl font-bold text-slate-900">{report.statistics.mostCommonEventType}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="text-sm text-slate-600">Total Participants</div>
                  <div className="text-xl font-bold text-slate-900">{report.statistics.participantCount}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3">Events by Type</h3>
                  <div className="space-y-2">
                    {Object.entries(report.statistics.eventsByType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="text-slate-700">{type}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(count / report.summary.totalEvents) * 100}%` }}></div>
                          </div>
                          <span className="text-sm font-medium text-slate-900">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-3">Events by Department</h3>
                  <div className="space-y-2">
                    {Object.entries(report.statistics.eventsByDepartment).map(([dept, count]) => (
                      <div key={dept} className="flex justify-between items-center">
                        <span className="text-slate-700">{dept}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full">
                            <div className="h-full bg-green-600 rounded-full" style={{ width: `${(count / report.summary.totalEvents) * 100}%` }}></div>
                          </div>
                          <span className="text-sm font-medium text-slate-900">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Findings */}
          {activeSection === 'findings' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Key Findings</h2>
              <div className="space-y-3">
                {report.keyFindings.map((finding, idx) => (
                  <div key={idx} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex gap-4">
                      <div className="text-2xl font-bold text-blue-600">{idx + 1}</div>
                      <div className="text-slate-800">{finding}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conclusion */}
          {activeSection === 'conclusion' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Conclusion</h2>
              <div className="bg-slate-50 p-8 rounded-lg border border-slate-200">
                <p className="text-slate-800 leading-relaxed text-lg">{report.conclusion}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportGeneration;
