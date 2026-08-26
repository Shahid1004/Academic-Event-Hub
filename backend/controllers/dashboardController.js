const Event = require("../models/Event");

const eventTypes = [
  "Hackathon", "Vervathon", "Guest Lecture", "Workshop", "Webinar",
  "Seminar", "Symposium", "FDP", "Training Event", "Conference", "Joint Event", "Other"
];

const buildDepartmentFilter = (department) => {
  if (!department || department === "ALL") return {};
  if (!["IT", "AIDS", "BOTH"].includes(department)) return null;
  return { department };
};

const dashboardSummary = async (req, res) => {
  try {
    const requestedDepartment = req.query.department?.toString().toUpperCase();
    const scopedDepartment = req.user.role === "hod"
      ? req.user.department?.toString().toUpperCase()
      : requestedDepartment;
    const departmentFilter = buildDepartmentFilter(scopedDepartment);

    if (!departmentFilter) {
      return res.status(400).json({ success: false, message: "Invalid department" });
    }

    const match = { ...departmentFilter };
    if (req.query.academicYear) match.academicYear = req.query.academicYear.toString();
    const today = new Date();

    const [result] = await Event.aggregate([
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalEvents: { $sum: 1 },
                completedEvents: {
                  $sum: { $cond: [{ $eq: [{ $toLower: { $ifNull: ["$status", ""] } }, "completed"] }, 1, 0] }
                },
                pendingDocumentation: {
                  $sum: { $cond: [{ $in: [{ $toLower: { $ifNull: ["$docStatus", ""] } }, ["pending", "partial"]] }, 1, 0] }
                },
                upcomingEvents: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ["$date", today] },
                          { $not: [{ $in: [{ $toLower: { $ifNull: ["$status", ""] } }, ["cancelled", "completed"]] }] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                },
                totalParticipants: { $sum: { $ifNull: ["$actualParticipants", 0] } },
                attendanceTotal: {
                  $sum: { $cond: [{ $gt: [{ $ifNull: ["$attendance", 0] }, 0] }, "$attendance", 0] }
                },
                attendanceCount: {
                  $sum: { $cond: [{ $gt: [{ $ifNull: ["$attendance", 0] }, 0] }, 1, 0] }
                },
                feedbackTotal: {
                  $sum: { $cond: [{ $gt: [{ $ifNull: ["$feedbackScore", 0] }, 0] }, "$feedbackScore", 0] }
                },
                feedbackCount: {
                  $sum: { $cond: [{ $gt: [{ $ifNull: ["$feedbackScore", 0] }, 0] }, 1, 0] }
                }
              }
            }
          ],
          byType: [
            { $group: { _id: "$type", count: { $sum: 1 } } },
            { $project: { _id: 0, type: "$_id", count: 1 } }
          ],
          recentEvents: [
            { $sort: { date: -1, createdAt: -1 } },
            { $limit: 6 },
            {
              $project: {
                _id: 0,
                eventId: { $ifNull: ["$id", { $toString: "$_id" }] },
                eventName: "$name",
                type: 1,
                department: 1,
                date: 1,
                coordinator: 1,
                participants: { $ifNull: ["$actualParticipants", 0] },
                attendance: { $ifNull: ["$attendance", 0] },
                status: 1
              }
            }
          ],
          academicYears: [
            { $match: { academicYear: { $exists: true, $nin: [null, ""] } } },
            { $group: { _id: "$academicYear" } },
            { $sort: { _id: -1 } },
            { $project: { _id: 0, academicYear: "$_id" } }
          ]
        }
      }
    ]);

    const values = result.summary[0] || {};
    const eventsByType = new Map(result.byType.map(item => [item.type, item.count]));
    const average = (total, count) => count ? Math.round((total / count) * 10) / 10 : 0;

    return res.json({
      success: true,
      data: {
        totalEvents: values.totalEvents || 0,
        completedEvents: values.completedEvents || 0,
        pendingDocumentation: values.pendingDocumentation || 0,
        upcomingEvents: values.upcomingEvents || 0,
        totalParticipants: values.totalParticipants || 0,
        averageAttendance: average(values.attendanceTotal || 0, values.attendanceCount || 0),
        averageFeedback: average(values.feedbackTotal || 0, values.feedbackCount || 0),
        eventsByType: eventTypes.map(type => ({ type, count: eventsByType.get(type) || 0 })),
        recentEvents: result.recentEvents,
        academicYears: result.academicYears.map(item => item.academicYear)
      }
    });
  } catch (error) {
    console.error("Dashboard summary failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load dashboard data" });
  }
};

module.exports = { dashboardSummary };
