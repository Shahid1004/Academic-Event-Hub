import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const outputPath = path.resolve('public/Academic-Event-Final-Report.pdf');
const pdf = await PDFDocument.create();
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 48;
const contentWidth = pageWidth - margin * 2;
const navy = rgb(0.05, 0.16, 0.30);
const blue = rgb(0.12, 0.29, 0.49);
const paleBlue = rgb(0.93, 0.96, 0.98);
const line = rgb(0.73, 0.78, 0.84);
const text = rgb(0.12, 0.16, 0.22);
const muted = rgb(0.35, 0.40, 0.47);

let page;
let y;

const addPage = () => {
  page = pdf.addPage([pageWidth, pageHeight]);
  y = pageHeight - margin;
};

const wrap = (value, font, size, width) => {
  const words = String(value ?? 'N/A').split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach(word => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : ['N/A'];
};

const ensure = height => {
  if (y - height < margin + 28) addPage();
};

const drawLines = (value, options = {}) => {
  const font = options.font || regular;
  const size = options.size || 9;
  const color = options.color || text;
  const width = options.width || contentWidth;
  const lineHeight = options.lineHeight || size + 3;
  const lines = wrap(value, font, size, width);
  ensure(lines.length * lineHeight);
  lines.forEach(item => {
    page.drawText(item, { x: options.x || margin, y, size, font, color });
    y -= lineHeight;
  });
  return lines.length * lineHeight;
};

const heading = (title, level = 1) => {
  const size = level === 1 ? 11 : 10;
  ensure(30);
  y -= 8;
  page.drawRectangle({ x: margin, y: y - 5, width: contentWidth, height: 22, color: level === 1 ? navy : paleBlue });
  page.drawText(title, { x: margin + 8, y: y + 2, size, font: bold, color: level === 1 ? rgb(1, 1, 1) : navy });
  y -= 28;
};

const paragraph = value => {
  drawLines(value, { size: 9, lineHeight: 13 });
  y -= 4;
};

const table = (columns, rows, options = {}) => {
  const widths = options.widths || columns.map(() => contentWidth / columns.length);
  const headerHeight = 25;
  const rowPadding = 5;
  const fontSize = options.fontSize || 8;
  const drawHeader = () => {
    ensure(headerHeight);
    let x = margin;
    page.drawRectangle({ x: margin, y: y - headerHeight + 5, width: contentWidth, height: headerHeight, color: blue });
    columns.forEach((column, index) => {
      page.drawText(column, { x: x + 5, y: y - 10, size: fontSize, font: bold, color: rgb(1, 1, 1) });
      x += widths[index];
    });
    y -= headerHeight;
  };
  drawHeader();
  rows.forEach((row, rowIndex) => {
    const cells = row.map((value, index) => wrap(value, regular, fontSize, widths[index] - 10));
    const height = Math.max(options.minRowHeight || 0, Math.max(...cells.map(cell => cell.length)) * (fontSize + 2) + rowPadding * 2);
    if (y - height < margin + 28) {
      addPage();
      drawHeader();
    }
    let x = margin;
    if (rowIndex % 2 === 0) page.drawRectangle({ x: margin, y: y - height + 5, width: contentWidth, height, color: paleBlue });
    cells.forEach((cell, index) => {
      cell.forEach((value, lineIndex) => page.drawText(value, { x: x + 5, y: y - rowPadding - fontSize - lineIndex * (fontSize + 2), size: fontSize, font: regular, color: text }));
      page.drawLine({ start: { x, y: y + 5 }, end: { x, y: y - height + 5 }, thickness: 0.5, color: line });
      x += widths[index];
    });
    page.drawLine({ start: { x: margin, y: y - height + 5 }, end: { x: margin + contentWidth, y: y - height + 5 }, thickness: 0.5, color: line });
    y -= height;
  });
  y -= 8;
};

addPage();

// Official header
page.drawRectangle({ x: 0, y: pageHeight - 12, width: pageWidth, height: 12, color: navy });
page.drawText('ACADEMIC EVENT HUB', { x: margin, y: y - 2, size: 18, font: bold, color: navy });
y -= 25;
page.drawText('EVENT REPORT', { x: margin, y, size: 13, font: bold, color: blue });
y -= 20;
page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 1.5, color: navy });
y -= 18;

table(
  ['Event Name', 'Event Type', 'Department'],
  [['Building Your Own Chatbot Using AI', 'Workshop', 'AI & Data Science']],
  { widths: [245, 105, 146], fontSize: 8 }
);
table(
  ['Coordinator', 'Date', 'Time', 'Venue', 'Mode'],
  [['Dr. Meena Krishnan', '2025-07-22', '10:00 - 16:00', 'Seminar Hall A', 'Hybrid']],
  { widths: [135, 78, 82, 130, 71], fontSize: 8 }
);

heading('1. EVENT OVERVIEW');
paragraph('A Workshop titled "Building Your Own Chatbot Using AI" was organized by the Department of AI & Data Science on 2025-07-22 at Seminar Hall A. The event was conducted in Hybrid mode from 10:00 to 16:00.');

heading('2. OBJECTIVE');
paragraph('Introduce students to LLM-based chatbot development using Python and open-source frameworks.');

heading('3. PERMISSION / PROPOSAL DETAILS');
paragraph('Prior approval was obtained from the HOD and the Principal. The proposal was submitted on 2025-07-01 and approved on 2025-07-05.');

heading('4. RESOURCE PERSON / GUEST DETAILS');
table(
  ['Name', 'Designation', 'Organization', 'Contact', 'Email'],
  [['Dr. Sanjay Rao', 'AI Researcher', 'IIT Madras', '9988776655', 'sanjay@iitm.ac.in']],
  { widths: [110, 95, 92, 88, 151], fontSize: 7.5 }
);

heading('5. EVENT EXECUTION DETAILS');
paragraph('The event was conducted as planned. The coordinator Dr. Meena Krishnan managed the event efficiently. Students built a working chatbot using LangChain and Hugging Face models during this intensive workshop.');

heading('6. TOPICS / CONCEPTS COVERED');
['Introduction to the topic', 'Theoretical foundations', 'Hands-on demonstration', 'Q&A Session', 'Feedback collection'].forEach(item => {
  drawLines(`• ${item}`, { size: 9, lineHeight: 13, x: margin + 8, width: contentWidth - 8 });
});
y -= 5;

heading('7. STUDENT PARTICIPATION');
table(
  ['Target Students', 'Expected Participants', 'Actual Participants'],
  [['II & III Year AIDS', '80', '74']],
  { widths: [250, 150, 136], fontSize: 8 }
);

heading('8. ATTENDANCE SUMMARY');
table(
  ['Total Students', 'Present', 'Absent', 'Attendance Percentage'],
  [['74', '68', '6', '92%']],
  { widths: [140, 120, 120, 156], fontSize: 8 }
);

heading('9. FEEDBACK SUMMARY AND ANALYSIS');
table(
  ['Average Feedback Score', 'Responses Collected', 'Overall Satisfaction', 'Students Rating 4 or Above'],
  [['4.7/5', '67', 'High', '85%']],
  { widths: [145, 130, 130, 131], fontSize: 7.5 }
);

heading('10. PAYMENT / REMUNERATION DETAILS');
table(
  ['Resource Person Remuneration', 'Payment Method', 'Payment Date', 'Transaction Reference'],
  [['INR 5,000', 'NEFT', '2025-07-22', 'TXN2025001']],
  { widths: [145, 115, 115, 161], fontSize: 8 }
);

heading('11. KEY OUTCOMES');
['Students gained practical knowledge in the subject area', 'Enhanced industry connect', 'Improved skill development', 'Increased awareness of current trends'].forEach(item => {
  drawLines(`• ${item}`, { size: 9, lineHeight: 13, x: margin + 8, width: contentWidth - 8 });
});
y -= 5;

heading('12. CORRECTIVE ACTION / RECOMMENDATIONS');
['Extend duration for future sessions', 'Arrange for lab access during the workshop', 'Share resource materials in advance', 'Schedule follow-up sessions'].forEach(item => {
  drawLines(`• ${item}`, { size: 9, lineHeight: 13, x: margin + 8, width: contentWidth - 8 });
});
y -= 5;

heading('13. CONCLUSION');
paragraph('The workshop was successfully conducted and achieved its intended objective of introducing students to LLM-based chatbot development using Python and open-source frameworks. The event provided students with practical exposure, improved their technical understanding, and increased awareness of current AI trends.');

heading('SIGNATURES');
table(
  ['Event Coordinator', 'Head of Department', 'Principal / Authorized Signatory'],
  [['Signature & Date', 'Signature & Date', 'Signature & Date']],
  { widths: [166, 166, 164], fontSize: 8, minRowHeight: 65 }
);

// Consistent footer and page numbers across all pages.
const pages = pdf.getPages();
pages.forEach((currentPage, index) => {
  currentPage.drawLine({ start: { x: margin, y: 31 }, end: { x: pageWidth - margin, y: 31 }, thickness: 0.6, color: line });
  currentPage.drawText('Generated by Academic Event Hub - Smart Events Management System', { x: margin, y: 18, size: 7, font: regular, color: muted });
  currentPage.drawText(`Page ${index + 1} of ${pages.length}`, { x: pageWidth - margin - 66, y: 18, size: 7, font: regular, color: muted });
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, await pdf.save());
console.log(`Created ${outputPath}`);