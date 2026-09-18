const msGraphConfig = require("../config/msGraphConfig");
const oneDriveAuthService = require("./oneDriveAuthService");
const Event = require("../models/Event");

/**
 * Sanitize folder and file names for OneDrive (removes invalid characters: " * : < > ? / \ | # %)
 */
const sanitizeOneDriveName = (name, fallback = "Untitled") => {
  if (!name) return fallback;
  const cleaned = String(name)
    .replace(/[\\/:*?"<>|#%]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) || fallback;
};

/**
 * Normalize department to required OneDrive folder name
 */
const getDepartmentFolderName = (department) => {
  const dept = String(department || "").trim().toUpperCase();
  if (dept === "IT" || dept.includes("INFORMATION TECHNOLOGY")) {
    return "IT Events";
  }
  if (dept === "AIDS" || dept.includes("AI & DATA") || dept.includes("ARTIFICIAL INTELLIGENCE")) {
    return "AI & Data Science Events";
  }
  if (dept === "BOTH" || dept.includes("BOTH") || dept.includes("JOINT")) {
    return "Joint Events";
  }
  return dept ? `${dept} Events` : "IT Events";
};

/**
 * Determine academic year string (e.g. "2026-2027")
 */
const getAcademicYearString = (event) => {
  if (event.academicYear && /^\d{4}-\d{4}$/.test(event.academicYear.trim())) {
    return event.academicYear.trim();
  }

  const date = event.date ? new Date(event.date) : new Date();
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: 0 = Jan, 5 = June

  if (month >= 5) {
    // June to December
    return `${year}-${year + 1}`;
  }
  // January to May
  return `${year - 1}-${year}`;
};

/**
 * Determine semester string ("Odd Semester" or "Even Semester")
 */
const getSemesterString = (event) => {
  const rawSem = String(event.semester || "").trim().toLowerCase();

  if (["odd", "i", "1", "odd semester", "first"].includes(rawSem)) {
    return "Odd Semester";
  }
  if (["even", "ii", "2", "even semester", "second"].includes(rawSem)) {
    return "Even Semester";
  }

  // Fall back to event date
  const date = event.date ? new Date(event.date) : new Date();
  const month = date.getMonth(); // 5 = June, 10 = Nov
  // In Indian collegiate academic calendars: June-November is Odd Semester, Dec-May is Even Semester
  if (month >= 5 && month <= 10) {
    return "Odd Semester";
  }
  return "Even Semester";
};

/**
 * Helper to call Microsoft Graph API
 */
const graphRequest = async (urlPath, options = {}) => {
  const accessToken = await oneDriveAuthService.getAccessToken();
  const fullUrl = urlPath.startsWith("http") ? urlPath : `${msGraphConfig.graphApiEndpoint}${urlPath}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Graph API error (${response.status})`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.graphError = data?.error;
    throw err;
  }

  return data;
};

/**
 * Find or create a subfolder inside a parent folder in OneDrive
 */
const getOrCreateChildFolder = async (parentId, folderName) => {
  const safeName = sanitizeOneDriveName(folderName);

  // 1. Try to list existing children of parent and find match
  try {
    const childrenRes = await graphRequest(
      `/me/drive/items/${parentId}/children?$filter=name eq '${encodeURIComponent(safeName)}'&$select=id,name,folder`
    );
    if (childrenRes?.value && childrenRes.value.length > 0) {
      const match = childrenRes.value.find((item) => item.folder && item.name.toLowerCase() === safeName.toLowerCase());
      if (match) return match;
    }
  } catch (err) {
    // If filter fails, fall back to listing all children
    try {
      const allChildren = await graphRequest(`/me/drive/items/${parentId}/children?$select=id,name,folder`);
      if (allChildren?.value) {
        const match = allChildren.value.find((item) => item.folder && item.name.toLowerCase() === safeName.toLowerCase());
        if (match) return match;
      }
    } catch (e) {
      /* continue to creation */
    }
  }

  // 2. Folder does not exist, create it
  try {
    const newFolder = await graphRequest(`/me/drive/items/${parentId}/children`, {
      method: "POST",
      body: JSON.stringify({
        name: safeName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    });
    return newFolder;
  } catch (err) {
    // If conflict error (409), fetch again as it was just created concurrently
    if (err.status === 409 || err.graphError?.code === "nameAlreadyExists") {
      const allChildren = await graphRequest(`/me/drive/items/${parentId}/children?$select=id,name,folder`);
      const match = allChildren?.value?.find((item) => item.folder && item.name.toLowerCase() === safeName.toLowerCase());
      if (match) return match;
    }
    throw err;
  }
};

/**
 * Get or create root "Academic Event Hub" folder in OneDrive
 */
const getOrCreateAcademicEventHubFolder = async () => {
  const rootFolderName = msGraphConfig.rootFolderName || "Academic Event Hub";

  try {
    // Check if root exists under drive root
    const rootRes = await graphRequest(`/me/drive/root:/${encodeURIComponent(rootFolderName)}`);
    if (rootRes?.id) return rootRes;
  } catch (err) {
    if (err.status !== 404) {
      console.warn("[OneDriveFolder] Lookup root folder error:", err.message);
    }
  }

  // Create under root
  return await graphRequest("/me/drive/root/children", {
    method: "POST",
    body: JSON.stringify({
      name: rootFolderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });
};

/**
 * Get or create department folder under root
 */
const getOrCreateDepartmentFolder = async (deptFolderName) => {
  const hubFolder = await getOrCreateAcademicEventHubFolder();
  return await getOrCreateChildFolder(hubFolder.id, deptFolderName);
};

/**
 * Get or create academic year folder under department folder
 */
const getOrCreateAcademicYearFolder = async (deptFolderId, academicYear) => {
  return await getOrCreateChildFolder(deptFolderId, academicYear);
};

/**
 * Get or create semester folder under academic year folder
 */
const getOrCreateSemesterFolder = async (yearFolderId, semester) => {
  return await getOrCreateChildFolder(yearFolderId, semester);
};

/**
 * Automatically get or create the complete event folder hierarchy:
 * Academic Event Hub / <Dept Events> / <Academic Year> / <Semester> / <Event Name>
 * Prevents duplicate folders and caches folderId on the Event model.
 */
const getOrCreateEventFolder = async (event) => {
  if (!event) {
    throw new Error("Event is required to create or locate event folder");
  }

  // 1. If event already has cached oneDriveFolderId, check if it is still valid in OneDrive
  if (event.oneDriveFolderId) {
    try {
      const existing = await graphRequest(`/me/drive/items/${event.oneDriveFolderId}?$select=id,name,folder,webUrl`);
      if (existing?.id && existing.folder) {
        return {
          folderId: existing.id,
          folderName: existing.name,
          webUrl: existing.webUrl,
          folderPath: event.oneDriveFolderPath || `Academic Event Hub/.../${existing.name}`,
        };
      }
    } catch (err) {
      console.warn(`[OneDriveFolder] Cached folder ${event.oneDriveFolderId} not found, recreating hierarchy:`, err.message);
    }
  }

  // 2. Build and traverse the folder hierarchy
  const deptFolderName = getDepartmentFolderName(event.department);
  const academicYear = getAcademicYearString(event);
  const semester = getSemesterString(event);
  const eventFolderName = sanitizeOneDriveName(event.name || event.id || "Event");

  // Hub root folder
  const hubFolder = await getOrCreateAcademicEventHubFolder();

  // Department folder (e.g. IT Events)
  const deptFolder = await getOrCreateChildFolder(hubFolder.id, deptFolderName);

  // Academic Year folder (e.g. 2026-2027)
  const yearFolder = await getOrCreateChildFolder(deptFolder.id, academicYear);

  // Semester folder (e.g. Odd Semester)
  const semFolder = await getOrCreateChildFolder(yearFolder.id, semester);

  // Event folder (e.g. Guest Lecture on Generative AI)
  const eventFolder = await getOrCreateChildFolder(semFolder.id, eventFolderName);

  const folderPath = `${hubFolder.name}/${deptFolder.name}/${yearFolder.name}/${semFolder.name}/${eventFolder.name}`;

  // 3. Cache the folder ID & path on the Event document in MongoDB
  try {
    const eventQuery = event._id ? { _id: event._id } : { id: event.id };
    await Event.updateOne(eventQuery, {
      $set: {
        oneDriveFolderId: eventFolder.id,
        oneDriveFolderPath: folderPath,
        semester,
        academicYear,
      },
    });
  } catch (dbErr) {
    console.warn("[OneDriveFolder] Could not update event record with OneDrive folder ID:", dbErr.message);
  }

  return {
    folderId: eventFolder.id,
    folderName: eventFolder.name,
    webUrl: eventFolder.webUrl,
    folderPath,
  };
};

/**
 * Handle event updates safely (e.g. name, department, year, semester changed).
 * Renames or moves the existing OneDrive folder without creating duplicate folders.
 */
const syncEventFolder = async (event, oldEvent = {}) => {
  if (!event || !event.oneDriveFolderId) {
    return await getOrCreateEventFolder(event);
  }

  try {
    const currentFolder = await graphRequest(`/me/drive/items/${event.oneDriveFolderId}?$select=id,name,parentReference`);
    if (!currentFolder?.id) {
      return await getOrCreateEventFolder(event);
    }

    const newDeptFolderName = getDepartmentFolderName(event.department);
    const newAcademicYear = getAcademicYearString(event);
    const newSemester = getSemesterString(event);
    const newEventFolderName = sanitizeOneDriveName(event.name);

    const oldDeptFolderName = getDepartmentFolderName(oldEvent.department || event.department);
    const oldAcademicYear = getAcademicYearString(oldEvent.academicYear ? oldEvent : event);
    const oldSemester = getSemesterString(oldEvent.semester ? oldEvent : event);
    const oldEventFolderName = sanitizeOneDriveName(oldEvent.name || event.name);

    const hierarchyChanged =
      newDeptFolderName !== oldDeptFolderName || newAcademicYear !== oldAcademicYear || newSemester !== oldSemester;

    const nameChanged = newEventFolderName !== currentFolder.name;

    if (!hierarchyChanged && !nameChanged) {
      return { folderId: currentFolder.id, folderName: currentFolder.name };
    }

    const patchBody = {};

    if (nameChanged) {
      patchBody.name = newEventFolderName;
    }

    if (hierarchyChanged) {
      // Find or create the new target semester folder
      const hubFolder = await getOrCreateAcademicEventHubFolder();
      const deptFolder = await getOrCreateChildFolder(hubFolder.id, newDeptFolderName);
      const yearFolder = await getOrCreateChildFolder(deptFolder.id, newAcademicYear);
      const targetSemFolder = await getOrCreateChildFolder(yearFolder.id, newSemester);

      patchBody.parentReference = { id: targetSemFolder.id };
    }

    const updatedFolder = await graphRequest(`/me/drive/items/${event.oneDriveFolderId}`, {
      method: "PATCH",
      body: JSON.stringify(patchBody),
    });

    const newPath = `Academic Event Hub/${newDeptFolderName}/${newAcademicYear}/${newSemester}/${updatedFolder.name}`;
    const eventQuery = event._id ? { _id: event._id } : { id: event.id };
    await Event.updateOne(eventQuery, {
      $set: {
        oneDriveFolderPath: newPath,
        semester: newSemester,
        academicYear: newAcademicYear,
      },
    });

    console.log(`[OneDriveFolder] Successfully synced OneDrive folder to: ${newPath}`);
    return { folderId: updatedFolder.id, folderName: updatedFolder.name, folderPath: newPath };
  } catch (err) {
    console.error("[OneDriveFolder] syncEventFolder error:", err.message);
    return await getOrCreateEventFolder(event);
  }
};

/**
 * Delete event folder and all its contents in OneDrive
 */
const deleteEventFolder = async (event) => {
  if (!event || !event.oneDriveFolderId) return false;

  try {
    await graphRequest(`/me/drive/items/${event.oneDriveFolderId}`, {
      method: "DELETE",
    });
    console.log(`[OneDriveFolder] Deleted event folder ${event.oneDriveFolderId} from OneDrive`);
    return true;
  } catch (error) {
    if (error.status === 404) return true; // Already deleted
    console.warn(`[OneDriveFolder] Failed to delete event folder ${event.oneDriveFolderId}:`, error.message);
    return false;
  }
};

module.exports = {
  sanitizeOneDriveName,
  getDepartmentFolderName,
  getAcademicYearString,
  getSemesterString,
  getOrCreateAcademicEventHubFolder,
  getOrCreateDepartmentFolder,
  getOrCreateAcademicYearFolder,
  getOrCreateSemesterFolder,
  getOrCreateEventFolder,
  syncEventFolder,
  deleteEventFolder,
  graphRequest,
};
