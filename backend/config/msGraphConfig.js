const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true
});

const msGraphConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID || "",
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
  tenantId: process.env.MICROSOFT_TENANT_ID || "common",
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || "http://localhost:5000/api/onedrive/auth/callback",
  graphApiEndpoint: process.env.MICROSOFT_GRAPH_API_URL || "https://graph.microsoft.com/v1.0",
  authEndpoint: process.env.MICROSOFT_AUTH_URL || "https://login.microsoftonline.com",
  scopes: ["offline_access", "User.Read", "Files.ReadWrite"],
  rootFolderName: "Academic Event Hub",
};

module.exports = msGraphConfig;
