const test = require('node:test');
const assert = require('node:assert/strict');

const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const { saveEventAttendance, importEventAttendanceRoster } = require('../controllers/attendanceController');

test('saveEventAttendance updates summary and event metrics without crashing', async () => {
  const originalBulkWrite = Attendance.bulkWrite.bind(Attendance);
  const originalFind = Attendance.find.bind(Attendance);
  const originalUpdate = Event.findOneAndUpdate.bind(Event);

  try {
    Attendance.bulkWrite = async () => ({ ok: 1 });
    Attendance.find = () => ({
      lean: async () => [
        { eventId: 'evt-1', regNo: '22IT001', status: 'P' },
        { eventId: 'evt-1', regNo: '22IT002', status: 'A' },
        { eventId: 'evt-1', regNo: '22IT003', status: 'OD' },
      ],
    });
    Event.findOneAndUpdate = async (filter, update) => {
      assert.deepEqual(filter, {
        $or: [{ id: 'evt-1' }, { _id: null }],
      });
      assert.deepEqual(update.$set, {
        attendance: 67,
        actualParticipants: 2,
      });
      return { ok: 1 };
    };

    const req = {
      params: { eventId: 'evt-1' },
      body: {
        records: [
          { regNo: '22IT001', studentName: 'A', status: 'P' },
          { regNo: '22IT002', studentName: 'B', status: 'A' },
          { regNo: '22IT003', studentName: 'C', status: 'OD' },
        ],
      },
      user: { _id: 'user-1' },
    };

    const res = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return payload;
      },
    };

    const result = await saveEventAttendance(req, res);

    assert.equal(result.success, true);
    assert.equal(result.summary.total, 3);
    assert.equal(result.summary.present, 1);
    assert.equal(result.summary.absent, 1);
    assert.equal(result.summary.od, 1);
    assert.equal(result.summary.attendancePercentage, 67);
  } finally {
    Attendance.bulkWrite = originalBulkWrite;
    Attendance.find = originalFind;
    Event.findOneAndUpdate = originalUpdate;
  }
});

test('importEventAttendanceRoster succeeds without returning 404 even if Event document is not in DB', async () => {
  const originalFindOne = Event.findOne.bind(Event);
  const originalFindAttendance = Attendance.find.bind(Attendance);
  const originalFindOneAttendance = Attendance.findOne.bind(Attendance);
  const originalBulkWrite = Attendance.bulkWrite.bind(Attendance);
  const originalUpdate = Event.findOneAndUpdate.bind(Event);
  const originalDeleteMany = Attendance.deleteMany;
  const originalInsertMany = Attendance.insertMany;

  try {
    Event.findOne = () => ({ lean: async () => null });
    Attendance.findOne = async () => null;
    Attendance.bulkWrite = async () => ({ ok: 1 });
    Attendance.deleteMany = async () => ({ acknowledged: true, deletedCount: 0 });
    Attendance.insertMany = async () => ([{ eventId: 'EVT-1787914019401', regNo: '22IT001', studentName: 'Arun Kumar M', status: '' }]);
    Attendance.find = () => ({
      lean: async () => [
        { eventId: 'EVT-1787914019401', regNo: '22IT001', studentName: 'Arun Kumar M', status: '' },
      ],
    });
    Event.findOneAndUpdate = async () => ({ ok: 1 });

    const req = {
      params: { eventId: 'EVT-1787914019401' },
      body: {
        students: [
          { regNo: '22IT001', studentName: 'Arun Kumar M', department: 'IT', className: 'III IT A' }
        ],
      },
      user: { _id: 'user-1' },
    };

    const res = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return payload;
      },
    };

    const result = await importEventAttendanceRoster(req, res);

    assert.equal(result.success, true);
    assert.equal(result.data.importedCount, 1);
    assert.equal(result.data.records.length, 1);
  } finally {
    Event.findOne = originalFindOne;
    Attendance.find = originalFindAttendance;
    Attendance.findOne = originalFindOneAttendance;
    Attendance.bulkWrite = originalBulkWrite;
    Attendance.deleteMany = originalDeleteMany;
    Attendance.insertMany = originalInsertMany;
    Event.findOneAndUpdate = originalUpdate;
  }
});

test('importEventAttendanceRoster preserves exact Excel values and derives department from class when missing', async () => {
  const originalFindOne = Event.findOne.bind(Event);
  const originalFindAttendance = Attendance.find.bind(Attendance);
  const originalFindOneAttendance = Attendance.findOne.bind(Attendance);
  const originalUpdate = Event.findOneAndUpdate.bind(Event);
  const originalDeleteMany = Attendance.deleteMany;
  const originalInsertMany = Attendance.insertMany;

  let capturedInsertedDocs = [];

  try {
    Event.findOne = () => ({ lean: async () => null });
    Attendance.findOne = async () => null;
    Attendance.deleteMany = async () => ({ acknowledged: true, deletedCount: 0 });
    Attendance.insertMany = async (docs) => {
      capturedInsertedDocs = docs;
      return docs;
    };
    Attendance.find = () => ({
      lean: async () => [
        { eventId: 'EVT-TEST', regNo: '221t001', studentName: 'Arun Kumar M', className: 'III IT A', department: 'Information Technology', status: '' },
      ],
    });
    Event.findOneAndUpdate = async () => ({ ok: 1 });

    const req = {
      params: { eventId: 'EVT-TEST' },
      body: {
        students: [
          { 'Register Number': '221t001', 'Student Name': 'Arun Kumar M', Class: 'III IT A' },
        ],
      },
      user: { _id: 'user-1' },
    };

    const res = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return payload;
      },
    };

    const result = await importEventAttendanceRoster(req, res);

    assert.equal(result.success, true);
    assert.equal(result.data.importedCount, 1);
    assert.equal(capturedInsertedDocs.length, 1);
    assert.equal(capturedInsertedDocs[0].regNo, '221t001');
    assert.equal(capturedInsertedDocs[0].studentName, 'Arun Kumar M');
    assert.equal(capturedInsertedDocs[0].className, 'III IT A');
    // Department should be derived from class 'III IT A' → 'Information Technology'
    assert.equal(capturedInsertedDocs[0].department, 'Information Technology');
  } finally {
    Event.findOne = originalFindOne;
    Attendance.find = originalFindAttendance;
    Attendance.findOne = originalFindOneAttendance;
    Attendance.deleteMany = originalDeleteMany;
    Attendance.insertMany = originalInsertMany;
    Event.findOneAndUpdate = originalUpdate;
  }
});

