require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const app = express();
const PORT = Number(process.env.PORT || 3000);

const aiRouter = require("./routes/ai");
const dbRouter = require("./routes/db");
const pantryRouter = require("./routes/pantry");

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Managed hosts (Render, Railway, Fly) terminate TLS at their own proxy, so the
// real client IP only arrives in X-Forwarded-For. Without this, req.ip is the
// proxy's address — which would collapse the rate limiter's IP fallback into a
// single bucket for every unauthenticated caller. Left off locally, where
// trusting the header would let a client spoof its own IP.
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use("/api/ai", aiRouter);
app.use("/api/db", dbRouter);
app.use("/api/pantry", pantryRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", instance: process.env.INSTANCE_NAME || "local" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
