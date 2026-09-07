import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { EventRecord } from '../types';
import type { EventFeedbackRecord } from '../services/api';

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

const available = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return 'Not Available';
  return String(value);
};

const optional = (event: UnknownEvent, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (event[key] !== undefined && event[key] !== null && event[key] !== '') return event[key];
  }
  return undefined;
};

const listValue = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(/\r?\n|\||;/).map(item => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
  return [];
};

const numericValue = (record: EventFeedbackRecord, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return undefined;
};

const averageRating = (records: EventFeedbackRecord[], ...keys: string[]): number | undefined => {
  const values = records.map(record => numericValue(record, ...keys)).filter((value): value is number => value !== undefined);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
};

const formatRating = (value: number | undefined): string => value === undefined ? 'Not Available' : `${value.toFixed(2)}/5`;

const commonText = (records: EventFeedbackRecord[], ...keys: string[]): string | undefined => {
  const counts = new Map<string, number>();
  records.forEach(record => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim() && !Number.isFinite(Number(value))) {
        const normalized = value.trim();
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
        break;
      }
    }
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
};

const feedbackAnalysis = (records: EventFeedbackRecord[]): string => {
  if (!records.length) return 'No feedback responses were recorded for this event.';
  const overall = averageRating(records, 'overallRating', 'overall', 'rating', 'overallScore');
  const highRatingCount = records.filter(record => (numericValue(record, 'overallRating', 'overall', 'rating', 'overallScore') ?? 0) >= 4).length;
  const comments = records.map(record => record.comment || record.comments || record.response).filter(value => typeof value === 'string' && value.trim());
  const responseText = comments.length ? ` ${comments.length} written response(s) were included in the analysis.` : '';
  return `Feedback analysis was generated from ${records.length} response(s). ${overall === undefined ? 'An overall rating was not recorded.' : `The average overall rating was ${overall.toFixed(2)}/5, with ${highRatingCount} response(s) rated 4 or above.`}${responseText}`;
};

const wrapText = (value: unknown, font: PDFFont, size: number, width: number): string[] => {
  const words = available(value).split(/\s+/);
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
  return lines.length ? lines : ['Not Available'];
};

export const generateFinalEventReport = async (sourceEvent: EventRecord, feedbackRecords: EventFeedbackRecord[] = []): Promise<PDFDocument> => {
  const event = sourceEvent as UnknownEvent;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage;
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
    const lineHeight = size + 3;
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
    page.drawText(title, { x: MARGIN + 8, y: y + 2, size: 10.5, font: bold, color: rgb(1, 1, 1) });
    y -= 28;
  };
  const paragraph = (value: unknown) => {
    drawWrapped(value, 9, regular, TEXT);
    y -= 4;
  };
  const keyValueTable = (rows: [string, unknown][]) => {
    const labelWidth = 155;
    const valueWidth = CONTENT_WIDTH - labelWidth;
    rows.forEach(([label, value], index) => {
      const valueLines = wrapText(value, regular, 8.5, valueWidth - 12);
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
    if (!items.length) items = ['Not Available'];
    items.forEach(item => {
      drawWrapped(`• ${item}`, 9, regular, TEXT, CONTENT_WIDTH - 10, MARGIN + 10);
    });
    y -= 4;
  };

  addPage();
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 12, width: PAGE_WIDTH, height: 12, color: NAVY });
  page.drawText('ACADEMIC EVENT HUB', { x: MARGIN, y, size: 18, font: bold, color: NAVY });
  y -= 25;
  page.drawText('FINAL EVENT REPORT', { x: MARGIN, y, size: 13, font: bold, color: BLUE });
  y -= 18;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.4, color: NAVY });
  y -= 18;

  const eventName = available(event.name);
  const eventType = available(event.type);
  const department = available(event.department);
  const date = available(event.date);
  const startTime = available(event.startTime);
  const endTime = available(event.endTime);
  const venue = available(event.venue);
  const mode = available(event.mode);
  const coordinator = available(event.coordinator);
  const targetStudents = available(event.targetStudents);
  const resource = event.resourcePerson || {};
  const actualParticipants = event.actualParticipants === undefined || event.actualParticipants === null ? 'Not Available' : String(event.actualParticipants);
  const expectedParticipants = event.expectedParticipants === undefined || event.expectedParticipants === null ? 'Not Available' : String(event.expectedParticipants);
  const attendance = event.attendance === undefined || event.attendance === null || event.attendance === 0 ? 'Not Available' : `${event.attendance}%`;
  const presentValue = optional(event, 'present', 'studentsPresent', 'presentStudents');
  const absentValue = optional(event, 'absent', 'studentsAbsent', 'absentStudents');
  const totalStudents = optional(event, 'totalStudents') ?? (event.actualParticipants ?? undefined);
  const present = presentValue ?? (totalStudents !== undefined && event.attendance ? Math.round(Number(totalStudents) * Number(event.attendance) / 100) : undefined);
  const absent = absentValue ?? (totalStudents !== undefined && present !== undefined ? Number(totalStudents) - Number(present) : undefined);
  const totalFeedback = feedbackRecords.length;
  const overallRating = averageRating(feedbackRecords, 'overallRating', 'overall', 'rating', 'overallScore');
  const sessionContentRating = averageRating(feedbackRecords, 'sessionContentRating', 'contentRating', 'content', 'sessionContent');
  const speakerEffectivenessRating = averageRating(feedbackRecords, 'speakerEffectivenessRating', 'speakerRating', 'speakerEffectiveness', 'speaker');
  const usefulnessRating = averageRating(feedbackRecords, 'usefulnessToStudents', 'usefulnessRating', 'usefulness', 'relevanceRating');
  const satisfactionRating = averageRating(feedbackRecords, 'overallSatisfaction', 'satisfactionRating', 'satisfaction');
  const satisfactionResponse = commonText(feedbackRecords, 'overallSatisfaction', 'satisfactionResponse', 'response');
  const overallValues = feedbackRecords.map(record => numericValue(record, 'overallRating', 'overall', 'rating', 'overallScore')).filter((value): value is number => value !== undefined);
  const highRatingPercentage = overallValues.length ? `${((overallValues.filter(value => value >= 4).length / overallValues.length) * 100).toFixed(1)}%` : 'Not Available';

  keyValueTable([
    ['Event Name', eventName], ['Event Type', eventType], ['Department', department], ['Date', date],
    ['Time', startTime !== 'Not Available' && endTime !== 'Not Available' ? `${startTime} - ${endTime}` : 'Not Available'],
    ['Venue', venue], ['Mode', mode], ['Coordinator', coordinator], ['Target Participants', targetStudents],
  ]);

  section('1. EVENT OVERVIEW');
  paragraph(`The ${eventType} titled "${eventName}" was conducted by ${department} on ${date} at ${venue}. The event was scheduled from ${startTime} to ${endTime} in ${mode} mode and coordinated by ${coordinator}.`);

  section('2. OBJECTIVE');
  paragraph(event.objective);

  section('3. PERMISSION / PROPOSAL DETAILS');
  keyValueTable([
    ['Approval Status', optional(event, 'approvalStatus', 'permissionStatus')],
    ['Proposal Submission Date', optional(event, 'proposalSubmissionDate', 'proposalDate', 'submissionDate')],
    ['Approval Date', optional(event, 'approvalDate', 'permissionApprovalDate')],
    ['HOD / Principal Details', optional(event, 'approvalDetails', 'hodApprovalDetails', 'principalApprovalDetails')],
  ]);

  section('4. RESOURCE PERSON / GUEST DETAILS');
  keyValueTable([
    ['Name', resource.name], ['Designation', resource.designation], ['Organization', resource.organization],
    ['Contact', resource.contact], ['Email', resource.email], ['Session Topic', optional(event, 'sessionTopic', 'topic', 'topics')],
  ]);

  section('5. EVENT EXECUTION DETAILS');
  const execution = optional(event, 'executionDetails', 'executionSummary') || `The event was conducted in ${mode} mode at ${venue}. The recorded coordinator was ${coordinator}. ${available(event.description)}`;
  paragraph(execution);

  section('6. TOPICS / CONCEPTS COVERED');
  bulletList(listValue(optional(event, 'topics', 'topicsCovered', 'conceptsCovered')));

  section('7. STUDENT PARTICIPATION');
  keyValueTable([['Target Students', targetStudents], ['Expected Participants', expectedParticipants], ['Actual Participants', actualParticipants]]);

  section('8. ATTENDANCE SUMMARY');
  keyValueTable([['Total Students', totalStudents], ['Present', present], ['Absent', absent], ['Attendance Percentage', attendance]]);

  section('9. FEEDBACK SUMMARY AND ANALYSIS');
  keyValueTable([
    ['Total Feedback Received', totalFeedback || 'No feedback responses were recorded for this event.'],
    ['Average Overall Rating', formatRating(overallRating)],
    ['Session Content Rating', formatRating(sessionContentRating)],
    ['Speaker Effectiveness Rating', formatRating(speakerEffectivenessRating)],
    ['Usefulness to Students', formatRating(usefulnessRating)],
    ['Overall Satisfaction / Response', satisfactionRating === undefined ? (satisfactionResponse || (feedbackRecords.length ? 'Not Available' : 'No feedback responses were recorded for this event.')) : formatRating(satisfactionRating)],
    ['Percentage Rated 4 or Above', highRatingPercentage],
  ]);
  paragraph(feedbackAnalysis(feedbackRecords));

  section('10. PAYMENT / REMUNERATION DETAILS');
  keyValueTable([
    ['Resource Person Remuneration', optional(event, 'remuneration', 'resourcePersonRemuneration', 'paymentAmount')],
    ['Payment Method', optional(event, 'paymentMethod')], ['Payment Date', optional(event, 'paymentDate')], ['Transaction Reference', optional(event, 'transactionReference', 'transactionId')],
  ]);

  section('11. KEY OUTCOMES');
  const outcomes = listValue(optional(event, 'keyOutcomes', 'outcomes'));
  bulletList(outcomes.length ? outcomes : [
    `The event addressed the recorded objective: ${available(event.objective)}`,
    `Participation recorded for ${actualParticipants} participant(s).`,
    `Average overall feedback rating: ${formatRating(overallRating)}.`,
  ]);

  section('12. CORRECTIVE ACTION / RECOMMENDATIONS');
  const recommendations = listValue(optional(event, 'recommendations', 'correctiveActions'));
  bulletList(recommendations);

  section('13. CONCLUSION');
  paragraph(`The ${eventType} titled "${eventName}" was conducted on ${date} with ${actualParticipants} participant(s) recorded. The event addressed its recorded objective, with attendance recorded as ${attendance}. ${feedbackAnalysis(feedbackRecords)}`);

  section('14. SIGNATURES');
  const signatureHeight = 72;
  ensure(signatureHeight);
  const signatureWidth = CONTENT_WIDTH / 3;
  ['Event Coordinator', 'Head of Department', 'Principal / Authorized Signatory'].forEach((label, index) => {
    const x = MARGIN + index * signatureWidth;
    page.drawLine({ start: { x: x + 8, y: y - 42 }, end: { x: x + signatureWidth - 8, y: y - 42 }, thickness: 0.7, color: BORDER });
    page.drawText('Signature & Date', { x: x + 8, y: y - 55, size: 7.5, font: regular, color: MUTED });
    wrapText(label, bold, 8, signatureWidth - 16).forEach((line, lineIndex) => page.drawText(line, { x: x + 8, y: y - 68 - lineIndex * 10, size: 8, font: bold, color: NAVY }));
  });
  y -= signatureHeight;

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: MARGIN, y: 31 }, end: { x: PAGE_WIDTH - MARGIN, y: 31 }, thickness: 0.6, color: BORDER });
    currentPage.drawText('Generated by Academic Event Hub - Smart Events Management System', { x: MARGIN, y: 18, size: 7, font: regular, color: MUTED });
    currentPage.drawText(`Page ${index + 1} of ${pages.length}`, { x: PAGE_WIDTH - MARGIN - 66, y: 18, size: 7, font: regular, color: MUTED });
  });

  return pdf;
};
