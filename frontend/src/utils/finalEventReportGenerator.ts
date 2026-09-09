import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { EventRecord } from '../types';
import type { AIReportContent, EventFeedbackRecord } from '../services/api';

type UnknownEvent = EventRecord & Record<string, unknown>;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const NAVY = rgb(0.05, 0.16, 0.30);
const BLUE = rgb(0.11, 0.28, 0.48);
const TEXT = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.38, 0.42, 0.48);
const BORDER = rgb(0.76, 0.80, 0.85);
const PALE_BLUE = rgb(0.94, 0.96, 0.98);

const wrapText = (value: unknown, font: PDFFont, size: number, width: number): string[] => {
  if (value === undefined || value === null || value === '') return [];
  const textStr = String(value).trim();
  if (!textStr) return [];
  const words = textStr.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
};

export const generateFinalEventReport = async (
  sourceEvent: EventRecord,
  feedbackRecords: EventFeedbackRecord[] = [],
  aiContent?: AIReportContent | null
): Promise<PDFDocument> => {
  const event = sourceEvent as UnknownEvent;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page!: PDFPage;
  let y = PAGE_HEIGHT - MARGIN;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensure = (height: number) => {
    if (y - height < MARGIN + 34) addPage();
  };
  const drawWrapped = (value: unknown, size = 9, font = regular, color = TEXT, width = CONTENT_WIDTH, x = MARGIN) => {
    const lines = wrapText(value, font, size, width);
    if (!lines.length) return 0;
    const lineHeight = size + 3.5;
    ensure(lines.length * lineHeight);
    lines.forEach(line => {
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
    });
    return lines.length * lineHeight;
  };
  const section = (title: string) => {
    ensure(32);
    y -= 8;
    page.drawRectangle({ x: MARGIN, y: y - 5, width: CONTENT_WIDTH, height: 22, color: NAVY });
    page.drawText(title, { x: MARGIN + 8, y: y + 2, size: 10, font: bold, color: rgb(1, 1, 1) });
    y -= 28;
  };
  const paragraph = (value: unknown) => {
    if (!value) return;
    drawWrapped(value, 9, regular, TEXT);
    y -= 4;
  };
  const keyValueTable = (rows: [string, unknown][]) => {
    const labelWidth = 155;
    const valueWidth = CONTENT_WIDTH - labelWidth;
    rows.forEach(([label, value], index) => {
      const valueLines = wrapText(value, regular, 8.5, valueWidth - 12);
      if (!valueLines.length) return;
      const rowHeight = Math.max(22, valueLines.length * 12 + 10);
      ensure(rowHeight);
      if (index % 2 === 0) page.drawRectangle({ x: MARGIN, y: y - rowHeight + 5, width: CONTENT_WIDTH, height: rowHeight, color: PALE_BLUE });
      page.drawText(label, { x: MARGIN + 6, y: y - 14, size: 8.5, font: bold, color: NAVY });
      valueLines.forEach((line, lineIndex) => page.drawText(line, { x: MARGIN + labelWidth + 6, y: y - 14 - lineIndex * 12, size: 8.5, font: regular, color: TEXT }));
      page.drawLine({ start: { x: MARGIN, y: y - rowHeight + 5 }, end: { x: MARGIN + CONTENT_WIDTH, y: y - rowHeight + 5 }, thickness: 0.5, color: BORDER });
      y -= rowHeight;
    });
    y -= 7;
  };
  const bulletList = (items: string[]) => {
    const validItems = items.filter(i => typeof i === 'string' && i.trim());
    if (!validItems.length) return;
    validItems.forEach(item => {
      drawWrapped(`• ${item.trim()}`, 9, regular, TEXT, CONTENT_WIDTH - 12, MARGIN + 10);
    });
    y -= 4;
  };

  addPage();
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 12, width: PAGE_WIDTH, height: 12, color: NAVY });
  page.drawText('SONA COLLEGE OF TECHNOLOGY,SALEM', { x: MARGIN, y, size: 15, font: bold, color: NAVY });
  y -= 20;
  page.drawText('Department of Information Technology', { x: MARGIN, y, size: 11, font: bold, color: BLUE });
  y -= 18;
  page.drawText('FINAL EVENT REPORT', { x: MARGIN, y, size: 13, font: bold, color: NAVY });
  y -= 18;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.4, color: NAVY });
  y -= 18;

  const eventName = event.name || '';
  const eventType = event.type || '';
  const department = event.department || 'Information Technology';
  const date = event.date ? String(event.date).slice(0, 10) : '';
  const startTime = event.startTime || '';
  const endTime = event.endTime || '';
  const venue = event.venue || '';
  const mode = event.mode || '';
  const coordinator = event.coordinator || '';

  const mainOverviewRows: [string, unknown][] = [
    ['Event Name', eventName],
    ['Event Type', eventType],
    ['Department', department],
    ['Date', date],
  ];
  if (startTime && endTime) mainOverviewRows.push(['Time', `${startTime} - ${endTime}`]);
  if (venue) mainOverviewRows.push(['Venue', venue]);
  if (mode) mainOverviewRows.push(['Mode', mode]);
  if (coordinator) mainOverviewRows.push(['Coordinator', coordinator]);

  keyValueTable(mainOverviewRows);

  if (aiContent) {
    if (aiContent.eventOverview) {
      section('1. EVENT OVERVIEW');
      paragraph(aiContent.eventOverview);
    }
    if (aiContent.eventObjectives) {
      section('2. OBJECTIVES');
      paragraph(aiContent.eventObjectives);
    }
    if (aiContent.resourcePerson) {
      section('3. RESOURCE PERSON DETAILS');
      paragraph(aiContent.resourcePerson);
    }
    if (aiContent.attendanceAnalysis) {
      section('4. ATTENDANCE SUMMARY & ANALYSIS');
      paragraph(aiContent.attendanceAnalysis.summary);
      if (aiContent.attendanceAnalysis.statistics) {
        paragraph(`Statistics: ${aiContent.attendanceAnalysis.statistics}`);
      }
    }
    if (aiContent.feedbackAnalysis) {
      section('5. FEEDBACK ANALYSIS');
      paragraph(aiContent.feedbackAnalysis.overview);
      if (aiContent.feedbackAnalysis.ratingsSummary) {
        paragraph(aiContent.feedbackAnalysis.ratingsSummary);
      }
      if (aiContent.feedbackAnalysis.positiveObservations?.length) {
        paragraph('Positive Highlights:');
        bulletList(aiContent.feedbackAnalysis.positiveObservations);
      }
      if (aiContent.feedbackAnalysis.studentSentiment) {
        paragraph(`Student Sentiment: ${aiContent.feedbackAnalysis.studentSentiment}`);
      }
    }
    if (aiContent.eventStrengths?.length) {
      section('6. KEY STRENGTHS');
      bulletList(aiContent.eventStrengths);
    }
    if (aiContent.areasForImprovement?.length) {
      section('7. AREAS FOR IMPROVEMENT');
      bulletList(aiContent.areasForImprovement);
    }
    if (aiContent.recommendations?.length) {
      section('8. ACTIONABLE RECOMMENDATIONS');
      bulletList(aiContent.recommendations);
    }
    if (aiContent.overallAssessment) {
      section('9. OVERALL ASSESSMENT & CONCLUSION');
      paragraph(aiContent.overallAssessment);
    }
  } else {
    section('1. EVENT OVERVIEW');
    paragraph(`The ${eventType} titled "${eventName}" was conducted by ${department}${date ? ` on ${date}` : ''}${venue ? ` at ${venue}` : ''}.${coordinator ? ` Coordinated by ${coordinator}.` : ''}`);
    if (event.objective) {
      section('2. OBJECTIVE');
      paragraph(event.objective);
    }
    section('3. SUMMARY');
    paragraph(`Attendance rate recorded: ${event.attendance ? `${event.attendance}%` : 'Recorded'}. Total feedback responses: ${feedbackRecords.length}.`);
  }

  section('SIGNATURES');
  const signatureHeight = 70;
  ensure(signatureHeight);
  const signatureWidth = CONTENT_WIDTH / 3;
  ['Event Coordinator', 'Head of Department', 'Principal / Authorized Signatory'].forEach((label, index) => {
    const x = MARGIN + index * signatureWidth;
    if (index === 0 && coordinator) {
      page.drawText(String(coordinator), { x: x + 8, y: y - 28, size: 8.5, font: bold, color: NAVY });
    }
    page.drawLine({ start: { x: x + 8, y: y - 40 }, end: { x: x + signatureWidth - 8, y: y - 40 }, thickness: 0.7, color: BORDER });
    page.drawText('Signature & Date', { x: x + 8, y: y - 52, size: 7.5, font: regular, color: MUTED });
    page.drawText(label, { x: x + 8, y: y - 64, size: 8, font: bold, color: NAVY });
  });
  y -= signatureHeight;

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: MARGIN, y: 31 }, end: { x: PAGE_WIDTH - MARGIN, y: 31 }, thickness: 0.6, color: BORDER });
    currentPage.drawText('Generated by Academic Event Hub - SONA COLLEGE OF TECHNOLOGY,SALEM', { x: MARGIN, y: 18, size: 7, font: regular, color: MUTED });
    currentPage.drawText(`Page ${index + 1} of ${pages.length}`, { x: PAGE_WIDTH - MARGIN - 66, y: 18, size: 7, font: regular, color: MUTED });
  });

  return pdf;
};
