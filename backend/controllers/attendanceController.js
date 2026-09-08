const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Event = require("../models/Event");

const defaultStudents = [
  { regNo: "22IT001", studentName: "Arun Kumar M", className: "III IT A", department: "IT", status: "" },
  { regNo: "22IT002", studentName: "Bhavya S", className: "III IT A", department: "IT", status: "" },
  { regNo: "22IT003", studentName: "Chethan R", className: "III IT B", department: "IT", status: "" },
  { regNo: "22IT004", studentName: "Divya P", className: "III IT A", department: "IT", status: "" },
  { regNo: "22IT005", studentName: "Elan K", className: "III IT B", department: "IT", status: "" },
  { regNo: "22IT006", studentName: "Fathima N", className: "III IT A", department: "IT", status: "" },
  { regNo: "22IT007", studentName: "Ganesh S", className: "III IT B", department: "IT", status: "" },
  { regNo: "22IT008", studentName: "Harini M", className: "III IT A", department: "IT", status: "" },
];

const deriveDepartment = (deptVal = "", classVal = "") => {
  const cleanDept = String(deptVal || "").trim();
  const c = String(classVal || "").trim();
  const combined = `${cleanDept} ${c}`.toLowerCase();

  if (!combined || combined.trim() === "-" || combined.trim() === "") return "-";

  if (
    combined.includes("artificial intelligence") ||
    /\b(ads|aids)\b/i.test(combined) ||
    combined.includes("ai & ds") ||
    combined.includes("ai and ds") ||
    combined.includes("ai & data science") ||
    combined.includes("ai and data science")
  ) {
    return "Artificial Intelligence and Data Science";
  }

  if (
    combined.includes("information technology") ||
    /\b(it)\b/i.test(combined)
  ) {
    return "Information Technology";
  }

  if (cleanDept && cleanDept !== "-") {
    return cleanDept;
  }

  return "-";
};

const sortAttendanceRecords = (records = []) => {
  return [...records].sort((a, b) => {
    const deptA = String(a.department || "-").trim();
    const deptB = String(b.department || "-").trim();
    const deptComp = deptA.localeCompare(deptB, undefined, { sensitivity: "base", numeric: true });
    if (deptComp !== 0) return deptComp;

    const nameA = String(a.studentName || "").trim();
    const nameB = String(b.studentName || "").trim();
    const nameComp = nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true });
    if (nameComp !== 0) return nameComp;

    const regA = String(a.regNo || "").trim();
    const regB = String(b.regNo || "").trim();
    return regA.localeCompare(regB, undefined, { sensitivity: "base", numeric: true });
  });
};

const normalizeStudentRecord = (student = {}) => {
  const raw = student || {};

  const getValue = (...keys) => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null) {
        const val = String(raw[key]).trim();
        if (val !== "") return val;
      }
    }
    const rawKeys = Object.keys(raw);
    for (const searchKey of keys) {
      const cleanSearch = searchKey.toLowerCase().replace(/[\s_\-\/]/g, "");
      const matchedKey = rawKeys.find(
        (k) => k.toLowerCase().replace(/[\s_\-\/]/g, "") === cleanSearch
      );
      if (matchedKey && raw[matchedKey] !== undefined && raw[matchedKey] !== null) {
        const val = String(raw[matchedKey]).trim();
        if (val !== "") return val;
      }
    }
    return "";
  };

  const regNo = getValue("Register Number", "Register No", "Reg No", "Reg Number", "Registration Number", "Registration No", "registerNumber", "regNo");
  const studentName = getValue("Student Name", "Name", "StudentName", "Student", "studentName");
  const departmentRaw = getValue("Department", "Dept", "Department Name", "DepartmentName", "department");
  const classValue = getValue("Class", "Year", "Year of Study", "className", "class");
  const sectionValue = getValue("Section", "Sec", "section");
  const combinedClass = getValue("Class / Section", "Class/Section", "Class Section", "ClassSection") || [classValue, sectionValue].filter(Boolean).join(" ");
  const finalDepartment = deriveDepartment(departmentRaw, combinedClass);
  const status = getValue("status", "Status", "Attendance Status");

  return {
    regNo,
    studentName,
    department: finalDepartment,
    className: combinedClass || "-",
    status: status || student.status || "",
  };
};

const getEventAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }

    let records = await Attendance.find({ eventId }).lean();

    if (records.length === 0) {
      records = defaultStudents.map((s) => ({
        eventId,
        regNo: s.regNo,
        studentName: s.studentName,
        className: s.className,
        department: deriveDepartment(s.department, s.className),
        status: s.status || "",
        checkInMethod: "online",
        markedAt: new Date(),
      }));
    }

    records = sortAttendanceRecords(records);

    const total = records.length;
    const present = records.filter((r) => r.status === "P").length;
    const absent = records.filter((r) => r.status === "A").length;
    const od = records.filter((r) => r.status === "OD").length;
    const attendancePercentage = total > 0 ? Math.round(((present + od) / total) * 100) : 0;

    return res.json({
      success: true,
      data: {
        eventId,
        summary: { total, present, absent, od, attendancePercentage },
        records,
      },
    });
  } catch (error) {
    console.error("Get attendance failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch attendance" });
  }
};

const saveEventAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { records } = req.body;

    if (!eventId || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: "Event ID and records array are required" });
    }

    const bulkOps = records.map((rec) => ({
      updateOne: {
        filter: { eventId, regNo: String(rec.regNo).trim().toUpperCase() },
        update: {
          $set: {
            studentName: rec.studentName || rec.name,
            className: rec.className || rec.class || "",
            department: rec.department || "",
            status: rec.status || "",
            checkInMethod: rec.checkInMethod || "online",
            markedAt: rec.markedAt || new Date(),
            markedBy: req.user?._id || null,
            remarks: rec.remarks || "",
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    const allRecords = await Attendance.find({ eventId }).lean();
    const sortedRecords = sortAttendanceRecords(allRecords);
    const total = sortedRecords.length;
    const present = sortedRecords.filter((r) => r.status === "P").length;
    const od = sortedRecords.filter((r) => r.status === "OD").length;
    const absent = sortedRecords.filter((r) => r.status === "A").length;
    const attendancePercentage = total > 0 ? Math.round(((present + od) / total) * 100) : 0;

    // Update Event model fields
    await Event.findOneAndUpdate(
      { $or: [{ id: eventId }, { _id: mongoose.isValidObjectId(eventId) ? eventId : null }] },
      {
        $set: {
          attendance: attendancePercentage,
          actualParticipants: present + od > 0 ? present + od : total,
        },
      }
    );

    return res.json({
      success: true,
      message: "Attendance saved successfully",
      summary: { total, present, absent, od, attendancePercentage },
      records: sortedRecords,
    });
  } catch (error) {
    console.error("Save attendance failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save attendance" });
  }
};

const qrCheckIn = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { regNo, studentName, className } = req.body;

    if (!eventId || !regNo) {
      return res.status(400).json({ success: false, message: "Event ID and Registration Number are required" });
    }

    const updated = await Attendance.findOneAndUpdate(
      { eventId, regNo: regNo.trim().toUpperCase() },
      {
        $set: {
          studentName: studentName || `Student ${regNo}`,
          className: className || "",
          status: "P",
          checkInMethod: "qr",
          markedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      message: `Check-in successful for ${regNo}`,
      data: updated,
    });
  } catch (error) {
    console.error("QR Check-in failed:", error.message);
    return res.status(500).json({ success: false, message: "QR check-in failed" });
  }
};

const exportAttendance = async (req, res) => {
  try {
    const { eventId } = req.params;
    const records = await Attendance.find({ eventId }).sort({ regNo: 1 }).lean();

    return res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Export attendance failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to export attendance" });
  }
};

const importEventAttendanceRoster = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { students } = req.body;

    if (!eventId) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: "Student roster is required" });
    }

    const event = await Event.findOne({ $or: [{ id: eventId }, { _id: mongoose.isValidObjectId(eventId) ? eventId : null }] }).lean();

    const validStudents = [];
    const duplicateRows = [];
    const invalidRows = [];
    const seen = new Set();
    let existingMatches = 0;

    for (const student of students) {
      const normalized = normalizeStudentRecord(student);
      const regNo = normalized.regNo;
      const studentName = normalized.studentName;

      if (!regNo || !studentName) {
        let reason = "Invalid – Missing required fields";
        if (!regNo && !studentName) reason = "Invalid – Registration Number & Student Name missing";
        else if (!regNo) reason = "Invalid – Registration Number missing";
        else if (!studentName) reason = "Invalid – Student Name missing";

        invalidRows.push({
          row: student,
          reason,
        });
        continue;
      }

      const dupKey = regNo.toLowerCase();
      if (seen.has(dupKey)) {
        duplicateRows.push({ regNo, studentName, reason: "Invalid – Duplicate Registration Number" });
        continue;
      }
      seen.add(dupKey);

      const existing = await Attendance.findOne({ eventId, regNo });
      if (existing) {
        existingMatches += 1;
      }

      validStudents.push({
        eventId,
        regNo,
        studentName,
        department: normalized.department || "-",
        className: normalized.className || "-",
        status: normalized.status || student.status || "",
        checkInMethod: student.checkInMethod || "import",
        markedAt: new Date(),
        markedBy: req.user?._id || null,
        remarks: student.remarks || "",
      });
    }

    // Completely wipe all previous attendance records for this eventId
    await Attendance.deleteMany({ eventId });

    if (validStudents.length > 0) {
      await Attendance.insertMany(validStudents);
    }

    let roster = await Attendance.find({ eventId }).lean();
    roster = sortAttendanceRecords(roster);
    const total = roster.length;
    const present = roster.filter((r) => r.status === "P").length;
    const absent = roster.filter((r) => r.status === "A").length;
    const od = roster.filter((r) => r.status === "OD").length;
    const attendancePercentage = total > 0 ? Math.round(((present + od) / total) * 100) : 0;

    await Event.findOneAndUpdate(
      { $or: [{ id: eventId }, { _id: mongoose.isValidObjectId(eventId) ? eventId : null }] },
      {
        $set: {
          attendance: attendancePercentage,
          actualParticipants: present + od > 0 ? present + od : total,
        },
      }
    );

    return res.json({
      success: true,
      message: "Student roster imported successfully",
      data: {
        importedCount: validStudents.length,
        duplicates: duplicateRows,
        invalidRows,
        existingMatches,
        summary: {
          total,
          present,
          absent,
          od,
          attendancePercentage,
        },
        records: roster,
      },
    });
  } catch (error) {
    console.error("Import event attendance roster failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to import student roster" });
  }
};

/**
 * Safely extract JSON array of student objects from raw AI text response
 */
const extractJsonFromText = (rawText = '', sessionId = '') => {
  if (!rawText || typeof rawText !== 'string') return [];

  // Remove markdown code fences if present
  let cleaned = rawText
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim();

  // Find first { or [ and last } or ]
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  let endIdx = -1;

  if (lastBrace !== -1 && lastBrace > lastBracket) {
    endIdx = lastBrace;
  } else if (lastBracket !== -1) {
    endIdx = lastBracket;
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1).trim();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.warn(`[AI Extraction Session ${sessionId}] Direct JSON.parse failed on extracted substring. Trying regex match...`);
    const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/) || cleaned.match(/\{\s*"[\s\S]*"\s*:\s*[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (e2) {
        console.error(`[AI Extraction Session ${sessionId}] Regex JSON parse also failed:`, e2.message);
      }
    }
  }

  if (!parsed) return [];

  // Extract student array from various possible JSON structures
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === 'object') {
    const keys = ['students', 'rows', 'attendance', 'data', 'records', 'items', 'list', 'studentList', 'result'];
    for (const key of keys) {
      if (Array.isArray(parsed[key])) {
        return parsed[key];
      }
    }
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val)) {
        return val;
      }
    }
  }

  return [];
};

/**
 * Normalize an individual AI extracted student object into standard properties
 */
const normalizeRawStudentRow = (raw = {}) => {
  if (!raw || typeof raw !== 'object') return null;

  const getValue = (...keys) => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null) {
        const strVal = String(raw[k]).trim();
        if (strVal !== '' && strVal !== 'null' && strVal !== 'undefined') return strVal;
      }
    }
    const rawKeys = Object.keys(raw);
    for (const searchKey of keys) {
      const cleanSearch = searchKey.toLowerCase().replace(/[\s_\-\/]/g, '');
      const matchedKey = rawKeys.find(
        (k) => k.toLowerCase().replace(/[\s_\-\/]/g, '') === cleanSearch
      );
      if (matchedKey && raw[matchedKey] !== undefined && raw[matchedKey] !== null) {
        const strVal = String(raw[matchedKey]).trim();
        if (strVal !== '' && strVal !== 'null' && strVal !== 'undefined') return strVal;
      }
    }
    return '';
  };

  const regNo = getValue(
    'regNo', 'reg_no', 'registerNumber', 'register_number', 'registrationNumber',
    'registration_number', 'rollNo', 'roll_number', 'rollNumber', 'id', 'reg'
  );

  const studentName = getValue(
    'studentName', 'student_name', 'name', 'student', 'fullName', 'full_name'
  );

  const classSection = getValue(
    'classSection', 'class_section', 'className', 'class_name', 'class', 'section', 'classAndSection'
  );

  const department = getValue(
    'department', 'dept', 'branch', 'departmentName'
  );

  const rawSig = raw.signaturePresent ?? raw.signature_present ?? raw.signed ?? raw.signature;
  const rawStatus = getValue('attendanceStatus', 'attendance_status', 'status', 'attendance');

  let signaturePresent = false;
  if (typeof rawSig === 'boolean') {
    signaturePresent = rawSig;
  } else if (typeof rawSig === 'string') {
    const s = rawSig.toLowerCase();
    signaturePresent = s.includes('true') || s.includes('yes') || s.includes('signed') || s.includes('present');
  } else if (rawStatus) {
    const st = rawStatus.toLowerCase();
    signaturePresent = st.includes('present') || st === 'p';
  }

  let confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.9;

  // Validation Rule: Accept row if at least ONE of regNo OR studentName exists
  if (!regNo && !studentName) {
    return null;
  }

  return {
    regNo: regNo ? regNo.toUpperCase() : '',
    studentName: studentName || '',
    classSection: classSection || '-',
    department: department || '',
    signaturePresent,
    rawStatus: rawStatus || (signaturePresent ? 'Present' : 'Absent'),
    confidence,
  };
};

/**
 * Enrich extracted student rows by matching against event database or default master roster
 */
const enrichExtractedStudents = async (extractedStudents = [], eventId = null) => {
  let knownStudents = [];
  try {
    if (eventId && Attendance && typeof Attendance.find === 'function') {
      knownStudents = await Attendance.find({ eventId }).lean().catch(() => []);
    }
  } catch (err) {
    knownStudents = [];
  }
  if (!knownStudents || knownStudents.length === 0) {
    knownStudents = typeof defaultStudents !== 'undefined' ? defaultStudents : [];
  }

  return extractedStudents.map((st, idx) => {
    let regNo = st.regNo;
    let studentName = st.studentName;
    let classSection = st.classSection;
    let department = st.department;

    // Try matching by Reg No first
    let match = knownStudents.find(
      (k) => k.regNo && regNo && k.regNo.toUpperCase() === regNo.toUpperCase()
    );

    // If no regNo match, try matching by studentName
    if (!match && studentName) {
      const cleanName = studentName.toLowerCase().replace(/[^a-z0-9]/g, '');
      match = knownStudents.find((k) => {
        const kName = (k.studentName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return kName && (kName === cleanName || kName.includes(cleanName) || cleanName.includes(kName));
      });
    }

    // Enrich missing fields from match
    if (match) {
      if (!regNo && match.regNo) regNo = match.regNo.toUpperCase();
      if (!studentName && match.studentName) studentName = match.studentName;
      if ((!classSection || classSection === '-') && (match.className || match.classSection)) {
        classSection = match.className || match.classSection;
      }
      if ((!department || department === '-') && match.department) {
        department = match.department;
      }
    }

    const finalDept = deriveDepartment(department, classSection);
    const isUncertain = !regNo || !studentName || st.confidence < 0.7;

    return {
      rowNumber: idx + 1,
      regNo: regNo || `UNREADABLE_${idx + 1}`,
      studentName: studentName || `Unread Student ${idx + 1}`,
      className: classSection || '-',
      department: finalDept,
      signaturePresent: st.signaturePresent,
      status: st.signaturePresent ? 'P' : 'A',
      confidence: st.confidence,
      isUncertain,
      uncertainFields: isUncertain ? ['Needs Review'] : [],
      isMatchedToRoster: Boolean(match),
    };
  });
};

/**
 * Check if AI response text is contaminated with SVG/XML/binary data
 */
const isContaminatedResponse = (text = '') => {
  if (!text) return false;
  const lower = text.slice(0, 2000); // check first 2000 chars
  return (
    lower.includes('<path ') ||
    lower.includes('<svg ') ||
    lower.includes('<path\n') ||
    lower.includes('d="M') ||
    lower.includes('xmlns=') ||
    lower.includes('<!DOCTYPE') ||
    lower.includes('<html') ||
    /^[A-Za-z0-9+/]{200,}={0,2}$/.test(lower.replace(/\s/g, ''))  // raw base64 blob
  );
};

/**
 * Validate a single student row's fields — reject rows with SVG/XML/garbage data
 */
const isValidStudentRow = (row = {}) => {
  const invalidPattern = /[<>]|\bpath\b|d="M|svg|xmlns|DOCTYPE/i;

  const name = String(row.studentName || '');
  const reg = String(row.regNo || '');
  const cls = String(row.classSection || '');
  const dept = String(row.department || '');

  if (invalidPattern.test(name)) return false;
  if (invalidPattern.test(reg)) return false;
  if (invalidPattern.test(cls)) return false;
  if (invalidPattern.test(dept)) return false;

  // Reasonable length limits
  if (name.length > 120) return false;
  if (reg.length > 30) return false;
  if (cls.length > 60) return false;
  if (dept.length > 80) return false;

  return true;
};

/**
 * Build Gemini API contents array: text prompt + inlineData image/PDF part
 */
const buildGeminiContents = (promptText, fileBuffer, mimeType) => {
  return [
    {
      role: 'user',
      parts: [
        { text: promptText },
        {
          inlineData: {
            mimeType: mimeType,
            data: fileBuffer.toString('base64'),
          },
        },
      ],
    },
  ];
};

/**
 * Dynamically discover available Gemini models supporting generateContent
 */
const getAvailableGeminiModels = async (apiKey) => {
  const GEMINI_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-flash'];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) return GEMINI_MODELS;
    const data = await res.json();
    if (!data.models || !Array.isArray(data.models)) return GEMINI_MODELS;
    const supportedNames = data.models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace('models/', ''));

    const filtered = GEMINI_MODELS.filter((m) => supportedNames.includes(m));
    // Add any extra available 3.x or flash models
    supportedNames.forEach((m) => {
      if ((m.includes('3.') || m.includes('flash')) && !filtered.includes(m)) {
        filtered.push(m);
      }
    });
    return filtered.length > 0 ? filtered : GEMINI_MODELS;
  } catch (err) {
    return GEMINI_MODELS;
  }
};

/**
 * Helper function to extract student rows from a single file buffer
 */
const extractStudentsFromSingleFile = async (fileObj, sheetType, sessionId) => {
  const fileBuffer = fileObj.buffer;
  let mimeType = fileObj.mimetype || 'image/jpeg';
  const originalName = fileObj.originalname || 'Uploaded_Document';

  const SUPPORTED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const isPdf = mimeType === 'application/pdf';
  const isImage = SUPPORTED_IMAGE_MIMES.some(m => mimeType.toLowerCase().includes(m.split('/')[1]));

  if (!isImage && !isPdf) {
    mimeType = 'image/jpeg';
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

  let rawCandidateRows = [];
  let rawAiResponseText = '';
  let providerUsed = 'none';
  let modelUsed = 'none';
  let aiHttpStatus = 200;
  let openAiErrorCode = null;
  let geminiErrorCode = null;
  let wasContaminated = false;

  const EXTRACTION_PROMPT = `You are analyzing a visual attendance document image or PDF.
Extract information ONLY from the visible student table.
Do NOT describe the image.
Do NOT return SVG, HTML, XML, OCR bounding boxes, coordinates, image metadata, or path data.
Return ONLY valid JSON.

TASK: Read every student row in this physical attendance sheet from top to bottom. If this is a multi-page document/PDF, process EVERY page.

For each student row extract:
  - regNo: registration / roll number string (or null if unreadable)
  - studentName: full student name (string)
  - classSection: class and section label e.g. "III IT A" (string or null if not visible)
  - department: department name e.g. "Information Technology" (string or null if not visible)
  - status: "Present" or "Absent"

RULES:
1. Only include students clearly visible in the document. Do NOT hallucinate.
2. If a value is unclear, use null — do NOT invent data.
3. Extract EVERY single student row visible. Do NOT stop early.
4. Return JSON only in this exact format:
{
  "students": [
    {
      "regNo": "221001",
      "studentName": "Arun Kumar M",
      "classSection": "III IT A",
      "department": "Information Technology",
      "status": "Present"
    }
  ]
}

${
  sheetType === 'participant_list'
    ? 'SHEET TYPE: Participant/Present list — mark every listed student as status "Present".'
    : 'SHEET TYPE: Signed attendance sheet — signature/mark/initials in the sign column = "Present", empty sign cell = "Absent".'
}`;

  const FALLBACK_PROMPT = `Look carefully at this visual attendance document.
List every student visible in a table or list format.
Return ONLY a JSON object:
{
  "students": [
    {
      "regNo": null,
      "studentName": "Student Name",
      "classSection": null,
      "department": null,
      "status": "Present"
    }
  ]
}
Do NOT return SVG, HTML, XML, image path coordinates, or text outside the JSON.
Accept partial data as long as a student name is visible.`;

  // 1. OpenAI ChatGPT Vision
  if (openaiApiKey) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        temperature: 0.1,
      });

      providerUsed = 'openai';
      modelUsed = 'gpt-4o-mini';
      aiHttpStatus = 200;

      rawAiResponseText = completion.choices[0]?.message?.content || '';
      if (isContaminatedResponse(rawAiResponseText)) {
        wasContaminated = true;
        rawAiResponseText = '';
      } else {
        const parsedArray = extractJsonFromText(rawAiResponseText, sessionId);
        rawCandidateRows = parsedArray
          .map(r => normalizeRawStudentRow(r))
          .filter(Boolean)
          .filter(r => isValidStudentRow(r));
      }

      if (rawCandidateRows.length === 0) {
        const completion2 = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: FALLBACK_PROMPT },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 4096,
          temperature: 0.1,
        });

        const rawText2 = completion2.choices[0]?.message?.content || '';
        if (isContaminatedResponse(rawText2)) {
          wasContaminated = true;
        } else {
          const parsedArray2 = extractJsonFromText(rawText2, sessionId);
          rawCandidateRows = parsedArray2
            .map(r => normalizeRawStudentRow(r))
            .filter(Boolean)
            .filter(r => isValidStudentRow(r));
        }
      }
    } catch (openAiErr) {
      const msg = openAiErr.message || '';
      const status = openAiErr.status || openAiErr.response?.status || 500;
      aiHttpStatus = status;

      if (status === 429 || msg.includes('429') || msg.includes('insufficient_quota') || msg.includes('credits') || msg.includes('Quota exceeded')) {
        openAiErrorCode = 'OPENAI_INSUFFICIENT_CREDITS';
      } else {
        openAiErrorCode = 'OPENAI_API_ERROR';
      }
    }
  }

  // 2. Gemini Fallback
  if (rawCandidateRows.length === 0 && geminiApiKey) {
    const availableModels = await getAvailableGeminiModels(geminiApiKey);
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const STUDENT_RESPONSE_SCHEMA = {
      type: 'object',
      properties: {
        students: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              regNo:        { type: 'string' },
              studentName:  { type: 'string' },
              classSection: { type: 'string' },
              department:   { type: 'string' },
              status:       { type: 'string', enum: ['Present', 'Absent'] },
            },
            required: ['studentName', 'status'],
          },
        },
      },
      required: ['students'],
    };

    for (const modelName of availableModels) {
      if (rawCandidateRows.length > 0) break;
      try {
        const aiResponse = await ai.models.generateContent({
          model: modelName,
          contents: buildGeminiContents(EXTRACTION_PROMPT, fileBuffer, mimeType),
          config: {
            temperature: 0.05,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: STUDENT_RESPONSE_SCHEMA,
          },
        });

        providerUsed = 'gemini';
        modelUsed = modelName;
        aiHttpStatus = 200;

        rawAiResponseText = (typeof aiResponse.text === 'string') ? aiResponse.text : '';
        if (!rawAiResponseText && aiResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
          rawAiResponseText = aiResponse.candidates[0].content.parts[0].text;
        }

        if (isContaminatedResponse(rawAiResponseText)) {
          wasContaminated = true;
          rawAiResponseText = '';
        } else {
          const parsedArray = extractJsonFromText(rawAiResponseText, sessionId);
          rawCandidateRows = parsedArray
            .map(r => normalizeRawStudentRow(r))
            .filter(Boolean)
            .filter(r => isValidStudentRow(r));
          if (rawCandidateRows.length > 0) break;
        }
      } catch (geminiErr) {
        const gMsg = geminiErr.message || '';
        if (gMsg.includes('404') || gMsg.includes('not found')) {
          geminiErrorCode = 'GEMINI_MODEL_NOT_AVAILABLE';
        } else {
          geminiErrorCode = 'GEMINI_API_ERROR';
        }
      }
    }
  }

  // 3. Regex Fallback
  if (rawCandidateRows.length === 0 && !openaiApiKey && !geminiApiKey) {
    providerUsed = 'regex';
    modelUsed = 'regex_pattern_matcher';
    const rawContent = fileBuffer.toString('utf8');
    const lines = rawContent.split(/\r?\n/);
    for (const line of lines) {
      const regMatch = line.match(/\b([0-9]{2}[A-Z]{1,4}[0-9]{3,4})\b/i);
      if (regMatch) {
        const candidate = normalizeRawStudentRow({
          regNo: regMatch[1].toUpperCase(),
          studentName: line.replace(regMatch[0], '').replace(/[^a-zA-Z\s.]/g, '').trim() || 'Extracted Student',
          signaturePresent: true,
        });
        if (candidate && isValidStudentRow(candidate)) {
          rawCandidateRows.push(candidate);
        }
      }
    }
  }

  // Attach sourceFile tag to candidate rows
  const taggedRows = rawCandidateRows.map(r => ({ ...r, sourceFile: originalName }));

  return {
    fileName: originalName,
    mimeType,
    fileSize: fileBuffer.length,
    success: taggedRows.length > 0,
    rows: taggedRows,
    providerUsed,
    modelUsed,
    aiHttpStatus,
    openAiErrorCode,
    geminiErrorCode,
    wasContaminated,
    rawAiResponseTextLength: rawAiResponseText.length,
  };
};

/**
 * Deduplicate student rows across files & merge attendance status
 */
const mergeExtractedStudents = (allRawRows = []) => {
  const mergedMap = new Map();

  for (const item of allRawRows) {
    const rawReg = (item.regNo || '').toString().trim().toUpperCase();
    const rawName = (item.studentName || '').toString().trim();
    const rawClass = (item.className || item.classSection || '').toString().trim();

    let uniqueKey = '';
    if (rawReg && rawReg.length >= 3) {
      uniqueKey = `REG:${rawReg}`;
    } else if (rawName) {
      uniqueKey = `NAME:${rawName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${rawClass.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    } else {
      continue;
    }

    const isPresent = item.status === 'P' || item.status === 'Present' || item.signaturePresent === true;

    if (!mergedMap.has(uniqueKey)) {
      mergedMap.set(uniqueKey, {
        regNo: item.regNo || '',
        studentName: item.studentName || '',
        className: item.className || item.classSection || '-',
        department: item.department || '-',
        status: isPresent ? 'P' : 'A',
        signaturePresent: isPresent,
        confidence: item.confidence || 0.9,
        isUncertain: item.isUncertain || false,
        uncertainFields: item.uncertainFields || [],
        sourceFiles: item.sourceFile ? [item.sourceFile] : [],
      });
    } else {
      const existing = mergedMap.get(uniqueKey);
      // Attendance Merge Rule: If marked Present in at least ONE valid sheet -> status = Present (P)
      if (isPresent) {
        existing.status = 'P';
        existing.signaturePresent = true;
      }
      if ((!existing.regNo || existing.regNo === '-') && item.regNo) existing.regNo = item.regNo;
      if ((!existing.className || existing.className === '-') && (item.className || item.classSection)) {
        existing.className = item.className || item.classSection;
      }
      if ((!existing.department || existing.department === '-') && item.department) {
        existing.department = item.department;
      }
      if (item.sourceFile && !existing.sourceFiles.includes(item.sourceFile)) {
        existing.sourceFiles.push(item.sourceFile);
      }
    }
  }

  return Array.from(mergedMap.values());
};

/**
 * Scan Hard Copy Physical Attendance Sheets (Single or Multiple Files) using Multimodal AI Vision API
 */
const scanHardCopyAttendance = async (req, res) => {
  const sessionId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const sheetType = req.body?.sheetType || 'signed';
    const eventId = req.body?.eventId || req.query?.eventId || null;

    // Collect all uploaded files (single or array under 'file' or 'files')
    let filesList = [];
    if (req.files) {
      if (Array.isArray(req.files)) {
        filesList = req.files;
      } else {
        if (req.files.files && Array.isArray(req.files.files)) {
          filesList = filesList.concat(req.files.files);
        }
        if (req.files.file && Array.isArray(req.files.file)) {
          filesList = filesList.concat(req.files.file);
        }
      }
    } else if (req.file) {
      filesList.push(req.file);
    } else if (req.body?.fileData) {
      const base64Data = req.body.fileData.replace(/^data:[^;]+;base64,/, '');
      filesList.push({
        buffer: Buffer.from(base64Data, 'base64'),
        mimetype: req.body.mimeType || 'image/jpeg',
        originalname: 'Uploaded_Document',
      });
    }

    console.log(`\n[${sessionId}] ═══════════════ NEW MULTI-SCAN ═══════════════`);
    console.log(`[${sessionId}] Total Files: ${filesList.length} | SheetType: ${sheetType} | EventID: ${eventId}`);

    if (!filesList || filesList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_FILE_PROVIDED',
        message: 'No document file provided for scanning.',
        debug: { fileReceived: false, mimeType: null, aiResponseReceived: false, studentsExtracted: 0 },
      });
    }

    let allRawCandidateRows = [];
    const fileResults = [];

    // Process each file separately
    for (let idx = 0; idx < filesList.length; idx++) {
      const fileObj = filesList[idx];
      console.log(`[${sessionId}] Processing sheet ${idx + 1} of ${filesList.length}: ${fileObj.originalname}`);

      const fileResult = await extractStudentsFromSingleFile(fileObj, sheetType, sessionId);
      fileResults.push({
        fileName: fileResult.fileName,
        status: fileResult.success ? 'success' : 'failed',
        extractedCount: fileResult.rows.length,
        error: fileResult.success ? null : fileResult.wasContaminated ? 'AI_RESPONSE_INVALID' : fileResult.openAiErrorCode || fileResult.geminiErrorCode || 'NO_STUDENT_ROWS_FOUND',
        providerUsed: fileResult.providerUsed,
        modelUsed: fileResult.modelUsed,
      });

      if (fileResult.success && fileResult.rows.length > 0) {
        allRawCandidateRows = allRawCandidateRows.concat(fileResult.rows);
      }
    }

    console.log(`[${sessionId}] Total Raw Extracted Rows across all ${filesList.length} files: ${allRawCandidateRows.length}`);

    // If 0 total rows extracted across all files, return failure summary
    if (allRawCandidateRows.length === 0) {
      return res.status(200).json({
        success: false,
        error: 'NO_STUDENT_ROWS_FOUND',
        message: 'The AI Vision engine could not find valid student rows in any of the uploaded attendance sheets.',
        summary: {
          totalFilesUploaded: filesList.length,
          successfulFilesCount: 0,
          failedFilesCount: filesList.length,
          totalRowsExtracted: 0,
          uniqueStudents: 0,
          duplicatesRemoved: 0,
          present: 0,
          absent: 0,
          fileResults,
        },
      });
    }

    // Combine & deduplicate student rows across all uploaded files
    const mergedStudents = mergeExtractedStudents(allRawCandidateRows);

    // Enrich matched student rows against master database roster
    const enrichedRows = await enrichExtractedStudents(mergedStudents, eventId);

    const finalRows = enrichedRows.map(r => ({
      ...r,
      status: sheetType === 'participant_list' ? 'P' : r.status,
    }));

    const sortedRows = sortAttendanceRecords(finalRows);
    const presentCount = sortedRows.filter(s => s.status === 'P').length;
    const absentCount = sortedRows.filter(s => s.status === 'A').length;
    const deptDist = {};
    sortedRows.forEach(s => { deptDist[s.department] = (deptDist[s.department] || 0) + 1; });

    const totalRawCount = allRawCandidateRows.length;
    const uniqueCount = sortedRows.length;
    const duplicatesRemoved = Math.max(0, totalRawCount - uniqueCount);

    console.log(`[${sessionId}] MULTI-SCAN COMPLETE: Files Uploaded: ${filesList.length} | Total Raw: ${totalRawCount} | Unique: ${uniqueCount} | Duplicates Removed: ${duplicatesRemoved} | Present: ${presentCount} | Absent: ${absentCount}`);

    return res.json({
      success: true,
      message: filesList.length > 1
        ? `Successfully processed ${filesList.length} attendance sheets and combined ${uniqueCount} unique student records.`
        : 'Hard copy attendance sheet scanned successfully using AI Vision',
      data: {
        sessionId,
        totalRowsDetected: sortedRows.length,
        extractedCount: sortedRows.length,
        presentCount,
        absentCount,
        deptDistribution: deptDist,
        sheetType,
        validationPassed: true,
        students: sortedRows,
      },
      summary: {
        totalFilesUploaded: filesList.length,
        successfulFilesCount: fileResults.filter(f => f.status === 'success').length,
        failedFilesCount: fileResults.filter(f => f.status === 'failed').length,
        totalRowsExtracted: totalRawCount,
        uniqueStudents: uniqueCount,
        duplicatesRemoved,
        present: presentCount,
        absent: absentCount,
        fileResults,
      },
    });

  } catch (error) {
    console.error(`[${sessionId}] Unhandled error:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to scan physical attendance sheet: ' + error.message,
    });
  }
};


module.exports = {
  getEventAttendance,
  saveEventAttendance,
  qrCheckIn,
  exportAttendance,
  importEventAttendanceRoster,
  scanHardCopyAttendance,
};


