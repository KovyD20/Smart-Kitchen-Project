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
