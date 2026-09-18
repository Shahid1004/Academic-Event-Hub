const msGraphConfig = require("../config/msGraphConfig");
const OneDriveAuth = require("../models/OneDriveAuth");

/**
 * Build Microsoft Entra OAuth 2.0 authorization URL
 */
const getAuthUrl = (state = "aeh_onedrive_auth") => {
  if (!msGraphConfig.clientId) {
    throw new Error("MICROSOFT_CLIENT_ID is not configured in environment variables");
  }

  const params = new URLSearchParams({
    client_id: msGraphConfig.clientId,
    response_type: "code",
    redirect_uri: msGraphConfig.redirectUri,
    response_mode: "query",
    scope: msGraphConfig.scopes.join(" "),
    state,
    prompt: "consent",
  });

  return `${msGraphConfig.authEndpoint}/${encodeURIComponent(msGraphConfig.tenantId)}/oauth2/v2.0/authorize?${params.toString()}`;
};

/**
 * Exchange authorization code for tokens, fetch account info, and persist in MongoDB
 */
const handleAuthCallback = async (code) => {
  if (!code) {
    throw new Error("Authorization code is required");
  }

  const tokenUrl = `${msGraphConfig.authEndpoint}/${encodeURIComponent(msGraphConfig.tenantId)}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: msGraphConfig.clientId,
    client_secret: msGraphConfig.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: msGraphConfig.redirectUri,
    scope: msGraphConfig.scopes.join(" "),
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenData = await response.json();

  if (!response.ok || tokenData.error) {
    const desc = tokenData.error_description || tokenData.error || "Token exchange failed";
    console.error("[OneDriveAuth] Token exchange failed:", desc);
    throw new Error(`Microsoft authentication failed: ${desc}`);
  }

  const { access_token, refresh_token, expires_in, scope } = tokenData;
  const expiresAt = new Date(Date.now() + (Number(expires_in || 3600) - 120) * 1000);

  // Fetch Microsoft account profile
  let accountEmail = "";
  let accountName = "";
  let driveId = "";

  try {
    const profileRes = await fetch(`${msGraphConfig.graphApiEndpoint}/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      accountEmail = profile.mail || profile.userPrincipalName || "";
      accountName = profile.displayName || "";
    }
  } catch (err) {
    console.warn("[OneDriveAuth] Failed to fetch user profile:", err.message);
  }

  try {
    const driveRes = await fetch(`${msGraphConfig.graphApiEndpoint}/me/drive`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (driveRes.ok) {
      const drive = await driveRes.json();
      driveId = drive.id || "";
    }
  } catch (err) {
    console.warn("[OneDriveAuth] Failed to fetch drive ID:", err.message);
  }

  // Persist tokens in MongoDB
  const authRecord = await OneDriveAuth.findOneAndUpdate(
    { key: "primary" },
    {
      accessToken: access_token,
      refreshToken: refresh_token || "",
      expiresAt,
      accountEmail,
      accountName,
      tenantId: msGraphConfig.tenantId,
      driveId,
      scope: scope || "",
      lastRefreshedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  console.log(`[OneDriveAuth] Successfully connected OneDrive for ${accountEmail || "authenticated user"}`);
  return authRecord;
};

/**
 * Refresh access token using stored refresh token
 */
const refreshAccessToken = async (authRecord) => {
  const refreshToken = authRecord?.refreshToken || process.env.MICROSOFT_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("No refresh token available. Please reconnect Microsoft OneDrive.");
  }

  const tokenUrl = `${msGraphConfig.authEndpoint}/${encodeURIComponent(msGraphConfig.tenantId)}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: msGraphConfig.clientId,
    client_secret: msGraphConfig.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: msGraphConfig.scopes.join(" "),
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenData = await response.json();

  if (!response.ok || tokenData.error) {
    const desc = tokenData.error_description || tokenData.error || "Silent refresh failed";
    console.error("[OneDriveAuth] Refresh token failed:", desc);
    throw new Error(`Microsoft token refresh failed: ${desc}`);
  }

  const { access_token, refresh_token: newRefreshToken, expires_in, scope } = tokenData;
  const expiresAt = new Date(Date.now() + (Number(expires_in || 3600) - 120) * 1000);

  authRecord.accessToken = access_token;
  if (newRefreshToken) {
    authRecord.refreshToken = newRefreshToken;
  }
  authRecord.expiresAt = expiresAt;
  if (scope) authRecord.scope = scope;
  authRecord.lastRefreshedAt = new Date();

  await authRecord.save();
  console.log("[OneDriveAuth] Access token refreshed silently and persisted in MongoDB.");
  return authRecord.accessToken;
};

/**
 * Get a valid access token. Automatically performs silent refresh if needed.
 */
const getAccessToken = async () => {
  let record = await OneDriveAuth.findOne({ key: "primary" });

  // If no record exists in MongoDB, attempt seeding from env if refresh token is provided
  if (!record && process.env.MICROSOFT_REFRESH_TOKEN && msGraphConfig.clientId && msGraphConfig.clientSecret) {
    console.log("[OneDriveAuth] Attempting initial token seed from MICROSOFT_REFRESH_TOKEN...");
    record = new OneDriveAuth({
      key: "primary",
      accessToken: "initial_placeholder",
      refreshToken: process.env.MICROSOFT_REFRESH_TOKEN,
      expiresAt: new Date(0), // Expired, so it triggers immediate refresh
    });
    await record.save();
  }

  if (!record || !record.refreshToken) {
    throw new Error(
      "Microsoft OneDrive is not connected. Please connect the Microsoft account via Settings or visit /api/onedrive/auth/login."
    );
  }

  // Check if token is expired or within 5 minutes of expiry
  const now = Date.now();
  const expiresTimestamp = record.expiresAt ? new Date(record.expiresAt).getTime() : 0;
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (now >= expiresTimestamp - bufferMs) {
    return await refreshAccessToken(record);
  }

  return record.accessToken;
};

/**
 * Get connection and health status
 */
const getConnectionStatus = async () => {
  try {
    const record = await OneDriveAuth.findOne({ key: "primary" }).lean();
    const isConfigured = Boolean(msGraphConfig.clientId && msGraphConfig.clientSecret);

    if (!record) {
      return {
        connected: false,
        configured: isConfigured,
        accountEmail: "",
        accountName: "",
        lastRefreshedAt: null,
        expiresAt: null,
      };
    }

    return {
      connected: Boolean(record.accessToken && record.refreshToken),
      configured: isConfigured,
      accountEmail: record.accountEmail || "",
      accountName: record.accountName || "",
      lastRefreshedAt: record.lastRefreshedAt || null,
      expiresAt: record.expiresAt || null,
      driveId: record.driveId || "",
    };
  } catch (error) {
    return {
      connected: false,
      configured: Boolean(msGraphConfig.clientId && msGraphConfig.clientSecret),
      error: error.message,
    };
  }
};

/**
 * Disconnect OneDrive account
 */
const disconnect = async () => {
  await OneDriveAuth.deleteOne({ key: "primary" });
  console.log("[OneDriveAuth] Disconnected OneDrive account.");
  return true;
};

module.exports = {
  getAuthUrl,
  handleAuthCallback,
  getAccessToken,
  getConnectionStatus,
  disconnect,
};
