const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDepartmentFolderName,
  getAcademicYearString,
  getSemesterString,
  sanitizeOneDriveName,
} = require("../services/oneDriveFolderService");

const { mapCategoryToType, sanitizeFilename } = require("../services/storageService");

test("oneDriveFolderService correctly maps department to folder name", () => {
  assert.equal(getDepartmentFolderName("IT"), "IT Events");
  assert.equal(getDepartmentFolderName("Information Technology"), "IT Events");
  assert.equal(getDepartmentFolderName("it"), "IT Events");
  assert.equal(getDepartmentFolderName("AIDS"), "AI & Data Science Events");
  assert.equal(getDepartmentFolderName("AI & Data Science"), "AI & Data Science Events");
  assert.equal(getDepartmentFolderName("BOTH"), "Joint Events");
  assert.equal(getDepartmentFolderName("Joint"), "Joint Events");
  assert.equal(getDepartmentFolderName("CSE"), "CSE Events");
});

test("oneDriveFolderService derives academic year accurately", () => {
  // Explicit academicYear
  assert.equal(getAcademicYearString({ academicYear: "2026-2027" }), "2026-2027");

  // Fallback to date in Autumn semester (e.g. September 2026)
  const sepDate = new Date(2026, 8, 15);
  assert.equal(getAcademicYearString({ date: sepDate }), "2026-2027");

  // Fallback to date in Spring semester (e.g. February 2027)
  const febDate = new Date(2027, 1, 20);
  assert.equal(getAcademicYearString({ date: febDate }), "2026-2027");
});

test("oneDriveFolderService derives semester accurately", () => {
  // Explicit semester string
  assert.equal(getSemesterString({ semester: "I" }), "Odd Semester");
  assert.equal(getSemesterString({ semester: "1" }), "Odd Semester");
  assert.equal(getSemesterString({ semester: "Odd" }), "Odd Semester");
  assert.equal(getSemesterString({ semester: "II" }), "Even Semester");
  assert.equal(getSemesterString({ semester: "2" }), "Even Semester");
  assert.equal(getSemesterString({ semester: "Even" }), "Even Semester");

  // Derived from date (June to November = Odd; Dec to May = Even)
  assert.equal(getSemesterString({ date: new Date(2026, 8, 10) }), "Odd Semester"); // September
  assert.equal(getSemesterString({ date: new Date(2027, 2, 10) }), "Even Semester"); // March
});

test("sanitizeOneDriveName strips illegal Windows & OneDrive characters", () => {
  const dirty = 'Tech/Symposium: "AI*Innovation" <2026> | Part? 1 #tag %pct';
  const clean = sanitizeOneDriveName(dirty);
  assert.equal(clean.includes("/"), false);
  assert.equal(clean.includes("\\"), false);
  assert.equal(clean.includes(":"), false);
  assert.equal(clean.includes("*"), false);
  assert.equal(clean.includes("?"), false);
  assert.equal(clean.includes('"'), false);
  assert.equal(clean.includes("<"), false);
  assert.equal(clean.includes(">"), false);
  assert.equal(clean.includes("|"), false);
  assert.equal(clean.includes("#"), false);
  assert.equal(clean.includes("%"), false);
});

test("storageService mapCategoryToType categorizes documents properly", () => {
  assert.equal(mapCategoryToType("Event Poster"), "poster");
  assert.equal(mapCategoryToType("Attendance Documents"), "attendance");
  assert.equal(mapCategoryToType("Student Feedback"), "feedback");
  assert.equal(mapCategoryToType("Event Photographs"), "photos");
  assert.equal(mapCategoryToType("Final Report"), "reports");
  assert.equal(mapCategoryToType("Permission Letter"), "documents");
});

test("storageService sanitizeFilename preserves extension and adds timestamp", () => {
  const result = sanitizeFilename("sample document.pdf");
  assert.equal(result.endsWith(".pdf"), true);
  assert.match(result, /^\d+_[a-f0-9]{6}_sample_document\.pdf$/);
});
