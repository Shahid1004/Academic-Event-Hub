const oneDriveAuthService = require("../services/oneDriveAuthService");

/**
 * Initiate Microsoft OAuth 2.0 Login
 */
const startAuthLogin = async (req, res) => {
  try {
    const state = req.query.state || "aeh_oauth_state";
    const authUrl = oneDriveAuthService.getAuthUrl(state);

    if (req.query.format === "json") {
      return res.json({ success: true, authUrl });
    }

    return res.redirect(authUrl);
  } catch (error) {
    console.error("[OneDriveAuthController] Login initiation failed:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to start Microsoft authentication",
    });
  }
};

/**
 * Handle Microsoft OAuth 2.0 Callback
 */
const handleAuthCallback = async (req, res) => {
  try {
    const { code, error, error_description } = req.query;

    if (error) {
      console.error("[OneDriveAuthController] Callback received error from Microsoft:", error, error_description);
      return res.status(400).send(`
        <html>
          <body style="font-family: system-ui, -apple-system, sans-serif; padding: 40px; text-align: center; background: #fff5f5; color: #991b1b;">
            <h2>❌ Microsoft Authentication Failed</h2>
            <p>${error_description || error}</p>
            <p><a href="/" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #dc2626; color: white; text-decoration: none; border-radius: 8px;">Return to Application</a></p>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send(`
        <html>
          <body style="font-family: system-ui, -apple-system, sans-serif; padding: 40px; text-align: center;">
            <h2>Authorization code missing</h2>
            <p><a href="/">Return to Application</a></p>
          </body>
        </html>
      `);
    }

    const authRecord = await oneDriveAuthService.handleAuthCallback(code);

    // Render friendly success page and redirect back
    const accountDisplay = authRecord.accountEmail || authRecord.accountName || "Microsoft Account";

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Microsoft OneDrive Connected</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
            .card { background: white; padding: 36px 44px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); text-align: center; max-width: 460px; border: 1px solid #e2e8f0; }
            .badge { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; background: #ecfdf5; color: #059669; margin-bottom: 20px; font-size: 32px; }
            h2 { margin: 0 0 10px; font-size: 22px; font-weight: 700; color: #0f172a; }
            p { margin: 8px 0; color: #475569; font-size: 14px; line-height: 1.5; }
            .account { font-weight: 600; color: #2563eb; background: #eff6ff; padding: 6px 12px; border-radius: 8px; display: inline-block; margin: 12px 0 20px; }
            .btn { display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; transition: background 0.2s; }
            .btn:hover { background: #1d4ed8; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">✓</div>
            <h2>Microsoft OneDrive Connected</h2>
            <p>Academic Event Hub is now connected to OneDrive for:</p>
            <div class="account">${accountDisplay}</div>
            <p>All event documents, reports, and attendance files will automatically persist directly into this OneDrive account.</p>
            <div style="margin-top: 24px;">
              <a href="http://localhost:5173" class="btn">Return to Academic Event Hub</a>
            </div>
          </div>
          <script>
            // Attempt to close if opened in popup, otherwise redirect
            if (window.opener) {
              setTimeout(() => { window.close(); }, 2000);
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("[OneDriveAuthController] Callback processing error:", error.message);
    return res.status(500).send(`
      <html>
        <body style="font-family: system-ui, -apple-system, sans-serif; padding: 40px; text-align: center; background: #fff5f5; color: #991b1b;">
          <h2>❌ Connection Error</h2>
          <p>${error.message}</p>
          <p><a href="/api/onedrive/auth/login" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #dc2626; color: white; text-decoration: none; border-radius: 8px;">Try Again</a></p>
        </body>
      </html>
    `);
  }
};

/**
 * Get current OneDrive connection status
 */
const getStatus = async (req, res) => {
  try {
    const status = await oneDriveAuthService.getConnectionStatus();
    return res.json({ success: true, data: status });
  } catch (error) {
    console.error("[OneDriveAuthController] Status check failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to check OneDrive status" });
  }
};

/**
 * Disconnect OneDrive account
 */
const disconnect = async (req, res) => {
  try {
    await oneDriveAuthService.disconnect();
    return res.json({ success: true, message: "Microsoft OneDrive account disconnected successfully." });
  } catch (error) {
    console.error("[OneDriveAuthController] Disconnect failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to disconnect OneDrive" });
  }
};

module.exports = {
  startAuthLogin,
  handleAuthCallback,
  getStatus,
  disconnect,
};
