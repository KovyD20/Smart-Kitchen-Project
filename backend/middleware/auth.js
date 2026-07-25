// Verifies the Firebase ID token in the Authorization: Bearer <token> header and
// attaches { uid, email } to req.user. Reusable for any protected route.

const { adminAuth, isConfigured } = require("../lib/firebaseAdmin");

async function requireAuth(req, res, next) {
  if (!isConfigured) {
    return res.status(503).json({ error: "Auth not configured on the server" });
  }

  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    req.user = { uid: decoded.uid, email: decoded.email || null };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
