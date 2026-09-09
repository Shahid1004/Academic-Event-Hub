const mongoose = require("mongoose");
const Event = require("../models/Event");
const Attendance = require("../models/Attendance");
const Feedback = require("../models/Feedback");
const FeedbackForm = require("../models/FeedbackForm");
const EventDocument = require("../models/EventDocument");

const findEvent = async (eventId) => {
  const byPublicId = await Event.findOne({ id: eventId }).lean();
  if (byPublicId) return byPublicId;
  if (mongoose.Types.ObjectId.isValid(eventId)) return Event.findById(eventId).lean();
  return null;
};

/** Build a value only if it is non-null, non-empty, and not a placeholder */
const safeVal = (value) => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === "-" || s === "—") return null;
  return s;
};

/** Build prompt from event data — only include fields that actually exist */
const buildReportPrompt = (event, attendanceData, feedbackData, documents) => {
  const lines = [];

  lines.push("You are generating a professional, comprehensive academic event report.");
  lines.push("Institution: SONA COLLEGE OF TECHNOLOGY,SALEM");
  lines.push("Department: Department of Information Technology");
  lines.push("");
  lines.push("=== EVENT DATA ===");

  // Event overview — only include available fields
  if (safeVal(event.name)) lines.push(`Event Name: ${event.name}`);
  if (safeVal(event.type)) lines.push(`Event Type: ${event.type}`);
  if (safeVal(event.department)) lines.push(`Department: ${event.department}`);
  if (safeVal(event.date)) lines.push(`Date: ${event.date.toString().slice(0, 10)}`);
  if (safeVal(event.dateTo) && event.dateTo !== event.date) lines.push(`End Date: ${event.dateTo.toString().slice(0, 10)}`);
  if (safeVal(event.startTime) && safeVal(event.endTime)) lines.push(`Time: ${event.startTime} - ${event.endTime}`);
  else if (safeVal(event.startTime)) lines.push(`Start Time: ${event.startTime}`);
  if (safeVal(event.venue)) lines.push(`Venue: ${event.venue}`);
  if (safeVal(event.mode)) lines.push(`Mode: ${event.mode}`);
  if (safeVal(event.coordinator)) lines.push(`Coordinator: ${event.coordinator}`);
  if (safeVal(event.academicYear)) lines.push(`Academic Year: ${event.academicYear}`);
  if (safeVal(event.targetStudents)) lines.push(`Target Students: ${event.targetStudents}`);
  if (event.expectedParticipants > 0) lines.push(`Expected Participants: ${event.expectedParticipants}`);
  if (safeVal(event.sponsoredBy)) lines.push(`Sponsored By: ${event.sponsoredBy}`);

  // Resource person
  if (event.resourcePerson) {
    const rp = event.resourcePerson;
    const rpParts = [];
    if (safeVal(rp.name)) rpParts.push(`Name: ${rp.name}`);
    if (safeVal(rp.designation)) rpParts.push(`Designation: ${rp.designation}`);
    if (safeVal(rp.organization)) rpParts.push(`Organization: ${rp.organization}`);
    if (rpParts.length > 0) lines.push(`Resource Person: ${rpParts.join(", ")}`);
  }

  if (safeVal(event.objective)) lines.push(`Objective: ${event.objective}`);
  if (safeVal(event.description)) lines.push(`Description: ${event.description}`);

  // Additional coordinators
  if (Array.isArray(event.additionalCoordinators) && event.additionalCoordinators.length > 0) {
    lines.push(`Additional Coordinators: ${event.additionalCoordinators.join(", ")}`);
  }
  if (Array.isArray(event.assignedFaculty) && event.assignedFaculty.length > 0) {
    const names = event.assignedFaculty.map(f => typeof f === "string" ? f : f.name).filter(Boolean);
    if (names.length > 0) lines.push(`Faculty: ${names.join(", ")}`);
  }

  lines.push("");
  lines.push("=== ATTENDANCE DATA ===");

  // Attendance
  const { records, summary } = attendanceData;
  if (summary.total > 0) {
    lines.push(`Total Registered Students: ${summary.total}`);
    lines.push(`Present: ${summary.present}`);
    lines.push(`Absent: ${summary.absent}`);
    if (summary.od > 0) lines.push(`On-Duty (OD): ${summary.od}`);
    lines.push(`Attendance Percentage: ${summary.attendancePercentage}%`);

    // Department-wise breakdown
    const deptMap = {};
    for (const r of records) {
      const dept = r.department || "Unknown";
      if (!deptMap[dept]) deptMap[dept] = { P: 0, A: 0, OD: 0, total: 0 };
      deptMap[dept].total += 1;
      if (r.status === "P") deptMap[dept].P += 1;
      else if (r.status === "A") deptMap[dept].A += 1;
      else if (r.status === "OD") deptMap[dept].OD += 1;
    }
    const deptKeys = Object.keys(deptMap).filter(k => k !== "Unknown" && k !== "-");
    if (deptKeys.length > 1) {
      lines.push("Department-wise Attendance:");
      for (const dept of deptKeys) {
        const d = deptMap[dept];
        lines.push(`  ${dept}: ${d.P} present, ${d.A} absent${d.OD > 0 ? `, ${d.OD} OD` : ""} (total: ${d.total})`);
      }
    }
  } else {
    lines.push("Attendance records: Not available");
  }

  lines.push("");
  lines.push("=== FEEDBACK DATA (ANALYZE THIS MOST DEEPLY) ===");

  // Feedback
  const { analytics, rawRecords, formQuestions } = feedbackData;
  if (analytics && analytics.totalResponses > 0) {
    lines.push(`Total Feedback Responses: ${analytics.totalResponses}`);
    if (analytics.totalStudents > 0) {
      lines.push(`Eligible Students: ${analytics.totalStudents}`);
      lines.push(`Submission Rate: ${analytics.submissionPercentage}%`);
    }
    if (analytics.averageRating !== null && analytics.averageRating !== undefined) {
      lines.push(`Overall Average Rating: ${analytics.averageRating.toFixed(2)}/5`);
    }

    // Rating distribution
    if (analytics.ratingDistribution) {
      const dist = analytics.ratingDistribution;
      lines.push(`Rating Distribution: 5★=${dist[5] || dist["5"] || 0}, 4★=${dist[4] || dist["4"] || 0}, 3★=${dist[3] || dist["3"] || 0}, 2★=${dist[2] || dist["2"] || 0}, 1★=${dist[1] || dist["1"] || 0}`);
    }

    // Question-wise analysis
    if (Array.isArray(analytics.questionAnalysis) && analytics.questionAnalysis.length > 0) {
      lines.push("Question-wise Analysis:");
      for (const q of analytics.questionAnalysis) {
        if (q.type === "rating" && q.average !== null && q.average !== undefined) {
          lines.push(`  - "${q.text}": ${q.average.toFixed(2)}/5`);
          if (q.distribution) {
            const distStr = Object.entries(q.distribution).map(([k, v]) => `${k}★:${v}`).join(", ");
            lines.push(`    Distribution: ${distStr}`);
          }
        } else if (q.type === "text" && Array.isArray(q.comments) && q.comments.length > 0) {
          lines.push(`  - "${q.text}" (text responses: ${q.comments.length}):`);
          q.comments.slice(0, 10).forEach(c => lines.push(`    • ${c.answer}`));
        } else if (q.distribution) {
          const distStr = Object.entries(q.distribution).map(([k, v]) => `${k}:${v}`).join(", ");
          lines.push(`  - "${q.text}": ${distStr}`);
        }
      }
    }

    // Student text comments
    const allComments = [];
    if (Array.isArray(analytics.comments) && analytics.comments.length > 0) {
      for (const c of analytics.comments) {
        if (c.answer && c.answer.trim()) allComments.push(c.answer.trim());
      }
    }
    // Also look at raw records for comment fields
    if (Array.isArray(rawRecords)) {
      for (const r of rawRecords) {
        const comment = r.comment || r.comments || r.response || r.feedback;
        if (typeof comment === "string" && comment.trim() && !allComments.includes(comment.trim())) {
          allComments.push(comment.trim());
        }
      }
    }
    if (allComments.length > 0) {
      lines.push(`Student Comments (${allComments.length} total):`);
      allComments.slice(0, 15).forEach((c, i) => lines.push(`  ${i + 1}. ${c}`));
    }
  } else {
    lines.push("No feedback responses recorded for this event.");
  }

  // Documents
  if (documents && documents.length > 0) {
    lines.push("");
    lines.push("=== UPLOADED DOCUMENTS ===");
    lines.push("The following documents have been uploaded for this event:");
    for (const doc of documents) {
      lines.push(`  - ${doc.documentName || doc.name} (Category: ${doc.documentType || doc.category || "Document"})`);
    }
    lines.push("These documents provide supporting evidence for this event.");
  }

  lines.push("");
  lines.push("=== REPORT GENERATION INSTRUCTIONS ===");
  lines.push("Generate a professional, detailed academic event report. Return ONLY valid JSON.");
  lines.push("Structure the response as follows:");
  lines.push(`{
  "eventOverview": "Professional paragraph describing the event using available data",
  "eventObjectives": "Event objectives and description (if available, otherwise omit this key)",
  "resourcePerson": "Resource person details paragraph (if available, otherwise omit this key)",
  "attendanceAnalysis": {
    "summary": "Professional paragraph summarizing attendance",
    "statistics": "Detailed attendance statistics as text",
    "classwise": "Class/department-wise breakdown (if data available)"
  },
  "feedbackAnalysis": {
    "overview": "Professional overview of feedback quality and quantity",
    "ratingsSummary": "Detailed analysis of ratings per question",
    "positiveObservations": ["list of positive themes identified from feedback"],
    "negativeObservations": ["list of negative themes or concerns"],
    "commonThemes": ["recurring themes identified from student comments"],
    "studentSentiment": "Overall sentiment analysis paragraph",
    "suggestions": ["actionable suggestions from students"]
  },
  "eventStrengths": ["list of 3-5 specific strengths based on evidence"],
  "areasForImprovement": ["list of 3-5 specific improvement areas based on evidence"],
  "recommendations": ["list of 3-5 actionable recommendations for future events"],
  "supportingDocuments": "Brief mention of documents available (if any, otherwise omit this key)",
  "overallAssessment": "Concise, professional conclusion paragraph"
}`);
  lines.push("");
  lines.push("CRITICAL RULES:");
  lines.push("1. NEVER use 'Not Available', 'N/A', 'Unknown', 'No Data', or similar placeholders.");
  lines.push("2. If a section has no data, OMIT that key from the JSON entirely.");
  lines.push("3. Be specific and evidence-based — cite actual numbers from the data.");
  lines.push("4. The feedbackAnalysis section must be the MOST DETAILED section.");
  lines.push("5. Analyze student comments for themes: speaker quality, content relevance, organization, time management, venue/facilities, interaction, technical arrangements, student engagement.");
  lines.push("6. If feedback is missing, omit the feedbackAnalysis key completely.");
  lines.push("7. Return ONLY valid JSON — no markdown, no explanations outside the JSON.");

  return lines.join("\n");
};

/** Build client-side analysis as fallback when AI fails */
const buildFallbackReport = (event, attendanceData, feedbackData, documents) => {
  const { summary, records } = attendanceData;
  const { analytics, rawRecords } = feedbackData;

  const hasAttendance = summary.total > 0;
  const hasFeedback = analytics && analytics.totalResponses > 0;

  const eventOverviewParts = [];
  if (event.type && event.name) eventOverviewParts.push(`A ${event.type} titled "${event.name}" was organized`);
  if (event.department) eventOverviewParts.push(`by the ${event.department} department`);
  if (event.date) eventOverviewParts.push(`on ${String(event.date).slice(0, 10)}`);
  if (event.venue) eventOverviewParts.push(`at ${event.venue}`);
  if (event.mode) eventOverviewParts.push(`in ${event.mode} mode`);

  const result = {};

  if (eventOverviewParts.length > 0) {
    result.eventOverview = eventOverviewParts.join(" ") + ".";
  }

  if (event.objective || event.description) {
    result.eventObjectives = [event.objective, event.description].filter(Boolean).join(" ");
  }

  if (event.resourcePerson && event.resourcePerson.name) {
    const rp = event.resourcePerson;
    const parts = [rp.name];
    if (rp.designation) parts.push(rp.designation);
    if (rp.organization) parts.push(rp.organization);
    result.resourcePerson = parts.join(", ");
  }

  if (hasAttendance) {
    const pct = summary.attendancePercentage;
    result.attendanceAnalysis = {
      summary: `The event recorded a total of ${summary.total} registered students with ${summary.present} present${summary.od > 0 ? ` and ${summary.od} on-duty` : ""}, giving an attendance rate of ${pct}%.`,
      statistics: `Total: ${summary.total} | Present: ${summary.present} | Absent: ${summary.absent}${summary.od > 0 ? ` | On-Duty: ${summary.od}` : ""} | Attendance: ${pct}%`,
    };
  }

  if (hasFeedback) {
    const positives = [];
    const negatives = [];
    const themes = [];
    const suggestions = [];

    if (analytics.averageRating >= 4) positives.push("High overall satisfaction with an average rating above 4/5");
    else if (analytics.averageRating >= 3) themes.push("Moderate overall satisfaction among participants");
    else negatives.push("Overall satisfaction ratings indicate room for significant improvement");

    if (analytics.submissionPercentage > 70) positives.push("Strong feedback participation rate");
    else if (analytics.submissionPercentage < 50) suggestions.push("Improve feedback form promotion to increase response rates");

    const allComments = [];
    if (Array.isArray(analytics.comments)) {
      for (const c of analytics.comments) {
        if (c.answer && c.answer.trim()) allComments.push(c.answer.trim());
      }
    }
    if (Array.isArray(rawRecords)) {
      for (const r of rawRecords) {
        const comment = r.comment || r.comments || r.response;
        if (typeof comment === "string" && comment.trim()) allComments.push(comment.trim());
      }
    }

    result.feedbackAnalysis = {
      overview: `Feedback was collected from ${analytics.totalResponses} student(s)${analytics.averageRating !== null ? ` with an average rating of ${analytics.averageRating.toFixed(2)}/5` : ""}.`,
      ratingsSummary: analytics.averageRating !== null ? `Average overall rating: ${analytics.averageRating.toFixed(2)}/5. Submission rate: ${analytics.submissionPercentage}%.` : `Submission rate: ${analytics.submissionPercentage}%.`,
      positiveObservations: positives.length > 0 ? positives : undefined,
      negativeObservations: negatives.length > 0 ? negatives : undefined,
      commonThemes: themes.length > 0 ? themes : undefined,
      studentSentiment: analytics.averageRating >= 4 ? "Students expressed a generally positive experience with the event." : analytics.averageRating >= 3 ? "Students expressed a moderately positive experience overall." : "Student feedback indicates areas requiring significant attention.",
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };

    // Remove undefined keys
    Object.keys(result.feedbackAnalysis).forEach(k => {
      if (result.feedbackAnalysis[k] === undefined) delete result.feedbackAnalysis[k];
    });
  }

  const strengths = [];
  if (event.objective) strengths.push("Event had a clearly documented objective");
  if (hasAttendance && summary.attendancePercentage >= 75) strengths.push(`Strong attendance rate of ${summary.attendancePercentage}%`);
  if (hasFeedback && analytics.averageRating >= 4) strengths.push("High student satisfaction reflected in feedback");
  if (documents && documents.length > 0) strengths.push("Comprehensive documentation maintained");
  if (event.resourcePerson && event.resourcePerson.name) strengths.push("Experienced resource person facilitated the event");
  result.eventStrengths = strengths.length > 0 ? strengths : ["Event was successfully organized and conducted"];

  const improvements = [];
  if (hasAttendance && summary.attendancePercentage < 75) improvements.push(`Attendance rate of ${summary.attendancePercentage}% could be improved`);
  if (!hasFeedback) improvements.push("Implement feedback collection for future events");
  if (hasFeedback && analytics.submissionPercentage < 60) improvements.push("Increase feedback form completion rates");
  if (!event.objective) improvements.push("Document event objectives for future events");
  result.areasForImprovement = improvements.length > 0 ? improvements : ["Continue maintaining current standards for future events"];

  result.recommendations = [
    "Document all event details promptly after each event",
    "Collect structured feedback from all participants",
    "Use attendance and feedback data to improve future events",
  ];

  result.overallAssessment = `The ${event.type || "event"} "${event.name}" was successfully conducted${event.date ? ` on ${String(event.date).slice(0, 10)}` : ""}${hasAttendance ? ` with ${summary.total} registered students and ${summary.attendancePercentage}% attendance` : ""}.${hasFeedback ? ` Student feedback averaged ${analytics.averageRating !== null ? `${analytics.averageRating.toFixed(2)}/5` : "collected"} from ${analytics.totalResponses} responses.` : ""} The event contributed positively to the academic enrichment of participating students.`;

  return result;
};

const generateAIReport = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }

    // 1. Fetch Event
    let event = await findEvent(eventId);
    if (!event) {
      if (req.body && req.body.event && typeof req.body.event === 'object') {
        event = req.body.event;
      } else {
        event = {
          id: eventId,
          name: `Academic Event (${eventId})`,
          type: "Symposium",
          department: "Information Technology",
          date: new Date().toISOString().slice(0, 10),
          coordinator: "Faculty Coordinator",
        };
      }
    }

    // 2. Fetch Attendance
    let attendanceRecords = await Attendance.find({ eventId }).lean();
    const total = attendanceRecords.length;
    const present = attendanceRecords.filter(r => r.status === "P").length;
    const absent = attendanceRecords.filter(r => r.status === "A").length;
    const od = attendanceRecords.filter(r => r.status === "OD").length;
    const attendancePercentage = total > 0 ? Math.round(((present + od) / total) * 100) : 0;
    const attendanceData = {
      records: attendanceRecords,
      summary: { total, present, absent, od, attendancePercentage },
    };

    // 3. Fetch Feedback
    const resolvedEventId = event.id || eventId;
    const feedbackForm = await FeedbackForm.findOne({ eventId: resolvedEventId }).lean();
    let rawRecords = [];
    let analyticsData = null;

    if (feedbackForm) {
      rawRecords = await Feedback.find({ eventId: resolvedEventId, feedbackFormId: feedbackForm._id }).lean();
      if (rawRecords.length === 0) {
        rawRecords = await Feedback.find({ $or: [{ eventId: resolvedEventId }, { event: resolvedEventId }] }).lean();
      }
    } else {
      rawRecords = await Feedback.find({ $or: [{ eventId: resolvedEventId }, { event: resolvedEventId }] }).lean();
    }

    if (rawRecords.length > 0) {
      const questionAnalysis = feedbackForm ? (feedbackForm.questions || []).map(q => {
        const values = rawRecords.map(r => r.answers?.[q.id]).filter(v => v !== undefined && v !== null && v !== "");
        if (q.type === "rating") {
          const numbers = values.map(Number).filter(Number.isFinite);
          return {
            id: q.id, text: q.text, type: q.type,
            average: numbers.length ? numbers.reduce((s, v) => s + v, 0) / numbers.length : null,
            distribution: Object.fromEntries([1, 2, 3, 4, 5].map(v => [v, numbers.filter(n => n === v).length])),
          };
        }
        if (q.type === "text") {
          return { id: q.id, text: q.text, type: q.type, comments: values.map(a => ({ question: q.text, answer: String(a) })) };
        }
        return { id: q.id, text: q.text, type: q.type, distribution: Object.fromEntries((q.options || ["Yes", "No"]).map(opt => [opt, values.filter(v => String(v) === opt).length])) };
      }) : [];

      const ratingValues = questionAnalysis.flatMap(q => q.type === "rating" && q.average !== null ? rawRecords.map(r => Number(r.answers?.[q.id])).filter(Number.isFinite) : []);
      const ratingDistribution = Object.fromEntries([1, 2, 3, 4, 5].map(v => [v, ratingValues.filter(n => n === v).length]));
      const averageRating = ratingValues.length ? ratingValues.reduce((s, v) => s + v, 0) / ratingValues.length : null;

      const attendanceCount = await Attendance.countDocuments({ eventId: resolvedEventId });
      const submittedStudents = rawRecords.length;
      const submissionPercentage = attendanceCount > 0 ? Math.round((submittedStudents / attendanceCount) * 100) : 0;

      analyticsData = {
        totalResponses: rawRecords.length,
        totalStudents: attendanceCount,
        submittedStudents,
        submissionPercentage,
        averageRating,
        ratingDistribution,
        questionAnalysis,
        comments: questionAnalysis.flatMap(q => q.type === "text" ? q.comments : []),
      };
    }

    const feedbackData = { analytics: analyticsData, rawRecords, formQuestions: feedbackForm?.questions || [] };

    // 4. Fetch Documents
    let documents = [];
    try {
      documents = await EventDocument.find({ eventId: resolvedEventId }).lean();
    } catch (e) {
      documents = [];
    }

    // 5. Build the AI prompt
    const prompt = buildReportPrompt(event, attendanceData, feedbackData, documents);

    // 6. Call Gemini API
    let reportContent = null;
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

    if (geminiApiKey) {
      try {
        const { GoogleGenAI } = require("@google/genai");
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

        let aiResponse = null;
        for (const model of GEMINI_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
              config: { temperature: 0.3, maxOutputTokens: 4096 },
            });
            aiResponse = response?.candidates?.[0]?.content?.parts?.[0]?.text || response?.text || null;
            if (aiResponse) break;
          } catch (modelErr) {
            console.warn(`[AI Report] Model ${model} failed:`, modelErr.message);
          }
        }

        if (aiResponse) {
          // Parse JSON from response
          let cleaned = aiResponse.replace(/```json\n?/gi, "").replace(/```\n?/gi, "").trim();
          const firstBrace = cleaned.indexOf("{");
          const lastBrace = cleaned.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
          }
          try {
            reportContent = JSON.parse(cleaned);
          } catch (parseErr) {
            console.warn("[AI Report] JSON parse failed, using fallback:", parseErr.message);
          }
        }
      } catch (aiErr) {
        console.error("[AI Report] Gemini API error:", aiErr.message);
      }
    }

    // 7. Fallback if AI failed
    if (!reportContent) {
      console.log("[AI Report] Using client-side fallback analysis");
      reportContent = buildFallbackReport(event, attendanceData, feedbackData, documents);
    }

    // 8. Return structured response
    return res.json({
      success: true,
      data: {
        reportContent,
        eventSnapshot: {
          name: event.name,
          type: event.type,
          department: event.department,
          date: event.date ? String(event.date).slice(0, 10) : null,
          dateTo: event.dateTo ? String(event.dateTo).slice(0, 10) : null,
          startTime: event.startTime || null,
          endTime: event.endTime || null,
          venue: event.venue || null,
          mode: event.mode || null,
          coordinator: event.coordinator || null,
          academicYear: event.academicYear || null,
          objective: event.objective || null,
          description: event.description || null,
          resourcePerson: event.resourcePerson || null,
          targetStudents: event.targetStudents || null,
          expectedParticipants: event.expectedParticipants || null,
          sponsoredBy: event.sponsoredBy || null,
        },
        attendanceSummary: attendanceData.summary,
        feedbackSummary: analyticsData ? {
          totalResponses: analyticsData.totalResponses,
          averageRating: analyticsData.averageRating,
          submissionPercentage: analyticsData.submissionPercentage,
          ratingDistribution: analyticsData.ratingDistribution,
        } : null,
        documentCount: documents.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[generateAIReport] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate AI report. Please try again." });
  }
};

module.exports = { generateAIReport };
